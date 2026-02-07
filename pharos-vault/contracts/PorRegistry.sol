// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IZkPorVerifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PorRegistry
 * @notice On-chain registry for zk-Proof-of-Reserve attestations.
 *
 * Flow:
 *   1. Off-chain prover generates a zk-SNARK that proves
 *      totalReserves >= totalLiabilities without revealing individual
 *      positions (privacy preserving).
 *   2. Attester calls `submitProof()` with the proof + public inputs.
 *   3. The contract verifies via `IZkPorVerifier` and stores the result.
 *   4. Anyone can call `latestProof()` / `isHealthy()` to check status.
 *   5. The frontend reads `ProofSubmitted` events for history.
 */
contract PorRegistry is Ownable {
    // ======================== Types ========================
    struct ProofRecord {
        uint256 timestamp;
        uint256 totalReserves;
        uint256 totalLiabilities;
        bytes32 merkleRoot;
        bool    verified;
        address attester;
    }

    // ======================== State ========================
    IZkPorVerifier public verifier;
    ProofRecord[] public proofs;
    mapping(address => bool) public allowedAttesters;

    // ======================== Events ========================
    event ProofSubmitted(
        uint256 indexed proofId,
        uint256 totalReserves,
        uint256 totalLiabilities,
        bytes32 merkleRoot,
        bool    verified,
        address indexed attester,
        uint256 timestamp
    );
    event VerifierUpdated(address indexed newVerifier);
    event AttesterUpdated(address indexed attester, bool allowed);

    // ======================== Errors ========================
    error Unauthorized();
    error VerifierNotSet();

    // ======================== Constructor ========================
    constructor(address _verifier) Ownable(msg.sender) {
        verifier = IZkPorVerifier(_verifier);
        allowedAttesters[msg.sender] = true;
    }

    // ======================== Write ========================

    /**
     * @notice Submit a zk proof-of-reserves attestation.
     * @param proof         Raw proof bytes.
     * @param publicInputs  ABI-encoded (totalReserves, totalLiabilities, merkleRoot).
     */
    function submitProof(
        bytes calldata proof,
        bytes calldata publicInputs
    ) external {
        if (!allowedAttesters[msg.sender]) revert Unauthorized();
        if (address(verifier) == address(0)) revert VerifierNotSet();

        (uint256 reserves, uint256 liabilities, bytes32 root) =
            abi.decode(publicInputs, (uint256, uint256, bytes32));

        bool ok = verifier.verify(proof, publicInputs);

        uint256 proofId = proofs.length;
        proofs.push(ProofRecord({
            timestamp: block.timestamp,
            totalReserves: reserves,
            totalLiabilities: liabilities,
            merkleRoot: root,
            verified: ok,
            attester: msg.sender
        }));

        emit ProofSubmitted(
            proofId, reserves, liabilities, root, ok, msg.sender, block.timestamp
        );
    }

    // ======================== Admin ========================

    function setVerifier(address _v) external onlyOwner {
        verifier = IZkPorVerifier(_v);
        emit VerifierUpdated(_v);
    }

    function setAttester(address _a, bool _allowed) external onlyOwner {
        allowedAttesters[_a] = _allowed;
        emit AttesterUpdated(_a, _allowed);
    }

    // ======================== View ========================

    function proofCount() external view returns (uint256) { return proofs.length; }

    function latestProof() external view returns (ProofRecord memory) {
        require(proofs.length > 0, "No proofs");
        return proofs[proofs.length - 1];
    }

    /// @notice Returns true when the latest verified proof shows reserves >= liabilities.
    function isHealthy() external view returns (bool) {
        if (proofs.length == 0) return false;
        ProofRecord memory p = proofs[proofs.length - 1];
        return p.verified && p.totalReserves >= p.totalLiabilities;
    }
}
