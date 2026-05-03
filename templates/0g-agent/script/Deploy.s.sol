// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Agent.sol";
import "../src/Memory.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Agent agent = new Agent();
        MemoryRegistry memoryRegistry = new MemoryRegistry();

        console.log("Agent deployed to:", address(agent));
        console.log("MemoryRegistry deployed to:", address(memoryRegistry));

        vm.stopBroadcast();
    }
}
