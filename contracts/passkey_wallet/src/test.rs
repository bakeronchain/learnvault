#![cfg(test)]

extern crate std;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use p256::ecdsa::signature::hazmat::PrehashSigner;
use p256::ecdsa::{Signature, SigningKey};
use soroban_sdk::{Address, Bytes, BytesN, Env, Vec};

use crate::{PasskeyAssertion, PasskeyWallet, PasskeyWalletClient, WalletError};

// ===========================================================================
// Test fixtures
// ===========================================================================

fn setup() -> (Env, Address) {
    let env = Env::default();
    let contract_id = env.register(PasskeyWallet, ());
    (env, contract_id)
}

fn client<'a>(env: &'a Env, contract_id: &'a Address) -> PasskeyWalletClient<'a> {
    PasskeyWalletClient::new(env, contract_id)
}

fn mock_credential_id(env: &Env, byte: u8) -> Bytes {
    Bytes::from_array(env, &[byte; 16])
}

/// Deterministic P-256 keypair from a fixed scalar so tests are reproducible.
fn signing_keypair(env: &Env, seed: u8) -> (SigningKey, BytesN<65>) {
    let scalar = [seed; 32];
    let signing_key = SigningKey::from_slice(&scalar).expect("valid P-256 scalar");
    let encoded = signing_key.verifying_key().to_encoded_point(false);
    let pk_bytes: [u8; 65] = encoded.as_bytes().try_into().expect("65-byte SEC1 point");
    (signing_key, BytesN::from_array(env, &pk_bytes))
}

/// Build a real, correctly-signed WebAuthn assertion for `signature_payload`,
/// mirroring exactly what a browser + the contract would each independently
/// produce: `authenticatorData` with the UP flag set, a `clientDataJSON` with
/// the challenge base64url-encoded, and a secp256r1 signature over
/// `sha256(authenticatorData || sha256(clientDataJSON))`.
fn valid_assertion(
    env: &Env,
    signing_key: &SigningKey,
    credential_id: &Bytes,
    signature_payload: &BytesN<32>,
) -> PasskeyAssertion {
    let mut auth_data = [0u8; 37];
    auth_data[32] = 0x01; // User Present flag
    let authenticator_data = Bytes::from_array(env, &auth_data);

    let challenge_b64 = URL_SAFE_NO_PAD.encode(signature_payload.to_array());
    let client_data_json_str = std::format!(
        "{{\"type\":\"webauthn.get\",\"challenge\":\"{challenge_b64}\",\"origin\":\"https://learnvault.app\"}}"
    );
    let client_data_json = Bytes::from_slice(env, client_data_json_str.as_bytes());

    let client_data_hash = env.crypto().sha256(&client_data_json);
    let mut signed_data = Bytes::new(env);
    signed_data.append(&authenticator_data);
    signed_data.append(&client_data_hash.into());
    let msg = env.crypto().sha256(&signed_data);

    let sig: Signature = signing_key
        .sign_prehash(&msg.to_array())
        .expect("secp256r1 sign_prehash");
    let sig = sig.normalize_s().unwrap_or(sig);
    let sig_bytes: [u8; 64] = sig.to_bytes().into();

    PasskeyAssertion {
        authenticator_data,
        client_data_json,
        signature: BytesN::from_array(env, &sig_bytes),
        credential_id: credential_id.clone(),
    }
}

fn check_auth(
    env: &Env,
    contract_id: &Address,
    signature_payload: &BytesN<32>,
    assertion: &PasskeyAssertion,
) -> Result<(), Result<WalletError, soroban_sdk::InvokeError>> {
    use soroban_sdk::IntoVal;
    env.try_invoke_contract_check_auth::<WalletError>(
        contract_id,
        signature_payload,
        assertion.into_val(env),
        &Vec::new(env),
    )
}

// ===========================================================================
// Initialization
// ===========================================================================

#[test]
fn test_initialize_registers_first_signer() {
    let (env, contract_id) = setup();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (_, pk) = signing_keypair(&env, 0x11);

    c.initialize(&cred, &pk);

    assert_eq!(c.signer_count(), 1);
    assert_eq!(c.get_signer_public_key(&cred), pk);
}

#[test]
fn test_initialize_fails_if_already_initialized() {
    let (env, contract_id) = setup();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (_, pk) = signing_keypair(&env, 0x11);

    c.initialize(&cred, &pk);

    let result = c.try_initialize(&cred, &pk);
    assert_eq!(result, Err(Ok(WalletError::AlreadyInitialized)));
}

// ===========================================================================
// Signer management (business logic — auth mocked)
// ===========================================================================

#[test]
fn test_add_signer() {
    let (env, contract_id) = setup();
    env.mock_all_auths();
    let c = client(&env, &contract_id);
    let cred1 = mock_credential_id(&env, 0x01);
    let cred2 = mock_credential_id(&env, 0x02);
    let (_, pk1) = signing_keypair(&env, 0x11);
    let (_, pk2) = signing_keypair(&env, 0x22);

    c.initialize(&cred1, &pk1);
    c.add_signer(&cred2, &pk2);

    assert_eq!(c.signer_count(), 2);
    assert_eq!(c.get_signer_public_key(&cred2), pk2);
}

#[test]
fn test_add_signer_duplicate_fails() {
    let (env, contract_id) = setup();
    env.mock_all_auths();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (_, pk) = signing_keypair(&env, 0x11);

    c.initialize(&cred, &pk);

    let result = c.try_add_signer(&cred, &pk);
    assert_eq!(result, Err(Ok(WalletError::SignerAlreadyExists)));
}

#[test]
fn test_remove_signer() {
    let (env, contract_id) = setup();
    env.mock_all_auths();
    let c = client(&env, &contract_id);
    let cred1 = mock_credential_id(&env, 0x01);
    let cred2 = mock_credential_id(&env, 0x02);
    let (_, pk1) = signing_keypair(&env, 0x11);
    let (_, pk2) = signing_keypair(&env, 0x22);

    c.initialize(&cred1, &pk1);
    c.add_signer(&cred2, &pk2);
    c.remove_signer(&cred2);

    assert_eq!(c.signer_count(), 1);
}

#[test]
fn test_remove_last_signer_fails() {
    let (env, contract_id) = setup();
    env.mock_all_auths();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (_, pk) = signing_keypair(&env, 0x11);

    c.initialize(&cred, &pk);

    let result = c.try_remove_signer(&cred);
    assert_eq!(result, Err(Ok(WalletError::CannotRemoveLastSigner)));
}

#[test]
fn test_remove_nonexistent_signer_fails() {
    let (env, contract_id) = setup();
    env.mock_all_auths();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (_, pk) = signing_keypair(&env, 0x11);
    let unknown = mock_credential_id(&env, 0x99);

    c.initialize(&cred, &pk);

    let result = c.try_remove_signer(&unknown);
    assert_eq!(result, Err(Ok(WalletError::SignerNotFound)));
}

#[test]
fn test_get_signer_ids() {
    let (env, contract_id) = setup();
    env.mock_all_auths();
    let c = client(&env, &contract_id);
    let cred1 = mock_credential_id(&env, 0x01);
    let cred2 = mock_credential_id(&env, 0x02);
    let (_, pk1) = signing_keypair(&env, 0x11);
    let (_, pk2) = signing_keypair(&env, 0x22);

    c.initialize(&cred1, &pk1);
    c.add_signer(&cred2, &pk2);

    let ids = c.get_signer_ids();
    assert_eq!(ids.len(), 2);
    assert!(ids.contains(cred1));
    assert!(ids.contains(cred2));
}

#[test]
fn test_get_version() {
    let (env, contract_id) = setup();
    let c = client(&env, &contract_id);
    assert_eq!(c.get_version(), soroban_sdk::String::from_str(&env, "0.1.0"));
}

#[test]
fn test_signer_count_before_init_is_zero() {
    let env = Env::default();
    let contract_id = env.register(PasskeyWallet, ());
    let c = client(&env, &contract_id);
    assert_eq!(c.signer_count(), 0);
}

#[test]
fn test_add_signer_before_init_fails() {
    let (env, contract_id) = setup();
    env.mock_all_auths();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (_, pk) = signing_keypair(&env, 0x11);

    let result = c.try_add_signer(&cred, &pk);
    assert_eq!(result, Err(Ok(WalletError::NotInitialized)));
}

// ===========================================================================
// __check_auth — WebAuthn / secp256r1 verification
//
// These exercise the real cryptographic path with genuine P-256 signatures,
// per the issue's explicit acceptance criteria: __check_auth must accept a
// valid assertion, and reject a wrong-challenge assertion, an unknown
// signer, and a replayed signature.
// ===========================================================================

#[test]
fn test_check_auth_accepts_valid_assertion() {
    let (env, contract_id) = setup();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (signing_key, pk) = signing_keypair(&env, 0x11);
    c.initialize(&cred, &pk);

    let payload = BytesN::from_array(&env, &[0x42; 32]);
    let assertion = valid_assertion(&env, &signing_key, &cred, &payload);

    let result = check_auth(&env, &contract_id, &payload, &assertion);
    assert_eq!(result, Ok(()));
}

#[test]
fn test_check_auth_rejects_wrong_challenge() {
    let (env, contract_id) = setup();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (signing_key, pk) = signing_keypair(&env, 0x11);
    c.initialize(&cred, &pk);

    // Assertion is signed for `payload`, but verified against `other_payload`
    // — the challenge embedded in clientDataJSON won't match.
    let payload = BytesN::from_array(&env, &[0x42; 32]);
    let other_payload = BytesN::from_array(&env, &[0x99; 32]);
    let assertion = valid_assertion(&env, &signing_key, &cred, &payload);

    let result = check_auth(&env, &contract_id, &other_payload, &assertion);
    assert_eq!(result, Err(Ok(WalletError::ChallengeMismatch)));
}

#[test]
fn test_check_auth_rejects_unknown_signer() {
    let (env, contract_id) = setup();
    let c = client(&env, &contract_id);
    let registered_cred = mock_credential_id(&env, 0x01);
    let (_, registered_pk) = signing_keypair(&env, 0x11);
    c.initialize(&registered_cred, &registered_pk);

    // A different, never-registered keypair/credential signs a
    // well-formed, correctly-challenged assertion.
    let unknown_cred = mock_credential_id(&env, 0xEE);
    let (unknown_key, _unknown_pk) = signing_keypair(&env, 0x33);

    let payload = BytesN::from_array(&env, &[0x42; 32]);
    let assertion = valid_assertion(&env, &unknown_key, &unknown_cred, &payload);

    let result = check_auth(&env, &contract_id, &payload, &assertion);
    assert_eq!(result, Err(Ok(WalletError::SignerNotFound)));
}

#[test]
fn test_check_auth_rejects_replayed_signature() {
    let (env, contract_id) = setup();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (signing_key, pk) = signing_keypair(&env, 0x11);
    c.initialize(&cred, &pk);

    // A legitimately captured assertion for one action (payload A) ...
    let payload_a = BytesN::from_array(&env, &[0x42; 32]);
    let assertion = valid_assertion(&env, &signing_key, &cred, &payload_a);
    assert_eq!(check_auth(&env, &contract_id, &payload_a, &assertion), Ok(()));

    // ... must not authorize a different action (payload B), even though the
    // signature itself is genuine — this is what challenge binding prevents.
    let payload_b = BytesN::from_array(&env, &[0x43; 32]);
    let result = check_auth(&env, &contract_id, &payload_b, &assertion);
    assert_eq!(result, Err(Ok(WalletError::ChallengeMismatch)));
}

#[test]
fn test_check_auth_rejects_wrong_ceremony_type() {
    let (env, contract_id) = setup();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (signing_key, pk) = signing_keypair(&env, 0x11);
    c.initialize(&cred, &pk);

    let payload = BytesN::from_array(&env, &[0x42; 32]);

    // Craft a "webauthn.create" (registration) ceremony assertion, still
    // signed correctly, to prove ceremony-type confusion is rejected and
    // that `type` is checked by actual value — not by substring presence.
    let mut auth_data = [0u8; 37];
    auth_data[32] = 0x01;
    let authenticator_data = Bytes::from_array(&env, &auth_data);
    let challenge_b64 = URL_SAFE_NO_PAD.encode(payload.to_array());
    let client_data_json_str = std::format!(
        "{{\"type\":\"webauthn.create\",\"challenge\":\"{challenge_b64}\",\"origin\":\"https://learnvault.app\"}}"
    );
    let client_data_json = Bytes::from_slice(&env, client_data_json_str.as_bytes());
    let client_data_hash = env.crypto().sha256(&client_data_json);
    let mut signed_data = Bytes::new(&env);
    signed_data.append(&authenticator_data);
    signed_data.append(&client_data_hash.into());
    let msg = env.crypto().sha256(&signed_data);
    let sig: Signature = signing_key.sign_prehash(&msg.to_array()).unwrap();
    let sig = sig.normalize_s().unwrap_or(sig);
    let sig_bytes: [u8; 64] = sig.to_bytes().into();

    let assertion = PasskeyAssertion {
        authenticator_data,
        client_data_json,
        signature: BytesN::from_array(&env, &sig_bytes),
        credential_id: cred,
    };

    let result = check_auth(&env, &contract_id, &payload, &assertion);
    assert_eq!(result, Err(Ok(WalletError::InvalidClientDataJson)));
}

#[test]
fn test_check_auth_rejects_missing_user_present_flag() {
    let (env, contract_id) = setup();
    let c = client(&env, &contract_id);
    let cred = mock_credential_id(&env, 0x01);
    let (signing_key, pk) = signing_keypair(&env, 0x11);
    c.initialize(&cred, &pk);

    let payload = BytesN::from_array(&env, &[0x42; 32]);

    // UP flag (bit 0 of byte 32) left unset.
    let auth_data = [0u8; 37];
    let authenticator_data = Bytes::from_array(&env, &auth_data);
    let challenge_b64 = URL_SAFE_NO_PAD.encode(payload.to_array());
    let client_data_json_str = std::format!(
        "{{\"type\":\"webauthn.get\",\"challenge\":\"{challenge_b64}\",\"origin\":\"https://learnvault.app\"}}"
    );
    let client_data_json = Bytes::from_slice(&env, client_data_json_str.as_bytes());
    let client_data_hash = env.crypto().sha256(&client_data_json);
    let mut signed_data = Bytes::new(&env);
    signed_data.append(&authenticator_data);
    signed_data.append(&client_data_hash.into());
    let msg = env.crypto().sha256(&signed_data);
    let sig: Signature = signing_key.sign_prehash(&msg.to_array()).unwrap();
    let sig = sig.normalize_s().unwrap_or(sig);
    let sig_bytes: [u8; 64] = sig.to_bytes().into();

    let assertion = PasskeyAssertion {
        authenticator_data,
        client_data_json,
        signature: BytesN::from_array(&env, &sig_bytes),
        credential_id: cred,
    };

    let result = check_auth(&env, &contract_id, &payload, &assertion);
    assert_eq!(result, Err(Ok(WalletError::UserNotPresent)));
}
