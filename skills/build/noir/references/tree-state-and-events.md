# Tree State and Events for Noir Apps

The most-broken-by-default piece of a Noir privacy app isn't the circuit — it's the **tree state synchronization** between the on-chain Merkle tree and the off-chain mirror that clients use to generate proofs. This file is the complete contract for that synchronization.

For circuit-side work, see `references/circuit-patterns.md`. For toolchain, see `references/prover-and-verifier-ops.md`. For app architecture, see `SKILL.md`.

## The five pieces of tree state

```
1. ON-CHAIN TREE: stores commitments, exposes current root
2. INSERT EVENTS: enable clients to rebuild without trusting one
3. ROOT HISTORY: what roots the contract accepts proofs against
4. OFF-CHAIN MIRROR: client-side tree built from events
5. WITNESS DERIVATION: leafIndex → siblings → indices for the circuit
```

If any of these is wrong or out of sync with the others, every proof fails.

## On-chain tree: LeanIMT (recommended)

LeanIMT (Lean Incremental Merkle Tree) from PSE's zk-kit is the production-grade choice. Append-only, Poseidon-hashed, gas-efficient.

```bash
npm install @zk-kit/lean-imt.sol @zk-kit/imt.sol
```

```solidity
import {LeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/LeanIMT.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

contract PrivacyApp {
    using LeanIMT for LeanIMTData;
    LeanIMTData private tree;
    mapping(bytes32 => bool) public usedNullifiers;

    event CommitmentInserted(bytes32 indexed commitment, uint256 indexed leafIndex, bytes32 root);

    function commit(bytes32 commitment) external {
        require(commitment != bytes32(0), "zero commitment");
        uint256 leafIndex = tree.size;
        tree.insert(uint256(commitment));
        emit CommitmentInserted(commitment, leafIndex, bytes32(tree.root()));
    }

    function root() external view returns (bytes32) { return bytes32(tree.root()); }
    function size() external view returns (uint256)  { return tree.size; }
}
```

Key properties:
- Append-only — leaves can't be modified or deleted.
- O(log n) per insert.
- Poseidon T3 (`hash_2`) for parent hashes, matching most Noir circuits.
- Root updates after every insert.

You **must** deploy `PoseidonT3` first (or use a precompile-equivalent address), then deploy your app pointing at it. The `poseidon-solidity` library handles this; check its README for the latest deploy script.

## Insert events: the contract for clients

Clients can't directly read tree internals — they have to **rebuild from events**. The event must contain enough information to do this:

```solidity
event CommitmentInserted(
    bytes32 indexed commitment,    // the leaf value
    uint256 indexed leafIndex,     // its position in the tree
    bytes32 root                   // the new root after insertion
);
```

Why each field:
- `commitment`: the leaf data the client needs to insert into its mirror.
- `leafIndex`: position in the tree, needed for proof generation.
- `root`: lets clients verify their mirror is in sync with chain (assert `mirror.root() == event.root`).

**Why indexed**: clients filter `getLogs` by `commitment` to find their own deposit's leafIndex, or by `leafIndex` to read the entire history.

## Root history policy

The contract must accept proofs against valid roots. Two policies:

### Recent-roots policy (default — recommended)

Keep the last N roots; any proof against any of them is valid:

```solidity
uint256 constant ROOT_HISTORY = 30;
bytes32[ROOT_HISTORY] public knownRoots;
uint8 public rootIndex;

function _addRoot(bytes32 newRoot) internal {
    knownRoots[rootIndex] = newRoot;
    rootIndex = uint8((rootIndex + 1) % ROOT_HISTORY);
}

function isKnownRoot(bytes32 r) public view returns (bool) {
    if (r == bytes32(0)) return false;
    for (uint256 i = 0; i < ROOT_HISTORY; i++) {
        if (knownRoots[i] == r) return true;
    }
    return false;
}
```

Why N=30 (or similar): handles concurrent inserts. Alice generates a proof against root `R_t`. Before her tx confirms, Bob inserts a new commitment, updating root to `R_{t+1}`. With recent-roots, Alice's proof still works.

If you only accept the current root, you'll get a thundering herd of failed transactions whenever multiple users try to act simultaneously.

### Current-root-only policy

```solidity
function act(bytes calldata proof, bytes32 _root, bytes32 _nullifier) external {
    require(_root == tree.root(), "root must be current");
    // ...
}
```

Use only if your app has a single active user at a time (rare). Document the constraint loudly.

## Off-chain tree mirror

Clients use `@zk-kit/lean-imt` to mirror the on-chain tree:

```ts
import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon2 } from "poseidon-lite";

// Match the on-chain hash function
const tree = new LeanIMT((a, b) => poseidon2([a, b]));
```

**Critical**: the hash function MUST match what the on-chain contract and the circuit use. If the contract uses Poseidon T3 from poseidon-solidity, the off-chain mirror must use poseidon-lite's `poseidon2` (which is the same algorithm). `poseidon-lite` is the canonical JS implementation that matches.

If you use a different Poseidon variant (Poseidon2, Poseidon-128, etc.), it WILL produce different hashes, and proofs will fail. There is no graceful failure — the proof simply won't verify.

## Building the mirror from events

```ts
import { createPublicClient, http, parseAbiItem } from "viem";

const client = createPublicClient({ chain, transport: http(RPC) });

const COMMIT_EVENT = parseAbiItem(
  "event CommitmentInserted(bytes32 indexed commitment, uint256 indexed leafIndex, bytes32 root)"
);

async function buildMirror() {
  const tree = new LeanIMT((a, b) => poseidon2([a, b]));

  // Paginate getLogs (provider-specific limits, see indexing/references/event-design.md)
  const deployBlock = 12345678n;
  const latest = await client.getBlockNumber();
  const step = 5000n;

  for (let from = deployBlock; from <= latest; from += step) {
    const to = from + step - 1n > latest ? latest : from + step - 1n;
    const logs = await client.getLogs({
      address: APP_CONTRACT,
      event: COMMIT_EVENT,
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      const commitment = BigInt(log.args.commitment!);
      tree.insert(commitment);

      // Verify our mirror matches chain's view at that point
      if (tree.root !== BigInt(log.args.root!)) {
        throw new Error(`Mirror desynced at leafIndex ${log.args.leafIndex}`);
      }
    }
  }
  return tree;
}
```

The desync assertion catches version mismatches early. If hashes diverge between on-chain and off-chain mirror, you find out at event 1, not when generating a proof for event 10000.

### Caching the mirror

Rebuilding from genesis on every page load is slow. Persist:

```ts
async function getMirror() {
  const cached = await idb.get("mirror");
  if (cached) {
    const tree = LeanIMT.import(cached, (a, b) => poseidon2([a, b]));
    // catch up from cached.lastBlock to head
    await catchUp(tree, cached.lastBlock);
    return tree;
  }
  const tree = await buildMirror();
  await idb.put("mirror", { ...tree.export(), lastBlock: await client.getBlockNumber() });
  return tree;
}
```

IndexedDB is the right place for this. Don't put the tree in localStorage (size limits).

## Witness derivation

Once the mirror is built and the user's note has a `leafIndex`:

```ts
const note: PrivacyNote = await loadNote();              // user's saved note
const tree = await getMirror();                          // fresh mirror

// Generate the inclusion proof
const { siblings, index } = tree.generateProof(note.leafIndex!);

// Convert leafIndex to binary indices array (LSB-first)
const TREE_DEPTH = 20;
const indices: number[] = [];
let i = note.leafIndex!;
for (let d = 0; d < TREE_DEPTH; d++) {
  indices.push(i & 1);
  i >>= 1;
}

// Pad siblings to fixed depth (LeanIMT returns variable; circuit expects fixed)
while (siblings.length < TREE_DEPTH) {
  siblings.push(0n);   // zero hash for unused slots
}

// Now feed to the circuit
const inputs = {
  nullifier: note.nullifier,
  secret: note.secret,
  merkle_path: siblings.map(toFieldHex),
  merkle_indices: indices,
  merkle_root: toFieldHex(tree.root),
  nullifier_hash: toFieldHex(poseidon1([BigInt(note.nullifier)])),
};
```

**Padding**: LeanIMT only stores siblings for occupied positions. If your tree has 5 leaves at depth 20, the proof has 5 siblings + 15 implicit zero hashes. Your circuit expects all 20. Pad with zero or with the canonical "zero hash" your tree uses.

**Index ordering**: LeanIMT and most circuit conventions use LSB-first binary expansion of `leafIndex`. Test with a known case (insert 4 leaves; prove leaf 1; verify circuit accepts) before assuming.

## Note persistence

The user's note (`{ nullifier, secret, commitment, leafIndex, ... }`) is the only thing connecting them to their commitment. Lose it = funds/vote/whatever stuck forever (no on-chain way to recover, since the on-chain commitment doesn't reveal owner).

Save:
```ts
type PrivacyNote = {
  nullifier: string;        // 0x-prefixed Field-sized hex
  secret: string;
  commitment: string;
  chainId: number;
  contract: `0x${string}`;
  treeDepth: number;
  leafIndex?: number;       // assigned on insert
  insertedAt?: number;      // block timestamp
  insertedBlock?: number;   // for re-syncing the mirror
};
```

Where:
- IndexedDB (browser) — survives page reload, scoped to origin.
- File download (`.json`) — user's responsibility to keep safe.
- Encrypted backup to user's own storage (Drive, Dropbox) — best UX, requires encryption-key UX.

UX: prompt the user to download the note immediately after commit. Make it impossible to "skip" the download — privacy app teams have repeatedly shipped UX where users committed funds and then refreshed the page, losing the note.

## Reorgs and event re-mirror

If the chain reorgs:
- Some commitments may be undone.
- Tree mirror state from the orphaned chain is now wrong.

Mitigation:
- Use `safe` or `finalized` block tags when building the mirror, not `latest`. Trades a few minutes of lag for reorg safety.
- Or: track block hashes alongside `lastBlock`; on each catch-up, verify your last cached block's hash still exists on chain. If not, walk back.

```ts
async function catchUp(tree, lastBlock, lastBlockHash) {
  const block = await client.getBlock({ blockNumber: lastBlock });
  if (block.hash !== lastBlockHash) {
    // reorg detected; rebuild from earlier
    await rebuildFrom(safeBlockBefore(lastBlock));
    return;
  }
  // ... fetch new logs from lastBlock+1 to head
}
```

## Common pitfalls

- **Mirror desync detected at proof time** → caught too late. Verify root match on EVERY event ingestion.
- **Hash function mismatch (Poseidon vs Poseidon2)** → proofs always fail. Test one leaf hash and one parent hash across all three layers (circuit, contract, mirror) at project start, before building anything else.
- **Tree depth mismatch** → circuit at depth 20, contract at depth 16. The first 16-leaf insert works; leaf 17 breaks. Hardcode depth as a contract immutable AND a circuit `global`.
- **Note lost** → no recovery. Make backup UX impossible to skip.
- **Index ordering wrong (MSB vs LSB)** → proof reconstructs a different root. Test with a known leaf early.
- **Padding wrong (zero vs canonical zero hash)** → root mismatch when proving a leaf in an underfilled subtree.
- **Public input ordering different in circuit vs contract** → proof verifies a different statement; either always passes or always fails. See `references/prover-and-verifier-ops.md`.
- **Recent-roots window too small** → high contention causes failed txs. Make it 30 minutes' worth of inserts.
- **Reorg breaks mirror** → use `safe`/`finalized`, or track block hashes.
- **Contract emits root only at end** but client uses event in middle of batch → double-check that EVERY insert emits its post-insert root, not only the last.

## What to read next

- `SKILL.md` — full app architecture
- `references/circuit-patterns.md` — what the circuit needs as inputs
- `references/prover-and-verifier-ops.md` — proof generation + verifier deployment
- `indexing/references/event-design.md` — `eth_getLogs` mechanics
- LeanIMT spec: https://github.com/privacy-scaling-explorations/zk-kit
- poseidon-lite (matches PoseidonT3): https://github.com/vimwitch/poseidon-lite
