#![no_std]

use soroban_sdk::{
    Address, Env, Symbol, contract, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, symbol_short,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Enrolled(Address, u32), // (learner, course_id) -> bool
}

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AlreadyEnrolled = 3,
}

#[contractevent]
pub struct Enrolled {
    pub learner: Address,
    pub course_id: u32,
}

#[contract]
pub struct CourseMilestone;

#[contractimpl]
impl CourseMilestone {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&ADMIN_KEY, &admin);
    }

    pub fn enroll(env: Env, learner: Address, course_id: u32) {
        learner.require_auth();

        let key = DataKey::Enrolled(learner.clone(), course_id);

        if env.storage().instance().has(&key) {
            panic_with_error!(&env, Error::AlreadyEnrolled);
        }
        env.storage().instance().set(&key, &true);

        Enrolled { learner, course_id }.publish(&env);
    }

    pub fn is_enrolled(env: Env, learner: Address, course_id: u32) -> bool {
        let key = DataKey::Enrolled(learner.clone(), course_id);
        env.storage().instance().get(&key).unwrap_or_default()
    }
}

#[cfg(test)]
mod test;
