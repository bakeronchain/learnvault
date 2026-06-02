#!/bin/bash

# Smoke Test All V1 Contracts
# This script performs basic smoke tests on all deployed contracts
# to verify they're working correctly on Stellar Testnet

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load contract addresses from environments.toml
if [ ! -f "environments.toml" ]; then
    echo -e "${RED}Error: environments.toml not found${NC}"
    echo "Please run ./scripts/deploy-testnet.sh first"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}V1 Contract Smoke Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to test a contract
test_contract() {
    local contract_name=$1
    local contract_id=$2
    local test_function=$3
    local test_description=$4
    
    echo -e "${YELLOW}Testing $contract_name...${NC}"
    echo -e "${YELLOW}Contract ID: $contract_id${NC}"
    
    if [ -z "$contract_id" ]; then
        echo -e "${RED}✗ Contract ID not found for $contract_name${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Function: $test_function${NC}"
    
    # Execute the test
    stellar contract invoke \
        --id "$contract_id" \
        --network testnet \
        -- \
        "$test_function" \
        2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $contract_name smoke test passed${NC}"
    else
        echo -e "${RED}✗ $contract_name smoke test failed${NC}"
        return 1
    fi
    
    echo ""
}

# Read contract IDs from environments.toml
LEARN_TOKEN_ID=$(grep -A1 "learn_token = " environments.toml | grep -o 'learn_token = .*' | sed 's/learn_token = "//' | sed 's/"//.*$//')
GOVERNANCE_TOKEN_ID=$(grep -A1 "governance_token = " environments.toml | grep -o 'governance_token = .*' | sed 's/governance_token = "//' | sed 's/"//.*$//')
COURSE_MILESTONE_ID=$(grep -A1 "course_milestone = " environments.toml | grep -o 'course_milestone = .*' | sed 's/course_milestone = "//' | sed 's/"//.*$//')
MILESTONE_ESCROW_ID=$(grep -A1 "milestone_escrow = " environments.toml | grep -o 'milestone_escrow = .*' | sed 's/milestone_escrow = "//' | sed 's/"//.*$//')
SCHOLARSHIP_TREASURY_ID=$(grep -A1 "scholarship_treasury = " environments.toml | grep -o 'scholarship_treasury = .*' | sed 's/scholarship_treasury = "//' | sed 's/"//.*$//')
SCHOLAR_NFT_ID=$(grep -A1 "scholar_nft = " environments.toml | grep -o 'scholar_nft = .*' | sed 's/scholar_nft = "//' | sed 's/"//.*$//')

# Check if all contracts are deployed
if [ -z "$LEARN_TOKEN_ID" ] || [ -z "$GOVERNANCE_TOKEN_ID" ] || [ -z "$COURSE_MILESTONE_ID" ] || [ -z "$MILESTONE_ESCROW_ID" ] || [ -z "$SCHOLARSHIP_TREASURY_ID" ] || [ -z "$SCHOLAR_NFT_ID" ]; then
    echo -e "${RED}Error: One or more contract IDs not found in environments.toml${NC}"
    echo "Please ensure all contracts are deployed first:"
    echo "Run: ./scripts/deploy-testnet.sh"
    exit 1
fi

echo -e "${YELLOW}Starting smoke tests...${NC}"
echo ""

# Test LearnToken
test_contract "LearnToken" "$LEARN_TOKEN_ID" "metadata" "Get token metadata"

# Test GovernanceToken  
test_contract "GovernanceToken" "$GOVERNANCE_TOKEN_ID" "balance" "Get token balance for deployer"

# Test CourseMilestone
test_contract "CourseMilestone" "$COURSE_MILESTONE_ID" "get_milestone" "Get milestone details"

# Test MilestoneEscrow
test_contract "MilestoneEscrow" "$MILESTONE_ESCROW_ID" "get_escrow_balance" "Get escrow balance"

# Test ScholarshipTreasury
test_contract "ScholarshipTreasury" "$SCHOLARSHIP_TREASURY_ID" "get_treasury_balance" "Get treasury balance"

# Test ScholarNFT
test_contract "ScholarNFT" "$SCHOLAR_NFT_ID" "token_uri" "Get NFT metadata"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Smoke Tests Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ All smoke tests completed!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Fund deployer address for testing:"
echo "   stellar friendbot fund testnet $DEPLOYER_ADDRESS"
echo ""
echo "2. Test contract functions with real parameters:"
echo "   stellar contract invoke --id CONTRACT_ID --network testnet --FUNCTION_NAME --PARAMS"
