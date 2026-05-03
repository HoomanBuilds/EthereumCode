// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Agent.sol";

contract AgentTest is Test {
    Agent public agent;
    address public user1 = address(0x1);
    address public user2 = address(0x2);

    function setUp() public {
        agent = new Agent();
    }

    function testRegisterAgent() public {
        vm.prank(user1);
        agent.registerAgent("QmTestHash123");

        (address agentAddr, string memory memoryHash, uint256 execCount, , bool isActive) = agent.getAgent(user1);

        assertEq(agentAddr, user1);
        assertEq(execCount, 0);
        assertTrue(isActive);
    }

    function testCannotRegisterTwice() public {
        vm.prank(user1);
        agent.registerAgent("QmTestHash123");

        vm.prank(user1);
        vm.expectRevert("Agent already registered");
        agent.registerAgent("QmTestHash456");
    }

    function testExecuteAgent() public {
        vm.prank(user1);
        agent.registerAgent("QmTestHash123");

        vm.prank(user1);
        agent.execute(user1, bytes32(uint256(1)));

        (, , uint256 execCount, uint256 lastExec, ) = agent.getAgent(user1);

        assertEq(execCount, 1);
        assertGt(lastExec, 0);
    }

    function testUpdateMemory() public {
        vm.prank(user1);
        agent.registerAgent("QmTestHash123");

        vm.prank(user1);
        agent.updateMemory("QmNewHash456");

        (, string memory memoryHash, , , ) = agent.getAgent(user1);
        assertEq(memoryHash, "QmNewHash456");
    }

    function testPauseUnpause() public {
        vm.prank(user1);
        agent.registerAgent("QmTestHash123");

        agent.pauseAgent(user1);

        (, , , , bool isActive) = agent.getAgent(user1);
        assertFalse(isActive);

        agent.unpauseAgent(user1);

        (, , , , isActive) = agent.getAgent(user1);
        assertTrue(isActive);
    }

    function testCannotExecutePausedAgent() public {
        vm.prank(user1);
        agent.registerAgent("QmTestHash123");

        agent.pauseAgent(user1);

        vm.prank(user1);
        vm.expectRevert();
        agent.execute(user1, bytes32(uint256(1)));
    }

    function testGetAgentCount() public {
        assertEq(agent.getAgentCount(), 0);

        vm.prank(user1);
        agent.registerAgent("QmTestHash123");

        vm.prank(user2);
        agent.registerAgent("QmTestHash456");

        assertEq(agent.getAgentCount(), 2);
    }
}
