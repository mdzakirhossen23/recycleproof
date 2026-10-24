// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Demo material custody registry. Does not certify physical recycling.
contract RecycleProof {
    struct Batch {
        address collector;
        address recycler;
        uint256 grams;
        bytes32 collectionHash;
        bytes32 receiptHash;
        bool received;
    }
    mapping(bytes32 => Batch) public batches;
    event Registered(bytes32 indexed batchId, address indexed collector, address indexed recycler, uint256 grams, bytes32 evidenceHash);
    event Received(bytes32 indexed batchId, address indexed recycler, bytes32 evidenceHash);

    function register(bytes32 batchId, address recycler, uint256 grams, bytes32 evidenceHash) external {
        require(batchId != bytes32(0) && evidenceHash != bytes32(0), "Missing evidence");
        require(batches[batchId].collector == address(0), "Batch already exists");
        require(recycler != address(0) && recycler != msg.sender, "Use a separate recycler wallet");
        require(grams > 0 && grams <= 100_000_000, "Invalid weight");
        batches[batchId] = Batch(msg.sender, recycler, grams, evidenceHash, bytes32(0), false);
        emit Registered(batchId, msg.sender, recycler, grams, evidenceHash);
    }

    function confirmReceipt(bytes32 batchId, bytes32 evidenceHash) external {
        Batch storage batch = batches[batchId];
        require(batch.collector != address(0), "Unknown batch");
        require(msg.sender == batch.recycler, "Only nominated recycler");
        require(!batch.received, "Receipt already confirmed");
        require(evidenceHash != bytes32(0), "Missing evidence");
        batch.received = true;
        batch.receiptHash = evidenceHash;
        emit Received(batchId, msg.sender, evidenceHash);
    }
}
