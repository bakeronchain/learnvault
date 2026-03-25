#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    symbol_short, Address, Env, Symbol,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CourseConfig {
    pub total_milestones: u32,
    pub tokens_per_milestone: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    LearnTokenContract,
    Courses(u32),
    Progress(Address, u32),
}

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const LEARN_TOKEN_KEY: Symbol = symbol_short!("LRN_TKN");

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    CourseNotFound = 4,
    MilestoneAlreadyCompleted = 5,
    CourseAlreadyComplete = 6,
    InvalidMilestones = 7,
    CourseAlreadyExists = 8,
}

#[contractevent]
pub struct MilestoneCompleted {
    pub learner: Address,
    pub course_id: u32,
    pub milestones_completed: u32,
    pub tokens_minted: i128,
}

#[contractevent]
pub struct CourseCompleted {
    pub learner: Address,
    pub course_id: u32,
}

#[contractevent]
pub struct CourseAdded {
    pub course_id: u32,
    pub total_milestones: u32,
    pub tokens_per_milestone: i128,
}

#[contract]
pub struct CourseMilestone;

#[contractimpl]
impl CourseMilestone {
    pub fn initialize(env: Env, admin: Address, learn_token_contract: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage()
            .instance()
            .set(&LEARN_TOKEN_KEY, &learn_token_contract);
    }

    pub fn add_course(env: Env, course_id: u32, total_milestones: u32, tokens_per_milestone: i128) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        if total_milestones == 0 {
            panic_with_error!(&env, Error::InvalidMilestones);
        }

        let key = DataKey::Courses(course_id);
        if env.storage().instance().has(&key) {
            panic_with_error!(&env, Error::CourseAlreadyExists);
        }

        let config = CourseConfig {
            total_milestones,
            tokens_per_milestone,
        };
        env.storage().instance().set(&key, &config);

        CourseAdded {
            course_id,
            total_milestones,
            tokens_per_milestone,
        }
        .publish(&env);
    }

    pub fn complete_milestone(env: Env, learner: Address, course_id: u32) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        let course_key = DataKey::Courses(course_id);
        let course: CourseConfig = env
            .storage()
            .instance()
            .get(&course_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::CourseNotFound));

        let progress_key = DataKey::Progress(learner.clone(), course_id);
        let current_progress: u32 = env.storage().instance().get(&progress_key).unwrap_or(0);

        if current_progress >= course.total_milestones {
            panic_with_error!(&env, Error::CourseAlreadyComplete);
        }

        let new_progress = current_progress + 1;
        env.storage().instance().set(&progress_key, &new_progress);

        let tokens_to_mint = course.tokens_per_milestone;
        Self::mint_tokens(&env, learner.clone(), tokens_to_mint);

        MilestoneCompleted {
            learner: learner.clone(),
            course_id,
            milestones_completed: new_progress,
            tokens_minted: tokens_to_mint,
        }
        .publish(&env);

        if new_progress == course.total_milestones {
            CourseCompleted { learner, course_id }.publish(&env);
        }
    }

    pub fn get_progress(env: Env, learner: Address, course_id: u32) -> u32 {
        let progress_key = DataKey::Progress(learner, course_id);
        env.storage().instance().get(&progress_key).unwrap_or(0)
    }

    pub fn is_course_complete(env: Env, learner: Address, course_id: u32) -> bool {
        let course_key = DataKey::Courses(course_id);
        let course: CourseConfig = match env.storage().instance().get(&course_key) {
            Some(c) => c,
            None => return false,
        };

        let progress_key = DataKey::Progress(learner, course_id);
        let progress: u32 = env.storage().instance().get(&progress_key).unwrap_or(0);

        progress >= course.total_milestones
    }

    pub fn get_course_config(env: Env, course_id: u32) -> Option<CourseConfig> {
        let course_key = DataKey::Courses(course_id);
        env.storage().instance().get(&course_key)
    }

    fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&ADMIN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn mint_tokens(env: &Env, to: Address, amount: i128) {
        let learn_token_addr: Address = env
            .storage()
            .instance()
            .get(&LEARN_TOKEN_KEY)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));

        let learn_token_client = crate::LearnTokenClient::new(env, &learn_token_addr);
        learn_token_client.mint(&to, &amount);
    }
}

mod learn_token_client {
    use soroban_sdk::{contractclient, Address, Env};

    #[contractclient(name = "LearnTokenClient")]
    pub trait LearnTokenInterface {
        fn mint(env: Env, to: Address, amount: i128);
    }
}

pub use learn_token_client::LearnTokenClient;

#[cfg(test)]
mod test;
