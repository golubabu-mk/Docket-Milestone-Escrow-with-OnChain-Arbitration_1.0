# The Bounty Board

**A community micro-grants and bounty marketplace on Stellar/Soroban.**
Sponsors escrow rewards in XLM, contributors claim and submit work,
payment releases instantly on approval — and every completed bounty
builds a contributor's on-chain reputation score, automatically, via a
cross-contract call.

Built for the Orange Belt (Level 3) submission — advanced smart
contracts and production-ready dApp architecture.

> 🔗 **Live demo:** _add your Vercel URL here after deploying (see
> `docs/DEPLOYMENT.md`)_
> 🎥 **Demo video:** _add your 1–2 min walkthrough link here_
> 📜 **BountyBoard contract:** `<add testnet address after deploy>`
> 📜 **ContributorRegistry contract:** `<add testnet address after deploy>`
> 🧾 **Sample transaction:** `<add a tx hash + stellar.expert link>`

---

## Why this instead of a vault

Token vaults are the most common Level 3 submission by a wide margin,
and they don't exercise inter-contract communication in an interesting
way — there's usually one contract and one token. This project uses
**two independently deployed contracts that call each other inside a
single atomic transaction**: `BountyBoard` handles escrow and the
bounty lifecycle, and calls into `ContributorRegistry` on every payout
to update a contributor's reputation. Neither contract trusts the
other by default — the registry explicitly authorizes which
`BountyBoard` deployment is allowed to write reputation events, which
is the kind of access-control decision real multi-contract systems have
to make.

## What it does

1. A **sponsor** posts a bounty with a title, description, and reward.
   The reward is transferred into escrow (the BountyBoard contract's
   own balance) immediately, via the native XLM Stellar Asset Contract.
2. A **contributor** claims an open bounty and submits a note describing
   their work.
3. The sponsor either:
   - **Approves** → funds release to the contributor in the same
     transaction that calls into `ContributorRegistry` to bump their
     completed-bounty count, lifetime earnings, and reputation score.
   - **Disputes** → the bounty moves to a `Disputed` state. The sponsor
     can still approve later, or cancel and reclaim funds, which
     records a strike against the contributor's reputation.
4. A **live activity ticker** shows bounty postings, claims, disputes,
   and payouts as they happen, and every contributor has a public
   reputation tier (New → Trusted → Veteran → Elite) other sponsors can
   check before assigning work.

## Architecture at a glance

```
Next.js frontend  ──Soroban RPC──▶  BountyBoard contract
                                          │        │
                              token::Client   registry::Client
                                          │        │
                                          ▼        ▼
                                  Native XLM SAC   ContributorRegistry
```

Full breakdown, sequence of the cross-contract call, event topics, and
the state machine diagram: **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

## Project structure

```
bounty-board/
├── contracts/
│   ├── bounty-board/            # Escrow + bounty lifecycle contract
│   │   └── src/
│   │       ├── lib.rs
│   │       └── test.rs          # 11 tests incl. full lifecycle + cross-contract effects
│   └── contributor-registry/    # Reputation contract
│       └── src/
│           ├── lib.rs
│           └── test.rs          # 8 tests incl. authorization checks
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router page + layout
│   │   ├── components/          # BountyCard, ActivityTicker, modals, etc.
│   │   ├── hooks/                # useWallet, useBounties, useActivityFeed
│   │   └── lib/                  # soroban.ts (RPC client), wallet.ts, format.ts
│   └── src/lib/format.test.ts, src/components/StatusBadge.test.tsx
├── scripts/
│   ├── build.sh                 # Build + optimize both contracts
│   └── deploy_testnet.sh        # Deploy, initialize, wire authorization
├── .github/workflows/
│   ├── ci.yml                   # Contract build+test+clippy, frontend lint+test+build
│   └── deploy-preview.yml       # Production-build gate on every PR
└── docs/
    ├── ARCHITECTURE.md
    └── DEPLOYMENT.md            # Full step-by-step to a live, verifiable submission
```

## Smart contract design

### `ContributorRegistry`

| Method | Purpose |
|---|---|
| `initialize(admin)` | One-time setup |
| `authorize_writer(writer)` | Admin allow-lists a BountyBoard contract address |
| `record_completion(caller, contributor, amount)` | Called cross-contract on payout; +15 reputation, capped at 1000 |
| `record_dispute(caller, contributor)` | Called cross-contract on a lost dispute; −60 reputation |
| `get_stats(contributor)` / `tier_label(contributor)` | Public reads |

### `BountyBoard`

| Method | Purpose |
|---|---|
| `initialize(admin, token, registry)` | Wires the reward token and registry addresses |
| `post_bounty(sponsor, title, description, reward)` | Escrows reward, creates `Open` bounty |
| `submit_work(bounty_id, contributor, note)` | `Open → Submitted` |
| `approve_and_pay(bounty_id, sponsor)` | Releases funds **and** calls the registry — `Submitted/Disputed → Paid` |
| `dispute_submission(bounty_id, sponsor)` | `Submitted → Disputed` |
| `cancel_disputed(bounty_id, sponsor)` | Refunds sponsor, penalizes contributor rep — `Disputed → Cancelled` |
| `cancel_open(bounty_id, sponsor)` | Refunds sponsor before anyone claims — `Open → Cancelled` |
| `list_bounties(offset, limit)` / `get_bounty(id)` | Public reads |

Full state machine diagram in `docs/ARCHITECTURE.md`.

## Events

Every state transition emits a typed `#[contractevent]` with indexed
topics, which is what powers the frontend's live activity ticker:

- `BountyPostedEvent`, `SubmissionMadeEvent`, `BountyDisputedEvent`,
  `BountyPaidEvent`, `BountyCancelledEvent` (BountyBoard)
- `BountyCompletedEvent`, `DisputeRecordedEvent`, `WriterAuthorizedEvent`
  (ContributorRegistry)

## Testing

**Contracts** — 19 tests across both contracts:

```bash
cargo test --workspace
```

Covers: escrow correctness, full lifecycle (post → submit → approve →
paid, with the reputation side effect asserted), authorization checks
on both sponsor-only actions and the registry's writer allow-list,
invalid-state rejections, dispute → cancel → refund flow with the
reputation penalty applied, dispute → approve-anyway flow, and
pagination.

**Frontend** — component and utility tests:

```bash
cd frontend && npm run test
```

Covers stroop/XLM conversion round-tripping, address formatting, and
status badge rendering. See `docs/DEPLOYMENT.md` for exact expected
output to screenshot.

> **Note on this repository as delivered:** the contract and frontend
> logic were written and reviewed carefully, but this environment does
> not have network access to fetch a Rust/Cargo toolchain, so the
> `cargo test` run itself has not been executed here. Run it yourself
> per `docs/DEPLOYMENT.md` step 4 before you submit — it's the actual
> artifact the checklist wants, and it should take under a minute
> once the Stellar CLI is installed.

## Error handling & loading states

- Every contract entry point returns `Result<T, ContractError>` with
  specific variants (`InvalidState`, `Unauthorized`, `BountyNotFound`,
  `InvalidReward`) instead of panicking.
- `src/lib/soroban.ts` centralizes simulate → sign → submit → poll for
  every write, and translates Soroban's raw simulation errors into
  plain-language messages shown in the UI (see
  `readableSimulationError`).
- Every async UI action has a loading state (button becomes "Confirming…",
  skeleton cards while bounties load, disabled submit while a form is
  in flight) and a visible error state (inline in modals, a dismissible
  banner for wallet errors, a retry button if the board fails to load).

## Mobile responsiveness

The Kanban board collapses from 4 columns → 2 → 1 by breakpoint, modals
become bottom sheets on small screens, and the header/hero stack
vertically below `sm:`. Test with your browser's device toolbar or on
a real phone against the Vercel URL.

## Local development

```bash
# Contracts
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli --features opt
cargo test --workspace

# Frontend
cd frontend
cp .env.example .env.local   # fill in after deploying (see docs/DEPLOYMENT.md)
npm install
npm run dev
```

Full deployment walkthrough — funding a deployer account, deploying
both contracts, wiring authorization, deploying the frontend to Vercel,
and capturing the checklist's screenshots/video —
**[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**.

## Tech stack

- **Contracts:** Rust, Soroban SDK 21.7
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Wallet:** Stellar Wallets Kit (Freighter and others)
- **RPC:** `@stellar/stellar-sdk`
- **Testing:** Rust's built-in test harness + `soroban-sdk` testutils;
  Vitest + React Testing Library on the frontend
- **CI/CD:** GitHub Actions (contract build/test/clippy, frontend
  lint/test/build, PR build-gate)

## License

MIT — see `LICENSE`.
