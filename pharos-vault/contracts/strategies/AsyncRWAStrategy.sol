// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BaseAsyncStrategy.sol";

/**
 * @title AsyncRWAStrategy
 * @notice 异步 RWA 策略 — 模拟美债购买/赎回的 ERC7540 流程
 */
contract AsyncRWAStrategy is BaseAsyncStrategy {
    using SafeERC20 for IERC20;

    uint256 public offChainAssets;
    uint256 public targetAPY;

    /// @notice 已注入但未 harvest 的收益（不计入 totalAssets）
    uint256 public injectedYield;
    /// @notice 累计已实现利润
    uint256 public totalProfit;
    /// @notice 上次 harvest 时间
    uint256 public lastHarvest;

    event YieldInjected(uint256 amount);
    event Harvested(uint256 profit);

    constructor(
        address _vault,
        address _asset,
        uint256 _targetAPY
    ) BaseAsyncStrategy(_vault, _asset, "RWA Strategy") {
        targetAPY = _targetAPY;
        lastHarvest = block.timestamp;
    }

    // ======================== 视图 ========================

    function totalAssets() public view override returns (uint256) {
        // injectedYield 不计入，直到 harvest
        return want.balanceOf(address(this)) - injectedYield + offChainAssets;
    }

    function estimatedAPY() external view override returns (uint256) {
        return targetAPY;
    }

    // ======================== Operator 操作 ========================

    function reportNAV(uint256 nav) external override onlyOperator {
        offChainAssets = nav;
        emit NAVReported(nav, block.timestamp);
    }

    /// @notice 注入美债收益 — 资金进来但不算入 totalAssets，等 harvest
    function injectYield(uint256 amount) external {
        require(amount > 0, "Zero");
        want.safeTransferFrom(msg.sender, address(this), amount);
        injectedYield += amount;
        emit YieldInjected(amount);
    }

    /// @notice harvest — 把 injectedYield 变成真正的资产（profit）
    function harvest() external {
        uint256 profit = injectedYield;
        if (profit == 0) return;
        injectedYield = 0;
        totalProfit += profit;
        lastHarvest = block.timestamp;
        emit Harvested(profit);
    }

    function withdrawToOperator(uint256 amount) external override onlyOperator returns (uint256) {
        uint256 bal = want.balanceOf(address(this));
        uint256 available = bal > injectedYield ? bal - injectedYield : 0;
        uint256 toSend = amount > available ? available : amount;
        want.safeTransfer(operator, toSend);
        offChainAssets += toSend;
        emit OperatorWithdraw(toSend);
        return toSend;
    }

    function returnAssets(uint256 amount) external onlyOperator {
        want.safeTransferFrom(msg.sender, address(this), amount);
        if (offChainAssets >= amount) {
            offChainAssets -= amount;
        } else {
            offChainAssets = 0;
        }
    }

    /// @notice Override claimAssets to transfer all available funds (including profit)
    function claimAssets(address redeemer) external override onlyVault returns (uint256 assets) {
        uint256 claimable = claimableAssets[redeemer];
        require(claimable > 0, "Nothing to claim");
        claimableAssets[redeemer] = 0;
        
        // Transfer all available funds (claimable + proportional profit)
        // Since this is full redemption scenario, transfer everything available
        uint256 bal = want.balanceOf(address(this));
        uint256 available = bal > injectedYield ? bal - injectedYield : 0;
        assets = available; // Transfer all available, vault will handle the exact amount
        
        // Clear offChainAssets
        offChainAssets = 0;
        
        if (assets > 0) {
            want.safeTransfer(vault, assets);
        }
    }

    // ======================== Admin ========================

    function setTargetAPY(uint256 _apy) external onlyOwner {
        targetAPY = _apy;
    }
}
