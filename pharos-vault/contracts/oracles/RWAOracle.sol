// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RWAOracle
 * @notice RWA 预言机 - 提供 NAV、利率和收益分发功能
 * @dev 由链下预言机节点调用更新数据
 */
contract RWAOracle is AccessControl {
    using SafeERC20 for IERC20;
    
    bytes32 public constant FEEDER_ROLE = keccak256("FEEDER_ROLE");
    
    IERC20 public immutable asset;
    address public strategy;
    
    // ============== NAV 数据 ==============
    uint256 public nav;           // NAV per share (18 decimals, 1e18 = $1.00)
    uint256 public navUpdatedAt;
    
    // ============== 利率数据 ==============
    uint256 public interestRate;  // 年化利率 (基点, 500 = 5%)
    uint256 public rateUpdatedAt;
    
    // ============== 收益统计 ==============
    uint256 public totalYieldDistributed;
    uint256 public lastYieldAt;
    
    uint256 public constant MAX_STALENESS = 24 hours;
    
    // ============== 事件 ==============
    event NAVUpdated(uint256 nav, uint256 timestamp);
    event InterestRateUpdated(uint256 rate, uint256 timestamp);
    event YieldDistributed(uint256 amount, uint256 timestamp);
    event StrategyUpdated(address strategy);
    
    constructor(address _asset) {
        asset = IERC20(_asset);
        nav = 1e18;  // 初始 NAV = $1.00
        interestRate = 500;  // 初始 5% APY
        navUpdatedAt = block.timestamp;
        rateUpdatedAt = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FEEDER_ROLE, msg.sender);
    }
    
    // ============== Feeder 函数 ==============
    
    /**
     * @notice 更新 NAV
     */
    function updateNAV(uint256 _nav) external onlyRole(FEEDER_ROLE) {
        require(_nav > 0, "Invalid NAV");
        nav = _nav;
        navUpdatedAt = block.timestamp;
        emit NAVUpdated(_nav, block.timestamp);
    }
    
    /**
     * @notice 更新利率
     */
    function updateInterestRate(uint256 _rate) external onlyRole(FEEDER_ROLE) {
        require(_rate <= 10000, "Rate too high");  // 最高 100%
        interestRate = _rate;
        rateUpdatedAt = block.timestamp;
        emit InterestRateUpdated(_rate, block.timestamp);
    }
    
    /**
     * @notice 分发收益到策略
     * @dev 调用前需先将资金转入此合约
     */
    function distributeYield(uint256 _amount) external onlyRole(FEEDER_ROLE) {
        require(strategy != address(0), "Strategy not set");
        require(_amount > 0, "Zero amount");
        require(asset.balanceOf(address(this)) >= _amount, "Insufficient balance");
        
        totalYieldDistributed += _amount;
        lastYieldAt = block.timestamp;
        
        asset.safeTransfer(strategy, _amount);
        emit YieldDistributed(_amount, block.timestamp);
    }
    
    /**
     * @notice 批量更新所有数据
     */
    function updateAll(uint256 _nav, uint256 _rate) external onlyRole(FEEDER_ROLE) {
        if (_nav > 0) {
            nav = _nav;
            navUpdatedAt = block.timestamp;
            emit NAVUpdated(_nav, block.timestamp);
        }
        if (_rate <= 10000) {
            interestRate = _rate;
            rateUpdatedAt = block.timestamp;
            emit InterestRateUpdated(_rate, block.timestamp);
        }
    }
    
    // ============== 视图函数 ==============
    
    /**
     * @notice 获取最新 NAV (带过期检查)
     */
    function getLatestNAV() external view returns (uint256, uint256) {
        require(block.timestamp - navUpdatedAt <= MAX_STALENESS, "NAV stale");
        return (nav, navUpdatedAt);
    }
    
    /**
     * @notice 获取最新利率 (带过期检查)
     */
    function getLatestRate() external view returns (uint256, uint256) {
        require(block.timestamp - rateUpdatedAt <= MAX_STALENESS, "Rate stale");
        return (interestRate, rateUpdatedAt);
    }
    
    /**
     * @notice 检查数据是否新鲜
     */
    function isDataFresh() external view returns (bool navFresh, bool rateFresh) {
        navFresh = block.timestamp - navUpdatedAt <= MAX_STALENESS;
        rateFresh = block.timestamp - rateUpdatedAt <= MAX_STALENESS;
    }
    
    /**
     * @notice 根据本金计算预期年收益
     */
    function calculateExpectedYield(uint256 principal) external view returns (uint256) {
        return (principal * interestRate) / 10000;
    }
    
    // ============== 管理函数 ==============
    
    function setStrategy(address _strategy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_strategy != address(0), "Invalid strategy");
        strategy = _strategy;
        emit StrategyUpdated(_strategy);
    }
    
    function addFeeder(address _feeder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(FEEDER_ROLE, _feeder);
    }
    
    function removeFeeder(address _feeder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(FEEDER_ROLE, _feeder);
    }
}
