import { Exercise } from "./types";

export const SOROBAN_EXERCISES: Exercise[] = [
  {
    id: "soroban-hello-world",
    title: "Exercise 1: Hello Soroban Function",
    description:
      "Write a public contract function named `hello` that accepts `env: Env` and `to: Symbol` and returns a `Vec<Symbol>` containing `[symbol_short!(\"Hello\"), to]`.",
    preamble:
      "#![no_std]\nuse soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};\n\n#[contract]\npub struct HelloContract;\n\n#[contractimpl]\nimpl HelloContract {",
    starterCode:
      "    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {\n        // Your code here\n        \n    }",
    postscript: "}",
    hints: [
      "Use `vec![&env, ...]` to instantiate a new Soroban vector.",
      "The first element should be `symbol_short!(\"Hello\")`.",
      "Pass `to` as the second element: `vec![&env, symbol_short!(\"Hello\"), to]`.",
    ],
    solution:
      "    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {\n        vec![&env, symbol_short!(\"Hello\"), to]\n    }",
    rules: [
      {
        id: "fn-hello",
        description: "Defines public function `hello`",
        failureMessage: "Missing `pub fn hello(env: Env, to: Symbol) -> Vec<Symbol>` signature.",
        validate: (code) => /pub\s+fn\s+hello\s*\(/.test(code),
      },
      {
        id: "uses-vec-macro",
        description: "Returns a vector constructed with `vec!` macro",
        failureMessage: "Construct the returned vector using `vec![&env, ...]`.",
        validate: (code) => /vec!\s*\[/.test(code),
      },
      {
        id: "includes-hello-symbol",
        description: "Includes `symbol_short!(\"Hello\")`",
        failureMessage: "Must include `symbol_short!(\"Hello\")` in the vector.",
        validate: (code) => /symbol_short!\s*\(\s*"Hello"\s*\)/.test(code),
      },
      {
        id: "includes-to-arg",
        description: "Includes the `to` argument in the result",
        failureMessage: "Ensure `to` is forwarded into the vector.",
        validate: (code) => /to\s*\]/.test(code),
      },
    ],
  },
  {
    id: "soroban-require-auth",
    title: "Exercise 2: Enforcing Caller Authorization",
    description:
      "Before mutating user state or withdrawing funds, verify caller authorization by invoking `caller.require_auth()`.",
    preamble:
      "#![no_std]\nuse soroban_sdk::{contract, contractimpl, Address, Env};\n\n#[contract]\npub struct VaultContract;\n\n#[contractimpl]\nimpl VaultContract {",
    starterCode:
      "    pub fn withdraw(env: Env, caller: Address, amount: i128) {\n        // Enforce authorization first\n        \n        // Transfer logic follows...\n    }",
    postscript: "}",
    hints: [
      "Call `.require_auth()` directly on the `caller` address.",
      "The statement should be `caller.require_auth();` before any state changes.",
    ],
    solution:
      "    pub fn withdraw(env: Env, caller: Address, amount: i128) {\n        caller.require_auth();\n    }",
    rules: [
      {
        id: "fn-withdraw",
        description: "Defines `withdraw` function with `caller: Address`",
        failureMessage: "Keep the `withdraw` function signature intact.",
        validate: (code) => /pub\s+fn\s+withdraw\s*\(/.test(code),
      },
      {
        id: "calls-require-auth",
        description: "Calls `caller.require_auth()`",
        failureMessage: "Add `caller.require_auth();` to verify the caller's cryptographic authorization.",
        validate: (code) => /caller\.require_auth\s*\(\s*\)/.test(code),
      },
    ],
  },
  {
    id: "soroban-token-client",
    title: "Exercise 3: Interacting with Stellar Asset Contract (SAC)",
    description:
      "Instantiate `token::Client` and call `transfer` from `from` address to `to` address for `amount`.",
    preamble:
      "#![no_std]\nuse soroban_sdk::{contract, contractimpl, token, Address, Env};\n\n#[contract]\npub struct PaymentContract;\n\n#[contractimpl]\nimpl PaymentContract {",
    starterCode:
      "    pub fn pay(env: Env, token: Address, from: Address, to: Address, amount: i128) {\n        // Instantiate token client and transfer\n        \n    }",
    postscript: "}",
    hints: [
      "Create the client with `let client = token::Client::new(&env, &token);`.",
      "Execute transfer with `client.transfer(&from, &to, &amount);`.",
    ],
    solution:
      "    pub fn pay(env: Env, token: Address, from: Address, to: Address, amount: i128) {\n        let client = token::Client::new(&env, &token);\n        client.transfer(&from, &to, &amount);\n    }",
    rules: [
      {
        id: "creates-token-client",
        description: "Instantiates `token::Client::new(&env, &token)`",
        failureMessage: "Instantiate the client using `token::Client::new(&env, &token)`.",
        validate: (code) => /token::Client::new\s*\(\s*&env\s*,\s*&token\s*\)/.test(code),
      },
      {
        id: "calls-transfer",
        description: "Calls `.transfer(&from, &to, &amount)`",
        failureMessage: "Invoke `.transfer(&from, &to, &amount)` on the token client.",
        validate: (code) => /\.transfer\s*\(\s*&from\s*,\s*&to\s*,\s*&amount\s*\)/.test(code),
      },
    ],
  },
];
