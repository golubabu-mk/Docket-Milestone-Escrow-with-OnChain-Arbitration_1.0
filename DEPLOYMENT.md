# Deployment Guide

This walks through deploying both contracts to Stellar **testnet** and wiring
up the frontend. Budget about 15–20 minutes. Do this yourself, from your own
machine — the addresses and transaction hash the competition checklist asks
for have to come from a real deployment you control.

## 0. Prerequisites

```bash
# Rust + wasm target
rustup target add wasm32-unknown-unknown

# Soroban / Stellar CLI
cargo install --locked soroban-cli --features opt

# Node 20+
node --version
```

You'll also want the [Freighter wallet extension](https://freighter.app)
installed in your browser, switched to **Testnet** in its network settings.

## 1. Create a deployer identity and fund it

```bash
soroban keys generate deployer --network testnet
soroban keys fund deployer --network testnet
soroban keys address deployer   # copy this — it's your admin/deployer address
```

## 2. Build the contracts

From the repo root:

```bash
cargo build --target wasm32-unknown-unknown --release
```

This produces:
- `target/wasm32-unknown-unknown/release/arbiter.wasm`
- `target/wasm32-unknown-unknown/release/escrow.wasm`

## 3. Deploy the Arbiter contract

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/arbiter.wasm \
  --source deployer \
  --network testnet
```

This prints a contract ID like `CABC...` — save it as `ARBITER_ID`.

Initialize it (you become the first trusted arbiter):

```bash
soroban contract invoke \
  --id $ARBITER_ID \
  --source deployer \
  --network testnet \
  -- initialize --admin $(soroban keys address deployer)
```

## 4. Deploy the Escrow contract

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/escrow.wasm \
  --source deployer \
  --network testnet
```

Save the printed ID as `ESCROW_ID`, then initialize it, pointing it at the
Arbiter contract you just deployed:

```bash
soroban contract invoke \
  --id $ESCROW_ID \
  --source deployer \
  --network testnet \
  -- initialize --arbiter_contract $ARBITER_ID
```

## 5. Get a test token

Easiest option — use the native XLM Stellar Asset Contract on testnet, or
deploy your own test token:

```bash
soroban contract asset deploy \
  --asset native \
  --source deployer \
  --network testnet
```

This prints the token contract's `C...` address — save it as `TOKEN_ID`.
If you want a custom token instead, issue one with `soroban contract asset deploy --asset YOURCODE:ISSUER`.

## 6. Do one real interaction (for your transaction hash)

Generate a second identity to act as a freelancer:

```bash
soroban keys generate freelancer --network testnet
soroban keys fund freelancer --network testnet
```

Create and fund a job (this is the transaction hash you'll submit):

```bash
soroban contract invoke \
  --id $ESCROW_ID \
  --source deployer \
  --network testnet \
  -- create_job \
  --client $(soroban keys address deployer) \
  --freelancer $(soroban keys address freelancer) \
  --token $TOKEN_ID \
  --milestone_descriptions '["Design mockups","Build MVP"]' \
  --milestone_amounts '["3000000000","7000000000"]'
```

The CLI output includes the transaction hash. You can also look it up on
[Stellar Expert](https://stellar.expert/explorer/testnet) by searching the
contract ID.

## 7. Configure the frontend

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:

```
VITE_STELLAR_NETWORK=TESTNET
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_ESCROW_CONTRACT_ID=<ESCROW_ID>
VITE_ARBITER_CONTRACT_ID=<ARBITER_ID>
VITE_TOKEN_CONTRACT_ID=<TOKEN_ID>
```

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, connect Freighter, and you should see the app
talking to your live testnet contracts.

## 8. Deploy the frontend to Vercel

```bash
npm install -g vercel
cd frontend
vercel
```

Follow the prompts (root directory: `frontend`, build command: `npm run
build`, output directory: `dist`). Add the same `VITE_*` environment
variables in the Vercel project settings under **Settings → Environment
Variables**, then redeploy.

## Checklist mapping

Use this after deploying to fill in the submission checklist:

| Item | Where to get it |
|---|---|
| Contract deployment address | `$ESCROW_ID` from step 4 (list both Escrow and Arbiter) |
| Transaction hash | Output of the `create_job` call in step 6 |
| Live demo link | Your Vercel deployment URL from step 8 |
| CI/CD screenshot | The green checkmarks tab on your GitHub repo (Actions tab) after pushing |
| Test output screenshot | Run `cargo test --workspace` and `npm test` locally, screenshot the terminal |
| Mobile UI screenshot | Open your Vercel URL in browser dev tools' device toolbar, or on your phone |
