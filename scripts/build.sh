#!/usr/bin/env bash
# Builds both Soroban contracts to WASM.
# Registry is built first because BountyBoard imports its WASM interface
# at compile time via `soroban_sdk::contractimport!`.
set -e

echo "==> Building contributor-registry"
cd contracts/contributor-registry
stellar contract build
cd ../..

echo "==> Building bounty-board"
cd contracts/bounty-board
stellar contract build
cd ../..

echo "==> Optimizing WASM"
stellar contract optimize \
  --wasm target/wasm32v1-none/release/contributor_registry.wasm
stellar contract optimize \
  --wasm target/wasm32v1-none/release/bounty_board.wasm

echo "Build complete. Artifacts in target/wasm32v1-none/release/"
