extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{LRNError, LearnToken, LearnTokenClient};

fn setup(e: &Env) -> (Address, Address, LearnTokenClient) {
    let admin = Address::generate(e);
    let id = e.register(LearnToken, ());
    e.mock_all_auths();
    let client = LearnTokenClient::new(e, &id);
    client.initialize(&admin);
    (id, admin, client)
}

// TODO: uncomment and complete once `initialize` and `mint` are implemented.

// #[test]
// fn mint_increases_balance() {
//     let e = Env::default();
//     let (_, _admin, client) = setup(&e);
//     let learner = Address::generate(&e);
//     client.mint(&learner, &100);
//     assert_eq!(client.balance(&learner), 100);
// }

// #[test]
// #[should_panic(expected = "Error(Contract, #1)")]
// fn transfer_is_blocked() {
//     let e = Env::default();
//     let (_, _admin, client) = setup(&e);
//     let a = Address::generate(&e);
//     let b = Address::generate(&e);
//     client.mint(&a, &50);
//     client.transfer(&a, &b, &10);
// }

// #[test]
// #[should_panic]
// fn unauthorized_mint_fails() {
//     let e = Env::default();
//     let (_, _, client) = setup(&e);
//     let stranger = Address::generate(&e);
//     // do NOT mock auths — should fail
//     client.mint(&stranger, &100);
// }
