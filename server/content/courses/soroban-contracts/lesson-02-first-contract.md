# Lesson 2: Your First Soroban Contract - A Simple Counter

Welcome to your first hands-on Soroban smart contract development! In this lesson, you'll write a simple counter contract that demonstrates the fundamental patterns used in Soroban development. These same patterns are used throughout the LearnVault project, especially in the CourseMilestone contract.

## Project Structure — What a Soroban Contract Directory Looks Like

A typical Soroban contract follows a standard Rust project structure with some specific conventions:

```
my-counter/
├── Cargo.toml              # Rust dependencies and project metadata
├── src/
│   ├── lib.rs             # Main contract implementation
│   └── test.rs           # Unit tests for the contract
└── .gitignore           # Git ignore file
```

Let's look at the essential `Cargo.toml` for a Soroban contract:

```toml
[package]
name = "my-counter"
version = "0.1.0"
edition = "2021"

[dependencies]
soroban-sdk = "23.0.1"

[dev-dependencies]
soroban-sdk = { version = "23.0.1", features = ["testutils"] }

[lib]
crate-type = ["cdylib"]

[profile.release]
opt-level = "z"
lto = true
```

Key points:
- `soroban-sdk` is the main dependency for Soroban development
- `testutils` feature enables testing utilities
- `crate-type = ["cdylib"]` tells Rust to compile as a dynamic library suitable for WASM

## The Contract Struct — #[contract] and #[contractimpl]

Every Soroban contract starts with a struct that represents your contract. The `#[contract]` and `#[contractimpl]` attributes are crucial markers that tell the Soroban SDK how to treat your code.

```rust
#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct Counter;

#[contractimpl]
impl Counter {
    pub fn new(env: Env, initializer: Address) -> i32 {
        // Constructor logic here
        0
    }
    
    pub fn increment(env: Env) -> i32 {
        // Increment logic here
        0
    }
    
    pub fn get(env: Env) -> i32 {
        // Get current value logic here
        0
    }
}
```

Breaking this down:

- `#![no_std]` tells Rust not to use the standard library (smart contracts run in constrained environments)
- `#[contract]` marks `Counter` as a contract struct
- `#[contractimpl]` marks the implementation block as containing callable contract functions
- Every function receives an `Env` parameter - the Soroban environment providing access to storage, crypto, and other blockchain features

## Storage — Instance vs Persistent Storage, Contracttype Keys

Soroban provides two types of storage, each with different characteristics:

### Instance Storage
- Lives as long as the contract instance exists
- Gets reset when contract code is upgraded
- Good for configuration data that should reset on upgrades

### Persistent Storage
- Survives contract upgrades
- Good for user data that must persist across upgrades
- More expensive gas costs than instance storage

### Storage Keys

Storage keys need to be serializable and unique. The `#[contracttype]` attribute makes a type usable as a storage key:

```rust
use soroban_sdk::{contracttype, Symbol};

// Simple symbol key for instance storage
const COUNTER_KEY: Symbol = soroban_sdk::symbol_short!("COUNTER");

// Enum key for more complex data organization
#[derive(Clone, contracttype)]
pub enum DataKey {
    Counter,
    LastUpdated,
    User(Address),
}
```

## Writing a Counter — Increment, Get Functions with Real Rust Code Snippets

Now let's build our complete counter contract with proper storage management:

```rust
#![no_std]

use soroban_sdk::{
    contract, contractimpl, Address, Env, Symbol, panic_with_error,
};

// Storage key for our counter value
const COUNTER_KEY: Symbol = soroban_sdk::symbol_short!("COUNTER");
const OWNER_KEY: Symbol = soroban_sdk::symbol_short!("OWNER");

// Error types for better error handling
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAuthorized = 1,
    NotInitialized = 2,
}

#[contract]
pub struct Counter;

#[contractimpl]
impl Counter {
    /// Initialize the contract with an owner
    pub fn initialize(env: Env, owner: Address) {
        // Check if already initialized
        if env.storage().instance().has(&OWNER_KEY) {
            panic_with_error!(&env, Error::NotInitialized);
        }
        
        // Set the owner
        env.storage().instance().set(&OWNER_KEY, &owner);
        
        // Initialize counter to 0
        env.storage().instance().set(&COUNTER_KEY, &0_i32);
    }
    
    /// Increment the counter by 1
    pub fn increment(env: Env) -> i32 {
        // Get current value, default to 0 if not set
        let current = env.storage()
            .instance()
            .get::<_, i32>(&COUNTER_KEY)
            .unwrap_or(0);
        
        let new_value = current + 1;
        
        // Store the new value
        env.storage().instance().set(&COUNTER_KEY, &new_value);
        
        new_value
    }
    
    /// Get the current counter value
    pub fn get(env: Env) -> i32 {
        env.storage()
            .instance()
            .get::<_, i32>(&COUNTER_KEY)
            .unwrap_or(0)
    }
    
    /// Get the contract owner
    pub fn get_owner(env: Env) -> Address {
        env.storage()
            .instance()
            .get::<_, Address>(&OWNER_KEY)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }
}
```

Key concepts in this implementation:

1. **Storage Access**: `env.storage().instance()` provides access to instance storage
2. **Error Handling**: `panic_with_error!` provides structured error reporting
3. **Default Values**: `unwrap_or(0)` provides sensible defaults
4. **Type Safety**: All storage operations are type-safe at compile time

## Writing a Test — Using Env::default(), mock_all_auths(), Assertions

Testing is crucial for smart contract development. Soroban provides excellent testing utilities:

```rust
#[cfg(test)]
mod test {
    use soroban_sdk::{Address, Env};
    use crate::{Counter, CounterClient, Error};

    fn setup_test() -> (Env, CounterClient, Address) {
        let env = Env::default();
        let contract_id = env.register(Counter, ());
        let client = CounterClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        
        // Mock all authentication for setup
        env.mock_all_auths();
        client.initialize(&owner);
        env.set_auths(&[]); // Clear auths for actual tests
        
        (env, client, owner)
    }

    #[test]
    fn test_counter_initialization() {
        let env = Env::default();
        let contract_id = env.register(Counter, ());
        let client = CounterClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        
        // Test initialization
        client.initialize(&owner);
        
        // Verify initial state
        assert_eq!(client.get(), 0);
        assert_eq!(client.get_owner(), owner);
        
        // Test double initialization fails
        let result = client.try_initialize(&owner);
        assert_eq!(
            result.err(),
            Some(Ok(soroban_sdk::Error::from_contract_error(
                Error::NotInitialized as u32
            )))
        );
    }

    #[test]
    fn test_increment_functionality() {
        let (env, client, _owner) = setup_test();
        
        // Initial value should be 0
        assert_eq!(client.get(), 0);
        
        // Increment and check
        assert_eq!(client.increment(), 1);
        assert_eq!(client.get(), 1);
        
        // Multiple increments
        assert_eq!(client.increment(), 2);
        assert_eq!(client.increment(), 3);
        assert_eq!(client.get(), 3);
    }

    #[test]
    fn test_persistence_across_calls() {
        let (env, client, _owner) = setup_test();
        
        // Increment several times
        for i in 1..=5 {
            assert_eq!(client.increment(), i);
        }
        
        // Value persists
        assert_eq!(client.get(), 5);
        
        // New increments continue from saved value
        assert_eq!(client.increment(), 6);
        assert_eq!(client.get(), 6);
    }
}
```

Testing patterns demonstrated:

1. **Setup Function**: Reusable test setup with `Env::default()` and `env.register()`
2. **Authentication Mocking**: `mock_all_auths()` for setup, `set_auths(&[])` for actual tests
3. **Error Testing**: Using `try_*` methods and checking error results
4. **State Verification**: Assertions to verify contract behavior

## Building to WASM — cargo build --target wasm32v1-none

Soroban contracts compile to WebAssembly (WASM) for blockchain execution. Here's how to build your contract:

```bash
# Install the WASM target if you haven't already
rustup target add wasm32v1-none

# Build the contract
cargo build --target wasm32v1-none --release

# The WASM file will be at:
# target/wasm32v1-none/release/my_counter.wasm
```

For development, you can also use the Soroban CLI:

```bash
# Install soroban-cli (if not already installed)
cargo install soroban-cli

# Build using soroban-cli (handles target automatically)
soroban contract build

# This creates a .wasm file in the target/wasm32v1-none/release directory
```

The WASM file is what gets deployed to the Stellar network. It contains your compiled contract logic in a format that the Stellar runtime can execute.

## How This Relates to LearnVault — CourseMilestone Uses the Same Patterns

The patterns you've learned here are directly applicable to the LearnVault project. Let's examine how the CourseMilestone contract uses these same concepts:

**Contract Structure**: Like our counter, CourseMilestone uses `#[contract]` and `#[contractimpl]` attributes:

```rust
// From CourseMilestone contract
#[contract]
pub struct CourseMilestone;

#[contractimpl]
impl CourseMilestone {
    pub fn initialize(env: Env, admin: Address, learn_token: Address) {
        // Similar initialization pattern
    }
}
```

**Storage Management**: CourseMilestone uses both instance and persistent storage:

```rust
// Instance storage for contract configuration
const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const LEARN_TOKEN_KEY: Symbol = symbol_short!("LEARN_TOKEN");

// Persistent storage for user data
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Milestone(u32),
    StudentProgress(Address),
}
```

**Error Handling**: CourseMilestone defines comprehensive error types just like our counter:

```rust
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    Unauthorized = 2,
    AlreadyCompleted = 3,
    // ... more error types
}
```

**Testing Patterns**: The CourseMilestone tests follow the same structure we used:

```rust
fn setup(env: &Env) -> (Address, Address, CourseMilestoneClient) {
    let admin = Address::generate(env);
    let learn_token = Address::generate(env);
    let contract_id = env.register(CourseMilestone, ());
    let client = CourseMilestoneClient::new(env, &contract_id);
    
    env.mock_all_auths();
    client.initialize(&admin, &learn_token);
    
    (contract_id, admin, client)
}
```

The key difference is complexity - CourseMilestone manages course progress, token rewards, and multiple user interactions, while our counter focuses on a single value. But the fundamental patterns are identical.

## Challenge Exercise

Now it's your turn to apply what you've learned! Modify the counter contract to only allow the owner to increment the counter.

**Requirements:**
1. The `increment` function should check that the caller is the contract owner
2. If an unauthorized user tries to increment, return an appropriate error
3. Add a test case that verifies the authorization works correctly
4. Add a test case that verifies unauthorized access is rejected

**Hints:**
- You'll need to use `require_auth()` to check the caller
- The `get_owner()` function we wrote will be helpful
- Look at how CourseMilestone handles authorization in its functions
- Remember to mock authentication in your tests

This exercise will reinforce the authentication patterns that are critical in real-world smart contracts, especially in the LearnVault ecosystem where controlling who can perform actions is essential for maintaining course integrity and token distribution fairness.

Good luck, and enjoy building your Soroban contracts!
