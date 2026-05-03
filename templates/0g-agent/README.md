---
name: 0G Agent Template
description: Autonomous agent with persistent memory on 0G Storage KV and inference on 0G Compute
---

# 0G Agent Template

Autonomous agent with persistent memory on 0G Storage KV and inference on 0G Compute.

## Architecture

```
User Input → Agent Core → 0G Compute (inference)
                 ↓
         0G Storage KV (memory)
                 ↓
         Response → User
```

## Structure

```
src/
  agent/
    Agent.sol          # Onchain agent registry and execution
    Memory.sol         # Onchain memory pointer (offchain data in 0G Storage)
test/
  Agent.t.sol          # Unit tests
  Agent.fuzz.t.sol     # Fuzz tests
script/
  Deploy.s.sol         # Deployment script
frontend/              # Scaffold-ETH 2 frontend
```

## Security Model

- Agent execution requires owner authorization
- Memory pointers are immutable after creation
- All state changes emit events
- Access control via OpenZeppelin Ownable

## Invariants

1. Agent cannot execute without valid authorization
2. Memory pointers cannot be changed after creation
3. All state transitions are logged
4. Owner can pause/unpause agent execution

## Getting Started

```bash
# Install dependencies
forge install foundry-rs/forge-std@v1.8.0
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0

# Run tests
forge test

# Deploy to 0G testnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## 0G Integration

- **Storage:** Agent memory stored in 0G Storage KV layer
- **Compute:** Agent inference runs on 0G Compute Router
- **Chain:** Smart contracts deploy on 0G Chain (EVM-compatible)

See `skills/build/0g-storage/SKILL.md` for storage patterns.
See `skills/build/0g-compute/SKILL.md` for compute integration.
See `skills/build/0g-chain/SKILL.md` for deployment.
