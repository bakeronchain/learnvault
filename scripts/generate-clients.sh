#!/usr/bin/env bash
# generate-clients.sh
# Generates TypeScript contract bindings for all six LearnVault Soroban contracts.
# Run this after deploying contracts and populating contract IDs in .env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load .env from project root if it exists
if [[ -f "$ROOT_DIR/.env" ]]; then
  # Export only non-empty, non-comment lines
  set -o allexport
  # shellcheck disable=SC1090
  source <(grep -v '^#' "$ROOT_DIR/.env" | grep '=')
  set +o allexport
fi

NETWORK="${STELLAR_NETWORK:-testnet}"

echo "Generating Soroban TypeScript clients (network: $NETWORK) ..."
echo ""

generate_client() {
  local name="$1"
  local contract_id="${2:-}"
  local out_dir="$ROOT_DIR/packages/$name"

  if [[ -z "$contract_id" ]]; then
    echo "  ⚠️  Skipping $name — contract ID not set in .env"
    return
  fi

  echo "  → $name ($contract_id)"
  stellar contract bindings typescript \
    --contract-id "$contract_id" \
    --network "$NETWORK" \
    --output-dir "$out_dir" \
    --overwrite
}

generate_client "learn_token"           "${VITE_LEARN_TOKEN_CONTRACT_ID:-}"
generate_client "governance_token"      "${VITE_GOVERNANCE_TOKEN_CONTRACT_ID:-}"
generate_client "course_milestone"      "${VITE_COURSE_MILESTONE_CONTRACT_ID:-}"
generate_client "milestone_escrow"      "${VITE_MILESTONE_ESCROW_CONTRACT_ID:-}"
generate_client "scholarship_treasury"  "${VITE_SCHOLARSHIP_TREASURY_CONTRACT_ID:-}"
generate_client "scholar_nft"           "${VITE_SCHOLAR_NFT_CONTRACT_ID:-}"

echo ""
echo "✅  Done. Run 'npm run install:contracts' to build the generated packages."
