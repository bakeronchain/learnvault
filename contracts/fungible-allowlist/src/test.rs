#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

    fn setup_test() -> (Env, GovernanceTokenClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths(); // Simulates authorizations for testing
        let contract_id = env.register_contract(None, GovernanceToken);
        let client = GovernanceTokenClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        
        // Initialize the contract (assuming an initialize function exists)
        client.initialize(&admin);
        (env, client, admin)
    }

    #[test]
    fn test_mint_to_donor() {
        let (env, client, admin) = setup_test();
        let donor = Address::generate(&env);
        let amount = 1000;

        client.mint(&admin, &donor, &amount);
        assert_eq!(client.balance(&donor), amount);
    }

    #[test]
    fn test_transfer_updates_balances() {
        let (env, client, admin) = setup_test();
        let donor = Address::generate(&env);
        let recipient = Address::generate(&env);
        client.mint(&admin, &donor, &500);

        client.transfer(&donor, &recipient, &200);
        assert_eq!(client.balance(&donor), 300);
        assert_eq!(client.balance(&recipient), 200);
    }

    #[test]
    #[should_panic(expected = "HostCallableError")]
    fn test_unauthorized_mint_fails() {
        let (env, client, _) = setup_test();
        let hacker = Address::generate(&env);
        let receiver = Address::generate(&env);

        // This should fail because 'hacker' is not the 'admin'
        client.mint(&hacker, &receiver, &1000);
    }

    #[test]
    fn test_delegate_voting_power() {
        let (env, client, admin) = setup_test();
        let user = Address::generate(&env);
        let delegatee = Address::generate(&env);
        
        client.mint(&admin, &user, &100);
        client.delegate(&user, &delegatee);
        
        assert_eq!(client.get_votes(&delegatee), 100);
    }
}