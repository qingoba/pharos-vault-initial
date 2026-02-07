// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title PharosTimelock
 * @notice Timelock controller for governance over the PharosVault.
 *         Admin operations (fee changes, strategy add/remove, emergency)
 *         can be delayed to give users an exit window.
 *
 * Default: 24 h delay, deployer as proposer + executor, zero address
 * as executor allows anyone to execute once the delay passes.
 */
contract PharosTimelock is TimelockController {
    /**
     * @param minDelay    Minimum delay in seconds (e.g. 86400 = 24 h)
     * @param proposers   Addresses that can propose operations
     * @param executors   Addresses that can execute ready operations
     *                    (address(0) = anyone can execute)
     * @param admin       Optional admin for managing roles; address(0) to renounce
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}
