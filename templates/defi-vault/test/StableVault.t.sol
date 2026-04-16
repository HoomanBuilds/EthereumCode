// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StableVault} from "../src/StableVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function mint(address to, uint256 amt) external { _mint(to, amt); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract StableVaultTest is Test {
    StableVault vault;
    MockUSDC usdc;
    address owner = address(0xA11CE);
    address alice = address(0xBEEF);
    address bob = address(0xCAFE);

    function setUp() public {
        usdc = new MockUSDC();
        vault = new StableVault(IERC20(address(usdc)), "Stable Vault", "svUSDC", 1_000_000e6, owner);
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);
    }

    function test_deposit_mintsShares() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        uint256 shares = vault.deposit(1_000e6, alice);
        vm.stopPrank();
        assertEq(shares, 1_000e6);
        assertEq(vault.balanceOf(alice), 1_000e6);
        assertEq(vault.totalAssets(), 1_000e6);
    }

    function test_withdraw_returnsPrincipal() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vault.deposit(1_000e6, alice);
        uint256 shares = vault.withdraw(1_000e6, alice, alice);
        vm.stopPrank();
        assertEq(shares, 1_000e6);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(alice), 10_000e6);
    }

    function test_depositCap_blocksOverflow() public {
        // Cap is 1_000_000e6 in setUp.
        vm.startPrank(alice);
        usdc.mint(alice, 1_500_000e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(900_000e6, alice);
        vm.expectRevert(StableVault.DepositCapExceeded.selector);
        vault.deposit(200_000e6, alice);
        vm.stopPrank();
    }

    function test_strategyRotation_respectsTimelock() public {
        address strat1 = address(0x1111);
        vm.prank(owner);
        vault.proposeStrategy(strat1);
        vm.prank(owner);
        vm.expectRevert(StableVault.TimelockPending.selector);
        vault.rotateStrategy();

        vm.warp(block.timestamp + 48 hours + 1);
        vm.prank(owner);
        vault.rotateStrategy();
        assertEq(vault.strategy(), strat1);
    }

    function test_mint_mintsShares() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        uint256 assets = vault.mint(1_000e6, alice);
        vm.stopPrank();
        assertEq(assets, 1_000e6);
        assertEq(vault.balanceOf(alice), 1_000e6);
    }

    function test_redeem_returnsAssets() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vault.deposit(1_000e6, alice);
        uint256 assets = vault.redeem(1_000e6, alice, alice);
        vm.stopPrank();
        assertEq(assets, 1_000e6);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(usdc.balanceOf(alice), 10_000e6);
    }

    function test_mintCap_blocksOverflow() public {
        vm.startPrank(alice);
        usdc.mint(alice, 1_500_000e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.mint(900_000e6, alice);
        vm.expectRevert(StableVault.DepositCapExceeded.selector);
        vault.mint(200_000e6, alice);
        vm.stopPrank();
    }

    function test_pause_blocksDeposits() public {
        vm.prank(owner);
        vault.pause();
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vm.expectRevert();
        vault.deposit(1_000e6, alice);
        vm.stopPrank();
    }

    function test_pause_blocksMint() public {
        vm.prank(owner);
        vault.pause();
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vm.expectRevert();
        vault.mint(1_000e6, alice);
        vm.stopPrank();
    }

    function test_pause_blocksWithdraw() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vault.deposit(1_000e6, alice);
        vm.stopPrank();

        vm.prank(owner);
        vault.pause();

        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(1_000e6, alice, alice);
    }

    function test_pause_blocksRedeem() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        vault.deposit(1_000e6, alice);
        vm.stopPrank();

        vm.prank(owner);
        vault.pause();

        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(1_000e6, alice, alice);
    }

    function test_maxDeposit_respectsCap() public {
        assertEq(vault.maxDeposit(alice), 1_000_000e6);
        vm.startPrank(alice);
        usdc.mint(alice, 600_000e6);
        usdc.approve(address(vault), 600_000e6);
        vault.deposit(600_000e6, alice);
        vm.stopPrank();
        assertEq(vault.maxDeposit(alice), 400_000e6);
    }

    function test_maxDeposit_zeroWhenPaused() public {
        vm.prank(owner);
        vault.pause();
        assertEq(vault.maxDeposit(alice), 0);
        assertEq(vault.maxMint(alice), 0);
        assertEq(vault.maxWithdraw(alice), 0);
        assertEq(vault.maxRedeem(alice), 0);
    }

    function testFuzz_shareAccounting(uint96 a1, uint96 a2) public {
        a1 = uint96(bound(a1, 1e6, 9_000e6));
        a2 = uint96(bound(a2, 1e6, 9_000e6));

        vm.startPrank(alice);
        usdc.approve(address(vault), a1);
        vault.deposit(a1, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), a2);
        vault.deposit(a2, bob);
        vm.stopPrank();

        assertEq(vault.totalAssets(), uint256(a1) + uint256(a2));
        assertEq(vault.balanceOf(alice) + vault.balanceOf(bob), vault.totalSupply());
    }
}
