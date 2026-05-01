# Permit and Meta-Transaction Cookbook

Gasless approvals, gasless transfers, and meta-tx patterns. Solidity `^0.8.20`, OpenZeppelin v5, viem v2. Verify against canonical specs at https://eips.ethereum.org/.

## Family Tree

| Standard      | Type        | What it gases-out                            | Status                              |
| ------------- | ----------- | -------------------------------------------- | ----------------------------------- |
| ERC-2612      | Permit       | `approve` (for ERC-20s that opt in)          | Widely adopted, not universal        |
| DAI permit    | Permit-like  | `approve`, with non-standard fields          | Legacy, DAI-only                     |
| EIP-3009      | Auth-transfer | `transferFrom` (the whole transfer)         | USDC and stablecoins                 |
| Permit2       | Universal approval middleware | Approve once forever for *any* token | Uniswap-led, growing adoption |
| ERC-2771      | Trusted forwarder | The whole tx (legacy meta-tx)            | Largely superseded by 4337/7702      |
| ERC-4337      | Smart account UserOp | The whole tx, programmable             | Live, growing                        |
| EIP-7702      | EOA delegation | The whole tx, sponsored by relayer         | Live since Pectra (May 2025)         |

## When to Use Which

| You want…                                                       | Use                       |
| --------------------------------------------------------------- | ------------------------- |
| Sign once, swap+deposit in one tx, on a token that supports permit | ERC-2612                  |
| Same as above, but the token is USDC / DAI / WETH / random ERC20 | Permit2                   |
| Move USDC from user A to user B without user A paying gas         | EIP-3009                  |
| User has an EOA, wants batched txs and gas sponsorship            | EIP-7702                  |
| New user, full programmability + recovery                         | ERC-4337                  |
| Legacy app you can't change, only forwarder support               | ERC-2771                  |

## ERC-2612 Permit

Lets a token holder sign an EIP-712 message authorizing an `approve`. Anyone (a relayer, the dapp, the user themselves) can submit it.

### Canonical Struct

```solidity
struct Permit {
    address owner;
    address spender;
    uint256 value;
    uint256 nonce;     // from token.nonces(owner) at signing time
    uint256 deadline;  // unix seconds
}
```

### TypeHash

```solidity
bytes32 public constant PERMIT_TYPEHASH = keccak256(
    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
);
```

### Token-Side (OpenZeppelin v5)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MyToken is ERC20, ERC20Permit {
    constructor() ERC20("MyToken", "MTK") ERC20Permit("MyToken") {}
}
```

`ERC20Permit` exposes:

```solidity
function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;

function nonces(address owner) external view returns (uint256);

function DOMAIN_SEPARATOR() external view returns (bytes32);
```

### USDT Reality Check

USDT on Ethereum mainnet *does not implement ERC-2612*. You cannot permit USDT directly. Workarounds: Permit2, or pre-approve once and use a router that pulls.

### DAI's Non-Standard Permit

DAI shipped before ERC-2612 was finalized, so it uses different fields:

```solidity
function permit(
    address holder,
    address spender,
    uint256 nonce,
    uint256 expiry,    // not "deadline"
    bool allowed,      // not "value" — booleans only: full unlimited or 0
    uint8 v, bytes32 r, bytes32 s
) external;
```

Differences from ERC-2612:
- `expiry` instead of `deadline` (semantically the same, different name).
- `allowed` boolean instead of `value`. `true` => approve `type(uint256).max`; `false` => approve `0`.
- The typehash is `Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)`.

When integrating DAI gasless flows, you must use the DAI variant. Routers that auto-detect typically check `bytes4(keccak256("PERMIT_TYPEHASH"))` shape.

### Permit + transferFrom Combo

The whole point: one user signature unlocks both approve and spend in a single tx the user submits or a relayer submits.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DepositRouter {
    using SafeERC20 for IERC20;

    function depositWithPermit(
        IERC20 token,
        address from,
        uint256 amount,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        IERC20Permit(address(token)).permit(from, address(this), amount, deadline, v, r, s);
        token.safeTransferFrom(from, address(this), amount);
        // continue with deposit logic
    }
}
```

Wrap with `try/catch` if you want to tolerate front-runs (an attacker can frontrun the permit; a duplicate permit reverts. With try/catch on permit, you fall through to the transferFrom assuming the allowance was already set).

```solidity
try IERC20Permit(address(token)).permit(from, address(this), amount, deadline, v, r, s) {} catch {}
token.safeTransferFrom(from, address(this), amount);
```

### Frontend (viem v2)

```typescript
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const account = privateKeyToAccount(process.env.PK as `0x${string}`);
const wallet  = createWalletClient({ account, chain: base, transport: http() });

const TOKEN  = "0x..." as const;          // token must implement ERC-2612
const ROUTER = "0xRouter" as const;
const value  = 1_000_000n;                 // 1 USDC if 6 decimals

// 1. Read nonce + name + version.
const result = await publicClient.readContract({
  address: TOKEN, abi: eip712DomainAbi, functionName: "eip712Domain",
}) as readonly [`0x${string}`, string, string, bigint, `0x${string}`, `0x${string}`, readonly bigint[]];
const [, name, version] = result;
const nonce = await publicClient.readContract({
  address: TOKEN, abi: noncesAbi, functionName: "nonces", args: [account.address],
});

// 2. Sign.
const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
const signature = await wallet.signTypedData({
  domain: { name, version, chainId: base.id, verifyingContract: TOKEN },
  types: {
    Permit: [
      { name: "owner",    type: "address" },
      { name: "spender",  type: "address" },
      { name: "value",    type: "uint256" },
      { name: "nonce",    type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Permit",
  message: {
    owner: account.address,
    spender: ROUTER,
    value,
    nonce,
    deadline,
  },
});

// 3. Split sig.
import { parseSignature } from "viem";
const { r, s, yParity } = parseSignature(signature);
const v = yParity === 0 ? 27 : 28;

// 4. Submit.
await wallet.writeContract({
  address: ROUTER,
  abi: routerAbi,
  functionName: "depositWithPermit",
  args: [TOKEN, account.address, value, deadline, v, r, s],
});
```

## Permit2

Uniswap's universal approval contract. Deployed at the same address on mainnet, Base, Arbitrum, Optimism, Polygon, and most major chains:

`0x000000000022D473030F116dDEE9F6B43aC78BA3`

Verify against https://github.com/Uniswap/permit2.

### Why Permit2

| Problem with raw approvals     | Permit2 fix                                                      |
| ------------------------------- | ---------------------------------------------------------------- |
| Have to approve every new dapp  | Approve Permit2 once; sign per-dapp authorizations off-chain     |
| Tokens don't implement permit   | Permit2 adds permit-like functionality to *any* ERC-20           |
| Infinite approvals stay forever | Permit2 supports time-bounded allowances                         |
| No transfer-with-witness        | Permit2's `permitTransferFrom` accepts witness data for context |

User flow:
1. One-time: user approves Permit2 for a token (regular ERC-20 `approve`).
2. Every dapp: user signs a Permit2 typed-data message off-chain naming the dapp + amount + deadline.
3. Dapp calls `Permit2.permitTransferFrom(...)` to pull funds.

### permitTransferFrom Flow

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISignatureTransfer {
    struct TokenPermissions { address token; uint256 amount; }
    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }
    struct SignatureTransferDetails { address to; uint256 requestedAmount; }

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}

contract Swap {
    ISignatureTransfer constant PERMIT2 = ISignatureTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3); // verify against https://github.com/Uniswap/permit2

    function swap(
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature,
        address owner
    ) external {
        PERMIT2.permitTransferFrom(
            permit,
            ISignatureTransfer.SignatureTransferDetails({ to: address(this), requestedAmount: permit.permitted.amount }),
            owner,
            signature
        );
        // ... do the swap
    }
}
```

### Witness Data

`permitWitnessTransferFrom` lets the signed message commit to *additional dapp-specific data* (e.g. min output amount for a swap). The witness is hashed into the typed-data, so a relayer can't tamper with the trade parameters.

```solidity
function permitWitnessTransferFrom(
    PermitTransferFrom calldata permit,
    SignatureTransferDetails calldata transferDetails,
    address owner,
    bytes32 witness,
    string calldata witnessTypeString,
    bytes calldata signature
) external;
```

`witnessTypeString` is the EIP-712 typedef of the dapp's witness struct, appended to the standard Permit2 typedef during hashing.

### Permit2 Allowance Pattern

Permit2 also supports an allowance flow (rather than per-tx signatures) — `IAllowanceTransfer`. The user signs an allowance permit naming a spender + amount + expiration; the spender can then call `transferFrom` repeatedly until expiry. Use this for recurring dapps (subscriptions, DCA bots).

## EIP-712 Typed Data: The Mechanics

EIP-712 hashes a structured message in a way that wallets can show fields humanly. Every permit/auth standard we discuss uses it.

```text
digest = keccak256(
    "\x19\x01" ||
    keccak256(EIP712Domain) ||
    keccak256(PrimaryType(message))
)

EIP712Domain = (name, version, chainId, verifyingContract)
```

### Domain Separator

```solidity
bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes(NAME)),
    keccak256(bytes(VERSION)),
    block.chainid,
    address(this)
));
```

`chainId` in the domain is what blocks cross-chain replay. If the contract is deployed at the same address on multiple chains (CREATE2), the `chainId` field still differs the digest.

### TypeHash

```solidity
bytes32 PERMIT_TYPEHASH = keccak256(
    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
);
```

### Message Hash

```solidity
bytes32 structHash = keccak256(abi.encode(
    PERMIT_TYPEHASH,
    owner, spender, value, nonce, deadline
));
bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
address signer = ECDSA.recover(digest, v, r, s);
```

OpenZeppelin's `EIP712.sol` and `ECDSA.sol` implement this; rolling your own is a recipe for malleability bugs. Use:

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
```

### viem's `signTypedData`

```typescript
const sig = await wallet.signTypedData({
  domain: { name, version, chainId, verifyingContract },
  types,            // primary type's struct + any nested
  primaryType,      // string name of root struct
  message,          // values
});
```

viem v2 returns the canonical 65-byte hex; split with `parseSignature` to get `r`, `s`, and `yParity` (derive `v` as `yParity === 0 ? 27 : 28`).

## ERC-2771 Trusted Forwarder

The original meta-tx pattern. A `Forwarder` contract relays user-signed messages; the target contract trusts the forwarder by checking `_msgSender()` (which extracts the original user from the calldata suffix).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";

contract MyApp is ERC2771Context {
    constructor(address forwarder) ERC2771Context(forwarder) {}

    function doThing() external {
        address user = _msgSender(); // user, not the forwarder
        // ...
    }
}
```

Largely superseded by ERC-4337 and EIP-7702 because:
- 2771 needs every target contract to opt in (inherit `ERC2771Context`).
- 4337 and 7702 work without contract changes.
- 2771 has no protocol-level gas accounting; 4337 does.

Still useful if you have legacy contracts you can't change but can deploy a new forwarder for.

## EIP-3009 vs ERC-2612: Quick Diff

| Property                       | ERC-2612 Permit                     | EIP-3009 transferWithAuthorization        |
| ------------------------------ | ----------------------------------- | ------------------------------------------ |
| What's signed                  | `approve(spender, value)`           | The whole transfer (`from`, `to`, `value`) |
| Result on-chain                | Allowance set                       | Funds moved                                |
| Nonce type                     | Sequential `uint256`                | Random `bytes32`                           |
| Order dependency               | Strict (1, 2, 3 ...)                | None                                       |
| Deadline field                 | `deadline`                          | `validBefore` (and `validAfter`)           |
| Cancelable?                    | Implicit (`approve(0)`)             | Explicit (`cancelAuthorization`)           |
| USDC support                   | Yes (most chains)                   | Yes (most chains)                          |
| USDT support                   | No                                  | No                                         |
| DAI support                    | Non-standard variant                | No                                         |
| Best for                       | Approving a spender                 | One-shot transfers (x402 payments)         |

**Rule:** if you want to give a contract long-lived spend authority, use Permit (or Permit2). If you want to make a single payment without the recipient ever holding allowance, use EIP-3009.

## Multicall + Permit (One-Tx UX)

OpenZeppelin v5 ships `Multicall` for batching. Combine with permit to give the user "sign once, do everything":

```solidity
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

contract App is Multicall {
    function doPermit(address token, ...) external { /* calls permit */ }
    function doDeposit(uint256 amount) external { /* uses allowance */ }
}
```

Frontend builds a `multicall(bytes[])` payload of `[doPermit(...), doDeposit(...)]`. User submits one tx that runs both. Works without 7702/4337 — just regular EOA + multicall.

## Anti-Patterns and Bugs

### Not Validating `deadline`

```solidity
// BAD — no deadline check, anyone can replay an old sig forever
function permitAndPull(... uint256 deadline, ...) external {
    IERC20Permit(token).permit(owner, address(this), value, deadline, v, r, s);
    token.transferFrom(owner, address(this), value);
}
```

`ERC20Permit.permit` itself enforces `block.timestamp <= deadline`. Don't skip it by writing your own variant. If you do roll your own (e.g. for a custom vault), include the check explicitly.

### Reusing Nonces

ERC-2612 enforces nonce monotonicity in the token. EIP-3009 uses `(authorizer, nonce) -> used`. Permit2 has its own bitmap model. **Never** reuse a nonce in any signed authorization — the second submission will revert and waste gas.

### Hard-Coding `name` or `version`

USDC on bridged chains is sometimes `"USDC"` v1; native USDC is `"USD Coin"` v2. DAI on mainnet is `"Dai Stablecoin"` v1. Hard-coded values silently break cross-chain. Always read `eip712Domain()` (EIP-5267) at startup or per-token.

```solidity
function eip712Domain() external view returns (
    bytes1 fields,
    string memory name,
    string memory version,
    uint256 chainId,
    address verifyingContract,
    bytes32 salt,
    uint256[] memory extensions
);
```

### Signature Malleability

Use OpenZeppelin's `ECDSA.recover` which rejects high-`s` signatures. Don't roll your own. Without enforcement, an attacker can mint a *different* valid signature for the same message and bypass nonce-style replay protection if you key your replay map on the signature instead of the message.

### Front-Run Permit Grief

An attacker watches the mempool, sees a user submit `[permit, transferFrom]`, and front-runs with just `permit`. The user's permit reverts (nonce already used) and their `transferFrom` succeeds (allowance already set). Annoying but not stealing funds. Mitigate with `try/catch` on the permit call as shown above, or use Permit2 (which uses random nonces).

### Insufficient `validAfter` Window for x402

If `validAfter == 0` and `validBefore == validAfter + 1` (a paranoid one-second window), clock skew between client and server will cause failures. Use `validAfter = 0` and `validBefore = now + 5min` as defaults.

## Pre-Flight Checklist

- [ ] Token implements ERC-2612? Check `nonces(address)` returns successfully.
- [ ] If not, can you use Permit2? (Token must be approvable normally.)
- [ ] Domain `name`/`version` read from chain, not hard-coded.
- [ ] Deadline / `validBefore` is short (5-15 min) for high-value flows, longer (1h) for low-stakes UX.
- [ ] `try/catch` around `permit()` if the same sig may already be on-chain.
- [ ] OpenZeppelin v5 `EIP712` + `ECDSA` for any custom signed-data verifier.
- [ ] Frontend recovers signer locally and compares to expected `from` before submitting (catches signing-key mismatch early).
- [ ] Tests cover: expired deadline, reused nonce, wrong chainId domain, wrong spender, malicious witness.

## Further Reading

- ERC-2612: https://eips.ethereum.org/EIPS/eip-2612
- EIP-3009: https://eips.ethereum.org/EIPS/eip-3009
- EIP-712: https://eips.ethereum.org/EIPS/eip-712
- EIP-5267: https://eips.ethereum.org/EIPS/eip-5267
- Permit2: https://github.com/Uniswap/permit2
- ERC-2771: https://eips.ethereum.org/EIPS/eip-2771
- OpenZeppelin v5 docs: https://docs.openzeppelin.com/contracts/5.x/
- viem typed-data: https://viem.sh/docs/actions/wallet/signTypedData
