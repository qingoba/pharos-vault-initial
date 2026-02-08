// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAssetSwapRouter
 * @notice Minimal swap router interface used by PharosVault for multi-asset deposits.
 */
interface IAssetSwapRouter {
    /**
     * @notice Quote output amount for an exact-input swap.
     */
    function quoteExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    /**
     * @notice Swap an exact `amountIn` and return output amount.
     * @dev `receiver` should receive `tokenOut`.
     */
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address receiver
    ) external returns (uint256 amountOut);
}

