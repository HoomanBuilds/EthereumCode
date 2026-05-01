# Randomness Onchain — Cookbook

Smart contracts are deterministic. Every node executing a transaction must produce the same result, or the chain forks. Determinism is incompatible with naive randomness. This file is the cookbook for getting unbiased random numbers in a deterministic environment.

Read it before designing lotteries, NFT reveals, randomized games, fair drops, MEV-resistant orderings, or anything where an adversary can extract value by predicting an outcome.

## What Does Not Work

```solidity
// All four of these are exploitable.

// 1. Block timestamp — validators manipulate within ~12s drift.
uint256 r = uint256(keccak256(abi.encodePacked(block.timestamp)));

// 2. blockhash(block.number) — always returns 0 for the current block.
uint256 r = uint256(blockhash(block.number));

// 3. blockhash(block.number - 1) — proposer of block N-1 can choose to
//    not propose if the result is unfavorable, biasing the distribution.
uint256 r = uint256(blockhash(block.number - 1));

// 4. block.prevrandao (post-Merge replacement for difficulty) —
//    publicly known one block in advance, validator can withhold.
uint256 r = uint256(block.prevrandao);
```

The unifying flaw: any value the validator/proposer can see and react to before committing the block can be biased. The proposer picks which transactions land in the block, in what order, and whether to publish the block at all. If the random source is in their reaction window, they can manipulate it.

## What Works

Two viable patterns.

| Pattern | Trust assumption | Cost | Latency |
|---|---|---|---|
| Commit-reveal | User cannot predict future blockhash; validator cannot read user's secret | One extra transaction per user | 1+ block between commit and reveal |
| Chainlink VRF | Chainlink oracle network is honest in aggregate; cryptographic proof verifies output | LINK fee per request (varies by chain) | 1–4 minutes typical, depends on network |

Use commit-reveal when the user is the entity whose action is being randomized (a user reveals a hidden bid, opens a pack they bought). Use VRF when the protocol needs randomness independent of any single user (lottery winner selection, NFT reveal across a whole collection, leader election).

## Pattern 1 — Commit-Reveal

The user picks a secret, hashes it, and commits the hash. Later, after a future block is mined, they reveal the secret. The randomness is `keccak256(secret, blockhash(commitBlock + N))` — the user did not know the future blockhash at commit time, and the validator did not know the secret at reveal time.

```solidity
// Illustrative — verify against canonical implementations and adapt to your threat model.
contract CommitRevealLottery {
    struct Entry {
        bytes32 commitment;
        uint64 commitBlock;
        bool revealed;
    }
    mapping(address => Entry) public entries;

    uint256 constant MIN_REVEAL_DELAY = 1;        // blocks
    uint256 constant MAX_REVEAL_WINDOW = 256;      // blockhash horizon

    error AlreadyCommitted();
    error TooEarly();
    error TooLate();
    error BadReveal();

    /// User commits hash(secret, address) — including msg.sender prevents
    /// front-running of the reveal.
    function commit(bytes32 commitment) external {
        if (entries[msg.sender].commitment != bytes32(0)) revert AlreadyCommitted();
        entries[msg.sender] = Entry(commitment, uint64(block.number), false);
    }

    function reveal(bytes32 secret) external returns (uint256 random) {
        Entry storage e = entries[msg.sender];
        uint256 elapsed = block.number - e.commitBlock;
        if (elapsed < MIN_REVEAL_DELAY) revert TooEarly();
        if (elapsed > MAX_REVEAL_WINDOW) revert TooLate();

        bytes32 expected = keccak256(abi.encode(secret, msg.sender));
        if (e.commitment != expected) revert BadReveal();

        bytes32 bh = blockhash(e.commitBlock + MIN_REVEAL_DELAY);
        random = uint256(keccak256(abi.encode(secret, bh)));
        e.revealed = true;
        // ... apply random outcome ...
    }
}
```

### The 256-block horizon

`blockhash(n)` returns 0 for any block more than 256 blocks in the past (about 51 minutes on mainnet at 12s blocks). If the user does not reveal within that window, the randomness source is gone. Decide on the failure mode:

- **Forfeit.** User loses their entry. Discourages "wait and see" strategies.
- **Refund.** User gets their stake back; entry void.
- **Default outcome.** Treat unrevealed as a specific outcome (e.g. losing).

Forfeit is most common because it preserves the protocol's bookkeeping. Make it explicit in code, not implicit:

```solidity
function forfeit(address user) external {
    Entry storage e = entries[user];
    if (block.number - e.commitBlock <= MAX_REVEAL_WINDOW) revert();
    delete entries[user];
    // burn or redirect their stake
}
```

### What commit-reveal does not protect against

- **User chooses not to reveal** when the result is unfavorable. They forfeit, but the protocol may need to re-randomize without them. Build in the fallback.
- **Validator censors the reveal tx.** The user could include a reveal in a private mempool (Flashbots Protect) to avoid this.
- **MEV builders see the reveal in the public mempool** and front-run with their own action that depends on the same randomness. If your contract has multiple users keyed to the same blockhash, ordering matters; consider per-user blockhashes.

### Including the address in the commitment

```solidity
keccak256(abi.encode(secret, msg.sender))
```

Why? Without `msg.sender`, an attacker can copy the commitment and front-run the reveal with their own transaction, stealing the outcome. Bind the commitment to its owner.

### Multi-user randomness

If many users reveal in the same block, they all see the same blockhash. That is fine if the outcomes are independent (each user opens their own pack). It is broken if outcomes interact (one lottery winner among many revealers in the same block).

For interacting outcomes, use commit-reveal with a separate "draw" step that anyone can call once after a deadline:

```solidity
// Two-phase: many users commit; after deadline, anyone calls draw().
function draw() external {
    require(block.number > drawBlock, "too early");
    bytes32 bh = blockhash(drawBlock);
    require(bh != 0, "blockhash expired");
    winner = entries[uint256(keccak256(abi.encode(bh))) % entries.length];
}
```

Now the validator who proposed `drawBlock` knew the outcome before publishing — they could withhold. For high-value lotteries, prefer VRF.

## Pattern 2 — Chainlink VRF

VRF (Verifiable Random Function) is randomness produced by an oracle node, accompanied by a cryptographic proof that anyone can verify onchain. The oracle cannot bias the result — it can refuse to answer, but it cannot answer differently for different parties.

Two variants exist in production: a subscription model where you fund a single account, and a direct-funding model where each request pays at call time. Verify the latest version, supported chains, and coordinator addresses against https://docs.chain.link/vrf — VRF has gone through v1, v2, v2.5, and the API is version-sensitive.

```solidity
// Illustrative VRF v2.5 sketch — verify against the latest Chainlink docs.
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract VRFLottery is VRFConsumerBaseV2Plus {
    uint256 public subscriptionId;
    bytes32 public keyHash;       // gas-lane key hash, network-specific
    uint32 public callbackGasLimit = 100_000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;

    mapping(uint256 => address) public requestToUser;

    constructor(address coordinator, uint256 subId, bytes32 _keyHash)
        VRFConsumerBaseV2Plus(coordinator)
    {
        subscriptionId = subId;
        keyHash = _keyHash;
    }

    function requestRandomness() external returns (uint256 requestId) {
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
        requestToUser[requestId] = msg.sender;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords)
        internal
        override
    {
        address user = requestToUser[requestId];
        uint256 r = randomWords[0];
        // ... use r to determine outcome for `user` ...
    }
}
```

Things to get right:

- **`callbackGasLimit`.** Your `fulfillRandomWords` runs with this limit. Tight; do minimal work. Do not loop unbounded.
- **`requestConfirmations`.** Higher is safer against re-orgs; lower is faster. Defaults vary by chain (mainnet typically 3).
- **`keyHash`.** Selects the gas lane (price tier). Network-specific values; verify in Chainlink's docs.
- **Subscription funding.** If LINK runs out, requests stall. Monitor and top up. Fund early.
- **Pull pattern in fulfill.** Do not transfer tokens directly in `fulfillRandomWords` — store the result, let the user claim. Reverts in fulfill can break the request.

### Verifying you got VRF right

- Request id is unique and stored before the external call.
- Fulfill runs minimal logic; main effect is recording the result.
- A separate `claim()` function reads the stored result.
- A timeout exists: if fulfillment never arrives, users can recover stake.

## Pattern 3 — RANDAO with delay

Post-Merge Ethereum exposes `block.prevrandao` (the RANDAO output of the previous block). It is publicly known one block before it is used. A proposer can withhold a block to bias the result.

It is acceptable for low-value randomness where the proposer's withholding cost (lost block reward, currently a few hundred dollars on mainnet — verify current MEV reward levels) exceeds the upside of biasing. It is unacceptable for high-value selections.

If you use it, mix it with future blockhash to add cost:

```solidity
// Low-stakes only. Validator can still bias but at increasing cost.
function lowStakesRandom(uint256 commitBlock) external view returns (uint256) {
    require(block.number > commitBlock + 1, "too early");
    require(block.number <= commitBlock + 256, "too late");
    return uint256(keccak256(abi.encode(blockhash(commitBlock + 1), block.prevrandao)));
}
```

Do not use this for anything where a single biased outcome is worth more than the validator's lost block reward.

## Pattern 4 — DRAND / Threshold Randomness Beacons

Drand is a distributed randomness beacon producing one unbiased value every 30 seconds (or 3s for the Quicknet network), backed by threshold BLS signatures across many independent operators. There are bridges that post drand outputs onchain on some networks. This is appropriate when:

- You need fresh randomness frequently.
- You can tolerate a 30s/3s tick rate.
- You are on a chain where a drand bridge is operational.

Verify availability and integration on your target chain at https://drand.love. Drand is the underlying technology in some VRF designs and several ZK-based randomness services.

## Decision Matrix

| Scenario | Use |
|---|---|
| User opens a loot box they paid for | Commit-reveal (user picks secret) |
| Lottery with 10,000 entries | Chainlink VRF |
| Pseudo-random shuffling of low-value NFTs | RANDAO with future-block delay |
| MEV-resistant settlement order | Threshold randomness or commit-reveal across all participants |
| Per-tick random reward in an idle game | RANDAO if rewards are small; VRF if large |
| Cross-chain randomness | VRF on the target chain (do not trust messages alone) |

## Common Mistakes

| Mistake | Why it breaks |
|---|---|
| Using `keccak256(block.timestamp, block.difficulty)` as random | Both are validator-controlled |
| Reading `blockhash(block.number)` | Always 0 for the current block |
| No deadline on reveal | Past 256 blocks, blockhash returns 0; outcome bricked |
| Calling `requestRandomWords` and acting in same tx | VRF response comes in a future tx; sync logic does not work |
| Doing heavy work in `fulfillRandomWords` | Hits callback gas limit, reverts, request lost |
| Trusting one validator's RANDAO for high-value lottery | Validator withholds block to bias |
| Allowing same commitment from two users | Front-running attack on the reveal |

## Testing Randomness

You cannot test "is this truly random." You can test:

- The fulfillment path runs and uses the correct request id.
- Two distinct random inputs produce distinct outcomes.
- Edge cases: zero, max uint, modulo bias when range is not power-of-two.
- Reverts on premature reveal, expired reveal, wrong secret.

For Chainlink VRF, use their `VRFCoordinatorV2_5Mock` (or current version) in Foundry to simulate fulfillment. Verify against https://docs.chain.link/vrf for the latest mock API.

```solidity
// Foundry test sketch.
function test_fulfill() public {
    uint256 reqId = lottery.requestRandomness();
    uint256[] memory words = new uint256[](1);
    words[0] = 42;
    coordinator.fulfillRandomWordsWithOverride(reqId, address(lottery), words);
    assertEq(lottery.lastRandom(), 42);
}
```

## Modulo Bias

A subtle bug: `random % N` is biased when `N` does not divide `2^256`. For small `N` this is negligible. For large `N` (close to `2^256`), the early values appear slightly more often. Use rejection sampling or accept the bias if your `N` is small (under 2^32, the skew is bounded by 1 in 2^224 — irrelevant in practice).

```solidity
// Acceptable for small ranges.
uint256 winner = random % participants.length;

// Rejection sampling for large ranges where bias matters.
function unbiased(uint256 r, uint256 n) internal pure returns (uint256) {
    uint256 limit = type(uint256).max - (type(uint256).max % n);
    while (r >= limit) {
        r = uint256(keccak256(abi.encode(r)));
    }
    return r % n;
}
```

## Further Reading

- Chainlink VRF docs: https://docs.chain.link/vrf
- Drand: https://drand.love
- "Randomness in EVM smart contracts" (Trail of Bits): https://blog.trailofbits.com
- EIP-4399 (RANDAO opcode rationale): https://eips.ethereum.org/EIPS/eip-4399

Verify all addresses, key hashes, parameter values, and library APIs against the canonical project documentation. The snippets here are illustrative and version-sensitive.
