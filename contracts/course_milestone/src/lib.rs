#![no_std]

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

    fn require_initialized(env: &Env) {
        if !env.storage().instance().has(&ADMIN_KEY) {
            panic_with_error!(env, Error::NotInitialized);
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

#[cfg(test)]
mod test;
