# Token Standards Cookbook

Concrete patterns for ERC-20, ERC-721, ERC-1155, and ERC-4626 with OpenZeppelin v5. All examples use Solidity `^0.8.20`. Verify canonical specs against https://eips.ethereum.org/.

## Decision Matrix

| Need                                  | Standard            | Why                                              |
| ------------------------------------- | ------------------- | ------------------------------------------------ |
| Fungible currency / governance / LP   | ERC-20              | Universal, smallest surface                      |
| Unique collectibles / identity NFTs   | ERC-721             | One-of-one ownership semantics                   |
| Mixed fungible + NFT in one contract  | ERC-1155            | Batch ops, lower gas for large drops             |
| Yield-bearing share token             | ERC-4626            | Standard `deposit/withdraw/preview`              |
| Cheap mass mint (10k PFP drop)        | ERC-721A            | Constant gas regardless of mint quantity         |
| Royalty-aware NFT                     | ERC-721 + ERC-2981  | `royaltyInfo` is the marketplace standard         |
| Gasless approve                       | ERC-20 + ERC-2612   | Sign permit, no separate `approve` tx            |
| Token-bound NFT account               | ERC-6551            | Niche; pairs with ERC-721                        |

## ERC-20

### Minimal Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}
```

### Canonical Implementation (OpenZeppelin v5)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, ERC20Permit, Ownable {
    constructor(address initialOwner)
        ERC20("MyToken", "MTK")
        ERC20Permit("MyToken")
        Ownable(initialOwner)
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
```

### Decimals: The #1 Footgun

| Token  | Decimals | Implication                            |
| ------ | -------- | -------------------------------------- |
| WETH   | 18       | 1 WETH = `1_000_000_000_000_000_000`   |
| DAI    | 18       | Same                                   |
| USDC   | 6        | $1 USDC = `1_000_000`                  |
| USDT   | 6        | $1 USDT = `1_000_000`                  |
| WBTC   | 8        | 1 WBTC = `100_000_000`                 |

Never assume 18. Always read `decimals()` from the token or hard-code per-token constants. Cross-token math without normalization silently breaks.

### transferFrom + approve

```solidity
IERC20(usdc).approve(spender, type(uint256).max); // user tx 1
// later, contract pulls funds
IERC20(usdc).transferFrom(user, address(this), 1_000_000); // contract action
```

**Infinite-approval risk:** `type(uint256).max` lets a compromised spender drain the entire balance forever. Mitigations:
- Approve the exact amount each time (worse UX, more gas).
- Use ERC-2612 Permit to scope a one-shot approval.
- Use Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`, verify against https://github.com/Uniswap/permit2) for unified, expiring approvals.

### Tokens That Revert vs Return False

ERC-20 lets `transfer`/`approve` return `false` on failure, but most modern tokens revert. Some (notably old USDT) don't return a value at all, so a Solidity `bool` decode reverts even on success. Always use the `SafeERC20` wrapper:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault {
    using SafeERC20 for IERC20;

    function pull(IERC20 token, address from, uint256 amount) external {
        token.safeTransferFrom(from, address(this), amount);
    }

    function push(IERC20 token, address to, uint256 amount) external {
        token.safeTransfer(to, amount);
    }
}
```

`SafeERC20` handles missing return values, false returns, and reverts uniformly. Use it for every external token call.

### Pathological Tokens

| Pathology                | Behavior                                                              | Mitigation                                                 |
| ------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| Fee-on-transfer (PAXG)   | `transfer(amount)` arrives as `amount - fee`                          | Measure `balanceOf` before/after, never trust the input    |
| Rebasing (stETH, AMPL)   | `balanceOf` changes without a `Transfer` event                        | Track shares, not balances; or wrap (wstETH)               |
| Blacklists (USDC, USDT)  | Calls revert if `from` or `to` is sanctioned                          | Treat any `safeTransfer` as fallible; design for refunds   |
| Pausable (USDC)          | Calls revert during admin pause                                       | Ditto; surface failure to user                             |
| Double-entrypoint (TUSD) | Two contracts share state — ERC-20 approval bypass possible           | Don't whitelist by address alone in router-style contracts |

### USDT Historical Gotcha

USDT on Ethereum mainnet's `approve` and `transfer` did not return a `bool` until later upgrades. Code that did `require(usdt.approve(...))` reverted because the ABI decode found no return data. `SafeERC20.forceApprove` and `safeTransfer` handle this — never call `approve`/`transfer` directly.

## ERC-2612 Permit

A standard for signing approvals off-chain. The owner signs an EIP-712 typed message; anyone can submit it on-chain to grant the allowance.

```solidity
// signed off-chain by `owner`
struct Permit {
    address owner;
    address spender;
    uint256 value;
    uint256 nonce;     // from token.nonces(owner)
    uint256 deadline;  // unix seconds
}

// on-chain submission (anyone can pay gas)
IERC20Permit(token).permit(owner, spender, value, deadline, v, r, s);
IERC20(token).transferFrom(owner, recipient, value);
```

Not all tokens implement it. USDT does not. DAI implements a non-standard variant (see permit-and-meta-tx reference). USDC implements EIP-3009 (`transferWithAuthorization`) plus permit on most chains.

## ERC-721

### Minimal Interface

```solidity
interface IERC721 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}
```

### `safeTransferFrom` vs `transferFrom`

`safeTransferFrom` calls `onERC721Received` on the recipient if it's a contract, reverting if the contract doesn't implement the receiver hook. This prevents NFTs being sent to contracts that can't move them out — i.e. permanently locked. Use `safeTransferFrom` for user-facing transfers; use `transferFrom` only when you control both ends and want to skip the callback.

### Canonical Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721URIStorage, ERC2981, Ownable {
    uint256 private _nextId = 1;

    constructor(address owner) ERC721("MyNFT", "MNFT") Ownable(owner) {
        _setDefaultRoyalty(owner, 500); // 5% — basis points
    }

    function mint(address to, string calldata uri) external onlyOwner returns (uint256 id) {
        id = _nextId++;
        _safeMint(to, id);
        _setTokenURI(id, uri);
    }

    function supportsInterface(bytes4 id)
        public view override(ERC721, ERC721URIStorage, ERC2981) returns (bool)
    {
        return super.supportsInterface(id);
    }
}
```

### tokenURI Patterns

| Strategy             | Pros                                     | Cons                                                                  |
| -------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Onchain SVG (data:)  | Permanent, no host needed                | Gas-heavy on mint, limited art                                        |
| IPFS                 | Cheap, content-addressed                 | Needs pinning service; CID rot if unpinned                            |
| Arweave              | Permanent for the storage fee            | Not free; one-shot upload                                             |
| Centralized HTTPS    | Mutable, cheap                           | Server failure = dead metadata; not "real" NFT immutability           |

### ERC-721A (Cheap Mints)

`ERC721A` from Azuki overrides `_mint` so minting N tokens is a single storage write rather than N. Use when you have a single-tx mass mint (PFP drop). Cost trade-off: per-token transfers are slightly more expensive because ownership lookup walks backwards through the array. Verify against https://github.com/chiru-labs/ERC721A.

### Royalties (ERC-2981)

```solidity
function royaltyInfo(uint256 tokenId, uint256 salePrice)
    external view returns (address receiver, uint256 royaltyAmount);
```

Marketplaces decide whether to honor it. OpenSea historically toggled enforcement; Blur ignores it. Don't depend on royalties as primary revenue.

## ERC-1155

Multi-token contract — each `id` can be fungible (supply > 1) or non-fungible (supply == 1).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract GameItems is ERC1155, Ownable {
    constructor(address owner)
        ERC1155("ipfs://Qm.../{id}.json")
        Ownable(owner)
    {}

    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external onlyOwner {
        _mint(to, id, amount, data);
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data)
        external onlyOwner
    {
        _mintBatch(to, ids, amounts, data);
    }
}
```

Use when:
- A game has many item types — sword (id=1), potion (id=2), key (id=3) — and you don't want one contract per item.
- Drops where you batch-mint to many recipients (gas savings).

The `{id}` placeholder in the URI is replaced by the hex token id (zero-padded to 64 chars) by ERC-1155-aware metadata services.

## ERC-4626 Tokenized Vaults

A vault that wraps an ERC-20 (the "asset") and issues shares (the vault token) that represent a claim on a growing pool.

### Core Interface

```solidity
interface IERC4626 {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);

    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function mint(uint256 shares, address receiver) external returns (uint256 assets);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    function previewDeposit(uint256 assets) external view returns (uint256);
    function previewMint(uint256 shares) external view returns (uint256);
    function previewWithdraw(uint256 assets) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);

    function maxDeposit(address) external view returns (uint256);
    function maxMint(address) external view returns (uint256);
    function maxWithdraw(address owner) external view returns (uint256);
    function maxRedeem(address owner) external view returns (uint256);
}
```

`deposit/withdraw` are denominated in assets; `mint/redeem` are denominated in shares. Always use the `preview*` functions for UI quotes — they apply rounding the same way the actual call will.

### Canonical Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract YieldVault is ERC4626 {
    constructor(IERC20 asset_) ERC4626(asset_) ERC20("Yield Vault", "yvUSDC") {}

    // Override _decimalsOffset() to set virtual share offset (default 0)
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6; // recommended >= 6 for inflation attack resistance
    }
}
```

### Share Inflation Attack

The classic ERC-4626 vulnerability. A first depositor mints 1 wei of shares, then donates assets directly to the vault (transfer to the vault address, bypassing `deposit`). Now `totalSupply = 1` and `totalAssets = 1e18`. The next depositor's shares round to zero. Their assets are stolen.

**OpenZeppelin v5 mitigation:** virtual shares + virtual assets via `_decimalsOffset()`. Set offset >= 6. The vault behaves as if it had `10**offset` extra dead shares, making the attack require an economically infeasible donation. This replaces the older "burn the first 1000 shares" hack.

### Rounding Direction (Standard)

| Operation             | Rounds                   | Why                                       |
| --------------------- | ------------------------ | ----------------------------------------- |
| `previewDeposit`      | Down (favor vault)       | Depositor gets fewer shares              |
| `previewMint`         | Up (favor vault)         | Minter pays more assets                  |
| `previewWithdraw`     | Up (favor vault)         | Withdrawer burns more shares             |
| `previewRedeem`       | Down (favor vault)       | Redeemer gets fewer assets               |

The vault always rounds in its own favor by 1 wei. Don't try to "fix" this — it's the standard.

### Hooks for Strategy Vaults

Override `_deposit` / `_withdraw` to deploy assets to a yield strategy on each interaction, or override `totalAssets()` to include strategy positions:

```solidity
function totalAssets() public view override returns (uint256) {
    return IERC20(asset()).balanceOf(address(this)) + strategy.balanceOf();
}
```

## OpenZeppelin v5 Import Cheat Sheet

```solidity
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
```

OZ v5 broke a number of v4 patterns: `Ownable` constructor takes `initialOwner`, `_beforeTokenTransfer` is removed (replaced by `_update`), `Counters` was removed (use a `uint256`). When migrating, lean on the v5 migration guide rather than guessing. Verify against https://docs.openzeppelin.com/contracts/5.x/.

## Testing Checklist (Foundry)

```solidity
function test_decimals() public view { assertEq(token.decimals(), 18); }
function test_totalSupplyAfterMint() public { token.mint(alice, 1e18); assertEq(token.totalSupply(), 1e18); }
function test_safeTransferFrom_revertsOnInsufficient() public {
    vm.expectRevert();
    token.safeTransferFrom(alice, bob, 1e30);
}
function test_inflationAttack_resisted() public {
    vault.deposit(1, attacker);                        // 1 wei
    deal(address(asset), address(vault), 1e18);        // donation
    vm.prank(victim);
    uint256 shares = vault.deposit(1e6, victim);
    assertGt(shares, 0);                               // would be 0 without offset
}
```

Always test against the pathologies, not just the happy path.
