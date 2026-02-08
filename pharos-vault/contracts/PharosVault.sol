// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IAssetSwapRouter.sol";

/**
 * @title PharosVault
 * @author Pharos Team
 * @notice Gas-optimised ERC4626 yield vault with multi-strategy management,
 *         cached accounting, keeper compatibility (Chainlink + Gelato), and
 *         snapshot events for full transparency dashboards.
 *
 * Key gas savings vs v1
 * ─────────────────────
 *  • `totalDeployedAssets` cache — no strategy loops in totalAssets().
 *  • `_cachedTotalDebtRatio` — addStrategy / updateRatio skip loops.
 *  • `estimatedAPY()` uses cached debt instead of external totalAssets().
 *  • Round-robin `harvestNext()` amortises keeper gas across blocks.
 */
contract PharosVault is ERC4626, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ======================== Constants ========================
    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant SECS_PER_YEAR = 31_556_952;
    uint256 public constant MAX_STRATEGIES = 10;

    // ======================== Fee state ========================
    uint256 public managementFee;
    uint256 public performanceFee;
    uint256 public idleAPY;
    uint256 public pendingAPY;
    uint256 public depositLimit;
    uint256 public lastFeeCollection;
    uint256 public accumulatedManagementFee;
    uint256 public accumulatedPerformanceFee;
    address public feeRecipient;

    // ======================== Emergency ========================
    bool public emergencyShutdown;

    // ======================== APY / risk metrics ========================
    int256 public realizedAPY;
    uint256 public lastPricePerShare;
    uint256 public lastPpsTimestamp;
    uint256 public highWatermarkPps;
    uint256 public maxDrawdownBps;

    // ======================== Multi-asset deposit ========================
    address public swapRouter;
    bool public autoAllocate;
    uint256 public pendingAssets;
    address[] private _supportedDepositAssets;
    mapping(address => bool) public isSupportedDepositAsset;
    mapping(address => uint256) private _supportedAssetIndexPlusOne;
    mapping(address => bool) public isAsyncStrategy;
    mapping(address => uint256) public pendingStrategyDebt;

    // ======================== Strategy registry ========================
    address[] public strategies;
    mapping(address => StrategyParams) public strategyParams;
    mapping(address => bool) public isActiveStrategy;

    /// @notice Cached total debt across all strategies — O(1) reads.
    uint256 public totalDeployedAssets;

    /// @notice Cached sum of active debtRatios.
    uint256 internal _cachedTotalDebtRatio;

    /// @notice Round-robin pointer for harvestNext().
    uint256 public nextHarvestIndex;

    // ======================== Structs ========================
    struct StrategyParams {
        uint256 activation;
        uint256 debtRatio;
        uint256 totalDebt;
        uint256 totalGain;
        uint256 totalLoss;
        uint256 lastReport;
    }

    // ======================== Events ========================
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
    event SwapRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event SupportedDepositAssetUpdated(address indexed asset, bool supported);
    event AutoAllocateUpdated(bool enabled);
    event StrategyAsyncUpdated(address indexed strategy, bool asyncMode);
    event IdleAPYUpdated(uint256 apyBps);
    event PendingAPYUpdated(uint256 apyBps);
    event PendingInvestmentQueued(
        address indexed strategy,
        uint256 amount,
        uint256 totalPendingForStrategy
    );
    event PendingInvestmentExecuted(
        address indexed strategy,
        uint256 amount,
        uint256 remainingPendingForStrategy
    );
    event PendingAllocationReleased(
        address indexed strategy,
        uint256 amount,
        uint256 remainingPendingForStrategy
    );
    event PerformanceMetricsUpdated(
        int256 realizedApyBps,
        uint256 maxDrawdownBps,
        uint256 pricePerShare
    );
    event MultiAssetDeposited(
        address indexed sender,
        address indexed receiver,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 assetsOut,
        uint256 shares
    );
    event FundsAllocatedToStrategy(address indexed strategy, uint256 amount);
    event FundsWithdrawnFromStrategy(address indexed strategy, uint256 amount);
    event AutoAllocationExecuted(uint256 totalAllocated, uint256 idleRemaining);

    /// @notice Emitted after every state-changing tx for off-chain dashboards.
    event VaultSnapshot(
        uint256 totalAssets,
        uint256 idleAssets,
        uint256 deployedAssets,
        uint256 pricePerShare,
        uint256 timestamp
    );

    // ======================== Errors ========================
    error DepositLimitExceeded();
    error EmergencyShutdownActive();
    error StrategyAlreadyExists();
    error StrategyNotFound();
    error InvalidDebtRatio();
    error MaxStrategiesReached();
    error InvalidFee();
    error ZeroAddress();
    error InsufficientFunds();
    error UnsupportedDepositAsset();
    error SwapRouterNotSet();
    error InvalidAmount();
    error InvalidStrategyState();
    error PendingAmountExceeded();

    // ======================== Modifiers ========================
    modifier notShutdown() {
        if (emergencyShutdown) revert EmergencyShutdownActive();
        _;
    }

    // ======================== Constructor ========================
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _feeRecipient
    ) ERC4626(_asset) ERC20(_name, _symbol) Ownable(msg.sender) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
        managementFee = 200;       // 2 %
        performanceFee = 1000;     // 10 %
        depositLimit = type(uint256).max;
        lastFeeCollection = block.timestamp;
        autoAllocate = true;
        lastPricePerShare = 1e18;
        highWatermarkPps = 1e18;
        lastPpsTimestamp = block.timestamp;
        _setSupportedDepositAsset(address(_asset), true);
    }

    // ================================================================
    //                   ERC4626 OVERRIDES  (gas-lean)
    // ================================================================

    /// @notice totalAssets = idle + cached deployed — no loops.
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + totalDeployedAssets;
    }

    function deposit(uint256 assets, address receiver)
        public override nonReentrant whenNotPaused notShutdown returns (uint256)
    {
        if (assets + totalAssets() > depositLimit) revert DepositLimitExceeded();
        _collectFees();
        uint256 shares = super.deposit(assets, receiver);
        if (autoAllocate) _autoAllocateIdle();
        _emitSnapshot();
        return shares;
    }

    function mint(uint256 shares, address receiver)
        public override nonReentrant whenNotPaused notShutdown returns (uint256)
    {
        uint256 assets = previewMint(shares);
        if (assets + totalAssets() > depositLimit) revert DepositLimitExceeded();
        _collectFees();
        uint256 a = super.mint(shares, receiver);
        if (autoAllocate) _autoAllocateIdle();
        _emitSnapshot();
        return a;
    }

    /**
     * @notice Deposit a supported asset, swap to vault asset (USDC), then mint shares.
     * @param tokenIn Asset user deposits (e.g., WBTC/WBNB).
     * @param amountIn Input amount of `tokenIn`.
     * @param minAssetsOut Minimum USDC expected from the swap.
     * @param receiver Receiver of vault shares.
     */
    function depositAsset(
        address tokenIn,
        uint256 amountIn,
        uint256 minAssetsOut,
        address receiver
    )
        external
        nonReentrant
        whenNotPaused
        notShutdown
        returns (uint256 shares, uint256 assetsDeposited)
    {
        if (tokenIn == address(0) || receiver == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert InvalidAmount();

        _collectFees();

        uint256 totalBefore = totalAssets();

        // Fast path for direct USDC deposit, still using this entrypoint.
        if (tokenIn == asset()) {
            if (amountIn + totalBefore > depositLimit) revert DepositLimitExceeded();
            shares = previewDeposit(amountIn);
            _deposit(msg.sender, receiver, amountIn, shares);
            assetsDeposited = amountIn;
        } else {
            if (!isSupportedDepositAsset[tokenIn]) revert UnsupportedDepositAsset();
            if (swapRouter == address(0)) revert SwapRouterNotSet();

            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenIn).forceApprove(swapRouter, 0);
            IERC20(tokenIn).forceApprove(swapRouter, amountIn);

            assetsDeposited = IAssetSwapRouter(swapRouter).swapExactInput(
                tokenIn,
                asset(),
                amountIn,
                minAssetsOut,
                address(this)
            );
            if (assetsDeposited == 0) revert InvalidAmount();

            if (totalBefore + assetsDeposited > depositLimit) {
                revert DepositLimitExceeded();
            }

            shares = _previewDepositForAssets(assetsDeposited, totalBefore);
            _depositFromVaultBalance(msg.sender, receiver, assetsDeposited, shares);
        }

        if (autoAllocate) _autoAllocateIdle();

        emit MultiAssetDeposited(
            msg.sender,
            receiver,
            tokenIn,
            amountIn,
            assetsDeposited,
            shares
        );
        _emitSnapshot();
    }

    function withdraw(uint256 assets, address receiver, address _owner)
        public override nonReentrant returns (uint256)
    {
        _collectFees();
        uint256 idleBalance = IERC20(asset()).balanceOf(address(this));
        if (idleBalance < assets) {
            _withdrawFromStrategies(assets - idleBalance);
        }
        _releasePendingReservationsForOutflow(assets);
        uint256 shares = super.withdraw(assets, receiver, _owner);
        _emitSnapshot();
        return shares;
    }

    function redeem(uint256 shares, address receiver, address _owner)
        public override nonReentrant returns (uint256)
    {
        _collectFees();
        uint256 assets = previewRedeem(shares);
        uint256 idleBalance = IERC20(asset()).balanceOf(address(this));
        if (idleBalance < assets) {
            _withdrawFromStrategies(assets - idleBalance);
        }
        _releasePendingReservationsForOutflow(assets);
        uint256 a = super.redeem(shares, receiver, _owner);
        _emitSnapshot();
        return a;
    }

    // ================================================================
    //                      STRATEGY MANAGEMENT
    // ================================================================

    function addStrategy(address _strategy, uint256 _debtRatio) external onlyOwner {
        if (_strategy == address(0)) revert ZeroAddress();
        if (isActiveStrategy[_strategy]) revert StrategyAlreadyExists();
        if (strategies.length >= MAX_STRATEGIES) revert MaxStrategiesReached();
        if (_cachedTotalDebtRatio + _debtRatio > MAX_BPS) revert InvalidDebtRatio();

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
        _cachedTotalDebtRatio += _debtRatio;

        emit StrategyAdded(_strategy, _debtRatio);
    }

    function removeStrategy(address _strategy) external onlyOwner {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();

        uint256 queuedPending = pendingStrategyDebt[_strategy];
        if (queuedPending > 0) {
            pendingAssets -= queuedPending;
            delete pendingStrategyDebt[_strategy];
            emit PendingAllocationReleased(_strategy, queuedPending, 0);
        }

        uint256 debt = strategyParams[_strategy].totalDebt;
        if (debt > 0) {
            uint256 withdrawn = IStrategy(_strategy).withdraw(debt);
            totalDeployedAssets -= (withdrawn > debt ? debt : withdrawn);
        }

        _cachedTotalDebtRatio -= strategyParams[_strategy].debtRatio;
        isActiveStrategy[_strategy] = false;

        uint256 len = strategies.length;
        for (uint256 i; i < len; ++i) {
            if (strategies[i] == _strategy) {
                strategies[i] = strategies[len - 1];
                strategies.pop();
                break;
            }
        }
        delete strategyParams[_strategy];
        delete isAsyncStrategy[_strategy];
        emit StrategyRemoved(_strategy);
        _emitSnapshot();
    }

    function updateStrategyDebtRatio(address _strategy, uint256 _debtRatio) external onlyOwner {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();
        uint256 oldRatio = strategyParams[_strategy].debtRatio;
        uint256 newTotal = _cachedTotalDebtRatio - oldRatio + _debtRatio;
        if (newTotal > MAX_BPS) revert InvalidDebtRatio();

        strategyParams[_strategy].debtRatio = _debtRatio;
        _cachedTotalDebtRatio = newTotal;
        emit StrategyDebtRatioUpdated(_strategy, _debtRatio);
    }

    function allocateToStrategy(address _strategy, uint256 _amount) external onlyOwner notShutdown {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();
        if (_amount == 0) revert InvalidAmount();

        uint256 freeIdle = _freeIdleAssets();
        if (freeIdle < _amount) revert InsufficientFunds();

        if (isAsyncStrategy[_strategy]) {
            _queuePendingAllocation(_strategy, _amount);
            _emitSnapshot();
            return;
        }

        IERC20(asset()).safeTransfer(_strategy, _amount);
        IStrategy(_strategy).invest();
        strategyParams[_strategy].totalDebt += _amount;
        totalDeployedAssets += _amount;

        emit FundsAllocatedToStrategy(_strategy, _amount);
        _emitSnapshot();
    }

    /**
     * @notice Finalize pending allocation for async strategies once external execution completes.
     * @dev For RWA-style delayed settlement, call this when USDC is actually moved into strategy.
     */
    function executePendingInvestment(address _strategy, uint256 _amount)
        external
        onlyOwner
        notShutdown
        nonReentrant
    {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();
        if (!isAsyncStrategy[_strategy]) revert InvalidStrategyState();
        if (_amount == 0) revert InvalidAmount();

        uint256 queued = pendingStrategyDebt[_strategy];
        if (_amount > queued) revert PendingAmountExceeded();

        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < _amount) revert InsufficientFunds();

        pendingStrategyDebt[_strategy] = queued - _amount;
        pendingAssets -= _amount;

        IERC20(asset()).safeTransfer(_strategy, _amount);
        IStrategy(_strategy).invest();

        strategyParams[_strategy].totalDebt += _amount;
        totalDeployedAssets += _amount;

        emit PendingInvestmentExecuted(_strategy, _amount, pendingStrategyDebt[_strategy]);
        emit FundsAllocatedToStrategy(_strategy, _amount);
        _emitSnapshot();
    }

    // ================================================================
    //                  HARVEST  —  manual & keeper
    // ================================================================

    function harvestStrategy(address _strategy) external {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();
        IStrategy(_strategy).harvest();
        _updateStrategyReport(_strategy);
        _emitSnapshot();
    }

    function harvestAll() external {
        uint256 len = strategies.length;
        for (uint256 i; i < len; ++i) {
            address s = strategies[i];
            if (isActiveStrategy[s]) {
                IStrategy(s).harvest();
                _updateStrategyReport(s);
            }
        }
        _emitSnapshot();
    }

    /// @notice Gas-efficient round-robin harvest — one strategy per call.
    function harvestNext() external returns (bool harvested) {
        uint256 len = strategies.length;
        if (len == 0) return false;

        uint256 start = nextHarvestIndex % len;
        uint256 idx = start;
        do {
            address s = strategies[idx];
            if (isActiveStrategy[s] && IStrategy(s).harvestTrigger()) {
                IStrategy(s).harvest();
                _updateStrategyReport(s);
                nextHarvestIndex = (idx + 1) % len;
                _emitSnapshot();
                return true;
            }
            idx = (idx + 1) % len;
        } while (idx != start);

        nextHarvestIndex = (start + 1) % len;
        return false;
    }

    // ---- Chainlink Automation ----
    function checkUpkeep(bytes calldata)
        external view returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256 len = strategies.length;
        for (uint256 i; i < len; ++i) {
            address s = strategies[i];
            if (isActiveStrategy[s] && IStrategy(s).harvestTrigger()) {
                return (true, abi.encode(s));
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external {
        address s = abi.decode(performData, (address));
        if (!isActiveStrategy[s]) revert StrategyNotFound();
        if (IStrategy(s).harvestTrigger()) {
            IStrategy(s).harvest();
            _updateStrategyReport(s);
            _emitSnapshot();
        }
    }

    // ---- Gelato Ops ----
    function checker()
        external view returns (bool canExec, bytes memory execPayload)
    {
        uint256 len = strategies.length;
        for (uint256 i; i < len; ++i) {
            address s = strategies[i];
            if (isActiveStrategy[s] && IStrategy(s).harvestTrigger()) {
                return (true, abi.encodeCall(this.harvestStrategy, (s)));
            }
        }
        return (false, "");
    }

    // ================================================================
    //                    MULTI-ASSET CONFIG
    // ================================================================

    function setSwapRouter(address _router) external onlyOwner {
        address oldRouter = swapRouter;
        swapRouter = _router;
        emit SwapRouterUpdated(oldRouter, _router);
    }

    function setAutoAllocate(bool _enabled) external onlyOwner {
        autoAllocate = _enabled;
        emit AutoAllocateUpdated(_enabled);
    }

    /**
     * @notice Mark strategy as async-settlement (e.g. RWA trade with delayed execution).
     * @dev Async strategies receive allocation into `pendingAssets` first.
     */
    function setStrategyAsync(address _strategy, bool _isAsync) external onlyOwner {
        if (!isActiveStrategy[_strategy]) revert StrategyNotFound();
        isAsyncStrategy[_strategy] = _isAsync;
        emit StrategyAsyncUpdated(_strategy, _isAsync);
    }

    function setSupportedDepositAsset(address _token, bool _supported) external onlyOwner {
        if (_token == address(0)) revert ZeroAddress();
        _setSupportedDepositAsset(_token, _supported);
    }

    function setSupportedDepositAssets(address[] calldata _tokens, bool _supported) external onlyOwner {
        uint256 len = _tokens.length;
        for (uint256 i; i < len; ++i) {
            if (_tokens[i] == address(0)) revert ZeroAddress();
            _setSupportedDepositAsset(_tokens[i], _supported);
        }
    }

    function rebalanceToDebtRatios() external onlyOwner notShutdown nonReentrant {
        _autoAllocateIdle();
        _emitSnapshot();
    }

    // ================================================================
    //                       FEE MANAGEMENT
    // ================================================================

    function setManagementFee(uint256 _fee) external onlyOwner {
        if (_fee > MAX_BPS) revert InvalidFee();
        managementFee = _fee;
        emit ManagementFeeUpdated(_fee);
    }

    function setPerformanceFee(uint256 _fee) external onlyOwner {
        if (_fee > MAX_BPS / 2) revert InvalidFee();
        performanceFee = _fee;
        emit PerformanceFeeUpdated(_fee);
    }

    /**
     * @notice Set APY for free idle assets (bps), used by projected APY.
     */
    function setIdleAPY(uint256 _apyBps) external onlyOwner {
        if (_apyBps > MAX_BPS) revert InvalidFee();
        idleAPY = _apyBps;
        emit IdleAPYUpdated(_apyBps);
    }

    /**
     * @notice Set APY for pending allocations (bps), used by projected APY.
     */
    function setPendingAPY(uint256 _apyBps) external onlyOwner {
        if (_apyBps > MAX_BPS) revert InvalidFee();
        pendingAPY = _apyBps;
        emit PendingAPYUpdated(_apyBps);
    }

    function setDepositLimit(uint256 _limit) external onlyOwner {
        depositLimit = _limit;
        emit DepositLimitUpdated(_limit);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        feeRecipient = _recipient;
    }

    function claimFees() external {
        uint256 total = accumulatedManagementFee + accumulatedPerformanceFee;
        if (total > 0) {
            accumulatedManagementFee = 0;
            accumulatedPerformanceFee = 0;
            uint256 feeShares = previewDeposit(total);
            if (feeShares > 0) _mint(feeRecipient, feeShares);
            _emitSnapshot();
        }
    }

    // ================================================================
    //                     EMERGENCY CONTROLS
    // ================================================================

    function setEmergencyShutdown(bool _active) external onlyOwner {
        emergencyShutdown = _active;
        emit EmergencyShutdownActivated(_active);
        if (_active) _pause(); else _unpause();
    }

    function emergencyWithdrawAll() external onlyOwner {
        uint256 len = strategies.length;
        for (uint256 i; i < len; ++i) {
            address s = strategies[i];
            uint256 queued = pendingStrategyDebt[s];
            if (queued > 0) {
                pendingAssets -= queued;
                pendingStrategyDebt[s] = 0;
                emit PendingAllocationReleased(s, queued, 0);
            }
            if (isActiveStrategy[s] && IStrategy(s).totalAssets() > 0) {
                IStrategy(s).emergencyWithdraw();
                strategyParams[s].totalDebt = 0;
            }
        }
        totalDeployedAssets = 0;
        _emitSnapshot();
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ================================================================
    //                       VIEW FUNCTIONS
    // ================================================================

    function strategiesLength() external view returns (uint256) { return strategies.length; }
    function getStrategies() external view returns (address[] memory) { return strategies; }
    function getSupportedDepositAssets() external view returns (address[] memory) {
        return _supportedDepositAssets;
    }
    function getStrategyInfo(address _s) external view returns (StrategyParams memory) {
        return strategyParams[_s];
    }
    function idleAssets() external view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }
    function freeIdleAssets() external view returns (uint256) {
        return _freeIdleAssets();
    }
    function pendingAssetsByStrategy(address _strategy) external view returns (uint256) {
        return pendingStrategyDebt[_strategy];
    }
    function deployedAssets() external view returns (uint256) { return totalDeployedAssets; }

    /// @notice Weighted APY estimate using cached debt — cheap.
    function estimatedAPY() external view returns (uint256) {
        return _projectedAPY();
    }

    function projectedAPY() external view returns (uint256) {
        return _projectedAPY();
    }

    function currentPricePerShare() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return (totalAssets() * 1e18) / supply;
    }

    function getAssetBreakdown()
        external
        view
        returns (uint256 idle, uint256 pending, uint256 deployed, uint256 freeIdle)
    {
        idle = IERC20(asset()).balanceOf(address(this));
        pending = pendingAssets;
        deployed = totalDeployedAssets;
        freeIdle = idle > pending ? idle - pending : 0;
    }

    function previewDepositAsset(address tokenIn, uint256 amountIn)
        external
        view
        returns (uint256 assetsOut, uint256 sharesOut)
    {
        if (amountIn == 0 || tokenIn == address(0)) return (0, 0);

        if (tokenIn == asset()) {
            assetsOut = amountIn;
            sharesOut = previewDeposit(amountIn);
            return (assetsOut, sharesOut);
        }

        if (!isSupportedDepositAsset[tokenIn] || swapRouter == address(0)) {
            return (0, 0);
        }

        assetsOut = IAssetSwapRouter(swapRouter).quoteExactInput(tokenIn, asset(), amountIn);
        if (assetsOut == 0) return (0, 0);

        sharesOut = _previewDepositForAssets(assetsOut, totalAssets());
    }

    // ================================================================
    //                     INTERNAL HELPERS
    // ================================================================

    function _projectedAPY() internal view returns (uint256) {
        uint256 total = totalAssets();
        if (total == 0) return 0;

        uint256 weightedAPY;
        uint256 len = strategies.length;
        for (uint256 i; i < len; ++i) {
            address s = strategies[i];
            if (isActiveStrategy[s]) {
                weightedAPY += IStrategy(s).estimatedAPY() * strategyParams[s].totalDebt;
            }
        }

        uint256 freeIdle = _freeIdleAssets();
        if (freeIdle > 0 && idleAPY > 0) {
            weightedAPY += idleAPY * freeIdle;
        }
        if (pendingAssets > 0 && pendingAPY > 0) {
            weightedAPY += pendingAPY * pendingAssets;
        }

        return weightedAPY / total;
    }

    function _freeIdleAssets() internal view returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle <= pendingAssets) return 0;
        return idle - pendingAssets;
    }

    function _previewDepositForAssets(uint256 _assets, uint256 _totalAssetsBefore)
        internal
        view
        returns (uint256)
    {
        return _assets.mulDiv(
            totalSupply() + 10 ** _decimalsOffset(),
            _totalAssetsBefore + 1,
            Math.Rounding.Floor
        );
    }

    function _autoAllocateIdle() internal {
        if (emergencyShutdown) return;

        uint256 idle = _freeIdleAssets();
        if (idle == 0) return;

        uint256 len = strategies.length;
        if (len == 0 || _cachedTotalDebtRatio == 0) return;

        uint256 total = totalAssets();
        uint256 totalAllocated;

        for (uint256 i; i < len && idle > 0; ++i) {
            address s = strategies[i];
            if (!isActiveStrategy[s]) continue;

            uint256 ratio = strategyParams[s].debtRatio;
            if (ratio == 0) continue;

            uint256 targetDebt = (total * ratio) / MAX_BPS;
            uint256 currentExposure = strategyParams[s].totalDebt + pendingStrategyDebt[s];
            if (targetDebt <= currentExposure) continue;

            uint256 toAllocate = targetDebt - currentExposure;
            if (toAllocate > idle) toAllocate = idle;
            if (toAllocate == 0) continue;

            if (isAsyncStrategy[s]) {
                _queuePendingAllocation(s, toAllocate);
            } else {
                IERC20(asset()).safeTransfer(s, toAllocate);
                IStrategy(s).invest();
                strategyParams[s].totalDebt += toAllocate;
                totalDeployedAssets += toAllocate;
                emit FundsAllocatedToStrategy(s, toAllocate);
            }

            idle -= toAllocate;
            totalAllocated += toAllocate;
        }

        if (totalAllocated > 0) {
            emit AutoAllocationExecuted(totalAllocated, idle);
        }
    }

    function _queuePendingAllocation(address _strategy, uint256 _amount) internal {
        pendingStrategyDebt[_strategy] += _amount;
        pendingAssets += _amount;
        emit PendingInvestmentQueued(_strategy, _amount, pendingStrategyDebt[_strategy]);
    }

    function _setSupportedDepositAsset(address _token, bool _supported) internal {
        bool current = isSupportedDepositAsset[_token];
        if (current == _supported) return;

        isSupportedDepositAsset[_token] = _supported;

        if (_supported) {
            _supportedDepositAssets.push(_token);
            _supportedAssetIndexPlusOne[_token] = _supportedDepositAssets.length;
        } else {
            uint256 idxPlusOne = _supportedAssetIndexPlusOne[_token];
            if (idxPlusOne != 0) {
                uint256 idx = idxPlusOne - 1;
                uint256 lastIdx = _supportedDepositAssets.length - 1;
                if (idx != lastIdx) {
                    address lastAsset = _supportedDepositAssets[lastIdx];
                    _supportedDepositAssets[idx] = lastAsset;
                    _supportedAssetIndexPlusOne[lastAsset] = idx + 1;
                }
                _supportedDepositAssets.pop();
                delete _supportedAssetIndexPlusOne[_token];
            }
        }

        emit SupportedDepositAssetUpdated(_token, _supported);
    }

    function _depositFromVaultBalance(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal {
        _mint(receiver, shares);
        emit Deposit(caller, receiver, assets, shares);
    }

    function _releasePendingReservationsForOutflow(uint256 _outflowAssets) internal {
        if (_outflowAssets == 0 || pendingAssets == 0) return;

        uint256 freeIdle = _freeIdleAssets();
        if (freeIdle >= _outflowAssets) return;

        uint256 neededFromPending = _outflowAssets - freeIdle;
        if (neededFromPending > pendingAssets) {
            neededFromPending = pendingAssets;
        }

        _releasePendingAmount(neededFromPending);
    }

    function _releasePendingAmount(uint256 _amount) internal {
        if (_amount == 0) return;

        uint256 remaining = _amount;
        uint256 len = strategies.length;

        for (uint256 i; i < len && remaining > 0; ++i) {
            address s = strategies[i];
            uint256 queued = pendingStrategyDebt[s];
            if (queued == 0) continue;

            uint256 released = queued > remaining ? remaining : queued;
            pendingStrategyDebt[s] = queued - released;
            remaining -= released;

            emit PendingAllocationReleased(s, released, pendingStrategyDebt[s]);
        }

        uint256 releasedTotal = _amount - remaining;
        if (releasedTotal > 0) {
            pendingAssets -= releasedTotal;
        }
    }

    function _withdrawFromStrategies(uint256 _amount) internal {
        uint256 remaining = _amount;
        uint256 len = strategies.length;
        for (uint256 i; i < len && remaining > 0; ++i) {
            address s = strategies[i];
            if (!isActiveStrategy[s]) continue;
            uint256 sAssets = IStrategy(s).totalAssets();
            if (sAssets == 0) continue;

            uint256 toWithdraw = remaining > sAssets ? sAssets : remaining;
            uint256 withdrawn = IStrategy(s).withdraw(toWithdraw);

            uint256 debtDelta = withdrawn > strategyParams[s].totalDebt
                ? strategyParams[s].totalDebt : withdrawn;
            strategyParams[s].totalDebt -= debtDelta;
            totalDeployedAssets -= debtDelta;
            remaining -= withdrawn;

            emit FundsWithdrawnFromStrategy(s, withdrawn);
        }
    }

    function _collectFees() internal {
        uint256 elapsed = block.timestamp - lastFeeCollection;
        if (elapsed == 0) return;
        uint256 total = totalAssets();
        if (total == 0) return;

        uint256 fee = (total * managementFee * elapsed) / (MAX_BPS * SECS_PER_YEAR);
        accumulatedManagementFee += fee;
        lastFeeCollection = block.timestamp;
        emit FeeCollected(fee, 0);
    }

    function _updateStrategyReport(address _strategy) internal {
        uint256 currentAssets = IStrategy(_strategy).totalAssets();
        uint256 previousDebt = strategyParams[_strategy].totalDebt;

        uint256 gain;
        uint256 loss;
        if (currentAssets > previousDebt) {
            gain = currentAssets - previousDebt;
            strategyParams[_strategy].totalGain += gain;
            accumulatedPerformanceFee += (gain * performanceFee) / MAX_BPS;
        } else if (currentAssets < previousDebt) {
            loss = previousDebt - currentAssets;
            strategyParams[_strategy].totalLoss += loss;
        }

        totalDeployedAssets = totalDeployedAssets - previousDebt + currentAssets;
        strategyParams[_strategy].totalDebt = currentAssets;
        strategyParams[_strategy].lastReport = block.timestamp;

        emit StrategyReported(_strategy, gain, loss, 0, currentAssets);
    }

    function _updatePerformanceMetrics(uint256 _pps) internal {
        uint256 ts = block.timestamp;

        if (lastPpsTimestamp > 0 && ts > lastPpsTimestamp && lastPricePerShare > 0) {
            int256 deltaPps = int256(_pps) - int256(lastPricePerShare);
            realizedAPY =
                (deltaPps * int256(SECS_PER_YEAR) * int256(MAX_BPS)) /
                (int256(lastPricePerShare) * int256(ts - lastPpsTimestamp));
        }

        if (_pps >= highWatermarkPps) {
            highWatermarkPps = _pps;
        } else if (highWatermarkPps > 0) {
            uint256 drawdown = ((highWatermarkPps - _pps) * MAX_BPS) / highWatermarkPps;
            if (drawdown > maxDrawdownBps) {
                maxDrawdownBps = drawdown;
            }
        }

        lastPricePerShare = _pps;
        lastPpsTimestamp = ts;

        emit PerformanceMetricsUpdated(realizedAPY, maxDrawdownBps, _pps);
    }

    function _emitSnapshot() internal {
        uint256 total = totalAssets();
        uint256 pps = totalSupply() > 0 ? (total * 1e18) / totalSupply() : 1e18;
        _updatePerformanceMetrics(pps);
        emit VaultSnapshot(
            total,
            IERC20(asset()).balanceOf(address(this)),
            totalDeployedAssets,
            pps,
            block.timestamp
        );
    }

}
