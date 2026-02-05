// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";

/**
 * @title SimpleLendingStrategy
 * @author Pharos Team
 * @notice 简单借贷策略 - 模拟将资金存入借贷协议赚取利息
 * @dev 此策略模拟与 Aave、Compound 等借贷协议集成
 * 
 * 工作原理:
 * 1. 将稳定币存入借贷池
 * 2. 获得相应的利息凭证代币 (aToken/cToken)
 * 3. 利息随时间自动累积
 * 4. harvest() 时将利息转换回底层资产
 * 
 * 真实场景集成:
 * - Aave V3
 * - Compound V3
 * - Venus Protocol
 */
contract SimpleLendingStrategy is BaseStrategy {
    using SafeERC20 for IERC20;

    // ============== 常量 ==============
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant SECS_PER_YEAR = 31_556_952;

    // ============== 状态变量 ==============
    
    /// @notice 借贷池地址 (模拟)
    address public lendingPool;
    
    /// @notice 利息代币地址 (模拟 aToken)
    address public interestToken;
    
    /// @notice 存入的本金
    uint256 public depositedAmount;
    
    /// @notice 模拟的利率 (基点，如 300 = 3%)
    uint256 public interestRate;
    
    /// @notice 上次利息计算时间
    uint256 public lastInterestUpdate;
    
    /// @notice 累计利息
    uint256 public accruedInterest;

    // ============== 事件 ==============
    
    event InterestUpdated(uint256 newInterest, uint256 totalAccrued);
    event LendingPoolUpdated(address newPool);
    event InterestRateUpdated(uint256 newRate);

    // ============== 构造函数 ==============

    /**
     * @notice 初始化借贷策略
     * @param _vault Vault 地址
     * @param _asset 底层资产地址
     * @param _interestRate 模拟利率 (基点)
     */
    constructor(
        address _vault,
        address _asset,
        uint256 _interestRate
    ) BaseStrategy(_vault, _asset, "Pharos Lending Strategy") {
        require(_interestRate <= 3000, "Rate too high"); // 最高 30%
        
        interestRate = _interestRate;
        lastInterestUpdate = block.timestamp;
    }

    // ============== 视图函数 ==============

    /**
     * @notice 获取策略管理的总资产
     */
    function totalAssets() public view override returns (uint256) {
        return depositedAmount + _calculatePendingInterest() + accruedInterest;
    }

    /**
     * @notice 获取预估 APY
     */
    function estimatedAPY() external view override returns (uint256) {
        return interestRate;
    }

    /**
     * @notice 获取待收取的利息
     */
    function getPendingInterest() external view returns (uint256) {
        return _calculatePendingInterest() + accruedInterest;
    }

    /**
     * @dev 收获触发条件
     */
    function _harvestTriggerCheck() internal view override returns (bool) {
        uint256 pending = _calculatePendingInterest() + accruedInterest;
        // 当累积利息超过本金的 0.05% 时触发
        return pending > (depositedAmount * 5) / 10000;
    }

    // ============== 核心策略函数 ==============

    /**
     * @dev 投资到借贷池
     */
    function _invest(uint256 _amount) internal override {
        // 真实场景:
        // IERC20(asset()).approve(lendingPool, _amount);
        // ILendingPool(lendingPool).deposit(asset(), _amount, address(this), 0);
        
        // 结算之前的利息
        _updateInterest();
        
        depositedAmount += _amount;
    }

    /**
     * @dev 收获利息
     */
    function _harvest() internal override returns (uint256 profit) {
        _updateInterest();
        
        profit = accruedInterest;
        
        if (profit > 0) {
            // 真实场景会从借贷池获取实际利息
            // 模拟场景中，利息来自策略自身的累积
            
            // 将利息复投
            depositedAmount += profit;
            accruedInterest = 0;
        }
        
        return profit;
    }

    /**
     * @dev 从借贷池提取
     */
    function _withdraw(uint256 _amount) internal override returns (uint256) {
        _updateInterest();
        
        uint256 available = depositedAmount + accruedInterest;
        uint256 toWithdraw = _amount > available ? available : _amount;
        
        // 优先使用利息
        if (toWithdraw <= accruedInterest) {
            accruedInterest -= toWithdraw;
        } else {
            uint256 fromDeposit = toWithdraw - accruedInterest;
            accruedInterest = 0;
            depositedAmount -= fromDeposit;
        }
        
        // 真实场景:
        // ILendingPool(lendingPool).withdraw(asset(), toWithdraw, address(this));
        
        return toWithdraw;
    }

    /**
     * @dev 紧急提取
     */
    function _emergencyWithdraw() internal override returns (uint256) {
        uint256 total = depositedAmount + accruedInterest;
        
        depositedAmount = 0;
        accruedInterest = 0;
        lastInterestUpdate = block.timestamp;
        
        // 真实场景:
        // ILendingPool(lendingPool).withdraw(asset(), type(uint256).max, address(this));
        
        return total;
    }

    // ============== 管理函数 ==============

    /**
     * @notice 设置利率 (仅测试用)
     */
    function setInterestRate(uint256 _rate) external onlyOwner {
        require(_rate <= 3000, "Rate too high");
        _updateInterest();
        interestRate = _rate;
        emit InterestRateUpdated(_rate);
    }

    /**
     * @notice 设置借贷池地址
     */
    function setLendingPool(address _pool) external onlyOwner {
        lendingPool = _pool;
        emit LendingPoolUpdated(_pool);
    }

    /**
     * @notice 模拟外部注入利息
     */
    function mockInjectInterest(uint256 _amount) external {
        want.safeTransferFrom(msg.sender, address(this), _amount);
        accruedInterest += _amount;
        emit InterestUpdated(_amount, accruedInterest);
    }

    // ============== 内部函数 ==============

    /**
     * @dev 计算待收取利息
     */
    function _calculatePendingInterest() internal view returns (uint256) {
        if (depositedAmount == 0 || interestRate == 0) return 0;
        
        uint256 elapsed = block.timestamp - lastInterestUpdate;
        if (elapsed == 0) return 0;
        
        // interest = principal * rate * time / (10000 * SECS_PER_YEAR)
        return (depositedAmount * interestRate * elapsed) / (10000 * SECS_PER_YEAR);
    }

    /**
     * @dev 更新利息
     */
    function _updateInterest() internal {
        uint256 pending = _calculatePendingInterest();
        if (pending > 0) {
            accruedInterest += pending;
            emit InterestUpdated(pending, accruedInterest);
        }
        lastInterestUpdate = block.timestamp;
    }
}
