#![no_std]

//! # PasskeyWallet
//!
//! A **secp256r1 (WebAuthn) smart wallet** contract for Soroban. The wallet's
//! identity *is* its deployed contract address — there is no separate owner
//! keypair. Every mutating call after `initialize` is authorized by
//! `env.current_contract_address().require_auth()`, which the Soroban host
//! routes back into this contract's own [`__check_auth`], so control never
//! depends on anything but a registered passkey.
//!
//! ## Relevant issue
//! Implements: <https://github.com/bakeronchain/learnvault/issues/1055>

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype, symbol_short, Bytes, BytesN, Env, Map,
    String, Symbol, Vec,
};

use soroban_sdk::crypto::Hash;

// ---------------------------------------------------------------------------
// Storage Constants
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = DAY_IN_LEDGERS;
const INSTANCE_EXTEND_TO: u32 = DAY_IN_LEDGERS * 30; // 30 days

/// `clientDataJSON` for a WebAuthn "get" (authentication) ceremony is a small,
/// fixed-shape object (type/challenge/origin/crossOrigin) — real browsers
/// produce well under 256 bytes. Capped generously to bound stack usage.
const CLIENT_DATA_JSON_MAX_LEN: usize = 1024;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum WalletError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    SignerAlreadyExists = 3,
    SignerNotFound = 4,
    InvalidAuthenticatorData = 5,
    InvalidClientDataJson = 6,
    ChallengeMismatch = 7,
    CannotRemoveLastSigner = 8,
    UserNotPresent = 9,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const SIGNERS_KEY: Symbol = symbol_short!("SIGNERS");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// WebAuthn assertion material for signature verification.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PasskeyAssertion {
    /// Raw authenticator data from the WebAuthn ceremony (>= 37 bytes).
    pub authenticator_data: Bytes,
    /// Serialised `clientDataJSON` from the WebAuthn ceremony.
    pub client_data_json: Bytes,
    /// Raw 64-byte P-256 (r ‖ s) signature produced by the authenticator.
    pub signature: BytesN<64>,
    /// The credential ID that produced this assertion.
    pub credential_id: Bytes,
}

/// Structured `clientDataJSON` fields we care about. Deserialised rather than
/// substring-matched so a `type`/`challenge` value can't be spoofed by
/// planting the expected substrings elsewhere in the JSON (e.g. inside
/// `origin`) — see `validate_client_data`.
#[derive(serde::Deserialize)]
struct ClientData<'a> {
    #[serde(rename = "type")]
    ceremony_type: &'a str,
    challenge: &'a str,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct PasskeyWallet;

#[contractimpl]
impl PasskeyWallet {
    /// Deploy-time constructor. Registers the learner's first passkey.
    ///
    /// Deliberately does **not** call `require_auth` — no signer exists yet,
    /// so there is nothing to authenticate against. Trust here comes from the
    /// deployment flow itself: the sponsoring backend only ever calls this
    /// once, immediately after contract creation, with the public key it just
    /// extracted from a WebAuthn registration ceremony. The `AlreadyInitialized`
    /// guard makes this a one-shot operation, closing the window after that.
    pub fn initialize(
        env: Env,
        credential_id: Bytes,
        public_key: BytesN<65>,
    ) -> Result<(), WalletError> {
        if env.storage().instance().has(&SIGNERS_KEY) {
            return Err(WalletError::AlreadyInitialized);
        }
        let signers: Map<Bytes, BytesN<65>> = Map::new(&env);
        env.storage().instance().set(&SIGNERS_KEY, &signers);
        Self::add_signer_inner(&env, credential_id, public_key)
    }

    /// Register a new passkey signer (e.g. a second device). Must be
    /// authorized by an *existing* signer via `__check_auth`.
    pub fn add_signer(
        env: Env,
        credential_id: Bytes,
        public_key: BytesN<65>,
    ) -> Result<(), WalletError> {
        Self::require_signer_auth(&env)?;
        Self::add_signer_inner(&env, credential_id, public_key)
    }

    /// Remove an existing signer. Must be authorized by an existing signer.
    /// Fails if this is the last remaining signer, so a learner can never
    /// lock themselves out by removing their only device.
    pub fn remove_signer(env: Env, credential_id: Bytes) -> Result<(), WalletError> {
        Self::require_signer_auth(&env)?;
        let mut signers = Self::load_signers(&env)?;
        if !signers.contains_key(credential_id.clone()) {
            return Err(WalletError::SignerNotFound);
        }
        if signers.len() <= 1 {
            return Err(WalletError::CannotRemoveLastSigner);
        }
        signers.remove(credential_id);
        env.storage().instance().set(&SIGNERS_KEY, &signers);
        Self::extend_instance(&env);
        Ok(())
    }

    /// Return all registered signer credential IDs.
    pub fn get_signer_ids(env: Env) -> Vec<Bytes> {
        Self::load_signers(&env)
            .map(|s| s.keys())
            .unwrap_or_else(|_| Vec::new(&env))
    }

    /// Return the public key for a given signer credential ID.
    pub fn get_signer_public_key(
        env: Env,
        credential_id: Bytes,
    ) -> Result<BytesN<65>, WalletError> {
        let signers = Self::load_signers(&env)?;
        signers.get(credential_id).ok_or(WalletError::SignerNotFound)
    }

    /// Number of registered signers.
    pub fn signer_count(env: Env) -> u32 {
        Self::load_signers(&env).map(|s| s.len()).unwrap_or(0)
    }

    /// Contract version string.
    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "0.1.0")
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn extend_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_EXTEND_TO);
    }

    fn load_signers(env: &Env) -> Result<Map<Bytes, BytesN<65>>, WalletError> {
        env.storage()
            .instance()
            .get(&SIGNERS_KEY)
            .ok_or(WalletError::NotInitialized)
    }

    /// Require authorization from this wallet's own address. The Soroban
    /// host routes a `require_auth()` call on a contract's own address back
    /// into that same contract's `__check_auth`, so this is what actually
    /// forces the caller to present a valid signature from a registered
    /// passkey — this contract never stores or checks any other credential.
    fn require_signer_auth(env: &Env) -> Result<(), WalletError> {
        if !env.storage().instance().has(&SIGNERS_KEY) {
            return Err(WalletError::NotInitialized);
        }
        env.current_contract_address().require_auth();
        Ok(())
    }

    fn add_signer_inner(
        env: &Env,
        credential_id: Bytes,
        public_key: BytesN<65>,
    ) -> Result<(), WalletError> {
        let mut signers = Self::load_signers(env)?;
        if signers.contains_key(credential_id.clone()) {
            return Err(WalletError::SignerAlreadyExists);
        }
        signers.set(credential_id, public_key);
        env.storage().instance().set(&SIGNERS_KEY, &signers);
        Self::extend_instance(env);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // WebAuthn verification
    // -----------------------------------------------------------------------

    fn verify_passkey_assertion(
        env: &Env,
        signature_payload: &Hash<32>,
        assertion: &PasskeyAssertion,
    ) -> Result<(), WalletError> {
        // 1. Look up the public key.
        let signers = Self::load_signers(env)?;
        let public_key = signers
            .get(assertion.credential_id.clone())
            .ok_or(WalletError::SignerNotFound)?;

        // 2. authenticatorData must be >= 37 bytes.
        if assertion.authenticator_data.len() < 37 {
            return Err(WalletError::InvalidAuthenticatorData);
        }

        // 3. User Present (UP) flag – bit 0 of flags byte at offset 32.
        let flags = assertion
            .authenticator_data
            .get(32)
            .ok_or(WalletError::InvalidAuthenticatorData)?;
        if flags & 0x01 == 0 {
            return Err(WalletError::UserNotPresent);
        }

        // 4. Validate clientDataJSON and challenge binding. This is the whole
        //    security model: without it, a signature produced for one
        //    action's payload could be replayed to authorize another.
        Self::validate_client_data(&assertion.client_data_json, signature_payload)?;

        // 5. Compute signed message:
        //    msg = sha256(authenticatorData ‖ sha256(clientDataJSON))
        let client_data_hash = env.crypto().sha256(&assertion.client_data_json);
        let mut signed_data = Bytes::new(env);
        signed_data.append(&assertion.authenticator_data);
        let hash_bytes: Bytes = client_data_hash.into();
        signed_data.append(&hash_bytes);
        let msg = env.crypto().sha256(&signed_data);

        // 6. secp256r1 (P-256) verify. Traps the whole invocation on failure,
        //    same as the SDK's ed25519_verify — there is no recoverable
        //    "wrong signature" error path here by design.
        env.crypto()
            .secp256r1_verify(&public_key, &msg, &assertion.signature);

        Ok(())
    }

    /// Validate `clientDataJSON`:
    /// - `type` must be exactly `"webauthn.get"`
    /// - `challenge` must equal `base64url(signature_payload)`
    ///
    /// Parses the JSON structurally (rather than substring-matching) so a
    /// crafted `origin` or other field can't spoof the expected markers.
    fn validate_client_data(
        client_data_json: &Bytes,
        signature_payload: &Hash<32>,
    ) -> Result<(), WalletError> {
        let json_len = client_data_json.len() as usize;
        if json_len > CLIENT_DATA_JSON_MAX_LEN {
            return Err(WalletError::InvalidClientDataJson);
        }
        let mut buf = [0u8; CLIENT_DATA_JSON_MAX_LEN];
        client_data_json.copy_into_slice(&mut buf[..json_len]);

        let (parsed, _): (ClientData, usize) = serde_json_core::from_slice(&buf[..json_len])
            .map_err(|_| WalletError::InvalidClientDataJson)?;

        if parsed.ceremony_type != "webauthn.get" {
            return Err(WalletError::InvalidClientDataJson);
        }

        let expected = Self::base64url_encode_32(signature_payload.to_array());
        if parsed.challenge.as_bytes() != expected.as_slice() {
            return Err(WalletError::ChallengeMismatch);
        }

        Ok(())
    }

    /// Base64url encode (no padding) a 32-byte array, matching the browser's
    /// encoding of `PublicKeyCredentialRequestOptions.challenge` into
    /// `clientDataJSON.challenge`. A 32-byte input always yields exactly 43
    /// output characters (`ceil(32*8/6)`, no padding), so the return type is
    /// fixed-size rather than a length-prefixed buffer.
    fn base64url_encode_32(data: [u8; 32]) -> [u8; 43] {
        const CHARS: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

        let mut buf = [0u8; 43];
        let mut out_len = 0;

        // 10 full 3-byte -> 4-char groups (30 of the 32 bytes).
        for i in 0..10 {
            let b0 = data[i * 3] as u32;
            let b1 = data[i * 3 + 1] as u32;
            let b2 = data[i * 3 + 2] as u32;
            let triple = (b0 << 16) | (b1 << 8) | b2;
            buf[out_len] = CHARS[((triple >> 18) & 0x3F) as usize];
            buf[out_len + 1] = CHARS[((triple >> 12) & 0x3F) as usize];
            buf[out_len + 2] = CHARS[((triple >> 6) & 0x3F) as usize];
            buf[out_len + 3] = CHARS[(triple & 0x3F) as usize];
            out_len += 4;
        }

        // Final 2 bytes -> 3 chars, no padding.
        let b0 = data[30] as u32;
        let b1 = data[31] as u32;
        let double = (b0 << 8) | b1;
        buf[out_len] = CHARS[((double >> 10) & 0x3F) as usize];
        buf[out_len + 1] = CHARS[((double >> 4) & 0x3F) as usize];
        buf[out_len + 2] = CHARS[((double << 2) & 0x3F) as usize];

        buf
    }
}

// ---------------------------------------------------------------------------
// Custom Account Interface
// ---------------------------------------------------------------------------

#[contractimpl]
impl CustomAccountInterface for PasskeyWallet {
    type Signature = PasskeyAssertion;
    type Error = WalletError;

    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signatures: PasskeyAssertion,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), WalletError> {
        Self::verify_passkey_assertion(&env, &signature_payload, &signatures)
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod test;
