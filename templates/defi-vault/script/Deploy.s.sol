// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StableVault} from "../src/StableVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Deploys StableVault with a configurable underlying asset and cap.
/// Asset and cap are read from env to keep this script reusable across chains.
///
///   forge script script/Deploy.s.sol \
///     --rpc-url $RPC --broadcast --slow --verify
///
/// Required env:
///   VAULT_ASSET       address of the underlying ERC-20 (e.g. USDC)
///   VAULT_NAME        human-readable name for the share token
///   VAULT_SYMBOL      symbol for the share token
///   VAULT_CAP         deposit cap in asset units
///   VAULT_OWNER       address that will own the vault (multisig recommended)
contract Deploy is Script {
    function run() external returns (StableVault vault) {
        address asset = vm.envAddress("VAULT_ASSET");
        string memory name = vm.envString("VAULT_NAME");
        string memory symbol = vm.envString("VAULT_SYMBOL");
        uint256 cap = vm.envUint("VAULT_CAP");
        address owner = vm.envAddress("VAULT_OWNER");

        vm.startBroadcast();
        vault = new StableVault(IERC20(asset), name, symbol, cap, owner);
        vm.stopBroadcast();

        console.log("StableVault deployed:", address(vault));
    }
}
