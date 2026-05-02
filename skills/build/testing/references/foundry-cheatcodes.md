# Foundry Cheatcodes Reference

The cheatcodes you actually use, what they do, and the gotchas. Verify against https://book.getfoundry.sh/cheatcodes/ — Foundry adds and renames cheatcodes regularly.

## Identity

```solidity
vm.prank(alice);              // next call only is from alice
vm.startPrank(alice);         // all subsequent calls are from alice
vm.stopPrank();
vm.prank(alice, alice);       // msg.sender = alice, tx.origin = alice (test top-level call)
```

`prank` only affects the next external call. If you `vm.prank(alice); vault.deposit(amount);` the deposit's internal calls all run with `alice` as `msg.sender` for the first hop, then revert to the test contract for nested calls. To prank inside the contract's internal hops, use `startPrank`.

## Funding

```solidity
vm.deal(alice, 100 ether);    // set ETH balance
deal(address(token), alice, 1000e18);   // set ERC-20 balance (forge-std helper)
deal(address(token), alice, 1000e18, true);  // also adjust totalSupply (more accurate)
```

`deal` (lowercase, from `StdCheats`) writes the storage slot directly — bypasses the token's transfer logic. Pass `adjust=true` to also update `totalSupply()`; without it, `sum(balances) != totalSupply()` and ERC-20 invariant tests fail.

For tokens with non-standard storage layouts (rebasing tokens, proxies), `deal` may fail silently. Verify with a balance check or use `vm.store` directly.

## Time and block

```solidity
vm.warp(block.timestamp + 1 days);     // skip forward
vm.roll(block.number + 100);            // advance N blocks
vm.fee(50 gwei);                        // set basefee
vm.chainId(1);                          // override chain id
vm.txGasPrice(20 gwei);                 // set tx.gasprice
```

`warp` does not advance block.number; `roll` does not advance timestamp. Some protocols (interest accruers, oracles) read both — advance both consistently.

## Storage

```solidity
vm.store(address(c), bytes32(uint256(0)), bytes32(uint256(123)));   // direct slot write
bytes32 v = vm.load(address(c), bytes32(uint256(0)));                // direct slot read
```

Use this to bypass access control during tests, or to test how a contract behaves under storage values that can't be reached through normal flow. Compute slots with `forge inspect ContractName storage-layout` to find slot numbers, or `keccak256` for mapping/array slots.

## Snapshots

```solidity
uint256 snap = vm.snapshotState();   // canonical name (Foundry 2025+)
// ... do stuff ...
vm.revertToState(snap);              // revert state to snapshot
```

The legacy aliases `vm.snapshot()` / `vm.revertTo()` still work but are deprecated — prefer `snapshotState()` / `revertToState()` in new tests.

After `revertToState`, the snapshot id is consumed; create a fresh one if you want to revert again. Useful for testing multiple scenarios from the same setup without re-running `setUp()`.

## Reverts

```solidity
vm.expectRevert();                                    // any revert
vm.expectRevert("specific message");                  // revert with string
vm.expectRevert(MyContract.MyError.selector);         // custom error (no args)
vm.expectRevert(abi.encodeWithSelector(
    MyContract.InsufficientBalance.selector,
    have, want
));                                                    // custom error with args
```

`expectRevert` applies to the **next external call only**. If the call doesn't revert, the test fails. If the call reverts with a different reason than expected, the test fails (when a specific reason is supplied).

For nested expectations:

```solidity
vm.expectRevert(abi.encodeWithSelector(
    OuterContract.OuterError.selector
));
outer.callInner();   // outer wraps inner's revert; expect the OUTER error
```

If you want to assert that an inner reverted but the outer caught it, use `try/catch` in the test instead.

## Events

```solidity
vm.expectEmit(true, true, false, true);   // (topic1, topic2, topic3, data)
emit Transfer(alice, bob, 100);            // expected event
token.transfer(bob, 100);                   // call that should emit
```

The four booleans are: check topic1, check topic2, check topic3, check non-indexed data. Set to `false` to wildcard-match on a topic.

`expectEmit(emitter)` overload pins which contract should emit:

```solidity
vm.expectEmit(true, true, false, true, address(token));
emit Transfer(alice, bob, 100);
```

Order matters — `expectEmit` checks the **next emit in declaration order**. If multiple events fire, declare each `expectEmit` immediately before its corresponding `emit`.

## Mocking calls

```solidity
vm.mockCall(
    address(oracle),
    abi.encodeWithSelector(IOracle.price.selector),
    abi.encode(uint256(2000e8))
);
// All calls to oracle.price() return 2000e8 until vm.clearMockedCalls()

vm.mockCallRevert(
    address(oracle),
    abi.encodeWithSelector(IOracle.price.selector),
    "ORACLE_DOWN"
);
// Make oracle.price() revert
```

Mocking is handy for unit tests but not a substitute for fork tests against real protocols. Use it for:

- Forcing rare error paths (oracle down, transfer failure).
- Speeding up tests that don't depend on the mocked behavior's correctness.
- Isolating a contract from a specific dependency for one test.

## Forks

```solidity
uint256 mainnetFork = vm.createFork("mainnet");          // create, don't switch
vm.selectFork(mainnetFork);                              // switch active fork
vm.rollFork(mainnetFork, 19_000_000);                    // pin block

uint256 baseFork = vm.createSelectFork("base", 12_000_000);  // create + select
```

`mainnet` and `base` here resolve to RPC URLs in `foundry.toml`'s `[rpc_endpoints]`. You can also pass a URL directly: `vm.createFork("https://...")`.

State is per-fork. Switching forks resets storage, balances, etc. To keep a contract's deployment alive across forks: `vm.makePersistent(address(contract))`.

## Address generation

```solidity
address alice = makeAddr("alice");                   // deterministic, name-keyed
(address bob, uint256 bobPk) = makeAddrAndKey("bob"); // also returns the private key
```

`makeAddrAndKey` is essential for testing signatures — you can sign with `vm.sign(bobPk, hash)`.

## Signatures

```solidity
bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
(uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, hash);
bytes memory signature = abi.encodePacked(r, s, v);

address recovered = ecrecover(hash, v, r, s);
```

`vm.sign` accepts a private key as `uint256`. For EIP-712 typed data, build the digest manually:

```solidity
bytes32 domainSeparator = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes("MyApp")), keccak256(bytes("1")), block.chainid, address(target)
));
bytes32 structHash = keccak256(abi.encode(TYPEHASH, ...));
bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
(uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
```

## Environment

```solidity
string memory rpc = vm.envString("MAINNET_RPC_URL");
uint256 deployerPk = vm.envUint("DEPLOYER_PK");
address deployer = vm.addr(deployerPk);
```

Use `vm.envOr` to provide defaults: `vm.envOr("THRESHOLD", uint256(100));`.

## File I/O (scripts and test fixtures)

```solidity
string memory json = vm.readFile("./fixtures/state.json");
bytes memory bytecode = vm.readFileBinary("./out/Vault.sol/Vault.json");
vm.writeFile("./out/result.txt", "deployed");
```

File I/O requires `fs_permissions` in `foundry.toml`:

```toml
[profile.default]
fs_permissions = [{ access = "read", path = "./fixtures" }, { access = "write", path = "./out" }]
```

## Recording calls and emits

```solidity
vm.recordLogs();
vault.deposit(100, alice);
Vm.Log[] memory entries = vm.getRecordedLogs();
// entries[i].topics, entries[i].data
```

Use this when you need to assert on emitted events more flexibly than `expectEmit` allows (e.g. multiple events, partial matches, count).

```solidity
vm.startStateDiffRecording();
vault.deposit(100, alice);
Vm.AccountAccess[] memory diff = vm.stopAndReturnStateDiff();
// inspect storage changes
```

## Gas metering

```solidity
vm.pauseGasMetering();
// expensive setup that shouldn't count
vm.resumeGasMetering();
uint256 g0 = gasleft();
target.someFunction();
uint256 used = g0 - gasleft();
```

Lets you exclude setup costs from a `console2.log` gas measurement.

## Common pitfalls

- **`prank` only covers one call**: nested calls revert to the test contract as `msg.sender`. Use `startPrank` for multi-step flows, but remember to `stopPrank`.
- **`deal` without `adjust=true`** breaks `sum(balances) == totalSupply()` — invariant tests catch this immediately.
- **`warp` without `roll`**: timestamp moves but block number doesn't, breaking protocols that gate by block number.
- **`expectRevert` followed by a non-reverting call**: the test fails with "expected revert, got success." Common when `expectRevert` is left over from a previous edit.
- **`expectEmit` ordering**: must immediately precede the matching `emit`. Putting other code between them desyncs the expectation.
- **`mockCall` lingers across tests**: `setUp` resets state, but mocks are per-test. Use `vm.clearMockedCalls()` if you accumulate them inside a single test.
- **Fork tests slow CI**: each `vm.createSelectFork` does an RPC roundtrip. Cache aggressively — set `RUST_LOG=foundry_compilers=warn forge test` to keep noise down; pin `--fork-block-number` for deterministic + cacheable runs.
- **`makePersistent` is not transitive**: persisting contract A doesn't persist its state in storage that points to B. Persist all addresses your test relies on.

## What to read next

- `references/fuzz-and-invariants.md` — fuzzing patterns, handler design, ghost variables
- `references/fork-testing.md` — workflows that test against live protocols
- `references/security-test-cases.md` — invariant test patterns that catch real bugs
- Foundry book: https://book.getfoundry.sh/cheatcodes/
