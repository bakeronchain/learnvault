#!/bin/bash

# Mint Test USDC Script
# Usage: ./scripts/mint-test-usdc.sh <recipient_address> [amount]
#
# This script mints test USDC tokens to a specified address on Stellar Testnet.
# Default amount is 1000 USDC (with 7 decimals = 10000000000 stroops)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if recipient address is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Recipient address is required${NC}"
    echo "Usage: $0 <recipient_address> [amount]"
    echo "Example: $0 GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX 1000"
    exit 1
fi

RECIPIENT=$1
AMOUNT=${2:-1000}

# Convert amount to stroops (7 decimals for USDC)
AMOUNT_STROOPS=$((AMOUNT * 10000000))

echo -e "${YELLOW}Minting Test USDC...${NC}"
echo "Recipient: $RECIPIENT"
echo "Amount: $AMOUNT USDC ($AMOUNT_STROOPS stroops)"
echo ""

# Check if we're in development or staging environment
if [ -f ".env" ]; then
    source .env
    NETWORK=${STELLAR_SCAFFOLD_ENV:-development}
else
    NETWORK="development"
fi

echo -e "${YELLOW}Environment: $NETWORK${NC}"

# Get the USDC contract ID from the environment
if [ "$NETWORK" == "development" ]; then
    # For local development, use the deployed test token
    echo -e "${YELLOW}Looking up USDC test token contract ID...${NC}"
    
    # Try to get the contract ID from the stellar CLI
    USDC_CONTRACT_ID=$(stellar contract id asset --asset native --network $NETWORK 2>/dev/null || echo "")
    
    if [ -z "$USDC_CONTRACT_ID" ]; then
        echo -e "${RED}Error: Could not find USDC contract ID${NC}"
        echo "Make sure you have deployed the contracts first by running: npm start"
        exit 1
    fi
else
    # For testnet/staging, you need to set the contract ID manually
    if [ -z "$PUBLIC_USDC_CONTRACT_ID" ]; then
        echo -e "${RED}Error: PUBLIC_USDC_CONTRACT_ID not set in .env${NC}"
        echo "Please set PUBLIC_USDC_CONTRACT_ID in your .env file"
        exit 1
    fi
    USDC_CONTRACT_ID=$PUBLIC_USDC_CONTRACT_ID
fi

echo "USDC Contract ID: $USDC_CONTRACT_ID"
echo ""

# Mint tokens using the stellar CLI
echo -e "${YELLOW}Invoking mint function...${NC}"

stellar contract invoke \
    --id $USDC_CONTRACT_ID \
    --source me \
    --network $NETWORK \
    -- \
    mint \
    --to $RECIPIENT \
    --amount $AMOUNT_STROOPS

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Successfully minted $AMOUNT USDC to $RECIPIENT${NC}"
    echo ""
    echo "You can verify the balance by running:"
    echo "stellar contract invoke --id $USDC_CONTRACT_ID --network $NETWORK -- balance --id $RECIPIENT"
else
    echo -e "${RED}✗ Failed to mint USDC${NC}"
    exit 1
fi
