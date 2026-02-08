// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BaseStrategy.sol";

/**
 * @title OracleRWAStrategy
 * @notice RWA 策略 - 收益由预言机节点注入
 * @dev 与 MockRWAYieldStrategy 不同，此策略不自动计算收益，
 *      而是等待预言机节点调用 injectYield() 注入链下收益
 */
contract OracleRWAStrategy is BaseStrategy {
    using SafeERC20 for IERC20;

    /// @notice 投入的本金
    uint256 public principal;
    
    /// @notice 待收获的收益 (由预言机注入)
    uint256 public pendingYield;
    
    /// @notice 目标 APY (仅用于展示，实际收益由预言机决定)
    uint256 public targetAPY;
    
    /// @notice 授权的预言机地址
    address public oracle;
    
    event YieldInjected(uint256 amount, uint256 timestamp);
    event OracleUpdated(address oldOracle, address newOracle);

    modifier onlyOracle() {
        require(msg.sender == oracle || msg.sender == owner(), "Only oracle");
        _;
    }

    constructor(
        address _vault,
        address _asset,
        address _oracle,
        uint256 _targetAPY
    ) BaseStrategy(_vault, _asset, "Oracle RWA Strategy") {
        oracle = _oracle;
        targetAPY = _targetAPY;
    }

    // ============== 预言机函数 ==============

    /**
     * @notice 预言机注入收益
     * @dev 预言机节点调用此函数，将链下收益注入策略
     *      调用前需要先将 USDC 转入此合约
     */
    function injectYield(uint256 _amount) external onlyOracle {
        require(_amount > 0, "Zero amount");
        require(want.balanceOf(address(this)) >= principal + pendingYield + _amount, "Insufficient balance");
        
        pendingYield += _amount;
        emit YieldInjected(_amount, block.timestamp);
    }

    /**
     * @notice 预言机直接转入收益并记录
     * @dev 一步完成：转账 + 记录
     */
    function depositYield(uint256 _amount) external onlyOracle {
        require(_amount > 0, "Zero amount");
        want.safeTransferFrom(msg.sender, address(this), _amount);
        pendingYield += _amount;
        emit YieldInjected(_amount, block.timestamp);
    }

    // ============== 视图函数 ==============

    function totalAssets() public view override returns (uint256) {
        return principal + pendingYield;
    }

    function estimatedAPY() external view override returns (uint256) {
        return targetAPY;
    }

    function _harvestTriggerCheck() internal view override returns (bool) {
        return pendingYield > 0;
    }

    // ============== 策略核心函数 ==============

    function _invest(uint256 _amount) internal override {
        principal += _amount;
    }

    function _harvest() internal override returns (uint256 profit) {
        profit = pendingYield;
        if (profit > 0) {
            // 收益复投到本金
            principal += profit;
            pendingYield = 0;
        }
        return profit;
    }

    function _withdraw(uint256 _amount) internal override returns (uint256) {
        uint256 available = principal + pendingYield;
        uint256 toWithdraw = _amount > available ? available : _amount;
        
        if (toWithdraw <= pendingYield) {
            pendingYield -= toWithdraw;
        } else {
            uint256 fromPrincipal = toWithdraw - pendingYield;
            pendingYield = 0;
            principal -= fromPrincipal;
        }
        
        return toWithdraw;
    }

    function _emergencyWithdraw() internal override returns (uint256) {
        uint256 total = principal + pendingYield;
        principal = 0;
        pendingYield = 0;
        return total;
    }

    // ============== 管理函数 ==============

    function setOracle(address _oracle) external onlyOwner {
        address old = oracle;
        oracle = _oracle;
        emit OracleUpdated(old, _oracle);
    }

    function setTargetAPY(uint256 _apy) external onlyOwner {
        targetAPY = _apy;
    }
}
