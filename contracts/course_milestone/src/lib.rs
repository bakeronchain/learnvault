#![no_std]

use soroban_sdk::{
    Address, Env, String, Symbol, Vec, contract, contracterror, contractevent, contractimpl,
    contracttype, panic_with_error, symbol_short,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CourseConfig {
    pub total_milestones: u32,
    pub tokens_per_milestone: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Verified,
    Rejected,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScholarStats {
    pub enrolled_courses: u32,
    pub completed_milestones: u32,
    pub pending_milestones: u32,
    pub rejected_milestones: u32,
}

#[contracttype]
pub enum DataKey {
    Admin,
    LearnTokenContract,
    Courses(u32),
    Progress(Address, u32),
    Enrolled(Address, u32),
    LearnerCourses(Address),
    MilestoneState(Address, u32, u32), // (learner, course_id, milestone_id)
    RejectionReason(Address, u32, u32), // (learner, course_id, milestone_id)
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const LEARN_TOKEN_KEY: Symbol = symbol_short!("LRN_TKN");

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

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
    NotEnrolled = 9,
    MilestoneAlreadyVerified = 10,
    MilestoneNotPending = 11,
    InvalidMilestoneId = 12,
    AlreadyEnrolled = 13,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

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

#[contractevent]
pub struct MilestoneVerified {
    pub learner: Address,
    pub course_id: u32,
    pub milestone_id: u32,
}

#[contractevent]
pub struct MilestoneRejected {
    pub learner: Address,
    pub course_id: u32,
    pub milestone_id: u32,
    pub reason: String,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct CourseMilestone;

#[contractimpl]
impl CourseMilestone {
    // -----------------------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Course management
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Enrollment
    // -----------------------------------------------------------------------

    /// Enroll a learner in a course. The course must exist.
    pub fn enroll(env: Env, learner: Address, course_id: u32) {
        learner.require_auth();

        // Course must exist
        if !env.storage().instance().has(&DataKey::Courses(course_id)) {
            panic_with_error!(&env, Error::CourseNotFound);
        }

        let key = DataKey::Enrolled(learner.clone(), course_id);
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AlreadyEnrolled);
        }
        env.storage().persistent().set(&key, &true);

        let learner_courses_key = DataKey::LearnerCourses(learner);
        let mut learner_courses = env
            .storage()
            .persistent()
            .get::<_, Vec<u32>>(&learner_courses_key)
            .unwrap_or(Vec::new(&env));
        learner_courses.push_back(course_id);
        env.storage()
            .persistent()
            .set(&learner_courses_key, &learner_courses);
    }

    /// Check whether a learner is enrolled in a course.
    pub fn is_enrolled(env: Env, learner: Address, course_id: u32) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Enrolled(learner, course_id))
    }

    // -----------------------------------------------------------------------
    // Milestone submission & admin review
    // -----------------------------------------------------------------------

    /// Submit a milestone for admin review. Sets status to Pending.
    pub fn submit_milestone(env: Env, learner: Address, course_id: u32, milestone_id: u32) {
        learner.require_auth();

        // Course must exist and milestone_id must be valid
        let course: CourseConfig = env
            .storage()
            .instance()
            .get(&DataKey::Courses(course_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::CourseNotFound));

        if milestone_id == 0 || milestone_id > course.total_milestones {
            panic_with_error!(&env, Error::InvalidMilestoneId);
        }

        // Learner must be enrolled
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Enrolled(learner.clone(), course_id))
        {
            panic_with_error!(&env, Error::NotEnrolled);
        }

        // Must not already be verified
        let state_key = DataKey::MilestoneState(learner.clone(), course_id, milestone_id);
        if let Some(status) = env
            .storage()
            .persistent()
            .get::<_, MilestoneStatus>(&state_key)
        {
            if status == MilestoneStatus::Verified {
                panic_with_error!(&env, Error::MilestoneAlreadyVerified);
            }
        }

        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Pending);
    }

    /// Admin-only: verify a submitted milestone, mint LRN reward, emit event.
    pub fn verify_milestone(env: Env, learner: Address, course_id: u32, milestone_id: u32) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        // Course must exist
        let course: CourseConfig = env
            .storage()
            .instance()
            .get(&DataKey::Courses(course_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::CourseNotFound));

        if milestone_id == 0 || milestone_id > course.total_milestones {
            panic_with_error!(&env, Error::InvalidMilestoneId);
        }

        // Learner must be enrolled
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Enrolled(learner.clone(), course_id))
        {
            panic_with_error!(&env, Error::NotEnrolled);
        }

        // Milestone must not already be verified
        let state_key = DataKey::MilestoneState(learner.clone(), course_id, milestone_id);
        if let Some(status) = env
            .storage()
            .persistent()
            .get::<_, MilestoneStatus>(&state_key)
        {
            if status == MilestoneStatus::Verified {
                panic_with_error!(&env, Error::MilestoneAlreadyVerified);
            }
        }

        // Transition to Verified
        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Verified);

        // Update overall progress counter
        let progress_key = DataKey::Progress(learner.clone(), course_id);
        let current_progress: u32 = env.storage().instance().get(&progress_key).unwrap_or(0);
        let new_progress = current_progress + 1;
        env.storage().instance().set(&progress_key, &new_progress);

        // Mint LRN reward
        Self::mint_tokens(&env, learner.clone(), course.tokens_per_milestone);

        // Emit verification event
        MilestoneVerified {
            learner: learner.clone(),
            course_id,
            milestone_id,
        }
        .publish(&env);

        // If all milestones verified, emit course completion
        if new_progress >= course.total_milestones {
            CourseCompleted { learner, course_id }.publish(&env);
        }
    }

    /// Admin-only: reject a pending milestone with a reason, emit event.
    pub fn reject_milestone(
        env: Env,
        learner: Address,
        course_id: u32,
        milestone_id: u32,
        reason: String,
    ) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        // Course must exist
        let course: CourseConfig = env
            .storage()
            .instance()
            .get(&DataKey::Courses(course_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::CourseNotFound));

        if milestone_id == 0 || milestone_id > course.total_milestones {
            panic_with_error!(&env, Error::InvalidMilestoneId);
        }

        // Milestone must be in Pending state
        let state_key = DataKey::MilestoneState(learner.clone(), course_id, milestone_id);
        let status: MilestoneStatus = env
            .storage()
            .persistent()
            .get(&state_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::MilestoneNotPending));

        if status != MilestoneStatus::Pending {
            panic_with_error!(&env, Error::MilestoneNotPending);
        }

        // Transition to Rejected
        env.storage()
            .persistent()
            .set(&state_key, &MilestoneStatus::Rejected);

        // Store the rejection reason
        let reason_key = DataKey::RejectionReason(learner.clone(), course_id, milestone_id);
        env.storage().persistent().set(&reason_key, &reason);

        // Emit rejection event
        MilestoneRejected {
            learner,
            course_id,
            milestone_id,
            reason,
        }
        .publish(&env);
    }

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    /// Get the milestone status for a specific (learner, course, milestone).
    pub fn get_milestone_status(
        env: Env,
        learner: Address,
        course_id: u32,
        milestone_id: u32,
    ) -> Option<MilestoneStatus> {
        env.storage()
            .persistent()
            .get(&DataKey::MilestoneState(learner, course_id, milestone_id))
    }

    /// Get the rejection reason for a rejected milestone.
    pub fn get_rejection_reason(
        env: Env,
        learner: Address,
        course_id: u32,
        milestone_id: u32,
    ) -> Option<String> {
        env.storage()
            .persistent()
            .get(&DataKey::RejectionReason(learner, course_id, milestone_id))
    }

    // -----------------------------------------------------------------------
    // Existing milestone + progress queries
    // -----------------------------------------------------------------------

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

    pub fn get_scholar_stats(env: Env, learner: Address) -> ScholarStats {
        let learner_courses_key = DataKey::LearnerCourses(learner.clone());
        let learner_courses = env
            .storage()
            .persistent()
            .get::<_, Vec<u32>>(&learner_courses_key)
            .unwrap_or(Vec::new(&env));

        if learner_courses.is_empty() {
            return ScholarStats {
                enrolled_courses: 0,
                completed_milestones: 0,
                pending_milestones: 0,
                rejected_milestones: 0,
            };
        }

        let mut stats = ScholarStats {
            enrolled_courses: learner_courses.len(),
            completed_milestones: 0,
            pending_milestones: 0,
            rejected_milestones: 0,
        };

        let mut course_index = 0_u32;
        while course_index < learner_courses.len() {
            let course_id = learner_courses.get(course_index).unwrap();
            if let Some(course) = env
                .storage()
                .instance()
                .get::<_, CourseConfig>(&DataKey::Courses(course_id))
            {
                let mut milestone_id = 1_u32;
                while milestone_id <= course.total_milestones {
                    let state_key =
                        DataKey::MilestoneState(learner.clone(), course_id, milestone_id);
                    if let Some(status) = env
                        .storage()
                        .persistent()
                        .get::<_, MilestoneStatus>(&state_key)
                    {
                        match status {
                            MilestoneStatus::Pending => stats.pending_milestones += 1,
                            MilestoneStatus::Verified => stats.completed_milestones += 1,
                            MilestoneStatus::Rejected => stats.rejected_milestones += 1,
                        }
                    }
                    milestone_id += 1;
                }
            }
            course_index += 1;
        }

        stats
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

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
    use soroban_sdk::{Address, Env, contractclient};

    #[contractclient(name = "LearnTokenClient")]
    pub trait LearnTokenInterface {
        fn mint(env: Env, to: Address, amount: i128);
    }
}

pub use learn_token_client::LearnTokenClient;

#[cfg(test)]
mod test;
