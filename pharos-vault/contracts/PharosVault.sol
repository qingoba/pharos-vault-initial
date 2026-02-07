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

    // ======================== Constants ========================
    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant SECS_PER_YEAR = 31_556_952;
    uint256 public constant MAX_STRATEGIES = 10;

    // ======================== Fee state ========================
    uint256 public managementFee;
    uint256 public performanceFee;
    uint256 public depositLimit;
    uint256 public lastFeeCollection;
    uint256 public accumulatedManagementFee;
    uint256 public accumulatedPerformanceFee;
    address public feeRecipient;

    // ======================== Emergency ========================
    bool public emergencyShutdown;

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
    event FundsAllocatedToStrategy(address indexed strategy, uint256 amount);
    event FundsWithdrawnFromStrategy(address indexed strategy, uint256 amount);

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
        _emitSnapshot();
        return a;
    }

    function withdraw(uint256 assets, address receiver, address _owner)
        public override nonReentrant returns (uint256)
    {
        _collectFees();
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < assets) {
            _withdrawFromStrategies(assets - idle);
        }
        uint256 shares = super.withdraw(assets, receiver, _owner);
        _emitSnapshot();
        return shares;
    }

    function redeem(uint256 shares, address receiver, address _owner)
        public override nonReentrant returns (uint256)
    {
        _collectFees();
        uint256 assets = previewRedeem(shares);
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < assets) {
            _withdrawFromStrategies(assets - idle);
        }
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
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < _amount) revert InsufficientFunds();

        IERC20(asset()).safeTransfer(_strategy, _amount);
        IStrategy(_strategy).invest();
        strategyParams[_strategy].totalDebt += _amount;
        totalDeployedAssets += _amount;

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
    function getStrategyInfo(address _s) external view returns (StrategyParams memory) {
        return strategyParams[_s];
    }
    function idleAssets() external view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }
    function deployedAssets() external view returns (uint256) { return totalDeployedAssets; }

    /// @notice Weighted APY estimate using cached debt — cheap.
    function estimatedAPY() external view returns (uint256) {
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
        return weightedAPY / total;
    }

    // ================================================================
    //                     INTERNAL HELPERS
    // ================================================================

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

    function _emitSnapshot() internal {
        uint256 total = totalAssets();
        uint256 pps = totalSupply() > 0 ? (total * 1e18) / totalSupply() : 1e18;
        emit VaultSnapshot(
            total,
            IERC20(asset()).balanceOf(address(this)),
            totalDeployedAssets,
            pps,
            block.timestamp
        );
    }
}
