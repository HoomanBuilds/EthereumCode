// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Agent
 * @notice Onchain agent registry and execution tracker
 * @dev Offchain agent logic uses 0G Compute for inference and 0G Storage KV for memory
 */
contract Agent is Ownable, Pausable {
    struct AgentState {
        address agentAddress;
        string memoryRootHash;
        uint256 executionCount;
        uint256 lastExecution;
        bool isActive;
    }

    mapping(address => AgentState) public agents;
    address[] public agentList;

    event AgentRegistered(address agent, string memoryRootHash);
    event AgentExecuted(address agent, uint256 executionCount, bytes32 resultHash);
    event MemoryUpdated(address agent, string newMemoryRootHash);
    event AgentPaused(address agent);
    event AgentUnpaused(address agent);

    constructor() Ownable(msg.sender) {}

    function registerAgent(string memory _memoryRootHash) external {
        require(!agents[msg.sender].isActive, "Agent already registered");
        require(bytes(_memoryRootHash).length > 0, "Invalid memory root hash");

        agents[msg.sender] = AgentState({
            agentAddress: msg.sender,
            memoryRootHash: _memoryRootHash,
            executionCount: 0,
            lastExecution: 0,
            isActive: true
        });

        agentList.push(msg.sender);
        emit AgentRegistered(msg.sender, _memoryRootHash);
    }

    function execute(address _agent, bytes32 _resultHash) external whenNotPaused {
        require(agents[_agent].isActive, "Agent not active");
        require(_agent == msg.sender || msg.sender == owner(), "Unauthorized");

        agents[_agent].executionCount++;
        agents[_agent].lastExecution = block.timestamp;

        emit AgentExecuted(_agent, agents[_agent].executionCount, _resultHash);
    }

    function updateMemory(string memory _newMemoryRootHash) external {
        require(agents[msg.sender].isActive, "Agent not active");
        require(bytes(_newMemoryRootHash).length > 0, "Invalid memory root hash");

        agents[msg.sender].memoryRootHash = _newMemoryRootHash;
        emit MemoryUpdated(msg.sender, _newMemoryRootHash);
    }

    function pauseAgent(address _agent) external onlyOwner {
        require(agents[_agent].isActive, "Agent not active");
        agents[_agent].isActive = false;
        emit AgentPaused(_agent);
    }

    function unpauseAgent(address _agent) external onlyOwner {
        require(!agents[_agent].isActive, "Agent already active");
        agents[_agent].isActive = true;
        emit AgentUnpaused(_agent);
    }

    function getAgent(address _agent) external view returns (
        address agentAddress,
        string memory memoryRootHash,
        uint256 executionCount,
        uint256 lastExecution,
        bool isActive
    ) {
        AgentState memory state = agents[_agent];
        return (
            state.agentAddress,
            state.memoryRootHash,
            state.executionCount,
            state.lastExecution,
            state.isActive
        );
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }
}
