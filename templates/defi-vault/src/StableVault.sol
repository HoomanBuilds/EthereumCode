// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title StableVault — ERC-4626 vault skeleton shipped by ethereum.new
/// @notice Deposit a stablecoin, receive shares, accrue yield from a strategy hook.
///         The strategy is an external address that can be set once by the owner and
///         rotated via a 48h timelock to protect depositors.
/// @dev Invariant: totalAssets() == underlying.balanceOf(address(this)) + reportedStrategyBalance.
contract StableVault is ERC4626, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant STRATEGY_ROTATION_DELAY = 48 hours;
    uint256 public immutable depositCap;

    address public strategy;
    address public pendingStrategy;
    uint256 public pendingStrategyAt;
    uint256 public reportedStrategyBalance;

    event StrategyProposed(address indexed strategy, uint256 effectiveAt);
    event StrategyRotated(address indexed oldStrategy, address indexed newStrategy);
    event StrategyReported(uint256 balance);
    event DepositCapHit(uint256 cap, uint256 attempted);

    error DepositCapExceeded();
    error TimelockPending();
    error ZeroAddress();

    constructor(IERC20 asset_, string memory name_, string memory symbol_, uint256 depositCap_, address owner_)
        ERC4626(asset_)
        ERC20(name_, symbol_)
        Ownable(owner_)
    {
        if (owner_ == address(0)) revert ZeroAddress();
        depositCap = depositCap_;
    }

    // -- core --------------------------------------------------------------

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + reportedStrategyBalance;
    }

    function deposit(uint256 assets, address receiver)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        if (totalAssets() + assets > depositCap) {
            emit DepositCapHit(depositCap, assets);
            revert DepositCapExceeded();
        }
        shares = super.deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        shares = super.withdraw(assets, receiver, owner_);
    }

    // -- strategy rotation (timelocked) ------------------------------------

    function proposeStrategy(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        pendingStrategy = next;
        pendingStrategyAt = block.timestamp + STRATEGY_ROTATION_DELAY;
        emit StrategyProposed(next, pendingStrategyAt);
    }

    function rotateStrategy() external onlyOwner {
        if (pendingStrategyAt == 0 || block.timestamp < pendingStrategyAt) revert TimelockPending();
        address old = strategy;
        strategy = pendingStrategy;
        pendingStrategy = address(0);
        pendingStrategyAt = 0;
        emit StrategyRotated(old, strategy);
    }

    /// @notice Strategy reports its custody balance. Only the strategy can call.
    function report(uint256 balance) external {
        require(msg.sender == strategy, "not strategy");
        reportedStrategyBalance = balance;
        emit StrategyReported(balance);
    }

    // -- safety valves -----------------------------------------------------

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
