// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MemoryRegistry
 * @notice Tracks memory root hashes for agents using 0G Storage KV
 * @dev Offchain memory is stored in 0G Storage, onchain contract stores pointer
 */
contract MemoryRegistry is Ownable {
    struct MemoryEntry {
        string memoryRootHash;
        uint256 lastUpdate;
        uint256 updateCount;
        bool exists;
    }

    mapping(address => MemoryEntry) public memoryEntries;
    mapping(string => bool) public usedHashes;

    event MemoryRegistered(address agent, string memoryRootHash);
    event MemoryUpdated(address agent, string oldHash, string newHash, uint256 updateCount);

    constructor() Ownable(msg.sender) {}

    function registerMemory(string memory _memoryRootHash) external {
        require(!memoryEntries[msg.sender].exists, "Memory already registered");
        require(bytes(_memoryRootHash).length > 0, "Invalid hash");
        require(!usedHashes[_memoryRootHash], "Hash already used");

        memoryEntries[msg.sender] = MemoryEntry({
            memoryRootHash: _memoryRootHash,
            lastUpdate: block.timestamp,
            updateCount: 1,
            exists: true
        });

        usedHashes[_memoryRootHash] = true;
        emit MemoryRegistered(msg.sender, _memoryRootHash);
    }

    function updateMemory(string memory _newMemoryRootHash) external {
        require(memoryEntries[msg.sender].exists, "Memory not registered");
        require(bytes(_newMemoryRootHash).length > 0, "Invalid hash");
        require(!usedHashes[_newMemoryRootHash], "Hash already used");

        string memory oldHash = memoryEntries[msg.sender].memoryRootHash;
        memoryEntries[msg.sender].memoryRootHash = _newMemoryRootHash;
        memoryEntries[msg.sender].lastUpdate = block.timestamp;
        memoryEntries[msg.sender].updateCount++;

        usedHashes[_newMemoryRootHash] = true;
        emit MemoryUpdated(msg.sender, oldHash, _newMemoryRootHash, memoryEntries[msg.sender].updateCount);
    }

    function getMemory(address _agent) external view returns (
        string memory memoryRootHash,
        uint256 lastUpdate,
        uint256 updateCount,
        bool exists
    ) {
        MemoryEntry memory entry = memoryEntries[_agent];
        return (entry.memoryRootHash, entry.lastUpdate, entry.updateCount, entry.exists);
    }
}
