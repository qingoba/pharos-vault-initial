// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IZkPorVerifier
 * @notice Interface for a zk-SNARK Proof-of-Reserve verifier.
 *         Implementations can wrap Groth16, PLONK, or any zk system.
 */
interface IZkPorVerifier {
    /**
     * @notice Verify a zk proof of reserves.
     * @param proof      The serialised proof bytes (system-specific).
     * @param publicInputs ABI-encoded public inputs:
     *        (uint256 totalReserves, uint256 totalLiabilities, bytes32 merkleRoot)
     * @return valid  True if the proof is valid and reserves >= liabilities.
     */
    function verify(
        bytes calldata proof,
        bytes calldata publicInputs
    ) external view returns (bool valid);
}
