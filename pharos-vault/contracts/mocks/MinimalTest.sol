// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MinimalTest
 * @notice Simplest possible contract to test deployment
 */
contract MinimalTest {
    uint256 public value;
    
    constructor() {
        value = 42;
    }
}
