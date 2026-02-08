// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAsyncStrategy
 * @notice 异步策略接口（ERC7540 风格）— 用于 RWA 等需要链下处理的资产
 * @dev 流程: requestDeposit → [链下处理] → fulfillDeposit → claimShares
 */
interface IAsyncStrategy {
    // ======================== 视图 ========================

    function name() external view returns (string memory);
    function vault() external view returns (address);
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function isActive() external view returns (bool);
    function estimatedAPY() external view returns (uint256);

    // ======================== 异步 Deposit ========================

    function requestDeposit(uint256 assets, address depositor) external returns (uint256 requestId);
    function pendingDeposit(address depositor) external view returns (uint256 assets);
    function claimableShares(address depositor) external view returns (uint256 shares);
    function claimShares(address depositor) external returns (uint256 shares);

    // ======================== 异步 Redeem ========================

    function requestRedeem(uint256 shares, address redeemer) external returns (uint256 requestId);
    function pendingRedeem(address redeemer) external view returns (uint256 shares);
    function claimableAssets(address redeemer) external view returns (uint256 assets);
    function claimAssets(address redeemer) external returns (uint256 assets);

    // ======================== 管理员（Operator）========================

    function fulfillDeposit(address depositor, uint256 shares) external;
    function fulfillRedeem(address redeemer, uint256 assets) external;
    function withdrawToOperator(uint256 amount) external returns (uint256);
    function reportNAV(uint256 nav) external;

    // ======================== 事件 ========================

    event DepositRequested(address indexed depositor, uint256 assets, uint256 requestId);
    event DepositFulfilled(address indexed depositor, uint256 shares);
    event RedeemRequested(address indexed redeemer, uint256 shares, uint256 requestId);
    event RedeemFulfilled(address indexed redeemer, uint256 assets);
    event NAVReported(uint256 nav, uint256 timestamp);
    event OperatorWithdraw(uint256 amount);
}
