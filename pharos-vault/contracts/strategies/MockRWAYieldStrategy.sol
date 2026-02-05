// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";

/**
 * @title MockRWAYieldStrategy
 * @author Pharos Team
 * @notice 模拟 RWA (Real World Asset) 收益的策略合约
 * @dev 此策略模拟美国国债或其他 RWA 资产的收益分发
 * 
 * 工作原理:
 * 1. Vault 将稳定币存入此策略
 * 2. 策略模拟持有代币化的美债或其他 RWA 资产
 * 3. 按照设定的年化收益率 (APY) 生成收益
 * 4. harvest() 时结算并复投收益
 * 
 * 真实场景中，此策略会与以下协议集成:
 * - Ondo Finance (OUSG - 美债)
 * - Backed Finance (bIB01 - 短期国债)
 * - Maple Finance (贸易融资)
 * - Centrifuge (实物资产代币化)
 */
contract MockRWAYieldStrategy is BaseStrategy {
    using SafeERC20 for IERC20;

    // ============== 常量 ==============
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant SECS_PER_YEAR = 31_556_952;
    uint256 public constant MAX_APY = 5000; // 最高 50% APY

    // ============== 状态变量 ==============
    
    /// @notice 模拟的年化收益率 (基点，如 500 = 5%)
    uint256 public targetAPY;
    
    /// @notice 模拟的 RWA 资产合约 (真实场景为外部协议)
    address public rwaToken;
    
    /// @notice 投入的本金
    uint256 public principal;
    
    /// @notice 上次计算收益的时间
    uint256 public lastAccrualTime;
    
    /// @notice 累计待收获的收益
    uint256 public pendingYield;
    
    /// @notice RWA Provider 地址 (模拟外部收益来源)
    address public yieldProvider;
    
    /// @notice 收益分发事件
    event YieldAccrued(uint256 amount, uint256 timestamp);
    event YieldDistributed(uint256 amount, address indexed recipient);
    event APYUpdated(uint256 oldAPY, uint256 newAPY);

    // ============== 构造函数 ==============

    /**
     * @notice 初始化 RWA 收益策略
     * @param _vault Vault 地址
     * @param _asset 底层资产地址 (稳定币)
     * @param _targetAPY 目标年化收益率 (基点)
     * @param _yieldProvider 收益提供者地址
     */
    constructor(
        address _vault,
        address _asset,
        uint256 _targetAPY,
        address _yieldProvider
    ) BaseStrategy(_vault, _asset, "Pharos RWA Yield Strategy") {
        require(_targetAPY <= MAX_APY, "APY too high");
        require(_yieldProvider != address(0), "Invalid yield provider");
        
        targetAPY = _targetAPY;
        yieldProvider = _yieldProvider;
        lastAccrualTime = block.timestamp;
    }

    // ============== 视图函数 ==============

    /**
     * @notice 获取策略管理的总资产
     * @return 本金 + 待收获收益
     */
    function totalAssets() public view override returns (uint256) {
        return principal + _calculatePendingYield() + pendingYield;
    }

    /**
     * @notice 获取预估的年化收益率
     * @return APY (基点)
     */
    function estimatedAPY() external view override returns (uint256) {
        return targetAPY;
    }

    /**
     * @notice 获取待收获的收益
     */
    function getPendingYield() external view returns (uint256) {
        return _calculatePendingYield() + pendingYield;
    }

    /**
     * @notice 获取自上次收获以来经过的时间
     */
    function timeSinceLastHarvest() external view returns (uint256) {
        return block.timestamp - lastHarvest;
    }

    /**
     * @dev 检查是否应该触发收获
     */
    function _harvestTriggerCheck() internal view override returns (bool) {
        // 如果累积收益超过本金的 0.1%，触发收获
        uint256 pending = _calculatePendingYield() + pendingYield;
        return pending > (principal * 10) / 10000; // 0.1%
    }

    // ============== 核心策略函数 ==============

    /**
     * @dev 投资逻辑 - 将资金投入 RWA 协议
     * @param _amount 要投资的金额
     */
    function _invest(uint256 _amount) internal override {
        // 在真实场景中，这里会:
        // 1. 调用 RWA 协议的 deposit 函数
        // 2. 接收对应的 RWA 代币 (如 OUSG, bIB01)
        // 3. 可能需要通过 KYC/AML 检查
        
        // 模拟: 直接增加本金
        // 先结算之前的收益
        _accrueYield();
        
        principal += _amount;
        
        // 真实实现示例:
        // IERC20(want).approve(rwaProtocol, _amount);
        // IRWAProtocol(rwaProtocol).deposit(_amount);
    }

    /**
     * @dev 收获逻辑 - 收割 RWA 收益
     * @return profit 收获的收益金额
     */
    function _harvest() internal override returns (uint256 profit) {
        // 计算并结算收益
        _accrueYield();
        
        profit = pendingYield;
        
        if (profit > 0) {
            // 在真实场景中，这里会从 RWA 协议领取收益
            // 模拟: 从 yieldProvider 拉取收益
            // 这需要 yieldProvider 预先存入足够的代币
            
            uint256 providerBalance = want.balanceOf(yieldProvider);
            if (providerBalance >= profit) {
                // 从提供者转入收益
                want.safeTransferFrom(yieldProvider, address(this), profit);
                
                // 将收益复投 (增加本金)
                principal += profit;
                pendingYield = 0;
                
                emit YieldDistributed(profit, vault);
            } else {
                // 收益提供者余额不足，减少收益金额
                if (providerBalance > 0) {
                    want.safeTransferFrom(yieldProvider, address(this), providerBalance);
                    principal += providerBalance;
                    pendingYield -= providerBalance;
                    profit = providerBalance;
                } else {
                    profit = 0;
                }
            }
        }
        
        return profit;
    }

    /**
     * @dev 提取逻辑 - 从 RWA 协议提取资金
     * @param _amount 要提取的金额
     * @return 实际提取的金额
     */
    function _withdraw(uint256 _amount) internal override returns (uint256) {
        // 在真实场景中，这里会:
        // 1. 从 RWA 协议赎回代币
        // 2. 可能有赎回等待期
        // 3. 可能收取赎回费用
        
        // 先结算收益
        _accrueYield();
        
        uint256 available = principal + pendingYield;
        uint256 toWithdraw = _amount > available ? available : _amount;
        
        // 优先使用待收获收益
        if (toWithdraw <= pendingYield) {
            pendingYield -= toWithdraw;
        } else {
            uint256 fromPrincipal = toWithdraw - pendingYield;
            pendingYield = 0;
            principal -= fromPrincipal;
        }
        
        // 资金已在合约中 (模拟场景)
        // 真实场景需要从协议中取出
        
        return toWithdraw;
    }

    /**
     * @dev 紧急提取 - 无条件取出所有资金
     * @return 提取的总金额
     */
    function _emergencyWithdraw() internal override returns (uint256) {
        // 在真实场景中，可能需要:
        // 1. 强制赎回 RWA 代币
        // 2. 接受可能的滑点或损失
        
        uint256 total = principal + pendingYield;
        principal = 0;
        pendingYield = 0;
        lastAccrualTime = block.timestamp;
        
        return total;
    }

    // ============== 管理函数 ==============

    /**
     * @notice 更新目标 APY
     * @param _newAPY 新的年化收益率 (基点)
     */
    function setTargetAPY(uint256 _newAPY) external onlyOwner {
        require(_newAPY <= MAX_APY, "APY too high");
        
        // 先结算当前收益
        _accrueYield();
        
        uint256 oldAPY = targetAPY;
        targetAPY = _newAPY;
        
        emit APYUpdated(oldAPY, _newAPY);
    }

    /**
     * @notice 更新收益提供者
     * @param _newProvider 新的提供者地址
     */
    function setYieldProvider(address _newProvider) external onlyOwner {
        require(_newProvider != address(0), "Invalid provider");
        yieldProvider = _newProvider;
    }

    /**
     * @notice 手动注入收益 (用于测试或补偿)
     * @param _amount 注入金额
     */
    function injectYield(uint256 _amount) external {
        require(_amount > 0, "Zero amount");
        want.safeTransferFrom(msg.sender, address(this), _amount);
        pendingYield += _amount;
        
        emit YieldAccrued(_amount, block.timestamp);
    }

    // ============== 内部函数 ==============

    /**
     * @dev 计算自上次结算以来的待收获收益
     */
    function _calculatePendingYield() internal view returns (uint256) {
        if (principal == 0 || targetAPY == 0) return 0;
        
        uint256 elapsed = block.timestamp - lastAccrualTime;
        if (elapsed == 0) return 0;
        
        // yield = principal * APY * elapsed / (10000 * SECS_PER_YEAR)
        return (principal * targetAPY * elapsed) / (10000 * SECS_PER_YEAR);
    }

    /**
     * @dev 结算待收获收益
     */
    function _accrueYield() internal {
        uint256 newYield = _calculatePendingYield();
        if (newYield > 0) {
            pendingYield += newYield;
            emit YieldAccrued(newYield, block.timestamp);
        }
        lastAccrualTime = block.timestamp;
    }
}
