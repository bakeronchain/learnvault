extern crate std;

use soroban_sdk::{Address, Env, testutils::Address as _};

use crate::{CourseMilestone, CourseMilestoneClient};

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
fn test_enroll() {
    let (env, _contract_id, _admin, client) = setup();

    let learner = Address::generate(&env);
    let course_id: u32 = 1000;

    client.enroll(&learner, &course_id);
}

#[test]
#[should_panic]
fn test_enroll_twice() {
    let (env, _contract_id, _admin, client) = setup();

    let learner = Address::generate(&env);
    let course_id: u32 = 1000;

    client.enroll(&learner, &course_id);
    client.enroll(&learner, &course_id);
    // assert!(result.is_err(), Error::AlreadyEnrolled)
}

#[test]
fn test_is_enrolled() {
    let (env, _contract_id, _admin, client) = setup();

    let learner = Address::generate(&env);
    let course_id: u32 = 1000;

    client.enroll(&learner, &course_id);

    let is_enrolled = client.is_enrolled(&learner, &course_id);
    assert!(is_enrolled);
}

#[test]
fn test_enroll_multiple_users() {
    let (env, _contract_id, _admin, client) = setup();

    let learner = Address::generate(&env);
    let course_id: u32 = 1000;

    client.enroll(&learner, &course_id);
    client.enroll(&Address::generate(&env), &1000);
    client.enroll(&Address::generate(&env), &1000);
    client.enroll(&Address::generate(&env), &1000);
    client.enroll(&Address::generate(&env), &2000);
    client.enroll(&Address::generate(&env), &2000);
}
