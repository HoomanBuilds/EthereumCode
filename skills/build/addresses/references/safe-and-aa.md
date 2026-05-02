# Safe and Account Abstraction Cookbook

Working snippets for Safe (1.4.1) deployment + transaction execution, ERC-4337 EntryPoint v0.7 UserOp construction, and EIP-7702 delegations (Pectra). Verify addresses against `SKILL.md` and the protocol docs.

## Safe (Gnosis Safe)

### Addresses

| Contract | Mainnet & most chains |
|---|---|
| Singleton 1.4.1 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| ProxyFactory 1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| MultiSend 1.4.1 | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` |
| MultiSendCallOnly 1.4.1 | `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` |
| CompatibilityFallbackHandler | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` |
| SignMessageLib | `0xd53cd0aB83D845Ac265BE939c57F53AD838012c9` |

Same addresses on all chains via CREATE2 (Arachnid deployer). Verify per chain at https://github.com/safe-global/safe-deployments — some chains pin to 1.3.0.

### Deploy a new Safe (CREATE2)

```solidity
import {ISafeProxyFactory} from "@safe-global/safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {ISafe}             from "@safe-global/safe-contracts/contracts/Safe.sol";

ISafeProxyFactory constant FACTORY = ISafeProxyFactory(0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67);
address           constant SINGLETON = 0x41675C099F32341bf84BFc5382aF534df5C7461a;
address           constant FALLBACK  = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;

function deploySafe(address[] memory owners, uint256 threshold, uint256 saltNonce) external returns (address safe) {
    bytes memory initializer = abi.encodeCall(ISafe.setup, (
        owners,
        threshold,
        address(0),       // to (delegatecall during setup)
        bytes(""),        // data
        FALLBACK,
        address(0),       // paymentToken
        0,                // payment
        payable(address(0))   // paymentReceiver
    ));
    safe = address(FACTORY.createProxyWithNonce(SINGLETON, initializer, saltNonce));
}
```

The salted address is `keccak256(initializer) + saltNonce` mixed in — same `(initializer, saltNonce)` pair maps to the same address on every chain.

### Execute a transaction (off-chain signing, on-chain exec)

The owners sign a typed-data hash off-chain; anyone can submit `execTransaction` with the concatenated signatures.

```solidity
import {ISafe} from "@safe-global/safe-contracts/contracts/Safe.sol";

ISafe(safe).execTransaction(
    to,
    value,
    data,
    /*operation*/ ISafe.Operation.Call,   // 0 = Call, 1 = DelegateCall
    /*safeTxGas*/ 0,
    /*baseGas*/   0,
    /*gasPrice*/  0,
    /*gasToken*/  address(0),
    /*refundReceiver*/ payable(address(0)),
    signatures   // sorted by signer address, ascending
);
```

The EIP-712 typed-data hash for a Safe tx:

```ts
import { hashTypedData } from "viem";

const domain = { chainId, verifyingContract: safe } as const;
const types = {
  SafeTx: [
    { name: "to",             type: "address" },
    { name: "value",          type: "uint256" },
    { name: "data",           type: "bytes"   },
    { name: "operation",      type: "uint8"   },
    { name: "safeTxGas",      type: "uint256" },
    { name: "baseGas",        type: "uint256" },
    { name: "gasPrice",       type: "uint256" },
    { name: "gasToken",       type: "address" },
    { name: "refundReceiver", type: "address" },
    { name: "nonce",          type: "uint256" },
  ],
} as const;

const message = { to, value, data, operation: 0, safeTxGas: 0n, baseGas: 0n,
                  gasPrice: 0n, gasToken: zeroAddress, refundReceiver: zeroAddress,
                  nonce: await readNonce() };
const txHash = hashTypedData({ domain, types, primaryType: "SafeTx", message });
// each owner signs txHash with personal_sign or signTypedData_v4
```

Concatenate signatures sorted by signer address ascending. Each is 65 bytes: `r (32) | s (32) | v (1)`.

For contract-owner signatures (smart-contract owners), set `v = 0` and append the contract's EIP-1271 signature data; Safe handles the lookup.

### Batch transactions via MultiSend

```solidity
import {MultiSendCallOnly} from "@safe-global/safe-contracts/contracts/libraries/MultiSendCallOnly.sol";

// Encode each call: operation(1) | to(20) | value(32) | dataLen(32) | data(dataLen)
bytes memory packed = abi.encodePacked(
    uint8(0), to1, uint256(0), uint256(data1.length), data1,
    uint8(0), to2, uint256(0), uint256(data2.length), data2
);

bytes memory call = abi.encodeCall(MultiSendCallOnly.multiSend, (packed));
// Submit as a single Safe tx with operation=DelegateCall to the MultiSendCallOnly address
ISafe(safe).execTransaction(
    0x9641d764fc13c8B624c04430C7356C1C7C8102e2, // MultiSendCallOnly
    0, call, ISafe.Operation.DelegateCall, 0,0,0,
    address(0), payable(address(0)), signatures
);
```

`MultiSendCallOnly` blocks `delegatecall` inner ops — strictly safer; use it unless you know you need the legacy `MultiSend` (which allows nested `delegatecall`).

### Modules and guards

- **Modules** can call `execTransactionFromModule` without owner signatures — use for session keys / automated trading. Add via `enableModule(addr)` (an owner-signed tx).
- **Guards** run `checkTransaction` before each exec and `checkAfterExecution` after — used for spend limits, allowlists, MEV protection. Set via `setGuard(addr)`.

Important: modules can drain the Safe. Audit any module before installing.

## ERC-4337 — Account Abstraction (EntryPoint v0.7)

EntryPoint v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (CREATE2, all chains).

A `UserOperation` is signed by the smart-account owner key (any signing scheme — secp256k1, passkey, Yubikey via the account's `validateUserOp`), then submitted to a `Bundler` which packs many UserOps into one EntryPoint call.

### PackedUserOperation (v0.7)

v0.7 changed the struct to pack gas fields and add a `paymasterAndData` split:

```solidity
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes   initCode;            // factory + factoryData (concatenated) for first deploy; empty after
    bytes   callData;            // what the account should execute
    bytes32 accountGasLimits;    // packed: verificationGasLimit (16) | callGasLimit (16)
    uint256 preVerificationGas;
    bytes32 gasFees;             // packed: maxPriorityFeePerGas (16) | maxFeePerGas (16)
    bytes   paymasterAndData;    // address(20) | verificationGasLimit(16) | postOpGasLimit(16) | data
    bytes   signature;
}
```

### Build and send (viem v2)

viem ships an account-abstraction module:

```ts
import { createBundlerClient, toSafeSmartAccount } from "viem/account-abstraction";
import { entryPoint07Address } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";

const owner = privateKeyToAccount(`0x${process.env.PK}`);

const account = await toSafeSmartAccount({
  client: publicClient,
  owners: [owner],
  version: "1.4.1",
  entryPoint: { address: entryPoint07Address, version: "0.7" },
});

const bundler = createBundlerClient({
  client: publicClient,
  transport: http(process.env.BUNDLER_URL),  // e.g. Pimlico, Stackup, Alchemy AA
});

const hash = await bundler.sendUserOperation({
  account,
  calls: [{ to: vault, data: depositCalldata, value: 0n }],
});
const receipt = await bundler.waitForUserOperationReceipt({ hash });
```

`toSafeSmartAccount` is a Safe variant; `toSimpleSmartAccount` and `toCoinbaseSmartAccount` (passkey) are the other built-ins. Verify exports at https://viem.sh/account-abstraction.

### Paymasters (sponsored + ERC-20 gas)

Paymasters pay gas on behalf of the user (sponsored) or accept ERC-20 (USDC) and reimburse the bundler in ETH:

```ts
import { createPaymasterClient } from "viem/account-abstraction";

const paymaster = createPaymasterClient({ transport: http(process.env.PAYMASTER_URL) });

const hash = await bundler.sendUserOperation({
  account,
  calls: [...],
  paymaster,                      // bundler queries paymaster for sponsorship
  paymasterContext: { token: USDC }, // some paymasters accept ERC-20 selection
});
```

The paymaster's RPC implements `pm_getPaymasterStubData` and `pm_getPaymasterData`; the bundler stitches the result into `paymasterAndData`.

### Bundler choice

| Provider | URL pattern |
|---|---|
| Pimlico | `https://api.pimlico.io/v2/<chainId>/rpc?apikey=...` |
| Stackup | `https://api.stackup.sh/v1/node/...` |
| Alchemy AA | `https://api.g.alchemy.com/v2/<key>` (their EIP-7677 paymaster + bundler) |
| Coinbase Bundler | dev-platform.coinbase.com — usable with their Smart Wallet |
| ZeroDev | `https://rpc.zerodev.app/api/v3/<key>` |

Each runs the standard `eth_sendUserOperation` / `eth_estimateUserOperationGas` / `eth_getUserOperationReceipt` namespace; verify EIP-7677 paymaster support if you need ERC-20 gas.

## EIP-7702 — temporary code on EOA (Pectra)

7702 lets an EOA delegate to contract code for the duration of a transaction (or persistently until re-delegated to `address(0)`). Live since the Pectra hard fork (May 7, 2025).

```ts
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(`0x${process.env.PK}`);

const auth = await account.signAuthorization({
  contractAddress: BATCH_EXECUTOR,   // code to delegate to
  chainId: 8453,                     // 0 = any chain
  nonce: await publicClient.getTransactionCount({ address: account.address }),
});

await walletClient.sendTransaction({
  type: "eip7702",
  authorizationList: [auth],
  to: account.address,               // self-call after delegation
  data: encodeFunctionData({ abi, functionName: "executeBatch", args: [calls] }),
});
```

After this transaction, the EOA's `code` field contains a 23-byte delegation designator (`0xef0100 || contractAddress`). Future calls to the EOA execute the delegated code's logic but with the EOA's storage.

**Use cases**:
- Batched transactions from a regular wallet (one tx, multiple calls).
- Session keys / scoped permissions on existing EOAs without migrating to a smart account.
- Sponsored gas for EOAs.

**Risks**:
- A malicious delegation can drain the EOA. Wallets should hard-warn before signing.
- Delegated code runs in the EOA's storage; storage layout collisions across delegate swaps are footguns.

To revoke: sign an authorization with `contractAddress = address(0)` and submit; the EOA goes back to no-code.

Verify viem's 7702 status and the chain's hard-fork timing at https://viem.sh/eip7702.

## Common pitfalls

- **Safe owner ordering**: `execTransaction` requires signatures sorted by signer address ascending. Wrong order = invalid signatures.
- **Safe `delegatecall` operation = 1**: easy to typo as 0; `delegatecall` runs the target code in the Safe's context — wrong target can rewrite Safe storage. Lock down what you delegatecall to.
- **Safe nonce**: `nonce()` is incremented per executed tx, not per signed message. Replays of an old signature with the same nonce fail.
- **MultiSend vs MultiSendCallOnly**: prefer `MultiSendCallOnly` — `MultiSend` permits nested `delegatecall` ops, which can be exploited via untrusted modules.
- **EntryPoint version mismatch**: v0.6 and v0.7 are different contracts at different addresses with different UserOp encodings. Pick one; mixing tooling across versions silently produces invalid UserOps.
- **`initCode` must be empty after first deploy**: passing it again on subsequent UserOps reverts (`AA10`).
- **Bundler vs paymaster URLs**: confused regularly. Bundler accepts `eth_sendUserOperation`; paymaster accepts `pm_*` — viem expects them as separate clients.
- **EIP-7702 delegation persists**: until you revoke it, every call to your EOA runs the delegated code. After testing a delegation, consider revoking unless you mean to keep it.
- **EIP-7702 chain hardforks**: not all chains have enabled SET_CODE_TX_TYPE 0x04. Check chain status before depending on it.

## What to read next

- `references/uniswap-cookbook.md` — multi-step swap flows that benefit from MultiSend or batched UserOps
- `references/lending-and-staking.md` — using a Safe as the borrower/depositor identity
- `references/oracles-and-bridges.md` — CCIP/Across calls from a Safe or smart account
- Safe docs: https://docs.safe.global/
- ERC-4337: https://eips.ethereum.org/EIPS/eip-4337
- viem AA: https://viem.sh/account-abstraction
- EIP-7702: https://eips.ethereum.org/EIPS/eip-7702
