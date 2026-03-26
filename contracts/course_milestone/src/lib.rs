#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    Address, Env, String, Symbol, contract, contracterror, contractimpl, contracttype,
    panic_with_error, symbol_short,
};

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Enrollment(Address, String),
    MilestoneState(Address, String, u32),
    MilestoneSubmission(Address, String, u32),
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum MilestoneStatus {
    NotStarted,
    Pending,
    Approved,
    Rejected,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MilestoneSubmission {
    pub evidence_uri: String,
    pub submitted_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct SubmittedEventData {
    pub learner: Address,
    pub course_id: String,
    pub evidence_uri: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct EnrolledEventData {
    pub learner: Address,
    pub course_id: String,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AlreadyEnrolled = 3,
    NotEnrolled = 4,
    DuplicateSubmission = 5,
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

    pub fn enroll(env: Env, learner: Address, course_id: String) {
        Self::require_initialized(&env);
        learner.require_auth();

        let key = DataKey::Enrollment(learner.clone(), course_id.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AlreadyEnrolled);
        }

        env.storage().persistent().set(&key, &true);
        env.events().publish(
            (symbol_short!("enrolled"),),
            EnrolledEventData { learner, course_id },
        );
    }

    pub fn is_enrolled(env: Env, learner: Address, course_id: String) -> bool {
        let key = DataKey::Enrollment(learner, course_id);
        env.storage().persistent().get(&key).unwrap_or(false)
    }

    pub fn submit_milestone(
        env: Env,
        learner: Address,
        course_id: String,
        milestone_id: u32,
        evidence_uri: String,
    ) {
        Self::require_initialized(&env);
        learner.require_auth();

        if !Self::is_enrolled(env.clone(), learner.clone(), course_id.clone()) {
            panic_with_error!(&env, Error::NotEnrolled);
        }

        let state_key = DataKey::MilestoneState(learner.clone(), course_id.clone(), milestone_id);
        let current_state = env
            .storage()
            .persistent()
            .get::<_, MilestoneStatus>(&state_key)
            .unwrap_or(MilestoneStatus::NotStarted);

        if current_state != MilestoneStatus::NotStarted {
            panic_with_error!(&env, Error::DuplicateSubmission);
        }

        let submission = MilestoneSubmission {
            evidence_uri: evidence_uri.clone(),
            submitted_at: env.ledger().timestamp(),
        };
        let submission_key =
            DataKey::MilestoneSubmission(learner.clone(), course_id.clone(), milestone_id);

        env.storage().persistent().set(&submission_key, &submission);
        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Pending);

        env.events().publish(
            (symbol_short!("submitted"), milestone_id),
            SubmittedEventData {
                learner,
                course_id,
                evidence_uri,
            },
        );
    }

    pub fn get_milestone_state(
        env: Env,
        learner: Address,
        course_id: String,
        milestone_id: u32,
    ) -> MilestoneStatus {
        let key = DataKey::MilestoneState(learner, course_id, milestone_id);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(MilestoneStatus::NotStarted)
    }

    pub fn get_milestone_submission(
        env: Env,
        learner: Address,
        course_id: String,
        milestone_id: u32,
    ) -> Option<MilestoneSubmission> {
        let key = DataKey::MilestoneSubmission(learner, course_id, milestone_id);
        env.storage().persistent().get(&key)
    }

    pub fn get_version(env: Env) -> String {
        String::from_str(&env, "1.0.0")
    }

    fn require_initialized(env: &Env) {
        if !env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(env, Error::NotInitialized);
        }
    }
}

#[cfg(test)]
mod test;
