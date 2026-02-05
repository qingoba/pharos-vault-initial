// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IStrategy.sol";

/**
 * @title BaseStrategy
 * @author Pharos Team
 * @notice 策略基类，包含所有策略的通用逻辑
 * @dev 继承此合约来实现具体的收益策略
 * 
 * 策略工作流程:
 * 1. Vault 调用 invest() 将资金投入目标协议
 * 2. Keeper 定期调用 harvest() 收获收益
 * 3. Vault 调用 withdraw() 按需提取资金
 * 4. 紧急情况下调用 emergencyWithdraw()
 */
abstract contract BaseStrategy is IStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============== 状态变量 ==============
    
    /// @notice 策略名称
    string public override name;
    
    /// @notice 关联的 Vault 地址
    address public immutable override vault;
    
    /// @notice 底层资产
    IERC20 public immutable want;
    
    /// @notice Keeper 地址 (可以调用 harvest)
    address public keeper;
    
    /// @notice 策略是否活跃
    bool public override isActive;
    
    /// @notice 紧急模式
    bool public emergencyMode;
    
    /// @notice 上次收获时间
    uint256 public lastHarvest;
    
    /// @notice 最小收获间隔 (秒)
    uint256 public minHarvestInterval;
    
    /// @notice 累计收益
    uint256 public totalProfit;

    // ============== 修饰符 ==============
    
    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }
    
    modifier onlyKeeper() {
        require(
            msg.sender == keeper || 
            msg.sender == owner() || 
            msg.sender == vault, 
            "Only keeper"
        );
        _;
    }
    
    modifier onlyActive() {
        require(isActive && !emergencyMode, "Strategy not active");
        _;
    }

    // ============== 构造函数 ==============

    /**
     * @notice 初始化基础策略
     * @param _vault Vault 地址
     * @param _asset 底层资产地址
     * @param _name 策略名称
     */
    constructor(
        address _vault,
        address _asset,
        string memory _name
    ) Ownable(msg.sender) {
        require(_vault != address(0), "Invalid vault");
        require(_asset != address(0), "Invalid asset");
        
        vault = _vault;
        want = IERC20(_asset);
        name = _name;
        keeper = msg.sender;
        isActive = true;
        minHarvestInterval = 1 hours;
        lastHarvest = block.timestamp;
        
        // 授权 Vault 可以拉取资金
        want.forceApprove(_vault, type(uint256).max);
    }

    // ============== 视图函数 ==============

    /**
     * @notice 获取底层资产地址
     */
    function asset() external view override returns (address) {
        return address(want);
    }

    /**
     * @notice 获取策略管理的总资产
     * @dev 子类必须实现此函数
     */
    function totalAssets() public view virtual override returns (uint256);

    /**
     * @notice 获取预估的年化收益率
     * @dev 子类可以重写此函数提供更准确的估算
     */
    function estimatedAPY() external view virtual override returns (uint256) {
        return 0; // 子类实现
    }

    /**
     * @notice 检查是否需要收获
     */
    function harvestTrigger() external view virtual override returns (bool) {
        // 检查时间间隔
        if (block.timestamp - lastHarvest < minHarvestInterval) {
            return false;
        }
        
        // 子类可以添加更多条件
        return _harvestTriggerCheck();
    }

    /**
     * @dev 子类实现收获触发条件
     */
    function _harvestTriggerCheck() internal view virtual returns (bool) {
        return true;
    }

    // ============== 核心操作函数 ==============

    /**
     * @notice 投资资金到目标协议
     * @dev 只有 Vault 可以调用
     */
    function invest() external override onlyVault onlyActive nonReentrant {
        uint256 balance = want.balanceOf(address(this));
        if (balance == 0) return;
        
        _invest(balance);
        
        emit Invested(balance);
    }

    /**
     * @notice 收获收益
     * @dev Keeper 或 Vault 可以调用
     * @return profit 本次收获的收益
     */
    function harvest() external override onlyKeeper nonReentrant returns (uint256 profit) {
        if (!isActive && !emergencyMode) return 0;
        
        // 执行收获逻辑
        profit = _harvest();
        
        totalProfit += profit;
        lastHarvest = block.timestamp;
        
        emit Harvested(profit);
        
        return profit;
    }

    /**
     * @notice 从策略中提取资金
     * @param _amount 需要提取的金额
     * @return 实际提取的金额
     */
    function withdraw(uint256 _amount) 
        external 
        override 
        onlyVault 
        nonReentrant 
        returns (uint256) 
    {
        if (_amount == 0) return 0;
        
        // 总是调用 _withdraw 来更新内部会计
        // 这确保策略的 totalAssets() 正确反映撤回后的状态
        uint256 withdrawn = _withdraw(_amount);
        
        // 检查实际可发送金额
        uint256 balance = want.balanceOf(address(this));
        uint256 toSend = balance < withdrawn ? balance : withdrawn;
        
        // 转给 Vault
        if (toSend > 0) {
            want.safeTransfer(vault, toSend);
        }
        
        emit Withdrawn(toSend);
        
        return toSend;
    }

    /**
     * @notice 紧急提取所有资金
     * @dev 只有 Vault 可以调用
     */
    function emergencyWithdraw() external override onlyVault nonReentrant {
        emergencyMode = true;
        
        // 执行紧急撤回
        uint256 total = _emergencyWithdraw();
        
        // 转移所有资金到 Vault
        uint256 balance = want.balanceOf(address(this));
        if (balance > 0) {
            want.safeTransfer(vault, balance);
        }
        
        isActive = false;
        
        emit EmergencyWithdrawn(total);
    }

    /**
     * @notice 迁移到新策略
     * @param _newStrategy 新策略地址
     */
    function migrate(address _newStrategy) external override onlyVault {
        require(_newStrategy != address(0), "Invalid strategy");
        
        // 先紧急撤回所有资金
        _emergencyWithdraw();
        
        // 转移所有资金到新策略
        uint256 balance = want.balanceOf(address(this));
        if (balance > 0) {
            want.safeTransfer(_newStrategy, balance);
        }
        
        isActive = false;
        
        emit Migrated(_newStrategy);
    }

    // ============== 管理函数 ==============

    /**
     * @notice 设置 Keeper 地址
     * @param _keeper 新的 Keeper 地址
     */
    function setKeeper(address _keeper) external onlyOwner {
        require(_keeper != address(0), "Invalid keeper");
        keeper = _keeper;
    }

    /**
     * @notice 设置最小收获间隔
     * @param _interval 新的间隔 (秒)
     */
    function setMinHarvestInterval(uint256 _interval) external onlyOwner {
        minHarvestInterval = _interval;
    }

    /**
     * @notice 激活/停用策略
     * @param _active 是否激活
     */
    function setActive(bool _active) external onlyOwner {
        isActive = _active;
    }

    /**
     * @notice 紧急恢复被困代币
     * @param _token 代币地址
     * @param _to 接收地址
     */
    function rescueTokens(address _token, address _to) external onlyOwner {
        require(_token != address(want), "Cannot rescue want token");
        uint256 balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_to, balance);
    }

    // ============== 抽象函数 (子类必须实现) ==============

    /**
     * @dev 投资逻辑 - 将资金投入目标协议
     * @param _amount 要投资的金额
     */
    function _invest(uint256 _amount) internal virtual;

    /**
     * @dev 收获逻辑 - 收割收益并复投
     * @return profit 收获的收益金额
     */
    function _harvest() internal virtual returns (uint256 profit);

    /**
     * @dev 提取逻辑 - 从目标协议提取资金
     * @param _amount 要提取的金额
     * @return 实际提取的金额
     */
    function _withdraw(uint256 _amount) internal virtual returns (uint256);

    /**
     * @dev 紧急提取逻辑 - 无条件提取所有资金
     * @return 提取的总金额
     */
    function _emergencyWithdraw() internal virtual returns (uint256);
}
