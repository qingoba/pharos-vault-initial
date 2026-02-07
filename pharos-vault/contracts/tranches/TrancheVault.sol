// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrancheVault
 * @notice ERC4626 token representing one tranche (Senior or Junior) of a
 *         shared yield pool managed by a TrancheManager.
 *
 * Shares are minted/burned 1-to-1 with the underlying asset.  The actual
 * yield attribution is handled by TrancheManager which controls the
 * totalAssets() each tranche reports.
 */
contract TrancheVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public manager;
    uint256 internal _managedAssets; // set by manager after waterfall

    error OnlyManager();

    modifier onlyManager() {
        if (msg.sender != manager) revert OnlyManager();
        _;
    }

    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _manager
    ) ERC4626(_asset) ERC20(_name, _symbol) Ownable(msg.sender) {
        manager = _manager;
    }

    function totalAssets() public view override returns (uint256) {
        return _managedAssets;
    }

    /// @notice Called by manager to update this tranche's share of the pool.
    function setManagedAssets(uint256 _amount) external onlyManager {
        _managedAssets = _amount;
    }

    /// @notice Manager deposits on behalf of a user.
    function managerDeposit(uint256 assets, address receiver)
        external onlyManager nonReentrant returns (uint256)
    {
        return super.deposit(assets, receiver);
    }

    /// @notice Manager redeems on behalf of a user.
    function managerRedeem(uint256 shares, address receiver, address owner_)
        external onlyManager nonReentrant returns (uint256)
    {
        return super.redeem(shares, receiver, owner_);
    }

    /// @notice Manager can mint tranche shares directly.
    function mintShares(address to, uint256 amount) external onlyManager {
        _mint(to, amount);
    }

    /// @notice Manager can burn tranche shares directly.
    function burnShares(address from, uint256 amount) external onlyManager {
        _burn(from, amount);
    }

    /// @dev Block direct user deposits — must go through manager.
    function deposit(uint256, address) public pure override returns (uint256) {
        revert("Use TrancheManager");
    }

    function mint(uint256, address) public pure override returns (uint256) {
        revert("Use TrancheManager");
    }

    function withdraw(uint256, address, address) public pure override returns (uint256) {
        revert("Use TrancheManager");
    }

    function redeem(uint256, address, address) public pure override returns (uint256) {
        revert("Use TrancheManager");
    }
}
