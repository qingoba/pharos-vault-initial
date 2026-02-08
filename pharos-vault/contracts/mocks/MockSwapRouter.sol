// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IAssetSwapRouter.sol";

/**
 * @title MockSwapRouter
 * @notice Test-only swap router with configurable fixed rates.
 * @dev Rate precision is 1e18: amountOut = amountIn * rate / 1e18.
 */
contract MockSwapRouter is IAssetSwapRouter, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant RATE_PRECISION = 1e18;

    struct Route {
        uint256 rate;
        bool enabled;
    }

    mapping(bytes32 => Route) public routes;

    event RouteUpdated(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 rate,
        bool enabled
    );

    constructor() Ownable(msg.sender) {}

    function setRoute(
        address tokenIn,
        address tokenOut,
        uint256 rate,
        bool enabled
    ) external onlyOwner {
        bytes32 routeKey = _key(tokenIn, tokenOut);
        routes[routeKey] = Route({rate: rate, enabled: enabled});
        emit RouteUpdated(tokenIn, tokenOut, rate, enabled);
    }

    function quoteExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        if (tokenIn == tokenOut) return amountIn;

        Route memory route = routes[_key(tokenIn, tokenOut)];
        if (!route.enabled || route.rate == 0) return 0;

        return (amountIn * route.rate) / RATE_PRECISION;
    }

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address receiver
    ) external override returns (uint256 amountOut) {
        require(receiver != address(0), "Invalid receiver");
        require(amountIn > 0, "Zero amount");

        if (tokenIn == tokenOut) {
            amountOut = amountIn;
            require(amountOut >= minAmountOut, "Slippage too high");

            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenOut).safeTransfer(receiver, amountOut);
            return amountOut;
        }

        Route memory route = routes[_key(tokenIn, tokenOut)];
        require(route.enabled && route.rate > 0, "Route not configured");

        amountOut = (amountIn * route.rate) / RATE_PRECISION;
        require(amountOut >= minAmountOut, "Slippage too high");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(receiver, amountOut);
    }

    function _key(address tokenIn, address tokenOut) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenIn, tokenOut));
    }
}

