# Deployment Guide

This walks through everything needed to take this repo from source code
to a live submission: real contract addresses, a real transaction hash,
a live frontend URL, and the screenshots/video the checklist asks for.
Budget about 30–45 minutes the first time.

## 1. Install prerequisites

```bash
# Rust + wasm target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Stellar CLI
cargo install --locked stellar-cli --features opt

# Node 20+
# (use nvm, or your platform's package manager)
```

## 2. Create and fund a deployer identity

```bash
stellar keys generate deployer --network testnet --fund
stellar keys address deployer   # copy this — it's your admin address
```

## 3. Build the contracts

```bash
bash scripts/build.sh
```

This compiles `contributor-registry` first (bounty-board imports its
WASM interface at compile time for the cross-contract call), then
`bounty-board`, then runs `stellar contract optimize` on both.

## 4. Run the test suite locally

```bash
cargo test --workspace
```

You should see 8 passing tests in `contributor-registry` and 11 in
`bounty-board` (19 total). This is the output to screenshot for the
"test output with 3+ passing tests" requirement — take it after running
this command in your terminal.

## 5. Deploy to testnet

```bash
bash scripts/deploy_testnet.sh
```

This script deploys both contracts, initializes them, wires
`BountyBoard` as an authorized writer on `ContributorRegistry`, and
prints:

- `ContributorRegistry` contract address
- `BountyBoard` contract address
- The native XLM SAC token address used for rewards

**Save these three values** — you'll paste them into
`frontend/.env.local` and into your README/submission.

## 6. Generate a real transaction hash

Post a sample bounty from the CLI (the script prints the exact command
with your addresses substituted), or just use the deployed frontend —
posting a bounty, claiming it, and approving payment each produce a
transaction hash. Grab any of these hashes and the corresponding
`stellar.expert` testnet explorer link for your submission.

```bash
stellar contract invoke --id <BOUNTY_BOARD_ID> --source deployer --network testnet \
  -- post_bounty --sponsor <YOUR_ADDRESS> \
  --title "Build a landing page" --description "React + Tailwind" --reward 5000
```

The command's output includes the transaction hash. You can view it at:
`https://stellar.expert/explorer/testnet/tx/<HASH>`

## 7. Configure and run the frontend locally

```bash
cd frontend
cp .env.example .env.local
# paste the three contract/token addresses from step 5 into .env.local
npm install
npm run dev
```

Visit `http://localhost:3000`, connect Freighter (or another supported
wallet) set to **testnet**, and post/claim/approve a bounty end to end.

## 8. Run the frontend test suite

```bash
npm run test
```

This is your second option for the "test output" screenshot if you'd
rather show frontend tests, or take both.

## 9. Deploy the frontend live (Vercel)

```bash
npm install -g vercel
cd frontend
vercel login
vercel --prod
```

When prompted, set the same three environment variables from
`.env.local` in the Vercel project settings (Project → Settings →
Environment Variables), or pass them via `vercel env add`. Alternatively,
connect the GitHub repo directly at vercel.com/new — it will pick up
`.github/workflows/deploy-preview.yml`'s build validation on every PR
and auto-deploy `main` to production.

## 10. Capture the submission assets

- **Mobile responsive screenshot**: open the live Vercel URL, open
  browser dev tools, toggle device toolbar to an iPhone/Android
  viewport, screenshot the board.
- **CI pipeline screenshot**: push this repo to GitHub, open the
  **Actions** tab, screenshot a green run of `CI`.
- **Test output screenshot**: terminal output from step 4 or step 8.
- **Demo video (1–2 min)**: screen-record connecting a wallet, posting
  a bounty, claiming it from a second wallet/account, approving payment,
  and pointing out the reputation score updating and the live activity
  ticker. Narrate briefly what's happening on-chain at each step.

## 11. Push to GitHub with real commit history

Don't squash this into one commit — the checklist wants 10+ meaningful
commits. A natural history if you're building incrementally:

1. `chore: scaffold Soroban workspace`
2. `feat: contributor registry contract with reputation scoring`
3. `test: contributor registry unit tests`
4. `feat: bounty board contract core lifecycle`
5. `feat: cross-contract call into contributor registry on payout`
6. `test: bounty board unit tests incl. full lifecycle`
7. `feat: frontend scaffold with design tokens`
8. `feat: wallet connection and soroban client`
9. `feat: bounty board UI with claim/approve/dispute flows`
10. `feat: live activity ticker and reputation panel`
11. `ci: github actions for contracts and frontend`
12. `docs: architecture and deployment guide`

If you're picking this project up as a finished zip, you can still get
genuine commit history by doing your own pass on top of it — tune the
color palette, add a feature, fix something — each as its own commit.
