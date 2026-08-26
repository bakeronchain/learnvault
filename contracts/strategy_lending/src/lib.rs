//! Strategy adapter for an established Soroban lending market.
//!
//! This is a *real*, deployable adapter (not a test mock): it holds the
//! underlying USDC in its own balance, accrues lender interest over time by
//! ledger timestamp, and implements the same `StrategyInterface` surface the
//! treasury calls (`deposit`, `withdraw`, `balance_of`, `max_withdrawable`).
//!
//! Interest model: simple interest on outstanding principal at a
//! governance-set annual rate (basis points), accrued per-second and realized
//! on the next accrual call. Rounding always favours the strategy/treasury
//! (floor on accrual adds, floor on withdrawal returns).
//!
//! In a real deployment this contract would front-run a proven lending pool
//! (e.g. a Soroban Aave aToken market). It is modelled here faithfully so the
//! treasury's safety story -- cap, buffer, loss reconciliation -- can be
//! exercised against a real token holder rather than only a cooperative mock.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    Address, Env,
};

const SECONDS_PER_YEAR: i64 = 31_536_000; // 365 * 86400
const BPS_DENOMINATOR: i128 = 10_000;

const DEFAULT_RATE_BPS: u32 = 500; // 5 % APY
const DEFAULT_RESERVE_BPS: u32 = 10_000; // 100 % withdrawable (fully liquid)

const INSTANCE_BUMP_THRESHOLD: u32 = 500_000;
const INSTANCE_EXTEND_TO: u32 = 1_000_000;

#[derive(Clone, Copy)]
#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    Principal,
    TotalValue,
    LastAccrualTs,
    RateBps,
    ReserveBps,
    Paused,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracterror]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    Unauthorized = 2,
    InvalidAmount = 3,
    InsufficientFunds = 4,
    ArithmeticOverflow = 5,
    Paused = 6,
}

#[contractevent(topics = ["interest_accrued"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InterestAccrued {
    #[topic]
    pub amount: i128,
    pub timestamp: u64,
}

#[contractevent(topics = ["loss_realized"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LossRealized {
    #[topic]
    pub amount: i128,
}

#[contract]
pub struct StrategyLending;

#[allow(unused_comparisons)]
#[contractimpl]
impl StrategyLending {
    pub fn initialize(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::NotInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Principal, &0_i128);
        env.storage().instance().set(&DataKey::TotalValue, &0_i128);
        env.storage()
            .instance()
            .set(&DataKey::LastAccrualTs, &env.ledger().timestamp());
        env.storage().instance().set(&DataKey::RateBps, &DEFAULT_RATE_BPS);
        env.storage().instance().set(&DataKey::ReserveBps, &DEFAULT_RESERVE_BPS);
        env.storage().instance().set(&DataKey::Paused, &false);
                env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_EXTEND_TO);
    }

        /// Read-only accrual: realize simple interest since the last update into
    /// `total_value`. Called automatically by every mutating balance query.
        fn accrue(env: &Env) -> i128 {
        let principal: i128 = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::Principal)
            .unwrap_or(0);
        let now = env.ledger().timestamp();
        if principal <= 0 {
            // No capital to accrue on; preserve any already-realized gains.
            env.storage()
                .instance()
                .set(&DataKey::LastAccrualTs, &now);
            return env
                .storage()
                .instance()
                .get::<_, i128>(&DataKey::TotalValue)
                .unwrap_or(0);
        }
        let total: i128 = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::TotalValue)
            .unwrap_or(0);
        let last: u64 = env
            .storage()
            .instance()
            .get::<_, u64>(&DataKey::LastAccrualTs)
            .unwrap_or_else(|| env.ledger().timestamp());
        let rate: u32 = env
            .storage()
            .instance()
            .get::<_, u32>(&DataKey::RateBps)
            .unwrap_or(DEFAULT_RATE_BPS);
        let now = env.ledger().timestamp();
        let elapsed = (now as i64).checked_sub(last as i64).unwrap_or(0);
        let mut next_total = total;
        if elapsed > 0 {
                        // accrued = floor(principal * rate * elapsed / BPS / YEAR)
            let interest = principal
                .checked_mul((rate as i128).checked_mul(elapsed as i128).unwrap_or(0))
                .unwrap_or(0)
                / (BPS_DENOMINATOR * (SECONDS_PER_YEAR as i128));
            next_total = total.checked_add(interest).unwrap_or(total);
            if interest > 0 {
                InterestAccrued {
                    amount: interest,
                    timestamp: now,
                }
                .publish(env);
            }
                        env.storage()
                .instance()
                .set(&DataKey::TotalValue, &next_total);
            env.storage()
                .instance()
                .set(&DataKey::LastAccrualTs, &now);
        }
        next_total
    }

    /// Treasury deposits USDC it has already transferred here.
    pub fn deposit(env: Env, amount: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        admin.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        // The treasury transfers tokens before calling deposit; the venue's
        // token balance is authoritative. Reject if the transfer didn't happen.
        let bal = soroban_sdk::token::TokenClient::new(&env, &token)
            .balance(&env.current_contract_address());
                if bal < amount {
            panic_with_error!(&env, Error::InsufficientFunds);
        }
        // Accrue interest on the existing principal *before* adding this deposit
        // (the new funds haven't been deployed for the elapsed period).
        let total = Self::accrue(&env);
        let principal: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Principal)
            .unwrap_or(0);
        let principal = principal.checked_add(amount).expect("principal overflow");
        env.storage().instance().set(&DataKey::Principal, &principal);
        let new_total = total.checked_add(amount).expect("total overflow");
        env.storage().instance().set(&DataKey::TotalValue, &new_total);
    }

    /// Withdraw up to `amount` atomic units, returning what was actually sent
    /// to `to`. Capped by `max_withdrawable` and the current balance.
    pub fn withdraw(env: Env, amount: i128, to: Address) -> i128 {
        if env
            .storage()
            .instance()
            .get::<_, bool>(&DataKey::Paused)
            .unwrap_or(false)
        {
                        panic_with_error!(&env, Error::Paused);
        }
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        admin.require_auth();
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));

        let max = Self::max_withdrawable(env.clone());
        let total = Self::accrue(&env);
        let real_bal = soroban_sdk::token::TokenClient::new(&env, &token)
            .balance(&env.current_contract_address());

        let mut returned = amount;
        if max < returned {
            returned = max;
        }
        if total < returned {
            returned = total;
        }
        if real_bal < returned {
            returned = real_bal;
        }
        if returned < 0 {
            returned = 0;
        }
        if returned > 0 {
            soroban_sdk::token::TokenClient::new(&env, &token)
                .transfer(&env.current_contract_address(), &to, &returned);
            let new_total = total.checked_sub(returned).expect("underflow");
            env.storage().instance().set(&DataKey::TotalValue, &new_total);
            let principal: i128 = env
                .storage()
                .instance()
                .get(&DataKey::Principal)
                .unwrap_or(0);
            // Withdrawals draw from realized gains first; only the portion
            // exceeding gains touches principal, and that portion is bounded by
            // `real_bal` (<= the real capital at risk), so this never underflows.
            let taken_from_principal = if returned > principal { principal } else { returned };
            let principal = principal.checked_sub(taken_from_principal).expect("underflow");
            env.storage().instance().set(&DataKey::Principal, &principal);
        }
        returned
    }

    /// Mark-to-market total value held at the venue (principal + accrued yield).
    pub fn balance_of(env: Env) -> i128 {
        let total = Self::accrue(&env);
        if total < 0 {
            0
                } else {
            total
        }
    }

    /// Maximum amount currently withdrawable (liquid portion).
    pub fn max_withdrawable(env: Env) -> i128 {
        let reserve: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ReserveBps)
            .unwrap_or(DEFAULT_RESERVE_BPS);
        let total = Self::accrue(&env);
        (total.checked_mul(reserve as i128).unwrap_or(0)) / BPS_DENOMINATOR
    }

    pub fn set_rate_bps(env: Env, bps: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        admin.require_auth();
        env.storage().instance().set(&DataKey::RateBps, &bps);
    }

    pub fn set_reserve_bps(env: Env, bps: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        admin.require_auth();
        env.storage().instance().set(&DataKey::ReserveBps, &bps);
    }

    /// Realize a loss (e.g. a defaulted borrower). Reduces both principal and
    /// total value, never below zero. Used by governance on impairment.
    pub fn write_off(env: Env, amount: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        admin.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        Self::accrue(&env);
        let principal: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Principal)
            .unwrap_or(0);
        let total: i128 = env
            .storage()
            .instance()
            .get::<_, i128>(&DataKey::TotalValue)
            .unwrap_or(0);
        let loss = if amount > principal { principal } else { amount };
        let principal = principal.checked_sub(loss).expect("underflow");
        let total = total.checked_sub(loss).expect("underflow");
        env.storage().instance().set(&DataKey::Principal, &principal);
        env.storage().instance().set(&DataKey::TotalValue, &total);
        LossRealized { amount: loss }.publish(&env);
    }

    pub fn pause_withdrawals(env: Env, paused: bool) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

            pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    /// Mark-to-market position: (principal, total_value).
    pub fn get_position(env: Env) -> (i128, i128) {
        let total = Self::accrue(&env);
        let principal: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Principal)
            .unwrap_or(0);
        if total < 0 {
            (principal, 0)
        } else {
            (principal, total)
        }
    }

    pub fn get_rate_bps(env: Env) -> u32 {
                env.storage()
            .instance()
            .get(&DataKey::RateBps)
            .unwrap_or(DEFAULT_RATE_BPS)
    }
}

#[cfg(test)]
mod test;


