// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IAsyncStrategy.sol";

/**
 * @title BaseAsyncStrategy
 * @notice 异步策略基类 — 实现 request/fulfill/claim 状态机
 */
abstract contract BaseAsyncStrategy is IAsyncStrategy, Ownable {
    using SafeERC20 for IERC20;

    string public override name;
    address public immutable override vault;
    IERC20 public immutable want;
    bool public override isActive;
    address public operator;

    uint256 private _nextRequestId;

    // Deposit: user → pending USDC, then claimable shares
    mapping(address => uint256) public override pendingDeposit;
    mapping(address => uint256) public override claimableShares;

    // Redeem: user → pending shares, then claimable USDC
    mapping(address => uint256) public override pendingRedeem;
    mapping(address => uint256) public override claimableAssets;

    // Track pending users for batch fulfill
    address[] internal _pendingDepositors;
    mapping(address => bool) internal _isPendingDepositor;
    address[] internal _pendingRedeemers;
    mapping(address => bool) internal _isPendingRedeemer;

    // Totals for accounting
    uint256 public totalPendingDeposits;
    uint256 public totalPendingRedeems;

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner(), "Only operator");
        _;
    }

    constructor(
        address _vault,
        address _asset,
        string memory _name
    ) Ownable(msg.sender) {
        vault = _vault;
        want = IERC20(_asset);
        name = _name;
        operator = msg.sender;
        isActive = true;
        want.forceApprove(_vault, type(uint256).max);
    }

    function asset() external view override returns (address) {
        return address(want);
    }

    // ======================== Async Deposit ========================

    function requestDeposit(uint256 assets, address depositor) external override onlyVault returns (uint256 requestId) {
        require(assets > 0, "Zero amount");
        pendingDeposit[depositor] += assets;
        totalPendingDeposits += assets;
        if (!_isPendingDepositor[depositor]) {
            _pendingDepositors.push(depositor);
            _isPendingDepositor[depositor] = true;
        }
        requestId = _nextRequestId++;
        emit DepositRequested(depositor, assets, requestId);
    }

    /// @notice Batch fulfill all pending deposits — operator just confirms purchase is done
    /// @dev Shares = pending USDC / current PPS (1:1 for simplicity)
    function fulfillDeposit(address, uint256) external override onlyOperator {
        _fulfillAllDeposits();
    }

    /// @notice Batch fulfill all pending deposits
    function fulfillAllDeposits() external onlyOperator {
        _fulfillAllDeposits();
    }

    function _fulfillAllDeposits() internal {
        uint256 len = _pendingDepositors.length;
        for (uint256 i; i < len; ++i) {
            address depositor = _pendingDepositors[i];
            uint256 pending = pendingDeposit[depositor];
            if (pending == 0) continue;
            // 1:1 shares for USDC (6 decimals both)
            uint256 shares = pending;
            pendingDeposit[depositor] = 0;
            totalPendingDeposits -= pending;
            claimableShares[depositor] += shares;
            _isPendingDepositor[depositor] = false;
            emit DepositFulfilled(depositor, shares);
        }
        delete _pendingDepositors;
    }

    function claimShares(address depositor) external override onlyVault returns (uint256 shares) {
        shares = claimableShares[depositor];
        require(shares > 0, "Nothing to claim");
        claimableShares[depositor] = 0;
        return shares;
    }

    // ======================== Async Redeem ========================

    function requestRedeem(uint256 shares, address redeemer) external override onlyVault returns (uint256 requestId) {
        require(shares > 0, "Zero amount");
        pendingRedeem[redeemer] += shares;
        totalPendingRedeems += shares;
        if (!_isPendingRedeemer[redeemer]) {
            _pendingRedeemers.push(redeemer);
            _isPendingRedeemer[redeemer] = true;
        }
        requestId = _nextRequestId++;
        emit RedeemRequested(redeemer, shares, requestId);
    }

    /// @notice Batch fulfill all pending redeems
    function fulfillRedeem(address, uint256) external override onlyOperator {
        _fulfillAllRedeems();
    }

    function fulfillAllRedeems() external onlyOperator {
        _fulfillAllRedeems();
    }

    function _fulfillAllRedeems() internal {
        uint256 len = _pendingRedeemers.length;
        uint256 totalNeeded;
        
        // First pass: calculate total needed
        for (uint256 i; i < len; ++i) {
            totalNeeded += pendingRedeem[_pendingRedeemers[i]];
        }
        
        // Check if strategy has enough funds
        uint256 available = want.balanceOf(address(this));
        require(available >= totalNeeded, "Insufficient funds - returnAssets first");
        
        // Second pass: fulfill
        for (uint256 i; i < len; ++i) {
            address redeemer = _pendingRedeemers[i];
            uint256 pending = pendingRedeem[redeemer];
            if (pending == 0) continue;
            // 1:1 assets for shares (6 decimals both)
            uint256 assets = pending;
            pendingRedeem[redeemer] = 0;
            totalPendingRedeems -= pending;
            claimableAssets[redeemer] += assets;
            _isPendingRedeemer[redeemer] = false;
            emit RedeemFulfilled(redeemer, assets);
        }
        delete _pendingRedeemers;
    }

    function claimAssets(address redeemer) external virtual override onlyVault returns (uint256 assets) {
        assets = claimableAssets[redeemer];
        require(assets > 0, "Nothing to claim");
        claimableAssets[redeemer] = 0;
        want.safeTransfer(vault, assets);
        return assets;
    }

    // ======================== Operator ========================

    function withdrawToOperator(uint256 amount) external virtual override onlyOperator returns (uint256) {
        uint256 bal = want.balanceOf(address(this));
        uint256 toSend = amount > bal ? bal : amount;
        want.safeTransfer(operator, toSend);
        emit OperatorWithdraw(toSend);
        return toSend;
    }

    // ======================== Admin ========================

    function setOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid");
        operator = _operator;
    }

    function setActive(bool _active) external onlyOwner {
        isActive = _active;
    }

    // ======================== Abstract ========================

    function totalAssets() public view virtual override returns (uint256);
    function estimatedAPY() external view virtual override returns (uint256);
    function reportNAV(uint256 nav) external virtual override;
}
