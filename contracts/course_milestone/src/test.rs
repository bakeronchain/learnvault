extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{CourseConfig, CourseMilestone, CourseMilestoneClient};

fn setup() -> (Env, Address, Address, CourseMilestoneClient<'static>) {
    let env = Env::default();

    let admin = Address::generate(&env);
    let learn_token_contract = Address::generate(&env);

    let contract_id = env.register(CourseMilestone, ());
    env.mock_all_auths();
    let client = CourseMilestoneClient::new(&env, &contract_id);
    client.initialize(&admin, &learn_token_contract);

    (env, admin, contract_id, client)
}

#[test]
fn test_initialize() {
    let (_env, _admin, _contract_id, _client) = setup();
}

#[test]
fn test_add_course() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let course_id: u32 = 1;
    client.add_course(&course_id, &5, &100);

    let config = client.get_course_config(&course_id);
    assert_eq!(
        config,
        Some(CourseConfig {
            total_milestones: 5,
            tokens_per_milestone: 100,
        })
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_add_course_invalid_milestones() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let course_id: u32 = 1;
    client.add_course(&course_id, &0, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_add_course_duplicate() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let course_id: u32 = 1;
    client.add_course(&course_id, &5, &100);
    client.add_course(&course_id, &5, &100);
}

#[test]
fn test_get_progress_zero_initially() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &5, &100);

    assert_eq!(client.get_progress(&learner, &course_id), 0);
}

#[test]
fn test_is_course_complete_false_initially() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 1;

    client.add_course(&course_id, &5, &100);

    assert!(!client.is_course_complete(&learner, &course_id));
}

#[test]
fn test_is_course_complete_nonexistent_course() {
    let (env, _admin, _contract_id, client) = setup();
    env.mock_all_auths();

    let learner = Address::generate(&env);
    let course_id: u32 = 999;

    assert!(!client.is_course_complete(&learner, &course_id));
}
