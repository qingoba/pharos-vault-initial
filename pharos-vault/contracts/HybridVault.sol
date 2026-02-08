// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IHybridVault.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IAsyncStrategy.sol";

/**
 * @title HybridVault
 * @notice 混合金库 — 同时管理同步(DeFi/4626)和异步(RWA/7540)策略
 *         用户获得统一的 ERC20 share token
 */
contract HybridVault is ERC4626, Ownable, ReentrancyGuard, IHybridVault {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_BPS = 10_000;

    // ======================== 策略注册 ========================

    address[] public _syncStrategies;
    address[] public _asyncStrategies;
    mapping(address => bool) public isSyncStrategy;
    mapping(address => bool) public isAsyncStrategy;

    // 同步策略参数
    struct SyncParams {
        uint256 debtRatio;
        uint256 totalDebt;
        uint256 totalGain;
        uint256 lastReport;
    }
    mapping(address => SyncParams) public syncParams;

    // 异步策略参数
    struct AsyncParams {
        uint256 debtRatio;
    }
    mapping(address => AsyncParams) public asyncParams;

    uint256 public override syncTotalRatio;
    uint256 public override asyncTotalRatio;

    // ======================== 同步策略缓存 ========================

    uint256 public totalSyncDebt;

    // ======================== 异步用户状态（vault 层聚合）========================

    mapping(address => uint256) public _pendingDeposit;
    mapping(address => uint256) public _claimableShares;
    mapping(address => uint256) public _pendingRedeem;      // shares pending
    mapping(address => uint256) public _pendingRedeemAssets; // assets owed (with profit)
    mapping(address => uint256) public _claimableAssets;

    // ======================== 费率 ========================

    uint256 public managementFee;   // bps
    uint256 public performanceFee;  // bps
    address public feeRecipient;
    uint256 public lastFeeCollection;
    uint256 public accumulatedFees;

    // ======================== 事件 ========================

    event VaultSnapshot(uint256 totalAssets, uint256 syncAssets, uint256 asyncAssets, uint256 pps, uint256 timestamp);

    // ======================== 构造 ========================

    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _feeRecipient
    ) ERC4626(_asset) ERC20(_name, _symbol) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        managementFee = 200;
        performanceFee = 1000;
        lastFeeCollection = block.timestamp;
    }

    // ================================================================
    //                        TOTAL ASSETS
    // ================================================================

    function totalAssets() public view override returns (uint256) {
        // Sync assets are tracked via totalSyncDebt (funds in sync strategies)
        // Async assets are in async strategies
        // Idle = any USDC sitting in vault (shouldn't be much after deposit)
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        uint256 asyncTotal = _totalAsyncAssets();
        return idle + totalSyncDebt + asyncTotal;
    }

    function _totalAsyncAssets() internal view returns (uint256 total) {
        for (uint256 i; i < _asyncStrategies.length; ++i) {
            if (isAsyncStrategy[_asyncStrategies[i]]) {
                total += IAsyncStrategy(_asyncStrategies[i]).totalAssets();
            }
        }
    }

    // ================================================================
    //                     DEPOSIT (同步 + 异步)
    // ================================================================

    function deposit(uint256 assets, address receiver)
        public override nonReentrant returns (uint256 syncShares)
    {
        require(assets > 0, "Zero");
        _collectFees();

        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);

        uint256 totalRatio = syncTotalRatio + asyncTotalRatio;
        require(totalRatio > 0, "No strategies");

        // 同步部分：立即 mint shares 并分配到策略
        uint256 syncAmount = (assets * syncTotalRatio) / totalRatio;
        if (syncAmount > 0) {
            syncShares = _convertToShares(syncAmount);
            _mint(receiver, syncShares);
            _distributeSyncDeposit(syncAmount);
            emit SyncDeposit(receiver, syncAmount, syncShares);
        }

        // 异步部分：进入 pending
        uint256 asyncAmount = assets - syncAmount;
        if (asyncAmount > 0) {
            _distributeAsyncDeposit(asyncAmount, receiver);
            emit AsyncDepositRequested(receiver, asyncAmount);
        }

        _emitSnapshot();
        return syncShares;
    }

    function _distributeSyncDeposit(uint256 amount) internal {
        uint256 len = _syncStrategies.length;
        if (len == 0) return;
        
        uint256 remaining = amount;
        for (uint256 i; i < len; ++i) {
            address s = _syncStrategies[i];
            if (!isSyncStrategy[s]) continue;
            uint256 share = (i == len - 1) ? remaining : (amount * syncParams[s].debtRatio) / syncTotalRatio;
            if (share == 0 || share > remaining) continue;
            
            IERC20(asset()).safeTransfer(s, share);
            IStrategy(s).invest();
            syncParams[s].totalDebt += share;
            totalSyncDebt += share;
            remaining -= share;
        }
    }

    function _distributeAsyncDeposit(uint256 amount, address depositor) internal {
        uint256 len = _asyncStrategies.length;
        uint256 remaining = amount;
        for (uint256 i; i < len; ++i) {
            address s = _asyncStrategies[i];
            if (!isAsyncStrategy[s]) continue;
            uint256 share = (i == len - 1) ? remaining : (amount * asyncParams[s].debtRatio) / asyncTotalRatio;
            if (share == 0) continue;
            if (share > remaining) share = remaining;

            IERC20(asset()).safeTransfer(s, share);
            IAsyncStrategy(s).requestDeposit(share, depositor);
            _pendingDeposit[depositor] += share;
            remaining -= share;
        }
    }

    // ================================================================
    //                  CLAIM ASYNC SHARES (用户调用)
    // ================================================================

    function claimAsyncShares(address receiver) external override nonReentrant returns (uint256 totalShares) {
        uint256 len = _asyncStrategies.length;
        for (uint256 i; i < len; ++i) {
            address s = _asyncStrategies[i];
            if (!isAsyncStrategy[s]) continue;
            uint256 claimable = IAsyncStrategy(s).claimableShares(receiver);
            if (claimable > 0) {
                uint256 shares = IAsyncStrategy(s).claimShares(receiver);
                totalShares += shares;
            }
        }
        if (totalShares > 0) {
            _mint(receiver, totalShares);
            // 清除 vault 层 pending 记录
            _pendingDeposit[receiver] = 0;
            _claimableShares[receiver] = 0;
            emit AsyncSharesClaimed(receiver, totalShares);
        }
        _emitSnapshot();
    }

    // ================================================================
    //                   WITHDRAW / REDEEM (同步 + 异步)
    // ================================================================

    function withdraw(uint256 assets, address receiver, address _owner)
        public override nonReentrant returns (uint256 shares)
    {
        _collectFees();
        shares = _convertToShares(assets);
        _doRedeem(shares, receiver, _owner);
        return shares;
    }

    function redeem(uint256 shares, address receiver, address _owner)
        public override nonReentrant returns (uint256 assets)
    {
        _collectFees();
        // Don't pre-calculate assets - let each strategy determine its own
        _doRedeem(shares, receiver, _owner);
        // Return total assets user will receive (sync immediate + async pending)
        assets = _convertToAssets(shares);
        return assets;
    }

    function _doRedeem(uint256 shares, address receiver, address _owner) internal {
        if (msg.sender != _owner) {
            _spendAllowance(_owner, msg.sender, shares);
        }

        uint256 totalRatio = syncTotalRatio + asyncTotalRatio;
        uint256 supplyBefore = totalSupply(); // Capture before any burns

        // 同步部分：立即赎回 - 按策略实际资产计算
        uint256 syncShares = (shares * syncTotalRatio) / totalRatio;
        if (syncShares > 0) {
            // Calculate sync assets before burn
            uint256 syncAssets = _calcSyncAssets(syncShares, supplyBefore);
            _burn(_owner, syncShares);
            _withdrawSyncAssets(syncAssets);
            if (syncAssets > 0) {
                IERC20(asset()).safeTransfer(receiver, syncAssets);
            }
            emit SyncWithdraw(receiver, syncAssets, syncShares);
        }

        // 异步部分：进入 pending - 按 RWA 策略实际资产计算
        uint256 asyncShares = shares - syncShares;
        if (asyncShares > 0) {
            // Calculate async assets before transfer
            uint256 asyncAssets = _calcAsyncAssets(asyncShares, supplyBefore);
            _transfer(_owner, address(this), asyncShares);
            _distributeAsyncRedeem(asyncShares, receiver);
            _pendingRedeem[receiver] += asyncShares;
            _pendingRedeemAssets[receiver] += asyncAssets;
            emit AsyncRedeemRequested(receiver, asyncShares);
        }

        _emitSnapshot();
    }

    /// @notice Calculate sync assets for given shares
    function _calcSyncAssets(uint256 syncShares, uint256 supply) internal view returns (uint256) {
        if (supply == 0) return syncShares;
        uint256 totalRatio = syncTotalRatio + asyncTotalRatio;
        uint256 syncSupply = (supply * syncTotalRatio) / totalRatio;
        if (syncSupply == 0) return syncShares;
        return (syncShares * totalSyncDebt) / syncSupply;
    }

    /// @notice Calculate async assets for given shares  
    function _calcAsyncAssets(uint256 asyncShares, uint256 supply) internal view returns (uint256) {
        uint256 asyncTotal = _totalAsyncAssets();
        if (asyncTotal == 0 || supply == 0) return asyncShares;
        uint256 totalRatio = syncTotalRatio + asyncTotalRatio;
        uint256 asyncSupply = (supply * asyncTotalRatio) / totalRatio;
        if (asyncSupply == 0) return asyncShares;
        return (asyncShares * asyncTotal) / asyncSupply;
    }

    /// @notice Withdraw sync assets from strategies
    function _withdrawSyncAssets(uint256 amount) internal {
        uint256 remaining = amount;
        for (uint256 i; i < _syncStrategies.length && remaining > 0; ++i) {
            address s = _syncStrategies[i];
            if (!isSyncStrategy[s]) continue;
            uint256 sAssets = IStrategy(s).totalAssets();
            if (sAssets == 0) continue;
            uint256 toWithdraw = remaining > sAssets ? sAssets : remaining;
            uint256 withdrawn = IStrategy(s).withdraw(toWithdraw);
            uint256 debtDelta = withdrawn > syncParams[s].totalDebt ? syncParams[s].totalDebt : withdrawn;
            syncParams[s].totalDebt -= debtDelta;
            totalSyncDebt -= debtDelta;
            remaining -= withdrawn;
        }
    }

    function _distributeAsyncRedeem(uint256 shares, address redeemer) internal {
        uint256 len = _asyncStrategies.length;
        uint256 remaining = shares;
        for (uint256 i; i < len; ++i) {
            address s = _asyncStrategies[i];
            if (!isAsyncStrategy[s]) continue;
            uint256 share = (i == len - 1) ? remaining : (shares * asyncParams[s].debtRatio) / asyncTotalRatio;
            if (share == 0) continue;
            if (share > remaining) share = remaining;

            IAsyncStrategy(s).requestRedeem(share, redeemer);
            remaining -= share;
        }
    }

    // ================================================================
    //                  CLAIM ASYNC ASSETS (用户调用)
    // ================================================================

    function claimAsyncAssets(address receiver) external override nonReentrant returns (uint256 totalAssetsClaimed) {
        // Use vault-tracked assets (includes profit via PPS at redeem time)
        uint256 owedAssets = _pendingRedeemAssets[receiver];
        require(owedAssets > 0, "Nothing to claim");

        // Check that strategies have fulfilled (claimableAssets > 0)
        uint256 len = _asyncStrategies.length;
        for (uint256 i; i < len; ++i) {
            address s = _asyncStrategies[i];
            if (!isAsyncStrategy[s]) continue;
            uint256 claimable = IAsyncStrategy(s).claimableAssets(receiver);
            if (claimable > 0) {
                // Clear the strategy's claimable state, withdraw owedAssets (not 1:1)
                IAsyncStrategy(s).claimAssets(receiver);
            }
        }

        // Burn the locked shares
        uint256 pendingShares = _pendingRedeem[receiver];
        if (pendingShares > 0) {
            _burn(address(this), pendingShares);
            _pendingRedeem[receiver] = 0;
        }
        _pendingRedeemAssets[receiver] = 0;

        // Transfer the full owed amount (with profit) directly from vault
        // Vault should have received funds from strategy.claimAssets
        totalAssetsClaimed = owedAssets;
        IERC20(asset()).safeTransfer(receiver, totalAssetsClaimed);
        emit AsyncAssetsClaimed(receiver, totalAssetsClaimed);
        _emitSnapshot();
    }

    // ================================================================
    //                     ASYNC VIEW FUNCTIONS
    // ================================================================

    function pendingDepositOf(address user) external view override returns (uint256) {
        return _pendingDeposit[user];
    }

    function claimableSharesOf(address user) external view override returns (uint256 total) {
        for (uint256 i; i < _asyncStrategies.length; ++i) {
            address s = _asyncStrategies[i];
            if (isAsyncStrategy[s]) {
                total += IAsyncStrategy(s).claimableShares(user);
            }
        }
    }

    function pendingRedeemOf(address user) external view override returns (uint256) {
        return _pendingRedeem[user];
    }

    function claimableAssetsOf(address user) external view override returns (uint256) {
        // Return vault-tracked amount (includes profit)
        // Only claimable after operator fulfills
        uint256 strategyClaimable;
        for (uint256 i; i < _asyncStrategies.length; ++i) {
            address s = _asyncStrategies[i];
            if (isAsyncStrategy[s]) {
                strategyClaimable += IAsyncStrategy(s).claimableAssets(user);
            }
        }
        // If strategy says claimable, return the vault-tracked assets (with profit)
        return strategyClaimable > 0 ? _pendingRedeemAssets[user] : 0;
    }

    // ================================================================
    //                    STRATEGY MANAGEMENT
    // ================================================================

    function addSyncStrategy(address strategy, uint256 debtRatio) external override onlyOwner {
        require(!isSyncStrategy[strategy] && !isAsyncStrategy[strategy], "Exists");
        require(IStrategy(strategy).asset() == asset(), "Asset mismatch");
        require(IStrategy(strategy).vault() == address(this), "Vault mismatch");
        require(syncTotalRatio + asyncTotalRatio + debtRatio <= MAX_BPS, "Ratio overflow");

        _syncStrategies.push(strategy);
        isSyncStrategy[strategy] = true;
        syncParams[strategy] = SyncParams(debtRatio, 0, 0, block.timestamp);
        syncTotalRatio += debtRatio;
        emit SyncStrategyAdded(strategy, debtRatio);
    }

    function addAsyncStrategy(address strategy, uint256 debtRatio) external override onlyOwner {
        require(!isSyncStrategy[strategy] && !isAsyncStrategy[strategy], "Exists");
        require(IAsyncStrategy(strategy).asset() == asset(), "Asset mismatch");
        require(IAsyncStrategy(strategy).vault() == address(this), "Vault mismatch");
        require(syncTotalRatio + asyncTotalRatio + debtRatio <= MAX_BPS, "Ratio overflow");

        _asyncStrategies.push(strategy);
        isAsyncStrategy[strategy] = true;
        asyncParams[strategy] = AsyncParams(debtRatio);
        asyncTotalRatio += debtRatio;
        emit AsyncStrategyAdded(strategy, debtRatio);
    }

    function removeSyncStrategy(address strategy) external override onlyOwner {
        require(isSyncStrategy[strategy], "Not found");
        syncTotalRatio -= syncParams[strategy].debtRatio;
        isSyncStrategy[strategy] = false;
        _removeFromArray(_syncStrategies, strategy);
        delete syncParams[strategy];
        emit StrategyRemoved(strategy);
    }

    function removeAsyncStrategy(address strategy) external override onlyOwner {
        require(isAsyncStrategy[strategy], "Not found");
        asyncTotalRatio -= asyncParams[strategy].debtRatio;
        isAsyncStrategy[strategy] = false;
        _removeFromArray(_asyncStrategies, strategy);
        delete asyncParams[strategy];
        emit StrategyRemoved(strategy);
    }

    function getSyncStrategies() external view override returns (address[] memory) {
        return _syncStrategies;
    }

    function getAsyncStrategies() external view override returns (address[] memory) {
        return _asyncStrategies;
    }

    // ================================================================
    //                   SYNC STRATEGY OPERATIONS
    // ================================================================

    function allocateToSyncStrategy(address strategy, uint256 amount) external override onlyOwner {
        require(isSyncStrategy[strategy], "Not sync");
        IERC20(asset()).safeTransfer(strategy, amount);
        IStrategy(strategy).invest();
        syncParams[strategy].totalDebt += amount;
        totalSyncDebt += amount;
    }

    function harvestSyncStrategy(address strategy) external override {
        require(isSyncStrategy[strategy], "Not sync");
        IStrategy(strategy).harvest();
        _updateSyncReport(strategy);
        _emitSnapshot();
    }

    /// @notice Harvest an async strategy (realize injected yield)
    function harvestAsyncStrategy(address strategy) external {
        require(isAsyncStrategy[strategy], "Not async");
        // Call harvest on the async strategy to realize injectedYield
        (bool ok,) = strategy.call(abi.encodeWithSignature("harvest()"));
        require(ok, "Harvest failed");
        _emitSnapshot();
    }

    function harvestAll() external override {
        for (uint256 i; i < _syncStrategies.length; ++i) {
            address s = _syncStrategies[i];
            if (isSyncStrategy[s]) {
                IStrategy(s).harvest();
                _updateSyncReport(s);
            }
        }
        for (uint256 i; i < _asyncStrategies.length; ++i) {
            address s = _asyncStrategies[i];
            if (isAsyncStrategy[s]) {
                (bool ok,) = s.call(abi.encodeWithSignature("harvest()"));
                // ignore failure
            }
        }
        _emitSnapshot();
    }

    // ================================================================
    //                        FEE MANAGEMENT
    // ================================================================

    function setManagementFee(uint256 _fee) external onlyOwner { managementFee = _fee; }
    function setPerformanceFee(uint256 _fee) external onlyOwner { performanceFee = _fee; }
    function setFeeRecipient(address _r) external onlyOwner { feeRecipient = _r; }

    function claimFees() external {
        if (accumulatedFees > 0) {
            uint256 feeShares = _convertToShares(accumulatedFees);
            accumulatedFees = 0;
            if (feeShares > 0) _mint(feeRecipient, feeShares);
        }
    }

    // ================================================================
    //                       INTERNAL HELPERS
    // ================================================================

    function _convertToShares(uint256 assets) internal view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? assets : (assets * supply) / totalAssets();
    }

    function _convertToAssets(uint256 shares) internal view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }

    function _withdrawFromSyncStrategies(uint256 amount) internal {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle >= amount) return;

        uint256 remaining = amount - idle;
        for (uint256 i; i < _syncStrategies.length && remaining > 0; ++i) {
            address s = _syncStrategies[i];
            if (!isSyncStrategy[s]) continue;
            uint256 sAssets = IStrategy(s).totalAssets();
            if (sAssets == 0) continue;

            uint256 toWithdraw = remaining > sAssets ? sAssets : remaining;
            uint256 withdrawn = IStrategy(s).withdraw(toWithdraw);
            uint256 debtDelta = withdrawn > syncParams[s].totalDebt ? syncParams[s].totalDebt : withdrawn;
            syncParams[s].totalDebt -= debtDelta;
            totalSyncDebt -= debtDelta;
            remaining -= withdrawn;
        }
    }

    function _updateSyncReport(address strategy) internal {
        uint256 current = IStrategy(strategy).totalAssets();
        uint256 prev = syncParams[strategy].totalDebt;
        if (current > prev) {
            uint256 gain = current - prev;
            syncParams[strategy].totalGain += gain;
            accumulatedFees += (gain * performanceFee) / MAX_BPS;
        }
        totalSyncDebt = totalSyncDebt - prev + current;
        syncParams[strategy].totalDebt = current;
        syncParams[strategy].lastReport = block.timestamp;
    }

    function _collectFees() internal {
        uint256 elapsed = block.timestamp - lastFeeCollection;
        if (elapsed == 0) return;
        uint256 total = totalAssets();
        if (total == 0) return;
        accumulatedFees += (total * managementFee * elapsed) / (MAX_BPS * 31_556_952);
        lastFeeCollection = block.timestamp;
    }

    function _removeFromArray(address[] storage arr, address item) internal {
        uint256 len = arr.length;
        for (uint256 i; i < len; ++i) {
            if (arr[i] == item) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }

    function _emitSnapshot() internal {
        uint256 total = totalAssets();
        uint256 pps = totalSupply() > 0 ? (total * 1e18) / totalSupply() : 1e18;
        emit VaultSnapshot(total, totalSyncDebt, _totalAsyncAssets(), pps, block.timestamp);
    }

    // ================================================================
    //                   ERC4626 OVERRIDES (disable direct)
    // ================================================================
    // 禁用原生 ERC4626 的 deposit/mint/withdraw/redeem，强制走 HybridVault 的逻辑

    function mint(uint256, address) public pure override returns (uint256) {
        revert("Use deposit()");
    }
}
