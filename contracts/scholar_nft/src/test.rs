#![cfg(test)]

use crate::{
    AdminChangedEventData, DataKey, InitializedEventData, MintEventData, ScholarMetadata,
    ScholarNFT, ScholarNFTClient, ScholarNFTError,
};
use soroban_sdk::{
    Address, BytesN, Env, IntoVal, String, symbol_short,
    testutils::{Address as _, Events as _, MockAuth, MockAuthInvoke, storage::Persistent},
};

fn setup(env: &Env) -> (Address, Address, ScholarNFTClient) {
    let admin = Address::generate(env);
    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(env, &contract_id);
    env.mock_all_auths();
    client.initialize(&admin);
    (contract_id, admin, client)
}

fn cid(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

fn authorize_upgrade(env: &Env, contract_id: &Address, signer: &Address, wasm_hash: &BytesN<32>) {
    env.mock_auths(&[MockAuth {
        address: signer,
        invoke: &MockAuthInvoke {
            contract: contract_id,
            fn_name: "upgrade",
            args: (wasm_hash.clone(),).into_val(env),
            sub_invokes: &[],
        },
    }]);
}

#[test]
fn mint_returns_sequential_token_ids() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let scholar_a = Address::generate(&env);
    let scholar_b = Address::generate(&env);

    env.mock_all_auths();
    assert_eq!(client.mint(&scholar_a, &cid(&env, "ipfs://cid-1")), 1);
    assert_eq!(client.mint(&scholar_b, &cid(&env, "ipfs://cid-2")), 2);
}

#[test]
fn owner_of_returns_minted_owner() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let scholar = Address::generate(&env);

    env.mock_all_auths();
    let token_id = client.mint(&scholar, &cid(&env, "ipfs://owner-check"));

    assert_eq!(client.owner_of(&token_id), scholar);
}

#[test]
fn get_all_scholars_is_empty_before_mint() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);

    assert_eq!(client.get_all_scholars().len(), 0);
}

#[test]
fn get_all_scholars_returns_all_minted_scholars_in_order() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let scholar_a = Address::generate(&env);
    let scholar_b = Address::generate(&env);
    let scholar_c = Address::generate(&env);

    env.mock_all_auths();
    client.mint(&scholar_a, &cid(&env, "ipfs://scholar-a"));
    client.mint(&scholar_b, &cid(&env, "ipfs://scholar-b"));
    client.mint(&scholar_c, &cid(&env, "ipfs://scholar-c"));

    let scholars = client.get_all_scholars();
    assert_eq!(scholars.len(), 3);
    assert_eq!(scholars.get(0).unwrap(), scholar_a);
    assert_eq!(scholars.get(1).unwrap(), scholar_b);
    assert_eq!(scholars.get(2).unwrap(), scholar_c);
}

#[test]
fn test_transfer_admin_success_and_old_admin_cannot_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(&env, &contract_id);

    let old_admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.initialize(&old_admin);
    client.transfer_admin(&new_admin);

    let uri = String::from_str(&env, "ipfs://new-token");
    let token_id = client.mint(&recipient, &uri);
    assert_eq!(token_id, 1);

    let fetched_owner = client.owner_of(&token_id);
    assert_eq!(fetched_owner, recipient);
}

#[test]
fn test_old_admin_cannot_mint_after_transfer() {
    let env = Env::default();

    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(&env, &contract_id);

    let old_admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &old_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "initialize",
            args: (&old_admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.initialize(&old_admin);

    env.mock_auths(&[MockAuth {
        address: &old_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "transfer_admin",
            args: (&new_admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.transfer_admin(&new_admin);

    env.mock_auths(&[MockAuth {
        address: &old_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "mint",
            args: (&recipient, cid(&env, "ipfs://bad")).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_mint(&recipient, &cid(&env, "ipfs://bad"));
    assert!(result.is_err());
}

#[test]
#[should_panic]
fn test_transfer_admin_rejected_for_non_admin() {
    let env = Env::default();

    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "initialize",
            args: (&admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.initialize(&admin);

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "transfer_admin",
            args: (&attacker,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.transfer_admin(&attacker);
}

#[test]
fn token_uri_returns_metadata_uri() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let scholar = Address::generate(&env);
    let metadata_uri = cid(&env, "ipfs://bafybeigdyrzt");

    env.mock_all_auths();
    let token_id = client.mint(&scholar, &metadata_uri);

    assert_eq!(client.token_uri(&token_id), metadata_uri);
}

#[test]
fn get_metadata_uri_round_trip() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let scholar = Address::generate(&env);
    let uri = cid(
        &env,
        "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    );

    env.mock_all_auths();
    let token_id = client.mint(&scholar, &uri);

    assert_eq!(client.get_metadata_uri(&token_id), uri);
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn non_admin_mint_panics() {
    let env = Env::default();
    let (contract_id, _admin, client) = setup(&env);
    let hacker = Address::generate(&env);
    let scholar = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &hacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "mint",
            args: (&scholar, cid(&env, "ipfs://hax")).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.mint(&scholar, &cid(&env, "ipfs://hax"));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_initialize_reverts() {
    let env = Env::default();
    let (_, admin, client) = setup(&env);
    env.mock_all_auths();
    client.initialize(&admin);
}

#[test]
fn test_revoke_flow() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let recipient = Address::generate(&env);
    let reason = String::from_str(&env, "Cheater");

    env.mock_all_auths();
    let token_id = client.mint(&recipient, &cid(&env, "ipfs://test"));
    assert!(client.has_credential(&token_id));

    client.revoke(&token_id, &reason);

    assert!(!client.has_credential(&token_id));
    assert!(client.is_revoked(&token_id));
    assert_eq!(client.get_revocation_reason(&token_id), Some(reason));
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_owner_of_revoked_fails() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let recipient = Address::generate(&env);
    let reason = String::from_str(&env, "Plagiarism");

    env.mock_all_auths();
    let token_id = client.mint(&recipient, &cid(&env, "ipfs://test"));
    client.revoke(&token_id, &reason);

    client.owner_of(&token_id);
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn test_unauthorized_revoke_fails() {
    let env = Env::default();
    let (contract_id, _admin, client) = setup(&env);
    let scholar = Address::generate(&env);
    let hacker = Address::generate(&env);
    let reason = String::from_str(&env, "Hax");

    env.mock_all_auths();
    let token_id = client.mint(&scholar, &cid(&env, "ipfs://test"));

    env.mock_auths(&[MockAuth {
        address: &hacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "revoke",
            args: (&token_id, reason.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.revoke(&token_id, &reason);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_revoke_non_existent_token_panics() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let token_id = 999u64;
    let reason = String::from_str(&env, "Testing");

    env.mock_all_auths();
    client.revoke(&token_id, &reason);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_revoke_already_revoked_panics() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let scholar = Address::generate(&env);
    let reason = String::from_str(&env, "Reason");

    env.mock_all_auths();
    let token_id = client.mint(&scholar, &cid(&env, "ipfs://test"));
    client.revoke(&token_id, &reason);
    client.revoke(&token_id, &reason);
}

#[test]
fn initialize_emits_event() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(&env, &contract_id);

    env.mock_all_auths();
    client.initialize(&admin);

    let events = env.events().all();
    let found = events.iter().any(|(_, topics, data)| {
        topics.contains(&symbol_short!("init").into_val(&env)) && {
            let d: InitializedEventData = data.clone().into_val(&env);
            d == InitializedEventData {
                admin: admin.clone(),
            }
        }
    });
    assert!(found, "initialized event not found");
}

#[test]
fn mint_emits_event() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let scholar = Address::generate(&env);
    let uri = cid(&env, "ipfs://mint-event-test");

    env.mock_all_auths();
    let token_id = client.mint(&scholar, &uri);

    let events = env.events().all();
    let found = events.iter().any(|(_, topics, data)| {
        topics.contains(&symbol_short!("minted").into_val(&env))
            && topics.contains(&token_id.into_val(&env))
            && {
                let d: MintEventData = data.clone().into_val(&env);
                d == MintEventData {
                    token_id,
                    owner: scholar.clone(),
                }
            }
    });
    assert!(found, "mint event not found");
}

#[test]
fn transfer_admin_emits_event() {
    let env = Env::default();
    let (_, old_admin, client) = setup(&env);
    let new_admin = Address::generate(&env);

    env.mock_all_auths();
    client.transfer_admin(&new_admin);

    let events = env.events().all();
    let found = events.iter().any(|(_, topics, data)| {
        topics.contains(&symbol_short!("adm_chng").into_val(&env)) && {
            let d: AdminChangedEventData = data.clone().into_val(&env);
            d == AdminChangedEventData {
                old_admin: old_admin.clone(),
                new_admin: new_admin.clone(),
            }
        }
    });
    assert!(found, "admin_changed event not found");
}

#[test]
fn transfer_panics_with_soulbound_error() {
    let env = Env::default();
    let (_, _, client) = setup(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let token_id = 1_u64;

    let result = client.try_transfer(&from, &to, &token_id);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            ScholarNFTError::Soulbound as u32
        )))
    );
}

#[test]
fn transfer_attempt_reverts_soulbound() {
    let env = Env::default();
    let (_, _admin, client) = setup(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    env.mock_all_auths();
    let token_id = client.mint(&from, &cid(&env, "ipfs://test"));

    let res = client.try_transfer(&from, &to, &token_id);
    assert!(res.is_err());
}

#[test]
fn test_mint_extends_ttl() {
    let env = Env::default();
    let (contract_id, _admin, client) = setup(&env);
    let scholar = Address::generate(&env);

    env.mock_all_auths();
    let token_id = client.mint(&scholar, &cid(&env, "ipfs://ttl-test"));

    env.as_contract(&contract_id, || {
        assert!(
            env.storage()
                .persistent()
                .get_ttl(&DataKey::Owner(token_id))
                >= 6_307_200
        );
        assert!(
            env.storage()
                .persistent()
                .get_ttl(&DataKey::TokenUri(token_id))
                >= 6_307_200
        );
        assert!(
            env.storage()
                .persistent()
                .get_ttl(&DataKey::Metadata(token_id))
                >= 6_307_200
        );
    });
}

#[test]
fn upgrade_requires_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let contract_id = env.register(ScholarNFT, ());
    let client = ScholarNFTClient::new(&env, &contract_id);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "initialize",
            args: (&admin,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.initialize(&admin);

    let wasm_hash = crate::upgrade::testutils::upload_upgrade_target(&env);
    authorize_upgrade(&env, &contract_id, &attacker, &wasm_hash);
    assert!(client.try_upgrade(&wasm_hash).is_err());
}

#[test]
fn state_persists_after_upgrade() {
    let env = Env::default();
    let (contract_id, admin, client) = setup(&env);
    let scholar = Address::generate(&env);
    let metadata_uri = cid(&env, "ipfs://upgrade-check");

    env.mock_all_auths();
    let token_id = client.mint(&scholar, &metadata_uri);

    env.set_auths(&[]);
    let wasm_hash = crate::upgrade::testutils::upload_upgrade_target(&env);
    authorize_upgrade(&env, &contract_id, &admin, &wasm_hash);
    client.upgrade(&wasm_hash);

    let metadata = env.as_contract(&contract_id, || {
        env.storage()
            .persistent()
            .get::<_, ScholarMetadata>(&DataKey::Metadata(token_id))
    });
    let stored_hash = env.as_contract(&contract_id, || crate::upgrade::current_hash(&env));

    let metadata = metadata.expect("metadata should persist across upgrades");
    assert_eq!(metadata.owner, scholar);
    assert_eq!(metadata.metadata_uri, metadata_uri);
    assert_eq!(stored_hash, wasm_hash);
}
