# USDC Integration Guide

This document explains how to use USDC (USD Coin) with LearnVault on Stellar
Testnet and Mainnet.

## Overview

LearnVault's `ScholarshipTreasury` contract accepts USDC deposits from donors.
This integration provides:

- Test USDC tokens for development and testing
- A faucet script to mint test USDC
- UI components for easy USDC operations
- Configuration for testnet and mainnet environments

## Contract Addresses

### Mainnet

- **Official Circle USDC**:
  `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`

### Testnet

- For testnet, we use a test token deployed as a Stellar Asset Contract
- The contract ID is configured in `environments.toml` and deployed
  automatically

### Local Development

- A test USDC token is deployed automatically when you run `npm start`
- The contract uses the `fungible_allowlist` contract as a USDC substitute

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# USDC Contract ID (testnet or mainnet)
PUBLIC_USDC_CONTRACT_ID="CB..."
```

### environments.toml

The USDC contracts are configured in `environments.toml`:

```toml
# Development (local)
[development.contracts]
usdc_test_token = { client = true, constructor_args = "--admin me --initial_supply 1000000000000000" }

# Staging (testnet)
[staging.contracts]
usdc_testnet = { client = true, constructor_args = "--admin testnet-user --manager testnet-user --initial_supply 1000000000000000" }

# Production (mainnet)
[production.contracts]
usdc_mainnet = { id = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75" }
```

## Getting Test USDC

### Method 1: CLI Script (Recommended)

Use the provided faucet script to mint test USDC:

```bash
# Mint 1000 USDC (default amount)
./scripts/mint-test-usdc.sh <your-stellar-address>

# Mint a custom amount
./scripts/mint-test-usdc.sh <your-stellar-address> 5000
```

**Example:**

```bash
./scripts/mint-test-usdc.sh GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX 1000
```

### Method 2: UI Button (Coming Soon)

A "Get Test USDC" button is available in the donor onboarding flow. This button
will:

1. Connect to your wallet
2. Mint test USDC tokens to your address
3. Display a success notification

**Note:** The UI button currently directs users to use the CLI script. Full UI
integration will be available once contract clients are generated.

## Using USDC with ScholarshipTreasury

### Initialize the Treasury

When deploying the `ScholarshipTreasury` contract, pass the USDC contract
address:

```rust
scholarship_treasury::initialize(
    env,
    admin_address,
    usdc_contract_address,  // USDC token contract
    governance_contract_address
)
```

### Make a Deposit

Donors can deposit USDC to the treasury:

```rust
scholarship_treasury::deposit(
    env,
    donor_address,
    amount  // Amount in stroops (7 decimals)
)
```

**Example:** To deposit 100 USDC:

```rust
let amount = 100 * 10_000_000;  // 100 USDC = 1,000,000,000 stroops
scholarship_treasury::deposit(env, donor, amount);
```

## Development Workflow

### 1. Start Local Environment

```bash
npm start
```

This will:

- Start a local Stellar node
- Deploy all contracts including the test USDC token
- Generate contract clients
- Start the frontend dev server

### 2. Fund Your Account

```bash
# Get XLM for transaction fees
stellar keys fund <your-address> --network testnet

# Or use the UI "Fund Account" button
```

### 3. Get Test USDC

```bash
./scripts/mint-test-usdc.sh <your-address> 1000
```

### 4. Test Donations

Use the LearnVault UI to:

1. Connect your wallet
2. Navigate to the Treasury/Donor page
3. Make a test donation using your USDC

## Testnet Deployment

### 1. Deploy Contracts

```bash
stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/fungible_allowlist.wasm \
    --source testnet-user \
    --network testnet
```

### 2. Initialize USDC Token

```bash
stellar contract invoke \
    --id <usdc-contract-id> \
    --source testnet-user \
    --network testnet \
    -- \
    initialize \
    --admin <admin-address> \
    --manager <manager-address> \
    --initial_supply 1000000000000000
```

### 3. Update Environment Variables

Add the deployed contract ID to your `.env`:

```bash
PUBLIC_USDC_CONTRACT_ID="<deployed-contract-id>"
```

## Mainnet Deployment

For mainnet, use the official Circle USDC contract:

```bash
PUBLIC_USDC_CONTRACT_ID="CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"
```

**Important:** Never use test tokens on mainnet. Always use the official Circle
USDC contract.

## Troubleshooting

### "USDC contract ID not configured"

**Solution:** Set `PUBLIC_USDC_CONTRACT_ID` in your `.env` file.

### "Failed to mint USDC"

**Possible causes:**

1. Contract not deployed
2. Insufficient permissions
3. Network connectivity issues

**Solution:**

- Verify the contract is deployed:
  `stellar contract info --id <contract-id> --network <network>`
- Check you have admin/manager permissions
- Ensure you're connected to the correct network

### "Contract not found"

**Solution:** Deploy the contracts first by running `npm start` (local) or
deploying to testnet.

## Security Considerations

### Testnet

- Test USDC has no real value
- Use only for development and testing
- Never share testnet private keys publicly

### Mainnet

- Use only the official Circle USDC contract
- Verify the contract address before any transaction
- Test thoroughly on testnet before mainnet deployment
- Follow security best practices for key management

## Additional Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Smart Contracts](https://soroban.stellar.org/docs)
- [Circle USDC Documentation](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [LearnVault GitHub](https://github.com/bakeronchain/learnvault)

## Support

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/bakeronchain/learnvault/issues)
2. Join our [Discord](https://discord.gg/learnvault)
3. Read the [Contributing Guide](../CONTRIBUTING.md)

---

**Last Updated:** March 2026
