//! Contributor Registry Contract
//!
//! Tracks on-chain reputation for contributors across the Bounty Board
//! ecosystem. This contract is invoked cross-contract by `BountyBoard`
//! whenever a bounty is successfully paid out, and it is the single
//! source of truth for contributor stats and trust scoring.
//!
//! It is intentionally decoupled from `BountyBoard` so that other
//! contracts (future modules: dispute resolution, grants, etc.) could
//! also write reputation events into the same registry.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributorStats {
    pub completed_bounties: u32,
    pub total_earned: i128,
    pub reputation_score: u32, // 0 - 1000, weighted score
    pub disputes_lost: u32,
}

#[contracttype]
enum DataKey {
    Admin,
    Stats(Address),
    // Set of contract addresses allowed to write reputation events
    // (in practice, the deployed BountyBoard contract address).
    AuthorizedWriter(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum RegistryError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
}

#[contractevent(topics = ["reputation", "bounty_completed"])]
pub struct BountyCompletedEvent {
    #[topic]
    pub contributor: Address,
    pub new_score: u32,
    pub total_earned: i128,
    pub completed_bounties: u32,
}

#[contractevent(topics = ["reputation", "dispute_recorded"])]
pub struct DisputeRecordedEvent {
    #[topic]
    pub contributor: Address,
    pub new_score: u32,
}

#[contractevent(topics = ["registry", "writer_authorized"])]
pub struct WriterAuthorizedEvent {
    #[topic]
    pub writer: Address,
}

const STARTING_SCORE: u32 = 500;
const MAX_SCORE: u32 = 1000;
const COMPLETION_BONUS: u32 = 15;
const DISPUTE_PENALTY: u32 = 60;

#[contract]
pub struct ContributorRegistry;

#[contractimpl]
impl ContributorRegistry {
    /// One-time setup. `admin` is allowed to authorize which BountyBoard
    /// contract instance(s) may write reputation events.
    pub fn initialize(env: Env, admin: Address) -> Result<(), RegistryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Admin authorizes a BountyBoard contract address to call
    /// `record_completion` / `record_dispute` on behalf of contributors.
    pub fn authorize_writer(env: Env, writer: Address) -> Result<(), RegistryError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(RegistryError::NotInitialized)?;
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::AuthorizedWriter(writer.clone()), &true);

        WriterAuthorizedEvent { writer }.publish(&env);
        Ok(())
    }

    /// Called cross-contract by BountyBoard when a bounty payout completes.
    /// `caller` must be an authorized writer contract; BountyBoard passes
    /// its own address, and we verify that address is on the allow-list.
    pub fn record_completion(
        env: Env,
        caller: Address,
        contributor: Address,
        amount_paid: i128,
    ) -> Result<ContributorStats, RegistryError> {
        caller.require_auth();
        Self::assert_authorized(&env, &caller)?;

        if amount_paid <= 0 {
            return Err(RegistryError::InvalidAmount);
        }

        let mut stats = Self::get_stats_internal(&env, &contributor);
        stats.completed_bounties += 1;
        stats.total_earned += amount_paid;
        stats.reputation_score = (stats.reputation_score + COMPLETION_BONUS).min(MAX_SCORE);

        env.storage()
            .persistent()
            .set(&DataKey::Stats(contributor.clone()), &stats);

        BountyCompletedEvent {
            contributor,
            new_score: stats.reputation_score,
            total_earned: stats.total_earned,
            completed_bounties: stats.completed_bounties,
        }
        .publish(&env);

        Ok(stats)
    }

    /// Called cross-contract by BountyBoard when a submission is disputed
    /// and rejected, penalizing the contributor's score.
    pub fn record_dispute(
        env: Env,
        caller: Address,
        contributor: Address,
    ) -> Result<ContributorStats, RegistryError> {
        caller.require_auth();
        Self::assert_authorized(&env, &caller)?;

        let mut stats = Self::get_stats_internal(&env, &contributor);
        stats.disputes_lost += 1;
        stats.reputation_score = stats.reputation_score.saturating_sub(DISPUTE_PENALTY);

        env.storage()
            .persistent()
            .set(&DataKey::Stats(contributor.clone()), &stats);

        DisputeRecordedEvent {
            contributor,
            new_score: stats.reputation_score,
        }
        .publish(&env);

        Ok(stats)
    }

    /// Public read-only view for the frontend / other contracts.
    pub fn get_stats(env: Env, contributor: Address) -> ContributorStats {
        Self::get_stats_internal(&env, &contributor)
    }

    pub fn tier_label(env: Env, contributor: Address) -> String {
        let stats = Self::get_stats_internal(&env, &contributor);
        match stats.reputation_score {
            0..=399 => String::from_str(&env, "New"),
            400..=649 => String::from_str(&env, "Trusted"),
            650..=849 => String::from_str(&env, "Veteran"),
            _ => String::from_str(&env, "Elite"),
        }
    }

    fn assert_authorized(env: &Env, caller: &Address) -> Result<(), RegistryError> {
        let is_authorized = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedWriter(caller.clone()))
            .unwrap_or(false);
        if !is_authorized {
            return Err(RegistryError::Unauthorized);
        }
        Ok(())
    }

    fn get_stats_internal(env: &Env, contributor: &Address) -> ContributorStats {
        env.storage()
            .persistent()
            .get(&DataKey::Stats(contributor.clone()))
            .unwrap_or(ContributorStats {
                completed_bounties: 0,
                total_earned: 0,
                reputation_score: STARTING_SCORE,
                disputes_lost: 0,
            })
    }
}

mod test;
