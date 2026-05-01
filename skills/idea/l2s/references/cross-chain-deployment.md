# Cross-Chain Deployment — Cookbook

The same contract, the same address, on every chain. That is the goal of cross-chain deployment, and it is harder than it sounds. This file is the cookbook for getting it right.

The core technique is **CREATE2**: a deployment opcode that computes the contract address from the deployer, the salt, and the bytecode hash — independent of the deployer's nonce. Same inputs, same address, on any chain. With one important caveat: the bytecode has to actually be identical, which is harder on zkSync than elsewhere.

Read this before you deploy a contract you intend to ship on more than one chain.

## Why Same-Address Deployments Matter

- **UX:** users (and support staff) can copy-paste an address and trust it on every chain.
- **Tooling:** wallets, indexers, and explorers can hardcode one address across the multi-chain config.
- **Composability:** other contracts that integrate with you don't need a chain-by-chain registry.
- **Branding:** your token / vault / router is `0xMYBRAND...` everywhere, which builds trust.
- **Contract upgrades:** if you use CREATE2 to deploy a deterministic factory, you can predict the address of future deployments without onchain registration.

The cost of **not** using deterministic deployment is a pile of `chain_id → address` lookup tables in every frontend, indexer, and partner integration. Avoid it.

## CREATE2 in 90 Seconds

A normal `CREATE` deploys to an address derived from `keccak256(rlp([sender, nonce]))` — nonce-dependent, so the same contract from the same deployer ends up at different addresses depending on transaction order.

`CREATE2` deploys to:

```
address = keccak256(0xff ++ deployer ++ salt ++ keccak256(initCode))[12:]
```

Where:

- `deployer` is the address calling `CREATE2` (typically a deployer factory).
- `salt` is a 32-byte value you choose.
- `initCode` is the contract creation bytecode (constructor + arguments).

If you fix the deployer, salt, and bytecode, the address is fixed across every EVM chain. **Constructor arguments** are part of `initCode` — change them and the address changes.

## The Universal CREATE2 Deployer

The standard cross-chain CREATE2 deployer is at:

```
0x4e59b44847b379578588920cA78FbF26c0B4956C
```

This is the **Arachnid deterministic deployer** (sometimes called the "create2 proxy"), deployed via a self-funding pre-signed transaction so it has the same address on every EVM chain that supports the standard. When `forge create` is invoked with `--salt`, Foundry automatically routes the deployment through this proxy.

Verify the deployer exists on your target chain before relying on it:

```bash
cast code 0x4e59b44847b379578588920cA78FbF26c0B4956C --rpc-url $RPC_URL
```

If `cast code` returns `0x`, the deployer is not on that chain. You need to either:

1. Deploy it yourself via the canonical pre-signed transaction (https://github.com/Arachnid/deterministic-deployment-proxy).
2. Use a chain-specific equivalent (most chains have one — check the chain's docs).

On most major L2s (Arbitrum, Base, Optimism, Unichain, Celo, Scroll, Linea) the Arachnid deployer has been deployed by community members via the canonical pre-signed transaction (it has no admin key and the same address everywhere). Do not assume — always run the `cast code` check above before deploying. zkSync Era uses a different scheme; see "zkSync Caveat" below.

## Salt Patterns That Don't Bite You Later

Pick the salt deliberately. The salt is permanent — once you've shipped, you cannot change it without changing your address.

### Pattern 1: Project-Versioned Salt

```
salt = keccak256("MyProject:MyContract:v1")
```

Embed the project name, contract name, and version. If you redeploy v2 with a different bytecode, the address changes (which is what you want — different code, different address). If you redeploy v1, the address is identical (idempotent — useful for re-running deploy scripts).

### Pattern 2: Vanity-Mined Salt

```
salt = keccak256("MyProject:Token:0x42424242...")
```

Mine a salt until the resulting address starts with the bytes you want (e.g. `0x4242...`). Tools like https://github.com/0age/create2crunch and the foundry built-in `cast create2` mine vanity addresses. **Cost:** $50-500 of CPU time for 4-6 leading hex characters; orders of magnitude more for longer prefixes.

```bash
# Foundry's vanity address miner
cast create2 --starts-with 4242 \
  --deployer 0x4e59b44847b379578588920cA78FbF26c0B4956C \
  --init-code-hash <hash>
```

### Pattern 3: Deterministic from Deployer EOA

```
salt = bytes32(uint256(uint160(deployerEOA)))
```

If only your team's deployer key should be able to produce this address, salt with the deployer EOA itself. Combined with a permissioned factory that requires the caller to be `deployerEOA`, this prevents anyone else from claiming the same address on a chain you have not deployed to yet (a "front-running" risk on cross-chain deploys).

### Pattern 4: The Don't-Do-This Salt

```
salt = bytes32(0)  // ← wrong, anyone can mine your bytecode hash and front-run
```

Zero salts and small-integer salts are heavily contested. Someone can deploy a malicious contract at the address you intended to use, then sit on it. Always use a salt with enough entropy that an attacker cannot guess it before you deploy.

## Forge Workflow for Multi-Chain Deployment

A typical Foundry script for deploying the same contract to multiple chains with a deterministic address:

There are two routes that produce a deterministic address:

- **Foundry CLI:** `forge create --salt 0x...` automatically routes through the Arachnid proxy at `0x4e59b44847b379578588920cA78FbF26c0B4956C`.
- **In a script:** call the deployer explicitly. Using `new X{salt: ...}` in Solidity calls the raw `CREATE2` opcode where `deployer = address(this)`. The address depends on whoever runs the deployment, NOT on the Arachnid proxy. To get the same address everywhere, route through the canonical deployer:

```solidity
// script/DeployAll.s.sol
// Illustrative. Verify against https://book.getfoundry.sh for current scripting API.
import "forge-std/Script.sol";
import {MyContract} from "../src/MyContract.sol";

contract DeployAll is Script {
    address constant DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes32 internal constant SALT = keccak256("MyProject:MyContract:v1");

    function run() external {
        vm.startBroadcast();
        bytes memory initCode = abi.encodePacked(
            type(MyContract).creationCode,
            abi.encode(/* constructor args */)
        );
        (bool ok, bytes memory ret) = DEPLOYER.call(abi.encodePacked(SALT, initCode));
        require(ok, "create2 failed");
        address deployed = address(uint160(bytes20(ret)));
        vm.stopBroadcast();
        require(deployed != address(0), "deploy failed");
    }
}
```

Run it against each chain:

```bash
# Mainnet
forge script script/DeployAll.s.sol --rpc-url $MAINNET_RPC --broadcast --verify

# Arbitrum
forge script script/DeployAll.s.sol --rpc-url https://arb1.arbitrum.io/rpc --broadcast --verify

# Base
forge script script/DeployAll.s.sol --rpc-url https://mainnet.base.org --broadcast --verify

# Optimism
forge script script/DeployAll.s.sol --rpc-url https://mainnet.optimism.io --broadcast --verify
```

If the bytecode is identical and the salt is the same, the resulting address is identical on every chain. **Always run a dry-run first** (`forge script ... --rpc-url ... -vvvv` without `--broadcast`) to print the predicted address.

### Predicting the Address Before Deploying

```bash
# Compute the deterministic address ahead of time
cast create2 \
  --salt $(cast keccak "MyProject:MyContract:v1") \
  --init-code-hash $(cast keccak <hex-of-creation-bytecode>) \
  --deployer 0x4e59b44847b379578588920cA78FbF26c0B4956C
```

Or in Solidity:

```solidity
function predict(bytes32 salt, bytes memory initCode) public pure returns (address) {
    return address(uint160(uint256(keccak256(abi.encodePacked(
        bytes1(0xff),
        address(0x4e59b44847b379578588920cA78FbF26c0B4956C),
        salt,
        keccak256(initCode)
    )))));
}
```

## Why Bytecode Differs Between Chains (And How to Fix It)

Same Solidity source ≠ same bytecode. The classic differences:

### Difference 1: Compiler Settings

`solc` version, optimizer runs, `viaIR`, EVM version (`paris`, `shanghai`, `cancun`, etc.) all change bytecode.

**Fix:** lock these in `foundry.toml` and check the file into version control.

```toml
[profile.default]
solc = "0.8.27"
optimizer = true
optimizer_runs = 200
evm_version = "cancun"
```

### Difference 2: Embedded Metadata Hash

Solidity embeds an IPFS hash of the source metadata at the end of the bytecode. Two compilations on different machines may differ if the metadata differs.

**Fix:** strip the metadata hash, or freeze it.

```toml
[profile.default]
bytecode_hash = "none"   # or "ipfs", but lock the inputs
cbor_metadata = false
```

### Difference 3: Constructor Arguments

Different constructor args = different `initCode` = different address. If a chain-specific config (e.g. a chain's USDC address) goes into the constructor, the address differs.

**Fix:** put chain-specific values in `initialize()` (proxied contracts), in immutables resolved at deploy time, or in a separate per-chain configurator contract.

### Difference 4: Linked Libraries

If your contract uses a library that gets linked at deploy time, the address of the library is part of the bytecode. Cross-chain deploys must deploy the library deterministically too.

**Fix:** deploy libraries via CREATE2 with the same salt strategy, then they live at the same address everywhere, then your contract's bytecode is identical everywhere.

## zkSync Caveat — CREATE2 Is Different

zkSync Era does **not** use the same CREATE2 address derivation as the rest of the EVM. It uses a different formula and a different deployer. **You cannot get the same address on zkSync as on mainnet using the same salt and bytecode.**

What you can do:

- Use the **same salt** for zkSync, accepting that the address differs.
- Use **zkSync's `ContractDeployer`** system contract (`0x0000000000000000000000000000000000008006`) for deterministic deployment within zkSync.
- Document the cross-chain address mapping in your frontend / indexer.

Verify the current zkSync deployment APIs against canonical docs at https://docs.zksync.io/build/developer-reference/contract-deployment.

If "same address on every chain" is a hard requirement, you can either:

1. Skip zkSync.
2. Accept zkSync as the one exception.
3. Deploy a "router" contract on every chain that proxies to chain-specific deployments — the router has the same address everywhere, the underlying logic differs.

Most projects pick option 2.

## Cross-Chain Deployment Checklist

Before you broadcast the first transaction:

- [ ] **Lock compiler version and settings** in `foundry.toml`. Check it in.
- [ ] **Disable metadata hash variability** (`bytecode_hash = "none"` or carefully managed).
- [ ] **Verify the CREATE2 deployer exists** on every target chain (`cast code 0x4e59b44847b379578588920cA78FbF26c0B4956C`).
- [ ] **Pick a salt with entropy** — namespaced to project + contract + version.
- [ ] **Move chain-specific config out of the constructor** (use `initialize()`, immutables-from-deployment, or a configurator).
- [ ] **Predict the address** with `cast create2` before broadcasting and confirm it matches the bytecode you intend to ship.
- [ ] **Dry-run on each chain's testnet** before mainnet.
- [ ] **Document the cross-chain address** in your README, on your website, in your indexer, in your wallet integration. The address itself is now part of your project's identity.
- [ ] **Plan for zkSync's different rules** — accept the different address or skip the chain.

## Frontending Strategy — Detect Deployment

In a multi-chain frontend, cache the deterministic address and verify it has bytecode on each chain:

```ts
// Illustrative. Verify viem APIs against https://viem.sh.
import { createPublicClient, http } from "viem";
import { mainnet, base, arbitrum, optimism, scroll, linea } from "viem/chains";

const DETERMINISTIC_ADDRESS = "0x..." as const; // your CREATE2 address
const CHAINS = [mainnet, base, arbitrum, optimism, scroll, linea];

async function detectDeployments() {
  const results = await Promise.all(
    CHAINS.map(async (chain) => {
      const client = createPublicClient({ chain, transport: http() });
      const code = await client.getCode({ address: DETERMINISTIC_ADDRESS });
      return {
        chain: chain.name,
        chainId: chain.id,
        deployed: code !== undefined && code.length > 2,
      };
    }),
  );
  return results;
}
```

This pattern lets you ship to one chain, verify, then expand without changing frontend constants — only the "deployed on which chains" set grows.

## Owning the Address Cross-Chain — Front-Running Defense

Until you deploy on a chain, that chain's `(deployer, salt, bytecode)` slot is unclaimed. An adversary who knows your salt and bytecode can deploy your exact contract on a chain you haven't shipped to yet. If your contract is upgradeable or has admin functions, this is a problem — they own the address and the admin role at the moment of deployment.

Defenses:

1. **Bake the deployer EOA into the bytecode** so the contract reverts unless `tx.origin == deployerEOA` during construction. An adversary cannot deploy the same code from your address.
2. **Use a permissioned factory** that wraps CREATE2 and requires `msg.sender == owner`.
3. **Set ownership via the constructor**, not via `initialize()`, so the deployer is irreversibly the address that ran CREATE2.
4. **Deploy to all chains close to simultaneously** to compress the window.

Pattern 1 is simplest and most robust. Bake a single canonical owner address into bytecode as a compile-time constant — it is the same on every chain, so the address stays deterministic, and ownership is fixed regardless of who runs the deployment transaction.

```solidity
contract Ownable {
    // Canonical owner — same constant on every chain so bytecode is identical.
    address public constant OWNER = 0x000000000000000000000000000000000000dEaD; // replace with your multisig

    function owner() external pure returns (address) {
        return OWNER;
    }
}
```

Because the address is a `constant` in bytecode, every chain compiles to identical `initCode` and the CREATE2 address matches. Ownership is set by the bytecode, not by `msg.sender` or `tx.origin` — so a front-runner who deploys your code on a fresh chain still hands ownership to your canonical address.

Do not use `tx.origin` for this check: `tx.origin` semantics are unreliable on zkSync (the bootloader can appear as `tx.origin`; see `op-stack-vs-zk.md`) and `tx.origin` auth is fragile across chains in general.

For stronger front-running protection, prefer **permissioned salts** — encode an authorised deployer into the salt itself, e.g. `salt = keccak256(abi.encode(authorizedDeployer, projectId, version))`. The proxy will produce the same address only when the same salt is used with the same init code; pair this with a small proxy factory you control on each chain if front-running is a real threat.

## Verifying After Deployment

After deploying on each chain:

1. **Read the bytecode.** `cast code <addr> --rpc-url ...` should return identical bytes on every EVM chain.
2. **Verify on each explorer.** Etherscan, Arbiscan, Basescan, Optimistic Etherscan, Scrollscan, Lineascan, Era Explorer all support `forge verify-contract`. Verifying gives users (and your indexer) source-level confirmation.
3. **Check ownership / admin** is set to the address you intended on every chain.
4. **Test a sample interaction on each chain** — the contract should function identically (modulo chain-specific quirks like Arbitrum's `block.number`).
5. **Add the address to your README** with a table of `(chain, address, verified link)`.

## Common Mistakes

**Hardcoding chain-specific addresses in the constructor.** A different USDC address per chain → different `initCode` → different address. Move to `initialize()` or to a configurator.

**Forgetting that constructor arguments are part of `initCode`.** Same code, different args, different address. Either keep arguments identical (e.g., always pass mainnet's USDC and read from a registry on each chain) or use proxies.

**Reusing salts across unrelated projects.** If two projects use the same salt with the same deployer, only the first wins.

**Ignoring zkSync's different rules.** Treating zkSync as just-another-EVM in your CREATE2 logic produces address mismatches and confused integrators.

**Not verifying the deployer exists on a chain.** Some niche L2s do not have the universal deployer in place — if you point `forge create --salt` at such a chain, the deployment will fail or fall back to nonce-dependent behavior. Run the `cast code` check first.

**Treating the address as immutable for upgrades.** A CREATE2 address is fixed for that bytecode. If you want upgradability, deploy a **proxy** at the deterministic address and put the implementation behind it. The proxy's bytecode and constructor are what you fix; the implementation can change.

## Default Pattern for Production

For most projects shipping to 3-5 chains, the recommended setup is:

1. **Foundry script with a fixed salt** namespaced to project + contract + version.
2. **Strip metadata hash** for byte-identical compilation.
3. **Proxy + implementation pattern** (TransparentUpgradeableProxy or UUPS) so the proxy is at the deterministic address and the implementation can be swapped per-chain if needed.
4. **Constructor checks `msg.sender == EXPECTED_DEPLOYER`** to defend against front-running.
5. **Skip zkSync from the deterministic-address scheme** unless you specifically need it.
6. **Verify on every chain's explorer** as part of the deploy script.

This is boring, deliberate, and correct. The flashy alternatives (vanity addresses, custom factories, exotic interop) are nice-to-haves — they should not be on the critical path of your first multi-chain ship.
