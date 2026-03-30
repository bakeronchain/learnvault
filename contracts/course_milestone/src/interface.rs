use soroban_sdk::{Address, Env, contractclient};

#[allow(dead_code)]
#[contractclient(name = "LearnTokenClient")]
pub trait LearnToken {
    fn mint(env: Env, to: Address, amount: i128);
    fn balance(env: Env, account: Address) -> i128;
}
