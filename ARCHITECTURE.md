# Architecture

## Why two contracts

Most milestone-escrow demos put dispute logic inside the same contract that
holds the funds. That's simpler, but it means every escrow deployment has to
reinvent arbitration, and there's no way for a trusted panel of arbiters to
service many independent jobs or many different escrow deployments.

This project splits the concern:

```
┌─────────────────┐        cross-contract call         ┌──────────────────┐
│  Escrow Contract │ ───────────────────────────────────▶│ Arbiter Contract │
│                  │   raise_dispute(escrow, job_id, …)  │                  │
│  - holds funds   │◀───────────────────────────────────│  - holds panel   │
│  - milestones    │        get_dispute() (read)         │  - holds rulings │
│  - pays out      │                                     │                  │
└─────────┬────────┘                                     └──────────────────┘
          │ cross-contract call
          ▼
┌──────────────────┐
│  Token Contract   │   (SEP-41 / Stellar Asset Contract)
│  - transfer()      │
└──────────────────┘
```

- **Escrow** never has arbitration logic hardcoded — it just knows how to
  call an `Address` that implements the Arbiter interface. In principle the
  same Escrow deployment could point at a different Arbiter contract.
- **Arbiter** never touches funds — it only records rulings. Escrow reads the
  ruling back (another cross-contract call) and moves the money itself. This
  keeps the Arbiter contract auditable in isolation from token logic.
- **Token** calls are the standard SEP-41 interface, so any Stellar Asset
  Contract or SEP-41-compliant custom token works without changes to Escrow.

## State machine

**Milestone status:** `Pending → Submitted → Approved → Released` (or
`Disputed` if escalated mid-flow).

**Job status:** `Active → Completed`, or `Active → Disputed → Completed`
once a ruling is executed. `Cancelled` is reserved for a future
before-any-milestone-submitted cancellation path.

## Events (the "real-time" layer)

Every state transition emits a Soroban event rather than requiring the
frontend to poll contract storage directly:

| Event topics | Emitted when |
|---|---|
| `job, created` | A client funds a new job |
| `milestone, submit` | Freelancer marks a milestone done |
| `milestone, approve` | Client approves a milestone |
| `milestone, released` | Funds move to the freelancer |
| `job, disputed` | Either party escalates |
| `dispute, raised` | Arbiter contract records the dispute |
| `dispute, resolved` | Arbiter contract records a ruling |
| `job, dresolve` | Escrow settles funds per the ruling |
| `job, complete` | All milestones released or dispute settled |

The frontend's `useEventStream` hook polls `getEvents` on an interval,
tracking the last-seen ledger so each poll only asks for what's new. This is
what the "Live Activity" panel in the UI renders — no manual refresh needed,
and no need for a centralized indexer/backend for a project this size.

## Frontend structure

```
frontend/src/
├── lib/
│   ├── config.js         # env-driven contract addresses & network config
│   ├── wallet.js          # Freighter wallet integration
│   ├── sorobanClient.js    # low-level build/simulate/sign/submit
│   ├── escrowActions.js    # typed wrappers per contract method
│   ├── events.js           # getEvents polling with ledger cursor
│   └── formatEvent.js      # pure event → label mapping (unit tested)
├── hooks/
│   ├── useWallet.js
│   └── useEventStream.js
└── components/             # presentational, mobile-first with Tailwind
```

Business logic (event formatting, contract argument construction) is kept in
plain, framework-free modules under `lib/` specifically so it's testable
without mounting React components — see `frontend/src/test/`.

## Security notes

- All state-changing entry points call `require_auth()` on the relevant
  party (client, freelancer, or arbiter) — Soroban's authorization framework
  rejects the transaction if the claimed signer didn't actually sign.
- The Arbiter panel is closed by default (only the admin who called
  `initialize` is trusted) and grows only via `add_arbiter`, itself gated on
  the stored admin address.
- Disputes can't be raised twice concurrently (`DisputeAlreadyOpen`) and
  can't be resolved twice (`DisputeAlreadyResolved`), preventing double-spend
  style ruling replay.
- `settle_dispute` is intentionally *not* auth-gated to a specific party —
  anyone can trigger it once a ruling exists, since the payout logic is
  fully determined by the ruling already stored on the Arbiter contract, not
  by who calls the function.
