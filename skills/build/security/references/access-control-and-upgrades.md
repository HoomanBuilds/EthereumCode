# Access Control and Upgrade Safety

Privileged functions and proxy upgrades are the two highest-leverage attack surfaces in smart contracts. A single missing modifier or a single typo'd owner address can drain an entire protocol. Solidity `^0.8.20`, OpenZeppelin v5.

## Ownable vs AccessControl

OpenZeppelin offers two patterns. Pick by use case, not by habit.

| | `Ownable` | `AccessControl` |
|---|---|---|
| Number of privileged actors | One owner | Arbitrary roles, arbitrary members per role |
| Granularity | Binary (owner or not) | Per-role |
| Code complexity | Minimal | Medium |
| Use when | Single admin, simple contract, MVP | Multiple actor types (admin, operator, pauser, minter), separation of duties |

Always prefer `AccessControl` once a protocol has more than one operational role. Combining everything under a single owner concentrates power and increases blast radius if that key is compromised.

```solidity
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract Treasury is Ownable2Step {
    constructor(address initialOwner) Ownable(initialOwner) {}

    function withdraw(address token, uint256 amount) external onlyOwner {
        // ...
    }
}
```

## Two-Step Ownership Transfer

`Ownable.transferOwnership(newOwner)` is one-shot. Typing the wrong address bricks the contract permanently. Use `Ownable2Step` instead — the new owner must explicitly accept.

```solidity
contract Vault is Ownable2Step {
    constructor(address initial) Ownable(initial) {}
}

// Transfer flow:
// 1. current owner: vault.transferOwnership(newOwner)
// 2. newOwner:      vault.acceptOwnership()
// Until step 2, the old owner remains in control.
```

Apply the same principle to any "set X to address Y" operation involving an actor that must respond. Push, not pull, leads to wrong-address footguns.

## AccessControl Role Design

`AccessControl` ships with `DEFAULT_ADMIN_ROLE`, the role admin for every other role unless overridden. Every role has an "admin role" that can grant and revoke it.

```solidity
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract Protocol is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE   = keccak256("MINTER_ROLE");

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _setRoleAdmin(OPERATOR_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE,   DEFAULT_ADMIN_ROLE);
        // MINTER_ROLE is administered by OPERATOR_ROLE — separation of duties
        _setRoleAdmin(MINTER_ROLE,   OPERATOR_ROLE);
    }

    function emergencyPause() external onlyRole(PAUSER_ROLE) { /* ... */ }
    function mint(address to, uint256 amt) external onlyRole(MINTER_ROLE) { /* ... */ }
}
```

### Role-design rules of thumb

- **Separate read-write privileges.** A `PAUSER_ROLE` that only pauses is much safer than letting the admin pause; the pauser key can live on a hot wallet, the admin on a multisig.
- **Use `_setRoleAdmin` deliberately.** Default behaviour is "admin admins everything". Use sub-roles (e.g., operator admins minter) to spread power.
- **Avoid making `DEFAULT_ADMIN_ROLE` a hot key.** It can grant any role to any address. It belongs on a multisig + timelock.
- **Renouncing roles is one-way.** Plan for it but document it; renouncing `DEFAULT_ADMIN_ROLE` may be desirable post-launch but is irreversible.

## The renounceOwnership Footgun

`Ownable.renounceOwnership()` sets the owner to `address(0)`, permanently. Calls protected by `onlyOwner` are then uncallable forever.

This is intentional ("ossification") and can be a feature, not a bug — many protocols announce renunciation as a credibility signal. But:

- Make sure you actually intend it. Renouncing the owner of an upgradeable proxy bricks upgrades forever.
- Make sure no admin function you might still need is gated only by `onlyOwner`.
- Disable it explicitly in inheriting contracts if you do not want it: override `renounceOwnership` to `revert("disabled")`.

```solidity
contract NoRenounce is Ownable2Step {
    function renounceOwnership() public pure override {
        revert("renounce disabled");
    }
}
```

## Multisig + Timelock for Sensitive Ops

Privileged functions with material impact (upgrades, parameter changes that affect collateral pricing, treasury withdrawals) should not be callable by an EOA. Standard pattern:

1. Owner is a Safe (Gnosis) multisig — N of M signers required.
2. The multisig itself queues operations in an OpenZeppelin `TimelockController` with a delay (24-72h is typical).
3. After the delay, anyone can execute the queued operation.

```solidity
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

// Deploy:
// proposers   = [safeAddress]
// executors   = [address(0)] -> anyone can execute after delay
// admin       = address(0)   -> no admin, immutable
// minDelay    = 86400 * 2    -> 48 hours
TimelockController timelock = new TimelockController(
    2 days,
    proposers,
    executors,
    address(0)
);

// Then in the protocol:
contract Protocol is Ownable2Step {
    constructor(address timelockAddr) Ownable(timelockAddr) {}
}
```

Why this works:

- Users see queued operations onchain in advance, can exit if they disagree.
- A single rogue signer cannot push through a malicious change (multisig threshold).
- A compromised multisig cannot execute instantly (timelock delay).
- The timelock has no admin, so its rules cannot be silently changed.

The tradeoff is response latency. For genuine emergencies, separate a `PAUSER_ROLE` (short-delay or no-delay) from upgrade authority (long delay). The pauser can stop new harm; only the timelocked path can change code.

## UUPS Proxy Gotchas

Universal Upgradeable Proxy Standard (EIP-1822 / OpenZeppelin UUPS) is the preferred upgrade pattern. The upgrade logic lives in the implementation, not the proxy. A few footguns:

```solidity
import {UUPSUpgradeable}    from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable}      from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

contract MyV1 is Initializable, UUPSUpgradeable, Ownable2StepUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) external initializer {
        __Ownable_init(admin);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImpl) internal override onlyOwner {}
}
```

### `_authorizeUpgrade` must be implemented

UUPSUpgradeable declares `_authorizeUpgrade` as `internal virtual`. You MUST override `_authorizeUpgrade`. Forgetting it makes upgrades permissionless or impossible depending on inheritance — verify before deploying. Check that the override gates the call: an empty body is the bug, `onlyOwner` (or equivalent) is correct.

### `initializer` and `reinitializer`

Proxies do not run constructors. State-setup goes in an `initializer` function called once via the proxy.

```solidity
function initialize(address admin) external initializer {
    __Ownable_init(admin);
    __UUPSUpgradeable_init();
}
```

For subsequent versions that need additional setup:

```solidity
function initializeV2(uint256 newParam) external reinitializer(2) {
    newParameter = newParam;
}
```

`reinitializer(N)` can run once per version number; bump for each upgrade that needs setup. Forgetting to use `reinitializer` and instead using `initializer` again silently fails (the modifier rejects re-runs).

### `_disableInitializers()` in the implementation constructor

The implementation contract is deployed independently of the proxy. If it is left uninitialized, anyone can call its `initialize` and become "owner" of the implementation. Pre-Cancun, that owner could `selfdestruct` the implementation, bricking every proxy that pointed at it.

EIP-6780 (post-Cancun) makes `selfdestruct` a no-op for contracts deployed in the same transaction, mitigating the destruction angle but not full state corruption: an attacker who initializes the implementation can still set arbitrary owner-only state in the implementation's own storage, which is generally harmless for proxy users (proxies have their own storage) but can cause confusion or be a stepping stone in some patterns.

Either way: always include `_disableInitializers()` in the implementation constructor, marked with the OZ unsafe-allow comment.

## Storage Layout Discipline

A proxy delegates calls to the implementation, which executes on the proxy's storage. Storage layout in the implementation defines what each slot of proxy storage means. Reordering or deleting variables across upgrades reinterprets existing data and is the source of the worst upgrade bugs.

Two approaches in OZ v5.

### Storage gaps (legacy v4 pattern)

Reserve trailing slots in each contract so subclasses can add variables without bumping into them.

```solidity
contract MyV1 {
    uint256 public a;
    uint256 public b;
    uint256[48] private __gap; // reserved
}
```

Brittle. Inheritance chains compound. v5 deprecates this in favour of namespaced storage.

### ERC-7201 namespaced storage (v5 pattern)

Each contract declares an explicit storage struct stored at a fixed namespaced slot. New variables are added inside the struct without affecting any other contract's slots.

```solidity
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Protocol is Initializable {
    /// @custom:storage-location erc7201:myprotocol.main
    struct MainStorage {
        uint256 totalDeposits;
        mapping(address => uint256) balances;
    }

    // PLACEHOLDER — derive YOUR slot, do not copy this expression verbatim into production without re-namespacing.
    // ERC-7201: keccak256(abi.encode(uint256(keccak256("myprotocol.main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_SLOT =
        keccak256(abi.encode(uint256(keccak256("myprotocol.main")) - 1)) & ~bytes32(uint256(0xff));

    function _s() private pure returns (MainStorage storage s) {
        bytes32 slot = MAIN_STORAGE_SLOT;
        assembly {
            s.slot := slot
        }
    }

    function totalDeposits() external view returns (uint256) {
        return _s().totalDeposits;
    }
}
```

The namespaced slot is derived deterministically from a string identifier and the OpenZeppelin upgrades plugin verifies layout compatibility on every upgrade. Compute the slot constant from the namespace string — the placeholder warning above applies, always re-namespace per protocol.

### Layout rules, regardless of pattern

- Append, never reorder, never delete.
- Do not change a variable's type to a different-sized one.
- Do not insert a variable in the middle.
- For mappings, the slot determines key hashing — moving the mapping reinterprets every key.
- Use OpenZeppelin's `@openzeppelin/upgrades-core` plugin (`forge upgrade` / Hardhat upgrades) to verify storage compatibility before deploying.

## Pause Mechanisms and the Censorship Tradeoff

OpenZeppelin's `Pausable` lets privileged callers freeze state-changing functions. Useful for emergency response. Bad for users if the pause key is a single hot wallet that can permanently freeze withdrawals.

CROPS framing (Censorship-Resistance, Open-source, Permissionless-access, Self-custody) treats every privileged path as a censorship vector. A `Pausable` + `onlyOwner` setup means the owner can deny service to any user at any time.

Mitigations:

- Split pause into "pause new entries" and "pause withdrawals". Never let the admin pause withdrawals indefinitely.
- Make the pauser a separate role from the admin. Pause should be fast; unpause can be slower (e.g., timelocked).
- Add an automatic unblock of withdrawals after `MAX_PAUSE_WINDOW` so users can never be permanently locked out.
- Consider not adding pause at all for genuinely-immutable contracts. Once a protocol is large enough, "we can't pause" is a feature.

```solidity
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract VaultWithBoundedPause is Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public pauseExpiry;
    uint256 public constant MAX_PAUSE_WINDOW = 7 days;

    function emergencyPause() external onlyRole(PAUSER_ROLE) {
        _pause();
        pauseExpiry = block.timestamp + MAX_PAUSE_WINDOW;
    }

    modifier whenNotPausedOrExpired() {
        require(!paused() || block.timestamp >= pauseExpiry, "paused");
        _;
    }

    // Withdraw works once pause expires even without admin action
    function withdraw(uint256 amount) external whenNotPausedOrExpired { /* ... */ }

    // Deposit blocked while paused, no auto-resume
    function deposit(uint256 amount) external whenNotPaused { /* ... */ }
}
```

## Real Cases

| Year | Protocol | Bug class | Lesson |
|---|---|---|---|
| 2022 | Audius | Initializer-protection bug; attacker re-initialized the governance proxy | Always `_disableInitializers()` on implementations; never expose initializers without guards |
| 2022 | Wormhole | Signature verification bypass — guardian set check skipped via uninitialized variable | Defaults are unsafe; explicitly verify every check path |
| 2022 | Beanstalk | Governance attack via flash loan to acquire voting power | Voting weight should not be readable from spot DEX state; use TWAP / snapshot |
| 2023 | LI.FI | Missing access check on a privileged swap function | Every privileged function needs an explicit modifier; no "everyone calls this" path |

Pattern: every entry above is "missing or wrong access check / initializer guard". Audit checklists exist precisely because these are easy to miss.

## Pre-Deploy Proxy + Access Checklist

- [ ] `Ownable2Step` (or two-step equivalent on `AccessControl` admin transfers) is used everywhere ownership can change.
- [ ] No EOA holds a privileged role on a production contract. Multisig + timelock for material ops.
- [ ] `DEFAULT_ADMIN_ROLE` lives on a multisig; sub-roles are split by duty.
- [ ] `renounceOwnership` is either disabled, or its consequences are documented.
- [ ] Every privileged function has an explicit modifier; no "external" without a check.
- [ ] On UUPS proxies, `_authorizeUpgrade` is overridden and gated.
- [ ] On UUPS proxies, the implementation constructor calls `_disableInitializers()`.
- [ ] `initialize` uses `initializer`; subsequent migrations use `reinitializer(N)`.
- [ ] All inherited `__X_init` parent initializers (e.g. `__Ownable_init`, `__ReentrancyGuard_init`, `__Pausable_init`, `__UUPSUpgradeable_init`) are invoked in the correct order inside the child `initialize`.
- [ ] Storage layout uses ERC-7201 namespaced slots (or storage gaps with the OZ upgrade plugin verifying layout).
- [ ] `forge upgrade` / Hardhat upgrades plugin is run before every upgrade and reports no layout violations.
- [ ] Pause is split into pause-deposit and pause-withdraw, or auto-expires, or is absent.
- [ ] Initial admin is a Safe with at least 3-of-5; signers are documented.
- [ ] Timelock minimum delay is set; emergency pause has a separate, faster role.
- [ ] Any "set fee receiver", "set oracle", "set treasury" function emits an event.
- [ ] Final check: deploy a copy on a testnet, simulate upgrade end-to-end, verify state survives.
