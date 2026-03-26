extern crate std;

use soroban_sdk::{Address, Env, String, contract, contractimpl, testutils::Address as _};

use crate::{CourseConfig, CourseMilestone, CourseMilestoneClient, MilestoneStatus, ScholarStats};

const COURSE_ID: &str = "rust-101";
const EVIDENCE_URI: &str = "ipfs://bafy-test-proof";

fn sid(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

fn setup() -> (Env, Address, Address, CourseMilestoneClient<'static>) {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(CourseMilestone, ());
    env.mock_all_auths();
    let client = CourseMilestoneClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, contract_id, admin, client)
}

#[test]
fn enrolls_learner() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, COURSE_ID);

    client.enroll(&learner, &course_id);

    assert!(client.is_enrolled(&learner, &course_id));
}

#[test]
fn enrolled_learner_can_submit_once_and_submission_is_stored() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, COURSE_ID);
    let evidence_uri = sid(&env, EVIDENCE_URI);

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &1, &evidence_uri);

    let state = client.get_milestone_state(&learner, &course_id, &1);
    assert_eq!(state, MilestoneStatus::Pending);

    let submission = client
        .get_milestone_submission(&learner, &course_id, &1)
        .expect("submission should exist");
    assert_eq!(submission.evidence_uri, evidence_uri);
    assert_eq!(submission.submitted_at, env.ledger().timestamp());
}

#[test]
fn non_enrolled_learner_cannot_submit() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, COURSE_ID);
    let evidence_uri = sid(&env, EVIDENCE_URI);

    let result = client.try_submit_milestone(&learner, &course_id, &1, &evidence_uri);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::NotEnrolled as u32
        )))
    );
}

#[test]
fn duplicate_submission_is_rejected() {
    let (env, _contract_id, _admin, client) = setup();
    let learner = Address::generate(&env);
    let course_id = sid(&env, COURSE_ID);
    let evidence_uri = sid(&env, EVIDENCE_URI);

    client.enroll(&learner, &course_id);
    client.submit_milestone(&learner, &course_id, &7, &evidence_uri);

    let result = client.try_submit_milestone(&learner, &course_id, &7, &evidence_uri);

    assert_eq!(
        result.err(),
        Some(Ok(soroban_sdk::Error::from_contract_error(
            Error::DuplicateSubmission as u32
        )))
    );
}

#[test]
fn test_get_scholar_stats_counts_mixed_states() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let second_learner = Address::generate(&env);

    client.add_course(&1, &3, &50);
    client.add_course(&2, &2, &75);

    client.enroll(&learner, &1);
    client.enroll(&learner, &2);
    client.enroll(&second_learner, &2);

    client.submit_milestone(&learner, &1, &1);
    client.verify_milestone(&learner, &1, &1);

    client.submit_milestone(&learner, &1, &2);

    client.submit_milestone(&learner, &2, &1);
    let reason = String::from_str(&env, "Missing proof");
    client.reject_milestone(&learner, &2, &1, &reason);

    client.submit_milestone(&second_learner, &2, &1);
    client.verify_milestone(&second_learner, &2, &1);

    assert_eq!(
        client.get_scholar_stats(&learner),
        ScholarStats {
            enrolled_courses: 2,
            completed_milestones: 1,
            pending_milestones: 1,
            rejected_milestones: 1,
        }
    );
}

#[test]
fn test_get_scholar_stats_returns_zero_for_unenrolled_learner() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);

    client.add_course(&1, &3, &50);

    assert_eq!(
        client.get_scholar_stats(&learner),
        ScholarStats {
            enrolled_courses: 0,
            completed_milestones: 0,
            pending_milestones: 0,
            rejected_milestones: 0,
        }
    );
}
