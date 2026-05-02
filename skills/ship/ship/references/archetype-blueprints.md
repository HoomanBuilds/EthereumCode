# Archetype Blueprints

The eight archetypes in `SKILL.md` are correct shape but need substance: which OZ contracts to extend, which integration patterns are battle-tested, and where the buying-vs-building line actually sits. This file is the deeper map.

For the day-of-launch runbook, see `references/launch-runbook.md`. For post-MVP iteration, see `references/post-mvp-iteration.md`.

## Token launch

**Skeleton** (one contract):

```solidity
pragma solidity ^0.8.27;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    constructor(address initialOwner)
        ERC20("MyToken", "MTK")
        ERC20Permit("MyToken")
        Ownable(initialOwner)
    {
        _mint(initialOwner, 1_000_000 ether);
    }

    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Votes) { super._update(from, to, value); }

    function nonces(address owner)
        public view override(ERC20Permit, Nonces) returns (uint256)
    { return super.nonces(owner); }
}
```

**Decisions to make first:**

| Decision | Default | When to deviate |
|---|---|---|
| Fixed vs mintable supply | Fixed | Mintable only with a hard cap and clear minting authority |
| Permit support | Yes | Cheap to include; saves gas for users |
| Votes support | Yes if governance is in roadmap | Don't add later — migration is painful |
| Fee on transfer | No | Breaks DEX integrations; only if you fully own the trading venue |
| Pausable | No | Centralization smell; only with a strong reason and timelock |
| Burnable | Optional | Cheap to add; useful for buyback-and-burn |

**Distribution patterns:**

- **Direct mint to multisig at deploy** — simplest, most opaque
- **Merkle airdrop** — `MerkleClaim.sol` over the token; cheaper than per-recipient mints; use OZ `MerkleProof`
- **Vesting per beneficiary** — OZ `VestingWallet` per recipient, or a single `MultiVestingWallet`
- **Liquidity bootstrap** — pair with WETH on Uniswap V3 / Aerodrome on chosen chain

**Where teams get burned:**

- Forgetting `_update` override merging (compile fails) — copy from OZ docs
- No clear initial liquidity plan — token deployed, sits at zero volume forever
- Fee-on-transfer + Uniswap → broken
- Centralized mint authority left enabled post-launch
- ERC20Votes without snapshotting in governance design

## NFT collection

**Skeleton** (ERC-721 with off-chain metadata):

```solidity
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Royalty} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721Royalty, Ownable {
    uint256 public nextId;
    uint256 public immutable maxSupply;
    string  private baseURI;

    constructor(address owner, uint256 _maxSupply, string memory _baseURI)
        ERC721("MyNFT", "MNFT") Ownable(owner)
    {
        maxSupply = _maxSupply;
        baseURI = _baseURI;
        _setDefaultRoyalty(owner, 500); // 5%
    }

    function mint(address to) external payable {
        require(msg.value == 0.01 ether, "wrong price");
        require(nextId < maxSupply, "sold out");
        _safeMint(to, nextId++);
    }

    function _baseURI() internal view override returns (string memory) { return baseURI; }
}
```

**Decisions:**

| Decision | Default | Alternative |
|---|---|---|
| ERC-721 vs 1155 | 721 for unique art, 1155 for editions | 1155 if any token has > 1 supply |
| Metadata location | IPFS or Arweave + base URI | Onchain SVG (only for procedural art) |
| Mint mechanic | Fixed price + max supply | Bonding curve, Dutch auction, allowlist + public phases |
| Allowlist | Merkle root (tiny gas, scales) | Signed off-chain list via EIP-712 (more flexible) |
| Royalty | EIP-2981 default | None if you don't want to enforce (most marketplaces ignore anyway) |
| Reveal | Pre-revealed | Two-stage with `setBaseURI` post-mint |

**Common bugs:**

- `tokenURI` returns broken JSON because trailing slash on `baseURI` is wrong
- Max supply checked AFTER mint (off-by-one)
- `_safeMint` to a contract that rejects `onERC721Received`
- Forgetting to lock `setBaseURI` after reveal — owner can rug metadata

**Buy vs build:** if you're shipping a vanilla ERC-721 collection, use Manifold or thirdweb's deployer instead of writing your own. Roll your own only if the contract has actual unique logic (game items, dynamic traits, bonded mints).

## Marketplace / exchange

**The buying-vs-building question:** in 95% of cases, the answer is **build nothing on-chain**.

```
Want to let users swap tokens?
   → Use Uniswap router. Zero contracts of your own.

Want to let users list NFTs for sale?
   → Use Reservoir / OpenSea SDKs. Zero contracts.

Want a custom UX over existing liquidity?
   → Frontend + router. Zero contracts.

Need custom matching, settlement, or token mechanics?
   → Custom contract.
```

**If custom:** the simplest pattern is escrow + signature settlement (Seaport-style):

```solidity
// Pseudocode — real Seaport is the right reference
contract OrderBook {
    mapping(bytes32 => bool) public filled;

    function fillOrder(Order calldata o, bytes calldata sig) external payable {
        bytes32 hash = _hashOrder(o);
        require(!filled[hash], "filled");
        require(SignatureChecker.isValidSignatureNow(o.maker, hash, sig), "bad sig");
        require(o.deadline >= block.timestamp, "expired");
        filled[hash] = true;
        _settle(o);
    }
}
```

**Key references:**
- Seaport (OpenSea) — the canonical EIP-712 marketplace
- Reservoir — orderbook aggregator + SDK
- Uniswap V4 hooks — for AMM-shaped marketplaces

**Where teams burn time:** building a CLOB on-chain (don't), reinventing approval flows (use Permit2), ignoring MEV (price-stale orders get sandwiched).

## Lending / vault / yield

**Skeleton** (ERC-4626 vault wrapping a single yield source):

```solidity
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract YieldVault is ERC4626 {
    IStrategy public strategy;

    constructor(IERC20 asset, address _strategy)
        ERC20("yvUSDC", "yvUSDC") ERC4626(asset)
    { strategy = IStrategy(_strategy); }

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + strategy.balanceOf();
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        IERC20(asset()).approve(address(strategy), assets);
        strategy.deposit(assets);
    }

    // _withdraw similarly pulls from strategy
}
```

**The inflation attack — read this carefully:**

ERC-4626 vaults are vulnerable to a first-depositor attack where attacker mints 1 share, donates assets directly to vault, then later depositors round to zero shares. Mitigations:

- OZ ERC-4626 v5+ has built-in virtual shares + virtual assets. Use it.
- For older versions: deposit a tiny seed amount yourself at deploy.
- For custom vaults: study Morpho-style internal accounting.

**Other gotchas:**

- Decimals mismatch: vault `decimals()` should mirror underlying (USDC vault → 6 decimals)
- `previewDeposit` rounds down — users get 1 wei less; document
- Strategy reentrancy: if strategy calls back, your `totalAssets()` may be stale mid-call

**Buy vs build:** if you just want users to earn yield on USDC, use Yearn / Morpho / Aave directly via your frontend. Build a custom vault only if you have a unique strategy worth managing.

## DAO / governance

**Skeleton** (three contracts, OZ Governor):

```
GovernanceToken (ERC20Votes)
        │
        ▼
MyGovernor (OZ Governor + GovernorSettings + GovernorVotes + GovernorVotesQuorumFraction + GovernorTimelockControl)
        │
        ▼
TimelockController (executes after delay)
```

**Parameters that matter:**

| Parameter | Typical | Notes |
|---|---|---|
| Voting delay | 1 day | Time between proposal and voting open |
| Voting period | 1 week | Voting window |
| Proposal threshold | 1% of supply | Anti-spam; tune to your token distribution |
| Quorum | 4-10% | Lower = more agile, less safe |
| Timelock delay | 2 days | Time between vote pass and execution |

**Common mistakes:**

- No timelock — governance executes instantly, single-block rugs are possible
- Quorum too low — minority takes over with low turnout
- Token distribution too concentrated — one whale controls outcomes
- Hardcoded admin functions in protocol that bypass governance — defeats the purpose

**Buy vs build:** Tally / Snapshot for off-chain voting + on-chain execution via Safe. The full Governor stack is heavy; only do it if you're targeting full on-chain governance from day 1.

**Reference deployments to study:** ENS Governor, Compound's GovernorBravo (the original), Uniswap Governor.

## AI agent service

**Architecture:** the agent runs off-chain. On-chain components are minimal:

- **ERC-8004** identity registration so other agents can verify yours
- **x402** payment endpoints for HTTP-native micropayments
- A Safe wallet for the agent's operating funds, with **AllowanceModule** capping daily spend

```solidity
// Optional: a simple registry of agent metadata
contract AgentRegistry {
    struct Agent { string name; string endpoint; address operator; }
    mapping(address => Agent) public agents;

    function register(string calldata name, string calldata endpoint) external {
        agents[msg.sender] = Agent(name, endpoint, msg.sender);
        emit Registered(msg.sender, name, endpoint);
    }
}
```

**Key principles:**

- **Solidity is not for AI inference.** Don't put model logic on-chain; put commitments to outputs on-chain.
- **Use Safe + Allowance Module for the operating wallet.** The agent's hot key is constantly online; cap blast radius.
- **Prefer x402 over building custom payments.** It's HTTP-native and standardized.

See `wallets/references/key-management.md` for the operating-wallet pattern.

## Prediction market

**Skeleton** (1-2 contracts):

```solidity
contract PredictionMarket {
    struct Market {
        string question;
        uint256 deadline;
        uint256 yesShares;
        uint256 noShares;
        bool resolved;
        bool outcome;
    }
    mapping(uint256 => Market) public markets;

    function bet(uint256 id, bool yes, uint256 amount) external { /* ... */ }
    function resolve(uint256 id, bool outcome) external onlyOracle { /* ... */ }
    function claim(uint256 id) external { /* payout based on side */ }
}
```

**Hard parts:**

- **Resolution oracle** — who decides the outcome? Trusted multisig is the easy path; UMA/Reality.eth is the decentralized path.
- **Liquidity** — fixed-odds vs LMSR vs CPMM. CPMM (Polymarket-style) is the default.
- **Disputes** — what happens when the oracle is wrong? Time-windowed dispute resolution is the standard.

**Buy vs build:** Polymarket is the dominant venue. If you're building a prediction market as a feature within a larger app, use Polymarket via API + a thin frontend wrapper.

## Common cross-archetype patterns

### Owner → Multisig migration

Every archetype's deployer should:

1. Deploy with EOA as owner
2. Verify functionality
3. Transfer ownership to a 3/5+ Safe immediately
4. Drain deployer's ETH balance
5. Document the multisig signers + recovery

This is non-negotiable for any contract holding funds.

### Pause vs immutable

| Approach | Pros | Cons |
|---|---|---|
| Pausable everywhere | Emergency stop possible | Centralization smell; trust required |
| Immutable, no admin | Maximally trustless | No recourse if bug found |
| Pausable + timelock + sunset | Trust-minimized; pausability sunsets after 6mo | More complex |

For DeFi with real funds, "pausable + timelock + sunset" is the modern default.

### Upgradeability

Default: **don't be upgradeable.** Immutable contracts are simpler, smaller attack surface, easier to audit.

If you must:
- UUPS (smaller, modern) over Transparent Proxy (legacy)
- Storage gaps (`uint256[50] __gap`) in all parent contracts
- Timelocked upgrades behind governance
- Document storage layout; run `forge inspect storageLayout` on every version and diff

## What to read next

- `SKILL.md` — full ship lifecycle
- `references/launch-runbook.md` — day-of-launch checklist
- `references/post-mvp-iteration.md` — after first deploy
- OpenZeppelin Wizard: https://wizard.openzeppelin.com — generates these skeletons
- Solady: https://github.com/Vectorized/solady — gas-optimized alternatives to OZ
