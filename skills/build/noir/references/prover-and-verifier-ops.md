# Noir Prover and Verifier Operations

Everything around the circuit that has to be right: nargo + bb version pinning, build artifacts, proof serialization, deploy patterns for the Solidity verifier, and the "why does my proof verify off-chain but fail on-chain" debugging tree.

For circuit logic, see `SKILL.md` and `references/circuit-patterns.md`. For tree state, see `references/tree-state-and-events.md`.

## Toolchain version pinning

Three versions must agree:

1. **`nargo`** — Noir compiler.
2. **`bb`** (Barretenberg CLI) — generates VK, proofs, Solidity verifier.
3. **`@aztec/bb.js`** — browser proving runtime.

A mismatch produces proofs that verify off-chain but fail on-chain (or vice versa). Version-bump tax is real:

```bash
# Capture exact versions in the project
nargo --version          # noirc 1.0.0-beta.x
bb --version             # bb 0.x.x

# Pin in package.json — match @aztec/bb.js to bb
"dependencies": {
  "@aztec/bb.js": "0.x.x",
  "@noir-lang/noir_js": "1.0.0-beta.x"
}
```

`bbup` defaults to "compatible with current nargo". After every `noirup` or `bbup`, re-run the entire build pipeline + integration test before assuming things still work.

### Locking versions in CI

```yaml
# .github/workflows/noir.yml
- run: |
    curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
    export PATH="$HOME/.nargo/bin:$PATH"
    noirup --version 1.0.0-beta.5
- run: |
    curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/master/barretenberg/bbup/install | bash
    export PATH="$HOME/.bb:$PATH"
    bbup --version 0.84.0
- run: nargo compile && nargo execute
```

Pin specific versions; don't track `latest`.

## Build pipeline annotated

```bash
# 1. Compile circuit → ACIR (abstract circuit intermediate repr)
nargo compile
# Produces: target/<crate>.json (bytecode + ABI + manifest)

# 2. Execute → witness file
nargo execute
# Reads Prover.toml, runs circuit, produces target/<crate>.gz

# 3. Verification key (one-time per circuit)
bb write_vk --oracle_hash keccak -b target/<crate>.json -o target/
# Produces: target/vk
# CRITICAL: --oracle_hash keccak is required for EVM compatibility

# 4. Solidity verifier (one-time per circuit)
bb write_solidity_verifier -k target/vk -o target/Verifier.sol

# 5. (Optional smoke test) Generate proof + verify locally
bb prove --oracle_hash keccak -b target/<crate>.json -w target/<crate>.gz -o target/
bb verify --oracle_hash keccak -p target/proof -k target/vk -i target/public_inputs
```

The `--oracle_hash keccak` flag MUST be on every step (`write_vk`, `prove`, `verify`). Without it, the proof uses a different transcript hash and won't verify in the EVM.

## Browser proving with `{ keccak: true }`

```ts
const proof = await backend.generateProof(witness, { keccak: true });
```

Match the CLI flag. Without `keccak: true`, browser-generated proofs use the default Pedersen oracle hash and fail on-chain.

## Solidity verifier deployment

The generated `HonkVerifier.sol` is a standalone contract. Two deploy patterns:

### Pattern 1: separate verifier, app holds address

```solidity
contract MyApp {
    IVerifier public immutable verifier;
    constructor(address _verifier) { verifier = IVerifier(_verifier); }

    function act(bytes calldata proof, bytes32[] calldata publicInputs) external {
        require(verifier.verify(proof, publicInputs), "bad proof");
        // ...
    }
}
```

```bash
# Deploy verifier first
forge create src/HonkVerifier.sol:HonkVerifier --private-key $KEY --rpc-url $RPC
# 0xVERIFIER...

# Deploy app, pass verifier address
forge create src/MyApp.sol:MyApp --constructor-args 0xVERIFIER... --private-key $KEY --rpc-url $RPC
```

Pros: upgradable verifier (deploy a new one for circuit changes, point app at new address). App contract small.

### Pattern 2: inline verifier as a library

`HonkVerifier.sol` exceeds the 24KB EIP-170 limit on most non-trivial circuits, so this is rarely viable. Use Pattern 1.

### Pattern 3: factory + per-circuit verifier registry

```solidity
mapping(bytes32 => address) public verifiers;     // circuitId → verifier address

function register(bytes32 circuitId, address v) external onlyOwner { verifiers[circuitId] = v; }

function actWithCircuit(bytes32 circuitId, bytes calldata proof, bytes32[] calldata publicInputs) external {
    address v = verifiers[circuitId];
    require(v != address(0), "unknown circuit");
    require(IVerifier(v).verify(proof, publicInputs), "bad proof");
    // ...
}
```

Useful when one app verifies multiple circuit versions or types (e.g., voting + airdrop + access control all in one app).

## EIP-170 size limit

Generated verifier easily exceeds 24KB:

```bash
# Check size
forge build && cast --calldata-decode 'create()' < out/HonkVerifier.sol/HonkVerifier.json
ls -lh out/HonkVerifier.sol/HonkVerifier.json
```

Mitigations (in order of preference):

1. **Optimizer on**: `optimizer = true; optimizer_runs = 200` in `foundry.toml`. Often saves 5–10KB.
2. **`optimizer_runs = 1`**: optimize for size, not gas. Saves more bytes; slightly more expensive per call.
3. **Smaller circuit**: fewer constraints = smaller verifier.
4. **EIP-7702 / proxy patterns**: the verifier's logic stays small if you can split.

Local development can use `anvil --code-size-limit 40960` and `forge --code-size-limit 40960`, but **mainnet enforces 24KB**. If your verifier is over 24KB after optimization, you cannot deploy on mainnet.

## Proof serialization end-to-end

Where things go wrong:

```
Browser:                                           On-chain:
proof.proof: Uint8Array  ─── hex(0x-prefix) ───►  bytes proof
proof.publicInputs:                                bytes32[] publicInputs
  string[]               ─── pad32 each   ───►
```

```ts
const bytesToHex = (bytes: Uint8Array) =>
  `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")}`;
const toBytes32 = (field: string) =>
  `0x${field.replace(/^0x/, "").padStart(64, "0")}` as `0x${string}`;

const proofHex = bytesToHex(proof.proof);
const publicInputs = proof.publicInputs.map(toBytes32);
```

Public input order MUST match:
1. Circuit's `pub` parameter order
2. Verifier ABI's `publicInputs` array order
3. App contract's input ordering

Check by reading the generated `HonkVerifier.sol` ABI directly.

## Debugging "verifies off-chain, fails on-chain"

Walk this tree:

```
1. Did you use --oracle_hash keccak everywhere?
   ├─ no → fix the CLI flags + bb.js { keccak: true }
   └─ yes ↓

2. Does the on-chain verifier ABI match what you're calling?
   ├─ no → re-generate verifier and call exactly its function signature
   └─ yes ↓

3. Are public inputs in the right order?
   ├─ no → reorder to match circuit's pub parameter order
   └─ yes ↓

4. Are public inputs padded to 32 bytes?
   ├─ no → pad with leading zeros
   └─ yes ↓

5. Is the proof bytes serialized correctly?
   ├─ no → inspect Uint8Array vs hex
   └─ yes ↓

6. Are the bb CLI version and @aztec/bb.js version IDENTICAL?
   ├─ no → align versions
   └─ yes ↓

7. Did you regenerate VK after the last circuit change?
   ├─ no → re-run write_vk and write_solidity_verifier
   └─ yes ↓

8. Is the deployed verifier the SAME as your local Verifier.sol?
   ├─ no → redeploy
   └─ yes → file an issue; you've found a real bug
```

99% of failures are #1, #3, #6, or #7.

## Verifier gas cost

| Backend | EVM gas / proof |
|---|---|
| UltraHonk (current default, BN254) | ~280k–500k |
| UltraPlonk (older) | ~350k–600k |
| Groth16 (different toolchain) | ~250k–300k |

Optimizer affects this: `optimizer_runs = 1` (for size) ~ +30k gas vs `optimizer_runs = 1000` (for execution).

On L2: $0.01–$0.10 per proof verification at typical L2 gas.

## Per-chain quirks

| Chain | Notes |
|---|---|
| Ethereum mainnet | Standard BN254 precompiles; everything works |
| Base, Optimism, Arbitrum | Identical to mainnet for verifier purposes |
| Scroll | Standard precompiles |
| Polygon PoS | Standard |
| zkSync ERA | BN254 precompiles are smart-contract impls, not native; verifier costs ~3-5× more |
| Polygon zkEVM | Being shut down — do not target |
| Linea | Native BN254 since recent upgrade; on par with mainnet |

When deploying to non-mainnet, run an integration test on a fork before mainnet deployment. zkSync in particular has surprised teams with verifier gas blowups.

## Local development workflow

```bash
# Loop tightly during circuit dev
nargo compile
nargo execute
bb write_vk --oracle_hash keccak -b target/circuit.json -o target/
bb write_solidity_verifier -k target/vk -o ../contracts/src/Verifier.sol

# Drop into Foundry test
cd ../contracts
forge test -vvv --match-test "testRealProof"
```

Foundry test that exercises a real proof:

```solidity
function testRealProof() public {
    bytes memory proof = vm.parseBytes(vm.readFile("../circuit/target/proof"));
    bytes32[] memory publicInputs = abi.decode(vm.readFileBinary("../circuit/target/public_inputs"), (bytes32[]));
    assertTrue(verifier.verify(proof, publicInputs));
}
```

## CI artifacts

```yaml
- run: nargo compile && nargo execute
- run: bb write_vk --oracle_hash keccak -b target/circuit.json -o target/
- run: bb write_solidity_verifier -k target/vk -o target/Verifier.sol
- uses: actions/upload-artifact@v4
  with: { name: noir-artifacts, path: target/ }
- run: forge test
```

Commit the generated `Verifier.sol` to git for reproducibility. Add a CI check that re-generation matches:

```yaml
- run: |
    bb write_solidity_verifier -k target/vk -o target/NewVerifier.sol
    diff target/NewVerifier.sol src/Verifier.sol  # fail if drift
```

## Common pitfalls

- **`--oracle_hash keccak` missing** — proofs verify locally with bb, fail on-chain.
- **`@aztec/bb.js` version drift** — browser-generated proofs use a different proving system than your CLI-generated ones.
- **Public inputs order mismatch** — verifies for the wrong claim, or fails. Reorder to match `pub` parameters in source.
- **Verifier > 24 KB** — can't deploy. Enable optimizer; reduce circuit size if needed.
- **Constructor wiring wrong** — app deployed with the wrong verifier address. Always read the verifier address from the deployment artifact.
- **MockVerifier in production** — never deploy `MockVerifier`. Wire the real `HonkVerifier` from day one of dev (mocking just defers the integration cost).
- **Forgot to regenerate VK after circuit change** — proofs are for the old circuit, verifier is for the new one. Always regenerate together.
- **Browser proving session leak** — call `bb.destroy()` after generation; otherwise WASM memory grows unbounded.
- **Circuit artifact in source bundle** — copy to `public/` for fetch-based loading; don't import as JSON in Next.js or it'll bloat the page bundle.

## What to read next

- `SKILL.md` — circuit-side patterns
- `references/circuit-patterns.md` — non-Tornado patterns
- `references/tree-state-and-events.md` — the offchain mirror
- bb CLI reference: https://github.com/AztecProtocol/aztec-packages/tree/master/barretenberg/cpp/src/barretenberg/bb
- Aztec Noir docs: https://noir-lang.org/docs/
