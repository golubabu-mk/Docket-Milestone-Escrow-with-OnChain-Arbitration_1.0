# Submission Checklist — mapped to this repo

Use this as your final pass before submitting. Items marked **[YOU]**
require an action from you that can't be done inside this repo/zip.

## Advanced smart contract development

- [x] Inter-contract communication — `BountyBoard::approve_and_pay` and
      `cancel_disputed` call into `ContributorRegistry`. See
      `docs/ARCHITECTURE.md` → "Inter-contract communication."
- [x] Event streaming & real-time updates — `#[contractevent]` on every
      state transition; frontend `ActivityTicker` + 8s polling
      reconciliation. See `docs/ARCHITECTURE.md` → "Event streaming."
- [ ] **[YOU]** CI/CD pipeline setup — workflows are in
      `.github/workflows/`; they run for real once you push to GitHub.
- [ ] **[YOU]** Smart contract deployment workflow — run
      `scripts/deploy_testnet.sh` (see `docs/DEPLOYMENT.md`).
- [x] Mobile responsive frontend development — Tailwind breakpoints
      throughout; Kanban grid collapses 4→2→1 columns, modals become
      bottom sheets on small screens.
- [x] Error handling & loading states — see README → "Error handling &
      loading states."
- [x] Writing tests for contracts and frontend — 19 contract tests,
      frontend unit + component tests. **[YOU]** run them yourself and
      screenshot — see below.
- [x] Production-ready architecture practices — typed errors, auth
      allow-lists, paginated reads, CI lint/clippy gates. See
      `docs/ARCHITECTURE.md` → "Production-readiness practices applied."
- [x] Documentation — this repo's README + docs/.
- [ ] **[YOU]** Demo presentation — record the video (step 10 in
      `docs/DEPLOYMENT.md`).

## Submission checklist items

- [ ] **[YOU]** Public GitHub repository — push this folder as a new
      repo, set visibility to Public.
- [x] README with complete documentation — `README.md`.
- [ ] **[YOU]** Minimum 10+ meaningful commits — see the suggested
      commit sequence in `docs/DEPLOYMENT.md` step 11. Committing this
      whole folder in one shot will *not* satisfy this — split it up,
      or better, make your own real edits/iterations on top and commit
      those incrementally.
- [ ] **[YOU]** Live demo link — deploy `frontend/` to Vercel (step 9).
- [ ] **[YOU]** Contract deployment address — from
      `scripts/deploy_testnet.sh` output.
- [ ] **[YOU]** Transaction hash for contract interaction — from any
      real invocation (step 6).
- [ ] **[YOU]** Screenshot: mobile responsive UI.
- [ ] **[YOU]** Screenshot: CI/CD pipeline running (GitHub Actions tab,
      after you push).
- [ ] **[YOU]** Screenshot: test output with 3+ passing tests — run
      `cargo test --workspace` (19 tests) or `npm run test` in
      `frontend/`.
- [ ] **[YOU]** Demo video link (1–2 minutes).

## Why these can't be pre-filled

Contract addresses, transaction hashes, live URLs, CI run screenshots,
and commit history are all things that only exist *after* you deploy
under your own keys/accounts — generating fake versions of any of them
would be submitting false on-chain data, which is grounds for
disqualification in virtually every version of this kind of program.
Everything that *can* be done ahead of time (contracts, tests, UI, CI
config, docs) is done. What's left is genuinely quick — budget
30–45 minutes following `docs/DEPLOYMENT.md` end to end.
