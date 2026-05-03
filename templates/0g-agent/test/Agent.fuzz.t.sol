// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Agent.sol";

contract AgentFuzzTest is Test {
    Agent public agent;

    function setUp() public {
        agent = new Agent();
    }

    function testFuzzRegisterAndExecute(address _user, string memory _hash) public {
        vm.assume(_user != address(0));
        vm.assume(bytes(_hash).length > 0 && bytes(_hash).length <= 64);

        vm.prank(_user);
        agent.registerAgent(_hash);

        (, string memory storedHash, uint256 execCount, , bool isActive) = agent.getAgent(_user);

        assertEq(storedHash, _hash);
        assertEq(execCount, 0);
        assertTrue(isActive);

        vm.prank(_user);
        agent.execute(_user, bytes32(uint256(1)));

        (, , execCount, , ) = agent.getAgent(_user);
        assertEq(execCount, 1);
    }

    function testFuzzUpdateMemory(address _user, string memory _oldHash, string memory _newHash) public {
        vm.assume(_user != address(0));
        vm.assume(bytes(_oldHash).length > 0 && bytes(_oldHash).length <= 64);
        vm.assume(bytes(_newHash).length > 0 && bytes(_newHash).length <= 64);
        vm.assume(keccak256(bytes(_oldHash)) != keccak256(bytes(_newHash)));

        vm.prank(_user);
        agent.registerAgent(_oldHash);

        vm.prank(_user);
        agent.updateMemory(_newHash);

        (, string memory storedHash, , , ) = agent.getAgent(_user);
        assertEq(storedHash, _newHash);
    }

    function testFuzzMultipleAgents(uint8 _count) public {
        vm.assume(_count > 0 && _count < 10);

        for (uint8 i = 0; i < _count; i++) {
            address user = address(uint160(i + 1));
            string memory hash = string(abi.encodePacked("hash", i));

            vm.prank(user);
            agent.registerAgent(hash);
        }

        assertEq(agent.getAgentCount(), _count);
    }
}
