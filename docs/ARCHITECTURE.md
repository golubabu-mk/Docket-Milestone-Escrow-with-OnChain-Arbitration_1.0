# Architecture

## System overview

```
                         ┌─────────────────────────┐
                         │   Next.js Frontend       │
                         │   (Kanban board UI)      │
                         └────────────┬─────────────┘
                                      │ Soroban RPC
                                      │ (simulate → sign → submit)
                                      ▼
                         ┌─────────────────────────┐
                         │   BountyBoard contract    │
                         │  ─────────────────────    │
                         │  post_bounty               │
                         │  submit_work                │
                         │  approve_and_pay ───────────┼──┐
                         │  dispute_submission          │  │ cross-contract call
                         │  cancel_disputed / cancel_open│  │ (Address, i128)
                         └───────────┬──────────────────┘  │
                                     │                       │
                          token::Client (SAC)                │
                                     │                       ▼
                                     │           ┌─────────────────────────┐
                                     │           │ ContributorRegistry      │
                                     ▼           │ ─────────────────────    │
                         ┌─────────────────┐     │ record_completion         │
                         │  Native XLM SAC  │     │ record_dispute             │
                         │  (escrow/payout) │     │ get_stats / tier_label     │
                         └─────────────────┘     └─────────────────────────┘
```

## Why two contracts

`BountyBoard` and `ContributorRegistry` are deployed and versioned
independently. This is the same pattern production Soroban systems use
to keep state and permissions cleanly separated:

- **Separation of concerns.** BountyBoard owns escrow and bounty
  lifecycle. ContributorRegistry owns reputation. Neither needs to know
  the other's internal storage layout — they interact only through a
  narrow, typed public interface.
- **Reusability.** Future modules (a dispute-arbitration contract, a
  grants program, a second bounty board for a different community)
  can all write into the same `ContributorRegistry` and read a
  contributor's full cross-program reputation.
- **Least privilege.** The registry does not trust every caller. An
  admin explicitly calls `authorize_writer` to allow list a specific
  BountyBoard contract address. Any other caller attempting
  `record_completion` or `record_dispute` is rejected with
  `RegistryError::Unauthorized` — see
  `test_unauthorized_writer_cannot_forge_reputation` in
  `contracts/contributor-registry/src/test.rs`.

## Inter-contract communication

The interesting cross-contract call happens in
`BountyBoard::approve_and_pay`:

1. `token::Client::transfer` — moves escrowed XLM from the BountyBoard
   contract's own balance to the contributor. This is itself a call
   into the Stellar Asset Contract (SAC), a separate deployed contract.
2. `registry::Client::record_completion` — calls into
   `ContributorRegistry`, passing `env.current_contract_address()` as
   the `caller` argument. The registry checks that this address was
   previously authorized, then updates the contributor's score,
   completed-bounty count, and lifetime earnings, and emits a
   `BountyCompletedEvent`.

Both calls happen inside a single Soroban transaction. If either fails,
the whole transaction reverts — a contributor is never marked "paid"
without the token transfer actually succeeding, and reputation is never
silently out of sync with payout history.

The same pattern happens in `cancel_disputed`, which calls
`registry::Client::record_dispute` after refunding the sponsor.

## Event streaming

Every state-changing method publishes a typed event
(`#[contractevent]`) with indexed topics, e.g.:

```rust
#[contractevent(topics = ["bounty", "paid"])]
pub struct BountyPaidEvent {
    #[topic] pub bounty_id: u32,
    pub contributor: Address,
    pub reward: i128,
}
```

The frontend achieves "live" streaming through two complementary
mechanisms, documented explicitly rather than glossed over:

1. **Optimistic local feed** (`useActivityFeed`): the instant a
   transaction the current user submitted is confirmed, its event is
   pushed onto the ticker immediately — no polling delay for your own
   actions.
2. **Polling reconciliation** (`useBounties`, every 8s): re-fetches
   `list_bounties` so state changes made by *other* users (a different
   sponsor approving a payout, another contributor claiming a bounty)
   converge into the UI within one polling interval.

For a production deployment with many concurrent users, step 2 would
be replaced by subscribing to `getEvents` on the Soroban RPC server
and filtering by contract ID and topic, which is the standard way to
build a true multi-user live feed on Soroban without polling. That
swap is isolated to `useBounties`/`useActivityFeed` and does not
require any contract or UI changes — it's noted as the natural next
step in the README's roadmap.

## Contract state machine

```
        post_bounty
            │
            ▼
        ┌────────┐   submit_work    ┌───────────┐
        │  Open  │ ───────────────▶ │ Submitted │
        └───┬────┘                  └─────┬─────┘
            │                             │
            │ cancel_open      dispute_submission
            │                             │
            ▼                             ▼
      ┌───────────┐   cancel_disputed  ┌──────────┐
      │ Cancelled │ ◀───────────────── │ Disputed │
      └───────────┘                    └────┬─────┘
            ▲                                │
            │                     approve_and_pay
            │                                │
            └───────────── Paid ◀────────────┘
                             ▲
                             │ approve_and_pay
                             │ (from Submitted, direct path)
                        ┌────┴─────┐
                        │   Paid   │
                        └──────────┘
```

## Frontend architecture

- **`src/lib/soroban.ts`** — the single place that builds, simulates,
  signs, and submits transactions. Every write path (post, claim,
  approve, dispute) shares the same simulation-error translation and
  confirmation-polling logic, so error handling is consistent instead
  of copy-pasted per button.
- **`src/lib/wallet.ts`** — thin wrapper around Stellar Wallets Kit,
  isolated so swapping wallet providers doesn't touch UI code.
- **`src/hooks/`** — `useWallet`, `useBounties`, `useActivityFeed` own
  all async state (loading / error / data) so components stay
  presentational.
- **Components** are split by responsibility: `BountyBoardGrid` (layout
  + empty/error states), `BountyCard` (single item + actions),
  `PostBountyModal` / `ClaimBountyModal` (validated forms), and
  `ActivityTicker` (the live feed).

## Production-readiness practices applied

- Explicit `Result<T, Error>` contract errors instead of panics, mapped
  to human-readable frontend copy in `readableSimulationError`.
- Reentrancy is not a concern here because Soroban's call model doesn't
  allow the classic EVM reentrancy pattern, but state is still updated
  *before* external calls where practical, and every external call's
  return path is checked.
- `require_auth()` on every state-changing entry point, and an explicit
  allow-list (`authorize_writer`) rather than trusting `env.caller()`
  by convention.
- No unbounded loops over user-controlled data structures without a
  `limit` parameter (`list_bounties(offset, limit)`).
- CI builds the release WASM and runs the full contract test suite
  and Clippy on every push, not just "does it compile."
