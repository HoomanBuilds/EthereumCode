# Noir Circuit Patterns Beyond Commitment-Nullifier

Most ZK app tutorials are commitment-nullifier (Tornado/Semaphore-shaped). That's *one* pattern. This file is the rest of the menu: range proofs, set membership, signatures, hash preimages, sealed bids, threshold proofs — what each looks like in Noir, when to pick it, and the constraint costs.

For the commitment-nullifier pattern, see `SKILL.md`. For toolchain mechanics, see `references/prover-and-verifier-ops.md`. For tree state, see `references/tree-state-and-events.md`.

## Choosing a circuit pattern

```
What needs to stay private?
  ├─ "I'm part of a known set" (membership)         → Merkle inclusion
  ├─ "I have a value in a range" (age, balance)     → Range proof
  ├─ "I know the preimage of this hash"             → Hash preimage
  ├─ "I signed this message"                        → ECDSA-in-circuit
  ├─ "My value beats the threshold but not its size" → Range + comparison
  ├─ "Multiple participants act anonymously"        → Commitment-nullifier
  └─ "Off-chain compute is correct"                 → Verifiable computation
```

## 1. Range proofs

Prove `min <= x <= max` without revealing x. Common uses: age verification (≥18), balance threshold (≥1 ETH), price-band auctions.

```noir
fn main(
    age: Field,                  // private
    min_age: pub Field,          // public (e.g., 18)
) {
    // Field is too large; constrain to a bounded type
    let age_u32 = age as u32;
    assert(age_u32 >= min_age as u32);
    assert(age_u32 <= 150);       // sanity bound
}
```

**Constraint cost**: `<` and `>=` on `u32` are cheap (a few hundred constraints). `Field` comparison requires bit decomposition — expensive. Cast to the smallest sufficient type.

**Pitfall**: Field is the prime field of BN254 (~254 bits). Naively comparing two Field values doesn't work like integer comparison. Use `u32`/`u64`/`u128` for ordered comparisons.

## 2. Set membership without anonymity set

Prove `x ∈ {known list}` where the list is small and hardcoded:

```noir
global ALLOWED: [Field; 4] = [0xa1, 0xb2, 0xc3, 0xd4];

fn main(value: Field, claimed_index: Field) {
    let idx = claimed_index as u32;
    assert(idx < 4);
    assert(value == ALLOWED[idx]);
}
```

For larger sets, use a Merkle tree (the commitment-nullifier pattern's substrate, but without the nullifier).

## 3. Hash preimage

Prove "I know `x` such that `hash(x) == public_hash`":

```noir
use poseidon::poseidon::bn254::hash_1;

fn main(
    preimage: Field,             // private
    public_hash: pub Field,
) {
    assert(hash_1([preimage]) == public_hash);
}
```

Use cases: sealed bids (commit `hash(bid, salt)` first, reveal later); claim codes (publish hashes, redeem with preimage); password-style proof.

**Salting**: small-domain inputs are brute-forceable. If `preimage` is "vote = 0 or 1", a verifier just hashes both and compares. Always add a high-entropy salt:

```noir
fn main(vote: Field, salt: Field, public_hash: pub Field) {
    assert(hash_2([vote, salt]) == public_hash);
}
```

## 4. ECDSA signature verification

Prove "I have a signature from address X over message M" without revealing the signature:

```noir
use std::ecdsa_secp256k1::verify_signature;

fn main(
    pub_key_x: [u8; 32],
    pub_key_y: [u8; 32],
    signature: [u8; 64],
    message_hash: [u8; 32],
    public_address: pub [u8; 20],
) {
    let valid = verify_signature(pub_key_x, pub_key_y, signature, message_hash);
    assert(valid);
    // Then prove pub_key derives to public_address (keccak + last 20 bytes)
    // ...
}
```

**Cost**: secp256k1 verification in-circuit is heavy (~50K–150K constraints depending on backend). The proof generation takes 5–30s. For high-throughput apps, prefer EdDSA (~2K constraints) when you control key generation.

```noir
use std::eddsa::eddsa_poseidon_verify;

fn main(
    pub_key_x: Field,
    pub_key_y: Field,
    signature_s: Field,
    signature_r8_x: Field,
    signature_r8_y: Field,
    message: Field,
) {
    let valid = eddsa_poseidon_verify(pub_key_x, pub_key_y, signature_s, signature_r8_x, signature_r8_y, message);
    assert(valid);
}
```

## 5. Threshold proofs

Prove "my value exceeds N" without revealing the value or N:

```noir
fn main(
    balance: Field,              // private
    threshold: pub Field,        // public threshold
) {
    let bal = balance as u128;
    let thr = threshold as u128;
    assert(bal >= thr);
}
```

Combined with a signature, this is "I own an account with balance >= threshold without revealing which account or balance" (proof-of-solvency, gated access).

## 6. Range membership in a Merkle tree (one-shot, no nullifier)

When you need anonymous group membership but no double-spend protection:

```noir
use binary_merkle_root::binary_merkle_root;
use poseidon::poseidon::bn254::hash_2;

global TREE_DEPTH: u32 = 16;

fn main(
    leaf: Field,
    indices: [u1; TREE_DEPTH],
    siblings: [Field; TREE_DEPTH],
    root: pub Field,
) {
    let computed = binary_merkle_root(hash_2, leaf, TREE_DEPTH, indices, siblings);
    assert(computed == root);
}
```

This is the "I'm in the set, don't ask which one" primitive without a nullifier. Use for one-time anonymous reads (private allowlist check, anonymous credential verification). Add a nullifier when actions consume state.

## 7. Sealed-bid auction reveal

Two-phase: commit phase publishes `hash(bid, salt)`; reveal phase proves `bid` is within range AND matches the commitment:

```noir
use poseidon::poseidon::bn254::hash_2;

fn main(
    bid: Field,
    salt: Field,
    commitment: pub Field,
    min_bid: pub Field,
    max_bid: pub Field,
    public_bid: pub Field,        // the revealed bid (same as bid)
) {
    assert(hash_2([bid, salt]) == commitment);
    assert(bid == public_bid);
    let b = bid as u128;
    assert(b >= min_bid as u128);
    assert(b <= max_bid as u128);
}
```

Why this beats "just reveal the bid": the on-chain auction can be auctioneer-blind (the auctioneer never sees losing bids), and the contract can run reveal logic against the proof without trusting the bidder.

## 8. Verifiable off-chain compute

Run heavy computation off-chain, prove it correct on-chain:

```noir
fn main(
    inputs: [Field; 100],
    output: pub Field,
) {
    let mut sum = 0;
    for i in 0..100 {
        sum += inputs[i] * inputs[i];
    }
    assert(sum == output);
}
```

The circuit attests that `output = sum of squares of 100 inputs`. The contract verifies this without re-running the loop. ZK rollups are this pattern at scale.

## 9. Set non-membership

Prove `x ∉ S`. Common technique: sorted set + range gap.

Sort the set; for each adjacent pair `(s_i, s_{i+1})`, prove `s_i < x < s_{i+1}` using a Merkle proof of the pair plus range checks. Used in some KYC/sanctions-list flows ("I'm NOT on this blocklist").

## Common circuit anti-patterns

### Unconstrained witness

```noir
fn main(secret: Field, hash: pub Field) {
    let derived = some_hash(secret);
    // BUG: no assert! `derived` is computed but doesn't constrain anything
}
```

The compiler may warn, but if the circuit has no constraint linking `secret` to `hash`, the proof is meaningless. Always end branches with an `assert`.

### Conditional constraints based on private input

```noir
fn main(flag: Field, x: Field, y: Field, out: pub Field) {
    if flag == 1 {
        assert(x + y == out);
    }
    // If flag != 1, no constraint — prover can fabricate any out!
}
```

In ZK, "if the private input is 0, no constraint" means the prover can lie about that branch. Constraints must hold for all valid witnesses. Solution: gate with multiplication.

```noir
fn main(flag: Field, x: Field, y: Field, out: pub Field) {
    let f = flag as u1;          // constrain to 0 or 1
    let result = if f == 1 { x + y } else { x };
    assert(result == out);
}
```

### Field arithmetic vs integer arithmetic

```noir
let a: Field = 5;
let b: Field = 3;
let c = a - b;   // c is Field, not "2 in u32"
```

`Field` arithmetic wraps modulo the BN254 prime. Underflow doesn't revert; it wraps to a huge value. Cast to bounded types before comparing.

### Using `as` cast as a constraint

```noir
let x_u32 = x as u32;            // does NOT assert x fits in 32 bits!
assert(x_u32 < 1000);
```

`as u32` truncates; it does NOT prove the original fit in 32 bits. To assert range, use explicit bit decomposition or compose constrained types.

### Magic numbers in public inputs

Public inputs are visible. Embedding a "secret threshold" as a public input leaks it. Either keep it private or accept that it's public.

## Constraint cost rough table (BN254, UltraHonk)

| Operation | Constraints |
|---|---|
| Field add/mul/sub | ~1 |
| `==` on Field | ~1 |
| Poseidon hash_2 | ~600 |
| Poseidon hash_4 | ~1200 |
| SHA256 (fixed input) | ~30,000 |
| Keccak256 (fixed input) | ~150,000 (uses lookups, faster than circuit) |
| Merkle proof depth 20 (Poseidon) | ~12,000 |
| ECDSA secp256k1 verify | ~80,000 |
| EdDSA Poseidon verify | ~2,000 |
| `< / >=` on u32 | ~50 |
| `< / >=` on Field (bit decomposition) | ~256 |

Constraint count drives proof time and verifier gas. Aim for under 100K constraints for browser-side proving.

## Choosing tree depth

| Depth | Capacity | Anonymity set | Notes |
|---|---|---|---|
| 8 | 256 | weak | toy / demo only |
| 12 | 4,096 | minimal | small allowlists |
| 16 | 65,536 | reasonable | most apps |
| 20 | 1,048,576 | strong | DeFi-scale; Tornado used 20 |
| 24 | 16,777,216 | overkill | only if you genuinely need it |

Larger trees = more constraints in the membership proof = slower proving. Pick the smallest depth that holds your expected user base for ~2 years.

## What to read next

- `SKILL.md` — commitment-nullifier as the canonical app shape
- `references/prover-and-verifier-ops.md` — toolchain mechanics
- `references/tree-state-and-events.md` — making the tree work onchain + offchain
- Noir docs: https://noir-lang.org/docs/
- zk-kit.noir: https://github.com/privacy-scaling-explorations/zk-kit.noir
