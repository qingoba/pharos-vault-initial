// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IStrategy.sol";

/**
 * @title PharosVault
 * @author Pharos Team
 * @notice ERC4626 标准的收益型保险库合约
 * @dev 实现了 ERC4626 标准，支持多策略管理、动态费率和资产透明度
 * 
 * 核心功能:
 * 1. ERC4626 标准接口 - 完全兼容
 * 2. 多策略管理 - 可连接多个收益策略
 * 3. 动态费率 - 管理费和绩效费自动计算
 * 4. 紧急模式 - 支持紧急暂停和资金撤回
 */
contract PharosVault is ERC4626, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============== 常量 ==============
    uint256 public constant MAX_BPS = 10_000; // 100% = 10000 基点
    uint256 public constant SECS_PER_YEAR = 31_556_952; // 365.2425 天
    uint256 public constant MAX_STRATEGIES = 10; // 最大策略数量

    // ============== 状态变量 ==============
    
    /// @notice 管理费 (年化，以基点表示，如 200 = 2%)
    uint256 public managementFee;
    
    /// @notice 绩效费 (以基点表示，如 1000 = 10%)
    uint256 public performanceFee;
    
    /// @notice 存款上限
    uint256 public depositLimit;
    
    /// @notice 上次费用收取时间
    uint256 public lastFeeCollection;
    
    /// @notice 累计收取的管理费
    uint256 public accumulatedManagementFee;
    
    /// @notice 累计收取的绩效费
    uint256 public accumulatedPerformanceFee;
    
    /// @notice 费用接收地址
    address public feeRecipient;
    
    /// @notice 紧急模式开关
    bool public emergencyShutdown;
    
    /// @notice 策略列表
    address[] public strategies;
    
    /// @notice 策略参数映射
    mapping(address => StrategyParams) public strategyParams;
    
    /// @notice 是否为活跃策略
    mapping(address => bool) public isActiveStrategy;

    // ============== 结构体 ==============
    
    /// @notice 策略参数
    struct StrategyParams {
        uint256 activation;      // 激活时间戳
        uint256 debtRatio;       // 分配给该策略的资金比例 (基点)
        uint256 totalDebt;       // 策略当前借用的资金
        uint256 totalGain;       // 策略累计收益
        uint256 totalLoss;       // 策略累计亏损
        uint256 lastReport;      // 上次报告时间
    }

    // ============== 事件 ==============
    
    event StrategyAdded(address indexed strategy, uint256 debtRatio);
    event StrategyRemoved(address indexed strategy);
    event StrategyDebtRatioUpdated(address indexed strategy, uint256 newDebtRatio);
    event StrategyReported(
        address indexed strategy,
        uint256 gain,
        uint256 loss,
        uint256 debtPaid,
        uint256 totalDebt
    );
    event FeeCollected(uint256 managementFee, uint256 performanceFee);
    event ManagementFeeUpdated(uint256 newFee);
    event PerformanceFeeUpdated(uint256 newFee);
    event DepositLimitUpdated(uint256 newLimit);
    event EmergencyShutdownActivated(bool active);
    event FundsAllocatedToStrategy(address indexed strategy, uint256 amount);
    event FundsWithdrawnFromStrategy(address indexed strategy, uint256 amount);

    // ============== 错误 ==============
    
    error DepositLimitExceeded();
    error EmergencyShutdownActive();
    error StrategyAlreadyExists();
    error StrategyNotFound();
    error InvalidDebtRatio();
    error MaxStrategiesReached();
    error InvalidFee();
    error ZeroAddress();
    error InsufficientFunds();

    // ============== 修饰符 ==============

    modifier notShutdown() {
        if (emergencyShutdown) revert EmergencyShutdownActive();
        _;
    }

    // ============== 构造函数 ==============

    /**
     * @notice 初始化 Vault
     * @param _asset 底层资产地址
     * @param _name Vault 名称
     * @param _symbol Vault 符号
     * @param _feeRecipient 费用接收地址
     */
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _feeRecipient
    ) ERC4626(_asset) ERC20(_name, _symbol) Ownable(msg.sender) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        
        feeRecipient = _feeRecipient;
        managementFee = 200;     // 默认 2% 年化管理费
        performanceFee = 1000;   // 默认 10% 绩效费
        depositLimit = type(uint256).max; // 默认无限制
        lastFeeCollection = block.timestamp;
    }

    // ============== ERC4626 重写 ==============

    /**
     * @notice 获取 Vault 管理的总资产
     * @return 总资产数量
     */
    function totalAssets() public view override returns (uint256) {
        uint256 total = IERC20(asset()).balanceOf(address(this));
        
        // 加上所有策略中的资产
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            if (isActiveStrategy[strategy]) {
                total += IStrategy(strategy).totalAssets();
            }
        }
        
        return total;
    }

    /**
     * @notice 存款函数 (包含限额检查)
     */
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        notShutdown
        returns (uint256) 
    {
        if (assets + totalAssets() > depositLimit) revert DepositLimitExceeded();
        
        // 收取待处理的费用
        _collectFees();
        
        return super.deposit(assets, receiver);
    }

    /**
     * @notice 铸造函数 (包含限额检查)
     */
    function mint(uint256 shares, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        notShutdown
        returns (uint256) 
    {
        uint256 assets = previewMint(shares);
        if (assets + totalAssets() > depositLimit) revert DepositLimitExceeded();
        
        _collectFees();
        
        return super.mint(shares, receiver);
    }

    /**
     * @notice 提现函数
     */
    function withdraw(uint256 assets, address receiver, address _owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        _collectFees();
        
        // 如果 Vault 中资金不足，从策略中撤回
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (vaultBalance < assets) {
            _withdrawFromStrategies(assets - vaultBalance);
        }
        
        return super.withdraw(assets, receiver, _owner);
    }

    /**
     * @notice 赎回函数
     */
    function redeem(uint256 shares, address receiver, address _owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        _collectFees();
        
        uint256 assets = previewRedeem(shares);
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        
        if (vaultBalance < assets) {
            _withdrawFromStrategies(assets - vaultBalance);
        }
        
        return super.redeem(shares, receiver, _owner);
    }

    // ============== 策略管理 ==============

    /**
     * @notice 添加策略
     * @param _strategy 策略地址
     * @param _debtRatio 分配给该策略的资金比例 (基点)
     */
    function addStrategy(address _strategy, uint256 _debtRatio) 
        external 
        onlyOwner 
    {
        if (_strategy == address(0)) revert ZeroAddress();
        if (isActiveStrategy[_strategy]) revert StrategyAlreadyExists();
        if (strategies.length >= MAX_STRATEGIES) revert MaxStrategiesReached();
        if (_getTotalDebtRatio() + _debtRatio > MAX_BPS) revert InvalidDebtRatio();
        
        // 验证策略的底层资产匹配
        require(IStrategy(_strategy).asset() == asset(), "Asset mismatch");
        require(IStrategy(_strategy).vault() == address(this), "Vault mismatch");
        
        strategies.push(_strategy);
        isActiveStrategy[_strategy] = true;
        strategyParams[_strategy] = StrategyParams({
            activation: block.timestamp,
            debtRatio: _debtRatio,
            totalDebt: 0,
            totalGain: 0,
            totalLoss: 0,
            lastReport: block.timestamp
        });
        
        emit StrategyAdded(_strategy, _debtRatio);
    }

    /**
     * @notice 移除策略
     * @param _strategy 策略地址
     */
    function removeStrategy(address _strategy) external onlyOwner {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();
        
        // 从策略中撤回所有资金
        uint256 totalDebt = strategyParams[_strategy].totalDebt;
        if (totalDebt > 0) {
            IStrategy(_strategy).withdraw(totalDebt);
        }
        
        isActiveStrategy[_strategy] = false;
        
        // 从数组中移除
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i] == _strategy) {
                strategies[i] = strategies[strategies.length - 1];
                strategies.pop();
                break;
            }
        }
        
        delete strategyParams[_strategy];
        
        emit StrategyRemoved(_strategy);
    }

    /**
     * @notice 更新策略的债务比例
     * @param _strategy 策略地址
     * @param _debtRatio 新的债务比例
     */
    function updateStrategyDebtRatio(address _strategy, uint256 _debtRatio) 
        external 
        onlyOwner 
    {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();
        
        uint256 oldRatio = strategyParams[_strategy].debtRatio;
        uint256 totalRatio = _getTotalDebtRatio() - oldRatio + _debtRatio;
        
        if (totalRatio > MAX_BPS) revert InvalidDebtRatio();
        
        strategyParams[_strategy].debtRatio = _debtRatio;
        
        emit StrategyDebtRatioUpdated(_strategy, _debtRatio);
    }

    /**
     * @notice 分配资金到策略
     * @param _strategy 策略地址
     * @param _amount 分配金额
     */
    function allocateToStrategy(address _strategy, uint256 _amount) 
        external 
        onlyOwner 
        notShutdown
    {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();
        
        uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));
        if (vaultBalance < _amount) revert InsufficientFunds();
        
        // 转移资产到策略
        IERC20(asset()).safeTransfer(_strategy, _amount);
        
        // 通知策略有新资金
        IStrategy(_strategy).invest();
        
        // 更新策略债务
        strategyParams[_strategy].totalDebt += _amount;
        
        emit FundsAllocatedToStrategy(_strategy, _amount);
    }

    /**
     * @notice 手动触发策略收获
     * @param _strategy 策略地址
     */
    function harvestStrategy(address _strategy) external {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();
        
        IStrategy(_strategy).harvest();
        
        _updateStrategyReport(_strategy);
    }

    /**
     * @notice 收获所有策略
     */
    function harvestAll() external {
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            if (isActiveStrategy[strategy]) {
                IStrategy(strategy).harvest();
                _updateStrategyReport(strategy);
            }
        }
    }

    // ============== 费用管理 ==============

    /**
     * @notice 设置管理费
     * @param _fee 新的管理费 (基点)
     */
    function setManagementFee(uint256 _fee) external onlyOwner {
        if (_fee > MAX_BPS) revert InvalidFee();
        managementFee = _fee;
        emit ManagementFeeUpdated(_fee);
    }

    /**
     * @notice 设置绩效费
     * @param _fee 新的绩效费 (基点)
     */
    function setPerformanceFee(uint256 _fee) external onlyOwner {
        if (_fee > MAX_BPS / 2) revert InvalidFee(); // 最高 50%
        performanceFee = _fee;
        emit PerformanceFeeUpdated(_fee);
    }

    /**
     * @notice 设置存款限额
     * @param _limit 新的存款限额
     */
    function setDepositLimit(uint256 _limit) external onlyOwner {
        depositLimit = _limit;
        emit DepositLimitUpdated(_limit);
    }

    /**
     * @notice 设置费用接收地址
     * @param _recipient 新的接收地址
     */
    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        feeRecipient = _recipient;
    }

    /**
     * @notice 领取累计费用
     */
    function claimFees() external {
        uint256 totalFees = accumulatedManagementFee + accumulatedPerformanceFee;
        if (totalFees > 0) {
            accumulatedManagementFee = 0;
            accumulatedPerformanceFee = 0;
            
            // 铸造 shares 给费用接收者
            uint256 feeShares = previewDeposit(totalFees);
            if (feeShares > 0) {
                _mint(feeRecipient, feeShares);
            }
        }
    }

    // ============== 紧急功能 ==============

    /**
     * @notice 激活/关闭紧急模式
     * @param _active 是否激活
     */
    function setEmergencyShutdown(bool _active) external onlyOwner {
        emergencyShutdown = _active;
        emit EmergencyShutdownActivated(_active);
        
        // 如果激活紧急模式，暂停合约
        if (_active) {
            _pause();
        } else {
            _unpause();
        }
    }

    /**
     * @notice 紧急从策略撤回所有资金
     */
    function emergencyWithdrawAll() external onlyOwner {
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            if (isActiveStrategy[strategy]) {
                uint256 strategyAssets = IStrategy(strategy).totalAssets();
                if (strategyAssets > 0) {
                    IStrategy(strategy).emergencyWithdraw();
                    strategyParams[strategy].totalDebt = 0;
                }
            }
        }
    }

    /**
     * @notice 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice 解除暂停
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============== 视图函数 ==============

    /**
     * @notice 获取策略数量
     */
    function strategiesLength() external view returns (uint256) {
        return strategies.length;
    }

    /**
     * @notice 获取所有策略地址
     */
    function getStrategies() external view returns (address[] memory) {
        return strategies;
    }

    /**
     * @notice 获取策略信息
     */
    function getStrategyInfo(address _strategy) 
        external 
        view 
        returns (StrategyParams memory) 
    {
        return strategyParams[_strategy];
    }

    /**
     * @notice 获取 Vault 空闲资金 (未分配到策略的资金)
     */
    function idleAssets() external view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    /**
     * @notice 获取策略中的总资产
     */
    function deployedAssets() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            if (isActiveStrategy[strategy]) {
                total += strategyParams[strategy].totalDebt;
            }
        }
        return total;
    }

    /**
     * @notice 计算预估年化收益率 (APY)
     * @dev 基于过去7天的收益计算
     * @return APY (基点)
     */
    function estimatedAPY() external view returns (uint256) {
        if (totalAssets() == 0) return 0;
        
        uint256 totalGains = 0;
        uint256 totalTime = 0;
        
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            if (isActiveStrategy[strategy]) {
                StrategyParams memory params = strategyParams[strategy];
                totalGains += params.totalGain;
                if (params.lastReport > params.activation) {
                    totalTime = params.lastReport - params.activation;
                }
            }
        }
        
        if (totalTime == 0 || totalGains == 0) return 0;
        
        // APY = (收益 / 总资产) * (一年秒数 / 运行时间) * 10000
        return (totalGains * SECS_PER_YEAR * MAX_BPS) / (totalAssets() * totalTime);
    }

    // ============== 内部函数 ==============

    /**
     * @dev 从策略中撤回资金
     */
    function _withdrawFromStrategies(uint256 _amount) internal {
        uint256 remaining = _amount;
        
        for (uint256 i = 0; i < strategies.length && remaining > 0; i++) {
            address strategy = strategies[i];
            if (!isActiveStrategy[strategy]) continue;
            
            // 使用策略的实际资产而非仅跟踪的债务
            // 这样可以正确处理策略产生的收益
            uint256 strategyAssets = IStrategy(strategy).totalAssets();
            if (strategyAssets == 0) continue;
            
            uint256 toWithdraw = remaining > strategyAssets ? strategyAssets : remaining;
            uint256 withdrawn = IStrategy(strategy).withdraw(toWithdraw);
            
            // 更新债务跟踪 (如果提取金额超过债务，则设为0)
            if (withdrawn >= strategyParams[strategy].totalDebt) {
                strategyParams[strategy].totalDebt = 0;
            } else {
                strategyParams[strategy].totalDebt -= withdrawn;
            }
            remaining -= withdrawn;
            
            emit FundsWithdrawnFromStrategy(strategy, withdrawn);
        }
    }

    /**
     * @dev 收取费用
     */
    function _collectFees() internal {
        uint256 timeSinceLastCollection = block.timestamp - lastFeeCollection;
        if (timeSinceLastCollection == 0) return;
        
        uint256 total = totalAssets();
        if (total == 0) return;
        
        // 计算管理费
        uint256 managementFeeAmount = (total * managementFee * timeSinceLastCollection) 
            / (MAX_BPS * SECS_PER_YEAR);
        
        accumulatedManagementFee += managementFeeAmount;
        lastFeeCollection = block.timestamp;
        
        emit FeeCollected(managementFeeAmount, 0);
    }

    /**
     * @dev 更新策略报告
     */
    function _updateStrategyReport(address _strategy) internal {
        uint256 currentAssets = IStrategy(_strategy).totalAssets();
        uint256 previousDebt = strategyParams[_strategy].totalDebt;
        
        uint256 gain = 0;
        uint256 loss = 0;
        
        if (currentAssets > previousDebt) {
            gain = currentAssets - previousDebt;
            strategyParams[_strategy].totalGain += gain;
            
            // 计算绩效费
            uint256 perfFee = (gain * performanceFee) / MAX_BPS;
            accumulatedPerformanceFee += perfFee;
        } else if (currentAssets < previousDebt) {
            loss = previousDebt - currentAssets;
            strategyParams[_strategy].totalLoss += loss;
        }
        
        strategyParams[_strategy].totalDebt = currentAssets;
        strategyParams[_strategy].lastReport = block.timestamp;
        
        emit StrategyReported(_strategy, gain, loss, 0, currentAssets);
    }

    /**
     * @dev 获取总债务比例
     */
    function _getTotalDebtRatio() internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (isActiveStrategy[strategies[i]]) {
                total += strategyParams[strategies[i]].debtRatio;
            }
        }
        return total;
    }
}
