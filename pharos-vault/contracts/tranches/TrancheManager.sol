// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./TrancheVault.sol";

/**
 * @title TrancheManager
 * @notice Manages a two-tranche (Senior / Junior) risk-split structure
 *         backed by a single PharosVault position.
 *
 * Waterfall model
 * ───────────────
 *   1. Senior tranche receives a fixed target APR on its deposits first.
 *   2. Remaining yield (or all yield if it exceeds the target) goes to
 *      Junior tranche — which also absorbs first losses.
 *   3. If total yield < senior target, the shortfall reduces junior value.
 *
 * Users deposit the underlying stablecoin into the manager, choosing
 * Senior or Junior.  The manager forwards the assets to the PharosVault.
 *
 * @dev Integrates with any ERC4626 vault.
 */
contract TrancheManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ======================== State ========================
    IERC20  public immutable asset;        // underlying (e.g. USDC)
    address public immutable vault;        // PharosVault
    TrancheVault public seniorTranche;
    TrancheVault public juniorTranche;

    /// @notice Senior tranche target APR in basis points (e.g. 300 = 3%).
    uint256 public seniorTargetAPR;

    /// @notice Total assets deposited into each tranche (principal tracking).
    uint256 public seniorDeposits;
    uint256 public juniorDeposits;

    /// @notice Last waterfall timestamp.
    uint256 public lastWaterfallTime;

    // ======================== Events ========================
    event Deposited(address indexed user, bool isSenior, uint256 assets, uint256 shares);
    event Redeemed(address indexed user, bool isSenior, uint256 shares, uint256 assets);
    event WaterfallExecuted(
        uint256 totalYield,
        uint256 seniorYield,
        uint256 juniorYield,
        uint256 timestamp
    );
    event SeniorTargetAPRUpdated(uint256 newAPR);

    // ======================== Errors ========================
    error ZeroAmount();

    // ======================== Constructor ========================
    constructor(
        address _asset,
        address _vault,
        uint256 _seniorTargetAPR
    ) Ownable(msg.sender) {
        asset = IERC20(_asset);
        vault = _vault;
        seniorTargetAPR = _seniorTargetAPR;
        lastWaterfallTime = block.timestamp;

        // Deploy tranche tokens
        seniorTranche = new TrancheVault(
            IERC20(_asset),
            "Pharos Senior pvUSDC",
            "spvUSDC",
            address(this)
        );
        juniorTranche = new TrancheVault(
            IERC20(_asset),
            "Pharos Junior pvUSDC",
            "jpvUSDC",
            address(this)
        );

        // Approve vault to pull assets
        asset.forceApprove(_vault, type(uint256).max);
    }

    // ======================== Deposit ========================

    function depositSenior(uint256 _assets, address _receiver)
        external nonReentrant returns (uint256 shares)
    {
        if (_assets == 0) revert ZeroAmount();
        asset.safeTransferFrom(msg.sender, address(this), _assets);

        // Forward to vault
        IERC4626(vault).deposit(_assets, address(this));
        seniorDeposits += _assets;

        // Mint tranche shares — transfer asset to tranche first
        asset.safeTransferFrom(msg.sender, address(seniorTranche), 0); // no-op, assets in manager
        // Actually we need assets in tranche for ERC4626 accounting.
        // Simpler: track internally, set managedAssets.
        seniorTranche.setManagedAssets(seniorDeposits);
        shares = _assets; // 1:1 at deposit time
        // Mint via low-level
        _mintTrancheShares(address(seniorTranche), _receiver, shares);

        emit Deposited(_receiver, true, _assets, shares);
    }

    function depositJunior(uint256 _assets, address _receiver)
        external nonReentrant returns (uint256 shares)
    {
        if (_assets == 0) revert ZeroAmount();
        asset.safeTransferFrom(msg.sender, address(this), _assets);

        IERC4626(vault).deposit(_assets, address(this));
        juniorDeposits += _assets;

        juniorTranche.setManagedAssets(juniorDeposits);
        shares = _assets;
        _mintTrancheShares(address(juniorTranche), _receiver, shares);

        emit Deposited(_receiver, false, _assets, shares);
    }

    // ======================== Withdraw ========================

    function redeemSenior(uint256 _shares, address _receiver)
        external nonReentrant returns (uint256 assets)
    {
        if (_shares == 0) revert ZeroAmount();
        // Calculate value of shares
        uint256 totalSenior = seniorTranche.totalAssets();
        uint256 totalShares = seniorTranche.totalSupply();
        assets = totalShares > 0 ? (_shares * totalSenior) / totalShares : _shares;

        // Burn tranche shares
        _burnTrancheShares(address(seniorTranche), msg.sender, _shares);

        // Withdraw from vault
        IERC4626(vault).withdraw(assets, _receiver, address(this));
        seniorDeposits = seniorDeposits > assets ? seniorDeposits - assets : 0;
        seniorTranche.setManagedAssets(seniorDeposits);

        emit Redeemed(_receiver, true, _shares, assets);
    }

    function redeemJunior(uint256 _shares, address _receiver)
        external nonReentrant returns (uint256 assets)
    {
        if (_shares == 0) revert ZeroAmount();
        uint256 totalJunior = juniorTranche.totalAssets();
        uint256 totalShares = juniorTranche.totalSupply();
        assets = totalShares > 0 ? (_shares * totalJunior) / totalShares : _shares;

        _burnTrancheShares(address(juniorTranche), msg.sender, _shares);

        IERC4626(vault).withdraw(assets, _receiver, address(this));
        juniorDeposits = juniorDeposits > assets ? juniorDeposits - assets : 0;
        juniorTranche.setManagedAssets(juniorDeposits);

        emit Redeemed(_receiver, false, _shares, assets);
    }

    // ======================== Waterfall ========================

    /**
     * @notice Execute the yield waterfall to distribute returns between tranches.
     *         Should be called periodically (e.g. after harvestAll).
     */
    function executeWaterfall() external {
        uint256 vaultShares = IERC20(vault).balanceOf(address(this));
        uint256 vaultValue = IERC4626(vault).convertToAssets(vaultShares);
        uint256 totalPrincipal = seniorDeposits + juniorDeposits;

        if (vaultValue <= totalPrincipal) {
            // Loss scenario — junior absorbs first
            uint256 loss = totalPrincipal - vaultValue;
            uint256 juniorLoss = loss > juniorDeposits ? juniorDeposits : loss;
            uint256 seniorLoss = loss > juniorDeposits ? loss - juniorDeposits : 0;

            juniorTranche.setManagedAssets(juniorDeposits - juniorLoss);
            seniorTranche.setManagedAssets(seniorDeposits - seniorLoss);

            emit WaterfallExecuted(0, 0, 0, block.timestamp);
        } else {
            uint256 totalYield = vaultValue - totalPrincipal;
            uint256 elapsed = block.timestamp - lastWaterfallTime;

            // Senior gets its target APR pro-rata
            uint256 seniorTarget = (seniorDeposits * seniorTargetAPR * elapsed)
                / (10_000 * 365.2425 days);

            uint256 seniorYield = totalYield >= seniorTarget ? seniorTarget : totalYield;
            uint256 juniorYield = totalYield - seniorYield;

            seniorTranche.setManagedAssets(seniorDeposits + seniorYield);
            juniorTranche.setManagedAssets(juniorDeposits + juniorYield);

            // Update principal to include yield for next period
            seniorDeposits += seniorYield;
            juniorDeposits += juniorYield;

            emit WaterfallExecuted(totalYield, seniorYield, juniorYield, block.timestamp);
        }

        lastWaterfallTime = block.timestamp;
    }

    // ======================== Admin ========================

    function setSeniorTargetAPR(uint256 _apr) external onlyOwner {
        seniorTargetAPR = _apr;
        emit SeniorTargetAPRUpdated(_apr);
    }

    // ======================== View ========================

    function seniorTotalAssets() external view returns (uint256) {
        return seniorTranche.totalAssets();
    }

    function juniorTotalAssets() external view returns (uint256) {
        return juniorTranche.totalAssets();
    }

    function totalManagedAssets() external view returns (uint256) {
        return IERC4626(vault).convertToAssets(IERC20(vault).balanceOf(address(this)));
    }

    // ======================== Internal ========================

    function _mintTrancheShares(address tranche, address to, uint256 amount) internal {
        // Use a low-level call to the tranche's internal _mint
        // Since TrancheVault inherits ERC20, we can call via the manager pattern.
        // We use a simple approach: the tranche directly mints via a manager-only function.
        // Let's add a mintShares function to TrancheVault.
        TrancheVault(tranche).mintShares(to, amount);
    }

    function _burnTrancheShares(address tranche, address from, uint256 amount) internal {
        TrancheVault(tranche).burnShares(from, amount);
    }
}
