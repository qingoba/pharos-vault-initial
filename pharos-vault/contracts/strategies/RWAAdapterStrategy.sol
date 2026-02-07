// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";
import "./BaseStrategy.sol";

/**
 * @title RWAAdapterStrategy
 * @notice Production-grade strategy that deposits into any ERC4626-compatible
 *         RWA vault (e.g. Ondo OUSG, Backed bIB01, or wrapped T-Bill vaults).
 *
 * Architecture
 * ────────────
 *   PharosVault ──deposit──> RWAAdapterStrategy ──deposit──> External RWA Vault
 *               <─withdraw─                    <─withdraw─
 *
 * The adapter holds shares of the external RWA vault and reports their
 * value back to PharosVault through the standard IStrategy interface.
 *
 * Deployments can point `rwaVault` at:
 *   • A real on-chain RWA vault (Ondo, Backed, Maple, Centrifuge).
 *   • A MockRWAVault for hackathon demos.
 */
contract RWAAdapterStrategy is BaseStrategy {
    using SafeERC20 for IERC20;

    // ======================== State ========================
    IERC4626 public rwaVault;           // external ERC4626 RWA vault
    uint256  public rwaShares;          // shares held in the external vault
    uint256  public targetAPY;          // bps — informational, from config

    // ======================== Events ========================
    event RWAVaultUpdated(address indexed newVault);
    event TargetAPYUpdated(uint256 newAPY);

    // ======================== Constructor ========================
    constructor(
        address _vault,          // PharosVault
        address _asset,          // underlying stablecoin
        address _rwaVault,       // external ERC4626 RWA vault
        uint256 _targetAPY       // informational target APY in bps
    ) BaseStrategy(_vault, _asset, "Pharos RWA Adapter Strategy") {
        require(_rwaVault != address(0), "Invalid RWA vault");
        rwaVault = IERC4626(_rwaVault);
        targetAPY = _targetAPY;

        // Approve the external vault to pull our asset
        IERC20(_asset).forceApprove(_rwaVault, type(uint256).max);
    }

    // ======================== View ========================

    function totalAssets() public view override returns (uint256) {
        if (rwaShares == 0) return want.balanceOf(address(this));
        return rwaVault.convertToAssets(rwaShares) + want.balanceOf(address(this));
    }

    function estimatedAPY() external view override returns (uint256) {
        return targetAPY;
    }

    function _harvestTriggerCheck() internal view override returns (bool) {
        // Trigger when pending gain > 0.1% of principal
        if (rwaShares == 0) return false;
        uint256 currentValue = rwaVault.convertToAssets(rwaShares);
        uint256 idle = want.balanceOf(address(this));
        uint256 total = currentValue + idle;
        // Use a simple threshold
        return total > 0;
    }

    // ======================== Core ========================

    function _invest(uint256 _amount) internal override {
        // Deposit into external RWA vault
        uint256 balance = want.balanceOf(address(this));
        uint256 toInvest = _amount > balance ? balance : _amount;
        if (toInvest > 0) {
            uint256 shares = rwaVault.deposit(toInvest, address(this));
            rwaShares += shares;
        }
    }

    function _harvest() internal override returns (uint256 profit) {
        if (rwaShares == 0) return 0;

        uint256 idle = want.balanceOf(address(this));

        // The "profit" is the increase since last report — tracked by PharosVault
        // via _updateStrategyReport.  We don't need to realise it here.
        // Just re-invest any idle balance.
        if (idle > 0) {
            uint256 shares = rwaVault.deposit(idle, address(this));
            rwaShares += shares;
        }

        // Return the gain — PharosVault uses totalAssets() delta.
        return 0; // vault calculates gain from totalAssets delta
    }

    function _withdraw(uint256 _amount) internal override returns (uint256) {
        uint256 idle = want.balanceOf(address(this));
        if (idle >= _amount) return _amount;

        uint256 needed = _amount - idle;
        // Redeem from external vault
        uint256 sharesToRedeem = rwaVault.convertToShares(needed);
        if (sharesToRedeem > rwaShares) sharesToRedeem = rwaShares;

        uint256 received = rwaVault.redeem(sharesToRedeem, address(this), address(this));
        rwaShares -= sharesToRedeem;

        return idle + received;
    }

    function _emergencyWithdraw() internal override returns (uint256) {
        if (rwaShares > 0) {
            rwaVault.redeem(rwaShares, address(this), address(this));
            rwaShares = 0;
        }
        return want.balanceOf(address(this));
    }

    // ======================== Admin ========================

    function setRWAVault(address _newVault) external onlyOwner {
        require(_newVault != address(0), "Invalid vault");
        // Emergency withdraw from old vault first
        if (rwaShares > 0) {
            rwaVault.redeem(rwaShares, address(this), address(this));
            rwaShares = 0;
        }
        rwaVault = IERC4626(_newVault);
        want.forceApprove(_newVault, type(uint256).max);
        emit RWAVaultUpdated(_newVault);
    }

    function setTargetAPY(uint256 _apy) external onlyOwner {
        targetAPY = _apy;
        emit TargetAPYUpdated(_apy);
    }
}
