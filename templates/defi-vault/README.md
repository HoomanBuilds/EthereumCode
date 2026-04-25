# defi-vault

ERC-4626 stablecoin vault shipped by `ethereum.new`.

## what you get

- `src/StableVault.sol` — ERC-4626 vault with deposit cap, pause, reentrancy guard, and a 48h timelocked strategy rotation.
- `test/StableVault.t.sol` — unit + fuzz tests.
- `script/Deploy.s.sol` — chain-agnostic deploy script driven by env vars.
- `frontend/` — Scaffold-ETH 2 page with the three-button flow (switch → approve → deposit).

## quick start

```bash
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge test
```

Deploy to Base Sepolia:

```bash
export BASE_SEPOLIA_RPC=...
export VAULT_ASSET=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # USDC on Base Sepolia
export VAULT_NAME="Stable Vault"
export VAULT_SYMBOL=svUSDC
export VAULT_CAP=1000000000000
export VAULT_OWNER=0xYourMultisig
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast --verify
```

## security notes (read before you ship)

- **Deposit cap**: protects against unbounded growth during early testing.
- **Strategy rotation**: 48h timelock. Never skip it.
- **Invariant**: `totalAssets() == underlying.balanceOf(vault) + reportedStrategyBalance`. Break it and you get a share price attack.
- **Reporting**: only the strategy can call `report()`. Validate the strategy before rotating.
- Run `slither .` before every deploy.
- Transfer ownership to a Safe multisig after verification.

This template enforces the ethskills `ship/` phase 4 production rules. See `audit.md` after running `eth audit`.
