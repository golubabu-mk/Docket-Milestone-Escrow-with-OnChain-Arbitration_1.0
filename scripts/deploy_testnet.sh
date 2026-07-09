#!/usr/bin/env bash
# Deploys ContributorRegistry then BountyBoard to Stellar Testnet, wires
# them together, and prints everything needed for the submission
# checklist (contract addresses + a sample transaction hash).
#
# Prerequisites:
#   1. Stellar CLI installed: https://developers.stellar.org/docs/tools/cli
#   2. An identity funded on testnet:
#        stellar keys generate deployer --network testnet --fund
#   3. Run scripts/build.sh first.
set -e

NETWORK="testnet"
DEPLOYER="deployer"
RPC_URL="https://soroban-testnet.stellar.org"
PASSPHRASE="Test SDF Network ; September 2015"

echo "==> Deploying ContributorRegistry"
REGISTRY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/contributor_registry.optimized.wasm \
  --source "$DEPLOYER" \
  --network "$NETWORK")
echo "ContributorRegistry deployed at: $REGISTRY_ID"

echo "==> Deploying BountyBoard"
BOARD_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/bounty_board.optimized.wasm \
  --source "$DEPLOYER" \
  --network "$NETWORK")
echo "BountyBoard deployed at: $BOARD_ID"

DEPLOYER_ADDRESS=$(stellar keys address "$DEPLOYER")

echo "==> Initializing ContributorRegistry"
stellar contract invoke \
  --id "$REGISTRY_ID" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- initialize --admin "$DEPLOYER_ADDRESS"

echo "==> Using native XLM SAC as the reward token (testnet)"
TOKEN_ID=$(stellar contract id asset --asset native --network "$NETWORK")
echo "Native token contract: $TOKEN_ID"

echo "==> Initializing BountyBoard"
stellar contract invoke \
  --id "$BOARD_ID" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --token_address "$TOKEN_ID" \
  --registry_address "$REGISTRY_ID"

echo "==> Authorizing BountyBoard as a trusted writer on the registry"
stellar contract invoke \
  --id "$REGISTRY_ID" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- authorize_writer --writer "$BOARD_ID"

echo ""
echo "=========================================="
echo " DEPLOYMENT COMPLETE"
echo "=========================================="
echo "ContributorRegistry: $REGISTRY_ID"
echo "BountyBoard:         $BOARD_ID"
echo "Reward token (XLM):  $TOKEN_ID"
echo ""
echo "Save these into frontend/.env.local — see .env.example"
echo ""
echo "Next: run a sample interaction to generate a tx hash you can"
echo "include in your submission, e.g.:"
echo ""
echo "stellar contract invoke --id $BOARD_ID --source $DEPLOYER --network $NETWORK \\"
echo "  -- post_bounty --sponsor $DEPLOYER_ADDRESS \\"
echo "  --title \"Build a landing page\" --description \"React + Tailwind\" --reward 5000"
