use soroban_sdk::contracterror;

pub const MIN_COURSE_ID_LEN: u32 = 1;
pub const MAX_COURSE_ID_LEN: u32 = 64;
pub const MIN_MILESTONE_COUNT: u32 = 1;
pub const MAX_MILESTONE_COUNT: u32 = 100;

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    CourseNotFound = 4,
    MilestoneAlreadyCompleted = 5,
    CourseAlreadyComplete = 6,
    InvalidMilestones = 7,
    AlreadyExists = 8,
    NotEnrolled = 9,
    DuplicateSubmission = 10,
    ContractPaused = 11,
    AlreadyEnrolled = 12,
    InvalidState = 13,
    AlreadyCompleted = 14,
    InvalidReward = 15,
    ArithmeticOverflow = 16,
    OracleUnavailable = 17,
    ManualFallbackDisabled = 18,
    InvalidCourseId = 19,
    InvalidMilestoneCount = 20,
}
