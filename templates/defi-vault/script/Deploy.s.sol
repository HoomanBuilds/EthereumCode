// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StableVault} from "../src/StableVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Deploys StableVault with a configurable underlying asset and cap.
/// Asset and cap are read from env to keep this script reusable across chains.
/// Falls back to sensible defaults for testnet deploys.
///
///   forge script script/Deploy.s.sol \
///     --rpc-url $RPC --broadcast --slow --verify
///
/// Required env (or defaults used for testnet):
///   VAULT_ASSET       address of the underlying ERC-20 (default: 0x036CbD53842c5426634e7929541eC2318f3dCF7e on base sepolia)
///   VAULT_NAME        human-readable name (default: "Stablecoin Vault")
///   VAULT_SYMBOL      symbol (default: "scUSD")
///   VAULT_CAP         deposit cap in asset units (default: 1000000e6)
///   VAULT_OWNER       deployer owns if not set
contract Deploy is Script {
    function run() external returns (StableVault vault) {
        address asset = vm.envOr("VAULT_ASSET", address(0x036CbD53842c5426634e7929541eC2318f3dCF7e));
        string memory name = vm.envOr("VAULT_NAME", string("Stablecoin Vault"));
        string memory symbol = vm.envOr("VAULT_SYMBOL", string("scUSD"));
        uint256 cap = vm.envOr("VAULT_CAP", uint256(1000000e6));
        address owner = vm.envOr("VAULT_OWNER", msg.sender);

        vm.startBroadcast();
        vault = new StableVault(IERC20(asset), name, symbol, cap, owner);
        vm.stopBroadcast();

        console.log("StableVault deployed:", address(vault));
    }
}
