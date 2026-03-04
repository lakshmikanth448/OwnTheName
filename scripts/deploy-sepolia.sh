#!/usr/bin/env bash

# Automated deployment to Sepolia and frontend update.
# Requires:
#   - .env containing PRIVATE_KEY and SEPOLIA_RPC_URL
#   - npx hardhat installed in project
#   - jq installed
#
# Usage: bash scripts/deploy-sepolia.sh

set -euo pipefail

# load environment variables
if [ -f .env ]; then
  source .env
fi

if [ -z "${SEPOLIA_RPC_URL:-}" ]; then
  echo "SEPOLIA_RPC_URL is not set in .env" >&2
  exit 1
fi

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "PRIVATE_KEY is not set in .env" >&2
  exit 1
fi

RPC="$SEPOLIA_RPC_URL"

# derive address from private key using hardhat
ADDRESS=$(npx hardhat accounts --network sepolia 2>/dev/null | head -1 | awk '{print $2}')

echo "Using wallet: $ADDRESS"

# check balance
balance_hex=$(curl -s -X POST "$RPC" \
  -H "Content-Type: application/json" \
  --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$ADDRESS\",\"latest\"],\"id\":1}" \
  | jq -r '.result')

echo "Balance (wei): $balance_hex"

balance=$((balance_hex))
min_balance=1000000000000000   # 0.001 ETH

if [ "$balance" -lt "$min_balance" ]; then
  echo "Insufficient Sepolia ETH." >&2
  exit 1
fi

# deploy contract
output=$(npx hardhat run scripts/deploy.js --network sepolia)

deployed_address=$(echo "$output" | grep -Eo "0x[a-fA-F0-9]{40}" | head -1)

if [ -z "$deployed_address" ]; then
  echo "Failed to parse deployed address"
  echo "$output"
  exit 1
fi

echo "Deployed contract at $deployed_address"

# update frontend config
node - "$deployed_address" <<'NODEEOF'
const fs=require('fs');
const path='./src/config.json';
const cfg=JSON.parse(fs.readFileSync(path));
cfg["11155111"].ETHDaddy.address = process.argv[2];
fs.writeFileSync(path, JSON.stringify(cfg,null,4));
NODEEOF

git add src/config.json
git commit -m "Use Sepolia contract address $deployed_address"
git push origin main