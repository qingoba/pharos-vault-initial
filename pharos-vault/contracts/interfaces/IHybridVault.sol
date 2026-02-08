// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IHybridVault
 * @notice Hybrid Vault 标准接口 — 同时支持同步(ERC4626)和异步(ERC7540)策略
 * @dev 任何资产实现 ISyncStrategy 或 IAsyncStrategy 即可接入
 *      Vault 的 share 是 ERC20，可作为其他协议的底层资产（Vault 套 Vault）
 */
interface IHybridVault {
    // asset(), totalAssets(), convertToShares(), convertToAssets(), deposit(), withdraw(), redeem()
    // 由 ERC4626 提供，此处不重复声明

    // ======================== 策略注册 ========================

    function addSyncStrategy(address strategy, uint256 debtRatio) external;
    function addAsyncStrategy(address strategy, uint256 debtRatio) external;
    function removeSyncStrategy(address strategy) external;
    function removeAsyncStrategy(address strategy) external;
    function getSyncStrategies() external view returns (address[] memory);
    function getAsyncStrategies() external view returns (address[] memory);
    function syncTotalRatio() external view returns (uint256);
    function asyncTotalRatio() external view returns (uint256);

    // ======================== 异步操作（ERC7540 风格）========================

    function claimAsyncShares(address receiver) external returns (uint256 shares);
    function claimAsyncAssets(address receiver) external returns (uint256 assets);
    function pendingDepositOf(address user) external view returns (uint256 assets);
    function claimableSharesOf(address user) external view returns (uint256 shares);
    function pendingRedeemOf(address user) external view returns (uint256 shares);
    function claimableAssetsOf(address user) external view returns (uint256 assets);

    // ======================== 管理员操作 ========================

    function allocateToSyncStrategy(address strategy, uint256 amount) external;
    function harvestSyncStrategy(address strategy) external;
    function harvestAll() external;

    // ======================== 事件 ========================

    event SyncDeposit(address indexed user, uint256 assets, uint256 shares);
    event AsyncDepositRequested(address indexed user, uint256 assets);
    event AsyncSharesClaimed(address indexed user, uint256 shares);
    event SyncWithdraw(address indexed user, uint256 assets, uint256 shares);
    event AsyncRedeemRequested(address indexed user, uint256 shares);
    event AsyncAssetsClaimed(address indexed user, uint256 assets);
    event SyncStrategyAdded(address indexed strategy, uint256 debtRatio);
    event AsyncStrategyAdded(address indexed strategy, uint256 debtRatio);
    event StrategyRemoved(address indexed strategy);
}
