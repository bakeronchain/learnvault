#!/bin/bash

# Deploy All V1 Contracts to Stellar Testnet
# This script deploys all six V1 contracts to Stellar Testnet
# and stores their addresses in environments.toml

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Network configuration
NETWORK="testnet"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015 Future Net"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Deploying V1 Contracts to Testnet${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if stellar CLI is available
if ! command -v stellar &> /dev/null; then
    echo -e "${RED}Error: stellar CLI not found${NC}"
    echo "Please install stellar CLI: npm install -g @stellar/stellar-cli"
    exit 1
fi

# Function to deploy a contract
deploy_contract() {
    local contract_name=$1
    local contract_path=$2
    
    echo -e "${YELLOW}Deploying $contract_name...${NC}"
    
    # Deploy contract
    DEPLOY_RESULT=$(stellar contract deploy \
        --wasm target/wasm32v1/release/$contract_name.wasm \
        --source deployer \
        --network $NETWORK \
        --rpc-url https://soroban-testnet.stellar.org:443)
    
    if [ $? -eq 0 ]; then
        # Extract contract ID from output
        CONTRACT_ID=$(echo "$DEPLOY_RESULT" | grep -o 'Contract ID: [A-Z0-9]*' | grep -o '[A-Z0-9]*')
        echo -e "${GREEN}✓ $contract_name deployed successfully!${NC}"
        echo -e "${GREEN}  Contract ID: $CONTRACT_ID${NC}"
        echo ""
        
        # Store contract ID in environments.toml
        echo "[$contract_name]" >> environments.toml
        echo "contract_id = \"$CONTRACT_ID\"" >> environments.toml
        echo "network = \"$NETWORK\"" >> environments.toml
        echo "" >> environments.toml
        
        return $CONTRACT_ID
    else
        echo -e "${RED}✗ Failed to deploy $contract_name${NC}"
        exit 1
    fi
}

# Build all contracts first
echo -e "${YELLOW}Building all contracts...${NC}"
if ! cargo build --target wasm32v1-none --release; then
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Clear existing environments.toml
> environments.toml

# Deploy all six contracts
echo -e "${YELLOW}Starting deployment...${NC}"
echo ""

LEARN_TOKEN_ID=$(deploy_contract "learn_token" "contracts/learn_token")
GOVERNANCE_TOKEN_ID=$(deploy_contract "governance_token" "contracts/governance_token")
COURSE_MILESTONE_ID=$(deploy_contract "course_milestone" "contracts/course_milestone")
MILESTONE_ESCROW_ID=$(deploy_contract "milestone_escrow" "contracts/milestone_escrow")
SCHOLARSHIP_TREASURY_ID=$(deploy_contract "scholarship_treasury" "contracts/scholarship_treasury")
SCHOLAR_NFT_ID=$(deploy_contract "scholar_nft" "contracts/scholar_nft")

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Deployment Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}All contracts deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}Contract Addresses:${NC}"
echo -e "${BLUE}LearnToken:${NC} $LEARN_TOKEN_ID"
echo -e "${BLUE}GovernanceToken:${NC} $GOVERNANCE_TOKEN_ID"
echo -e "${BLUE}CourseMilestone:${NC} $COURSE_MILESTONE_ID"
echo -e "${BLUE}MilestoneEscrow:${NC} $MILESTONE_ESCROW_ID"
echo -e "${BLUE}ScholarshipTreasury:${NC} $SCHOLARSHIP_TREASURY_ID"
echo -e "${BLUE}ScholarNFT:${NC} $SCHOLAR_NFT_ID"
echo ""
echo -e "${GREEN}environments.toml updated with contract addresses${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update .env.example with contract IDs"
echo "2. Run smoke tests: stellar contract invoke --id <CONTRACT_ID> --network testnet ..."
echo "3. Update frontend integration"
