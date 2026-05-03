---
name: 0g-chain
description: 0G Chain development — fully EVM-compatible L1 for deploying Solidity contracts with Foundry. Use when deploying contracts to 0G Chain or building on 0G's EVM layer.
---

# 0G Chain Development

0G Chain is a fully EVM-compatible L1. This means your Solidity contracts, Foundry toolchain, and development workflow are identical to Ethereum — just point to 0G's RPC instead.

## Network Configuration

| Network | Chain ID | RPC | Explorer | Faucet |
|---------|----------|-----|----------|--------|
| Mainnet | 16661 | `https://evmrpc.0g.ai` | `https://chainscan.0g.ai` | N/A |
| Testnet | 16602 | `https://evmrpc-testnet.0g.ai` | `https://chainscan-galileo.0g.ai` | `https://faucet.0g.ai` |

## Foundry Setup

### foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

[rpc_endpoints]
0g = "https://evmrpc.0g.ai"
0g-testnet = "https://evmrpc-testnet.0g.ai"

[etherscan]
0g = { key = "", url = "https://chainscan.0g.ai/api" }
0g-testnet = { key = "", url = "https://chainscan-galileo.0g.ai/api" }
```

### Deploying Contracts

```bash
# Deploy to testnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# Deploy to mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://evmrpc.0g.ai \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Testing

```bash
# Run tests (same as Ethereum)
forge test

# Run tests with fork of 0G testnet
forge test --fork-url https://evmrpc-testnet.0g.ai

# Run tests with fork of 0G mainnet
forge test --fork-url https://evmrpc.0g.ai
```

### Interacting with Contracts

```bash
# Read contract state
cast call $CONTRACT "balanceOf(address)" $ADDRESS \
  --rpc-url https://evmrpc-testnet.0g.ai

# Send transaction
cast send $CONTRACT "transfer(address,uint256)" $TO $AMOUNT \
  --private-key $PRIVATE_KEY \
  --rpc-url https://evmrpc-testnet.0g.ai

# Get balance
cast balance $ADDRESS \
  --rpc-url https://evmrpc-testnet.0g.ai
```

## Chain ID Configuration

When adding 0G to Hardhat or other tools, use:

| Network | Chain ID |
|---------|----------|
| 0G Mainnet | 16661 |
| 0G Testnet | 16602 |

## Native Token

The native token is **0G** (not ETH). Gas fees are paid in 0G tokens.

## Faucet

Get testnet 0G from `https://faucet.0g.ai` — provides 0.1 0G/day for development and testing.

## Block Explorers

- **Mainnet:** `https://chainscan.0g.ai`
- **Testnet:** `https://chainscan-galileo.0g.ai`

## Contract Verification

0G Chain supports contract verification through its block explorer APIs. Use the standard `forge verify-contract` command with the appropriate explorer URL.

```bash
forge verify-contract \
  $CONTRACT_ADDRESS \
  src/MyContract.sol:MyContract \
  --chain-id 16602 \
  --verifier-url https://chainscan-galileo.0g.ai/api
```

## Differences from Ethereum

0G Chain is designed to be EVM-compatible, so:
- Same Solidity syntax
- Same Foundry/Hardhat workflows
- Same EVM opcodes
- Same contract deployment patterns
- Same wallet signing (ECDSA)

The only differences are:
- Chain ID (16661 mainnet, 16602 testnet)
- Native token symbol (0G instead of ETH)
- RPC endpoints
- Block explorer URLs
- Gas prices (typically lower than Ethereum mainnet)

## Common Pitfalls

- **Chain ID:** always specify the correct chain ID (16661 or 16602) — don't default to 1
- **RPC reliability:** testnet RPCs may have occasional downtime — implement retry logic
- **Block time:** 0G may have different block times than Ethereum — don't hardcode timing assumptions
- **Faucet limits:** 0.1 0G/day on testnet — manage your testnet balance accordingly
- **Explorer API:** verification API endpoints may differ from Etherscan — check 0G docs for the correct format
