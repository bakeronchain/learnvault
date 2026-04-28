use soroban_sdk::{Address, BytesN, Env, Symbol, contractevent, symbol_short};

const CURRENT_WASM_HASH_KEY: Symbol = symbol_short!("WASMHASH");

#[contractevent(topics = ["contract_upgraded"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractUpgraded {
    pub old_hash: BytesN<32>,
    pub new_hash: BytesN<32>,
    pub upgraded_by: Address,
}

pub fn init(env: &Env) {
    env.storage()
        .instance()
        .set(&CURRENT_WASM_HASH_KEY, &zero_hash(env));
}

pub fn apply(env: &Env, admin: &Address, new_wasm_hash: &BytesN<32>) {
    // Soroban emits a native `executable_update` system event with the exact
    // old/new executable refs. Contracts cannot read their current WASM hash,
    // so we track the last managed upgrade hash locally for contract events.
    let upgraded = ContractUpgraded {
        old_hash: current_hash(env),
        new_hash: new_wasm_hash.clone(),
        upgraded_by: admin.clone(),
    };

    env.deployer()
        .update_current_contract_wasm(new_wasm_hash.clone());
    env.storage()
        .instance()
        .set(&CURRENT_WASM_HASH_KEY, new_wasm_hash);

    upgraded.publish(env);
}

pub fn current_hash(env: &Env) -> BytesN<32> {
    env.storage()
        .instance()
        .get(&CURRENT_WASM_HASH_KEY)
        .unwrap_or_else(|| zero_hash(env))
}

fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0; 32])
}

#[cfg(any(test, feature = "testutils"))]
pub mod testutils {
    use soroban_sdk::{BytesN, Env};

    pub const UPGRADE_TARGET_WASM: &[u8] = include_bytes!("../../testdata/upgrade-target.wasm");

    pub fn upload_upgrade_target(env: &Env) -> BytesN<32> {
        env.deployer().upload_contract_wasm(UPGRADE_TARGET_WASM)
    }
}
