// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStrategy
 * @author Pharos Team
 * @notice 策略接口定义
 * @dev Vault 通过此接口与策略交互
 */
interface IStrategy {
    // ============== 视图函数 ==============
    
    /// @notice 获取策略名称
    function name() external view returns (string memory);
    
    /// @notice 获取关联的 Vault 地址
    function vault() external view returns (address);
    
    /// @notice 获取底层资产地址
    function asset() external view returns (address);
    
    /// @notice 获取策略管理的总资产
    function totalAssets() external view returns (uint256);
    
    /// @notice 检查策略是否活跃
    function isActive() external view returns (bool);
    
    /// @notice 获取预估的年化收益率 (基点)
    function estimatedAPY() external view returns (uint256);
    
    /// @notice 检查是否需要收获
    function harvestTrigger() external view returns (bool);

    // ============== 操作函数 ==============
    
    /// @notice 投资资金到目标协议
    function invest() external;
    
    /// @notice 收获收益
    /// @return profit 本次收获的收益
    function harvest() external returns (uint256 profit);
    
    /// @notice 从策略中提取资金
    /// @param _amount 需要提取的金额
    /// @return 实际提取的金额
    function withdraw(uint256 _amount) external returns (uint256);
    
    /// @notice 紧急提取所有资金
    function emergencyWithdraw() external;
    
    /// @notice 迁移到新策略
    /// @param _newStrategy 新策略地址
    function migrate(address _newStrategy) external;

    // ============== 事件 ==============
    
    event Invested(uint256 amount);
    event Harvested(uint256 profit);
    event Withdrawn(uint256 amount);
    event EmergencyWithdrawn(uint256 amount);
    event Migrated(address newStrategy);
}
