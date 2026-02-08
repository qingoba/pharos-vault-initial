/**
 * HybridVault & AsyncRWAStrategy ABIs
 */

export const HybridVaultABI = [
  // ERC20
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  // ERC4626
  { inputs: [], name: 'asset', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalAssets', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'assets', type: 'uint256' }], name: 'convertToShares', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'shares', type: 'uint256' }], name: 'convertToAssets', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], name: 'deposit', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], name: 'withdraw', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], name: 'redeem', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'maxWithdraw', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'maxRedeem', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  // Strategy management
  { inputs: [], name: 'getSyncStrategies', outputs: [{ name: '', type: 'address[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getAsyncStrategies', outputs: [{ name: '', type: 'address[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'syncTotalRatio', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'asyncTotalRatio', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSyncDebt', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'syncParams', outputs: [{ name: 'debtRatio', type: 'uint256' }, { name: 'totalDebt', type: 'uint256' }, { name: 'totalGain', type: 'uint256' }, { name: 'lastReport', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'asyncParams', outputs: [{ name: 'debtRatio', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  // Async user state
  { inputs: [{ name: 'user', type: 'address' }], name: 'pendingDepositOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'claimableSharesOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'pendingRedeemOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'claimableAssetsOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'receiver', type: 'address' }], name: 'claimAsyncShares', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'receiver', type: 'address' }], name: 'claimAsyncAssets', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  // Admin
  { inputs: [{ name: 'strategy', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'allocateToSyncStrategy', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'strategy', type: 'address' }], name: 'harvestSyncStrategy', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'strategy', type: 'address' }], name: 'harvestAsyncStrategy', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'harvestAll', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  // Fees
  { inputs: [], name: 'managementFee', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'performanceFee', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'accumulatedFees', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'feeRecipient', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_fee', type: 'uint256' }], name: 'setManagementFee', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_fee', type: 'uint256' }], name: 'setPerformanceFee', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'claimFees', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  // Events
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'assets', type: 'uint256' }, { indexed: false, name: 'shares', type: 'uint256' }], name: 'SyncDeposit', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'assets', type: 'uint256' }], name: 'AsyncDepositRequested', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'shares', type: 'uint256' }], name: 'AsyncSharesClaimed', type: 'event' },
  { anonymous: false, inputs: [{ indexed: false, name: 'totalAssets', type: 'uint256' }, { indexed: false, name: 'syncAssets', type: 'uint256' }, { indexed: false, name: 'asyncAssets', type: 'uint256' }, { indexed: false, name: 'pps', type: 'uint256' }, { indexed: false, name: 'timestamp', type: 'uint256' }], name: 'VaultSnapshot', type: 'event' },
] as const;

export const AsyncRWAStrategyABI = [
  { inputs: [], name: 'name', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalAssets', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'isActive', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'estimatedAPY', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'offChainAssets', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'targetAPY', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'pendingDeposit', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'claimableShares', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'pendingRedeem', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'claimableAssets', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalPendingDeposits', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalPendingRedeems', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  // Operator actions
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'withdrawToOperator', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'nav', type: 'uint256' }], name: 'reportNAV', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'depositor', type: 'address' }, { name: 'shares', type: 'uint256' }], name: 'fulfillDeposit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'redeemer', type: 'address' }, { name: 'assets', type: 'uint256' }], name: 'fulfillRedeem', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'injectYield', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'returnAssets', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  // Events
  { anonymous: false, inputs: [{ indexed: true, name: 'depositor', type: 'address' }, { indexed: false, name: 'assets', type: 'uint256' }, { indexed: false, name: 'requestId', type: 'uint256' }], name: 'DepositRequested', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'depositor', type: 'address' }, { indexed: false, name: 'shares', type: 'uint256' }], name: 'DepositFulfilled', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'redeemer', type: 'address' }, { indexed: false, name: 'shares', type: 'uint256' }, { indexed: false, name: 'requestId', type: 'uint256' }], name: 'RedeemRequested', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'redeemer', type: 'address' }, { indexed: false, name: 'assets', type: 'uint256' }], name: 'RedeemFulfilled', type: 'event' },
] as const;
