//! Bounty Board Contract
//!
//! A community micro-grants / bounty marketplace. Sponsors fund bounties
//! in a configured SAC token, contributors submit work, sponsors approve
//! or dispute, and on approval funds are released atomically while the
//! contributor's on-chain reputation is updated via a cross-contract call
//! into `ContributorRegistry`.
//!
//! State machine per bounty:
//!   Open -> Submitted -> Paid
//!                     \-> Disputed -> Paid | Cancelled
//!   Open -> Cancelled (sponsor can cancel/reclaim before a submission)

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env,
    String, Vec,
};

mod registry {
    // Cross-contract client generated from the Contributor Registry's
    // exported interface. This is how BountyBoard talks to the other
    // contract on-chain.
    soroban_sdk::contractimport!(
        file = "../contributor-registry/target/wasm32-unknown-unknown/release/contributor_registry.wasm"
    );
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BountyStatus {
    Open,
    Submitted,
    Disputed,
    Paid,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Bounty {
    pub id: u32,
    pub sponsor: Address,
    pub title: String,
    pub description: String,
    pub reward: i128,
    pub status: BountyStatus,
    pub contributor: Option<Address>,
    pub submission_note: Option<String>,
    pub created_at: u64,
}

#[contracttype]
enum DataKey {
    Admin,
    TokenAddress,
    RegistryAddress,
    BountyCount,
    Bounty(u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum BoardError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    BountyNotFound = 3,
    InvalidState = 4,
    Unauthorized = 5,
    InvalidReward = 6,
}

#[contract]
pub struct BountyBoard;

#[contractimpl]
impl BountyBoard {
    /// Initialize the board with the SAC token used for rewards and the
    /// address of the deployed ContributorRegistry contract.
    pub fn initialize(
        env: Env,
        admin: Address,
        token_address: Address,
        registry_address: Address,
    ) -> Result<(), BoardError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(BoardError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenAddress, &token_address);
        env.storage()
            .instance()
            .set(&DataKey::RegistryAddress, &registry_address);
        env.storage().instance().set(&DataKey::BountyCount, &0u32);
        Ok(())
    }

    /// Sponsor posts a new bounty and escrows the reward into this
    /// contract via the SAC token's `transfer`.
    pub fn post_bounty(
        env: Env,
        sponsor: Address,
        title: String,
        description: String,
        reward: i128,
    ) -> Result<u32, BoardError> {
        sponsor.require_auth();
        if reward <= 0 {
            return Err(BoardError::InvalidReward);
        }

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .ok_or(BoardError::NotInitialized)?;

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&sponsor, &env.current_contract_address(), &reward);

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::BountyCount)
            .unwrap_or(0);

        let bounty = Bounty {
            id,
            sponsor: sponsor.clone(),
            title,
            description,
            reward,
            status: BountyStatus::Open,
            contributor: None,
            submission_note: None,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&DataKey::Bounty(id), &bounty);
        env.storage()
            .instance()
            .set(&DataKey::BountyCount, &(id + 1));

        env.events().publish(
            (soroban_sdk::Symbol::new(&env, "bounty"), soroban_sdk::Symbol::new(&env, "posted"), id),
            (sponsor, reward),
        );

        Ok(id)
    }

    /// A contributor claims/submits work on an Open bounty.
    pub fn submit_work(
        env: Env,
        bounty_id: u32,
        contributor: Address,
        note: String,
    ) -> Result<(), BoardError> {
        contributor.require_auth();
        let mut bounty = Self::get_bounty_internal(&env, bounty_id)?;

        if bounty.status != BountyStatus::Open {
            return Err(BoardError::InvalidState);
        }

        bounty.status = BountyStatus::Submitted;
        bounty.contributor = Some(contributor.clone());
        bounty.submission_note = Some(note);

        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        env.events().publish(
            (soroban_sdk::Symbol::new(&env, "bounty"), soroban_sdk::Symbol::new(&env, "submitted"), bounty_id),
            contributor,
        );

        Ok(())
    }

    /// Sponsor approves the submission: releases escrowed funds to the
    /// contributor and performs a cross-contract call into
    /// ContributorRegistry to record the completion and update reputation.
    pub fn approve_and_pay(env: Env, bounty_id: u32, sponsor: Address) -> Result<(), BoardError> {
        sponsor.require_auth();
        let mut bounty = Self::get_bounty_internal(&env, bounty_id)?;

        if bounty.sponsor != sponsor {
            return Err(BoardError::Unauthorized);
        }
        if bounty.status != BountyStatus::Submitted && bounty.status != BountyStatus::Disputed {
            return Err(BoardError::InvalidState);
        }
        let contributor = bounty.contributor.clone().ok_or(BoardError::InvalidState)?;

        // --- Cross-contract call #1: release payment via SAC token ---
        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .ok_or(BoardError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &contributor,
            &bounty.reward,
        );

        // --- Cross-contract call #2: update contributor reputation ---
        let registry_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::RegistryAddress)
            .ok_or(BoardError::NotInitialized)?;
        let registry_client = registry::Client::new(&env, &registry_address);
        registry_client.record_completion(
            &env.current_contract_address(),
            &contributor,
            &bounty.reward,
        );

        bounty.status = BountyStatus::Paid;
        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        env.events().publish(
            (soroban_sdk::Symbol::new(&env, "bounty"), soroban_sdk::Symbol::new(&env, "paid"), bounty_id),
            (contributor, bounty.reward),
        );

        Ok(())
    }

    /// Sponsor disputes a submission (e.g. work doesn't meet spec).
    /// This pushes the bounty into a Disputed state; the sponsor can
    /// still approve_and_pay later, or cancel to reclaim escrowed funds,
    /// which also records a dispute strike against the contributor.
    pub fn dispute_submission(
        env: Env,
        bounty_id: u32,
        sponsor: Address,
    ) -> Result<(), BoardError> {
        sponsor.require_auth();
        let mut bounty = Self::get_bounty_internal(&env, bounty_id)?;

        if bounty.sponsor != sponsor {
            return Err(BoardError::Unauthorized);
        }
        if bounty.status != BountyStatus::Submitted {
            return Err(BoardError::InvalidState);
        }

        bounty.status = BountyStatus::Disputed;
        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        env.events().publish(
            (soroban_sdk::Symbol::new(&env, "bounty"), soroban_sdk::Symbol::new(&env, "disputed"), bounty_id),
            sponsor,
        );
        Ok(())
    }

    /// Sponsor cancels a Disputed bounty: reclaims escrowed funds and
    /// records a dispute strike against the contributor's reputation.
    pub fn cancel_disputed(env: Env, bounty_id: u32, sponsor: Address) -> Result<(), BoardError> {
        sponsor.require_auth();
        let mut bounty = Self::get_bounty_internal(&env, bounty_id)?;

        if bounty.sponsor != sponsor {
            return Err(BoardError::Unauthorized);
        }
        if bounty.status != BountyStatus::Disputed {
            return Err(BoardError::InvalidState);
        }
        let contributor = bounty.contributor.clone().ok_or(BoardError::InvalidState)?;

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .ok_or(BoardError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &bounty.sponsor,
            &bounty.reward,
        );

        let registry_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::RegistryAddress)
            .ok_or(BoardError::NotInitialized)?;
        let registry_client = registry::Client::new(&env, &registry_address);
        registry_client.record_dispute(&env.current_contract_address(), &contributor);

        bounty.status = BountyStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        env.events().publish(
            (soroban_sdk::Symbol::new(&env, "bounty"), soroban_sdk::Symbol::new(&env, "cancelled"), bounty_id),
            (),
        );
        Ok(())
    }

    /// Sponsor cancels an Open (unclaimed) bounty and reclaims funds.
    pub fn cancel_open(env: Env, bounty_id: u32, sponsor: Address) -> Result<(), BoardError> {
        sponsor.require_auth();
        let mut bounty = Self::get_bounty_internal(&env, bounty_id)?;

        if bounty.sponsor != sponsor {
            return Err(BoardError::Unauthorized);
        }
        if bounty.status != BountyStatus::Open {
            return Err(BoardError::InvalidState);
        }

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .ok_or(BoardError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &bounty.sponsor,
            &bounty.reward,
        );

        bounty.status = BountyStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        env.events().publish(
            (soroban_sdk::Symbol::new(&env, "bounty"), soroban_sdk::Symbol::new(&env, "cancelled"), bounty_id),
            (),
        );
        Ok(())
    }

    pub fn get_bounty(env: Env, bounty_id: u32) -> Result<Bounty, BoardError> {
        Self::get_bounty_internal(&env, bounty_id)
    }

    pub fn list_bounties(env: Env, offset: u32, limit: u32) -> Vec<Bounty> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::BountyCount)
            .unwrap_or(0);
        let mut out = Vec::new(&env);
        let mut i = offset;
        let end = (offset + limit).min(count);
        while i < end {
            if let Some(b) = env.storage().persistent().get(&DataKey::Bounty(i)) {
                out.push_back(b);
            }
            i += 1;
        }
        out
    }

    pub fn bounty_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::BountyCount)
            .unwrap_or(0)
    }

    fn get_bounty_internal(env: &Env, bounty_id: u32) -> Result<Bounty, BoardError> {
        env.storage()
            .persistent()
            .get(&DataKey::Bounty(bounty_id))
            .ok_or(BoardError::BountyNotFound)
    }
}

mod test;
