// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice 模拟 USDC 代币，用于测试
 */
contract MockUSDC is ERC20 {
    uint8 private _decimals;

    constructor() ERC20("Mock USDC", "mUSDC") {
        _decimals = 6; // USDC 使用 6 位小数
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice 铸造代币 (仅用于测试)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice 销毁代币
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
