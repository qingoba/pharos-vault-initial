/**
 * Pharos Vault Contract ABIs
 * Auto-generated from smart contract interfaces
 */

// PharosVault ABI - ERC4626 Vault with multi-strategy support
export const PharosVaultABI = [
  // ERC20 基础函数
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // ERC4626 标准函数
  {
    inputs: [],
    name: 'asset',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'assets', type: 'uint256' }],
    name: 'convertToShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'shares', type: 'uint256' }],
    name: 'convertToAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'assets', type: 'uint256' }],
    name: 'previewDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'shares', type: 'uint256' }],
    name: 'previewMint',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'assets', type: 'uint256' }],
    name: 'previewWithdraw',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'shares', type: 'uint256' }],
    name: 'previewRedeem',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'receiver', type: 'address' }],
    name: 'maxDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'receiver', type: 'address' }],
    name: 'maxMint',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'maxWithdraw',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'maxRedeem',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // 存取款函数
  {
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    name: 'deposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    name: 'mint',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    name: 'withdraw',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    name: 'redeem',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  
  // Vault 特有函数
  {
    inputs: [],
    name: 'managementFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'performanceFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'depositLimit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'emergencyShutdown',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lastFeeCollection',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'accumulatedManagementFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'accumulatedPerformanceFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeRecipient',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'claimFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_fee', type: 'uint256' }],
    name: 'setManagementFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_fee', type: 'uint256' }],
    name: 'setPerformanceFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  
  // 策略管理
  {
    inputs: [],
    name: 'strategiesLength',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getStrategies',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'index', type: 'uint256' }],
    name: 'strategies',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'strategy', type: 'address' }],
    name: 'isActiveStrategy',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'strategy', type: 'address' }],
    name: 'getStrategyInfo',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'activation', type: 'uint256' },
          { name: 'debtRatio', type: 'uint256' },
          { name: 'totalDebt', type: 'uint256' },
          { name: 'totalGain', type: 'uint256' },
          { name: 'totalLoss', type: 'uint256' },
          { name: 'lastReport', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'idleAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'deployedAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'estimatedAPY',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  
  // New cached accounting
  {
    inputs: [],
    name: 'totalDeployedAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextHarvestIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // 管理员函数
  {
    inputs: [
      { name: 'strategy', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'allocateToStrategy',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'harvestAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'strategy', type: 'address' }],
    name: 'harvestStrategy',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Keeper functions
  {
    inputs: [],
    name: 'harvestNext',
    outputs: [{ name: 'harvested', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'bytes' }],
    name: 'checkUpkeep',
    outputs: [
      { name: 'upkeepNeeded', type: 'bool' },
      { name: 'performData', type: 'bytes' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'checker',
    outputs: [
      { name: 'canExec', type: 'bool' },
      { name: 'execPayload', type: 'bytes' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  
  // 事件
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'sender', type: 'address' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'assets', type: 'uint256' },
      { indexed: false, name: 'shares', type: 'uint256' },
    ],
    name: 'Deposit',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'sender', type: 'address' },
      { indexed: true, name: 'receiver', type: 'address' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'assets', type: 'uint256' },
      { indexed: false, name: 'shares', type: 'uint256' },
    ],
    name: 'Withdraw',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'strategy', type: 'address' },
      { indexed: false, name: 'debtRatio', type: 'uint256' },
    ],
    name: 'StrategyAdded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'strategy', type: 'address' },
      { indexed: false, name: 'gain', type: 'uint256' },
      { indexed: false, name: 'loss', type: 'uint256' },
      { indexed: false, name: 'debtPaid', type: 'uint256' },
      { indexed: false, name: 'totalDebt', type: 'uint256' },
    ],
    name: 'StrategyReported',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'totalAssets', type: 'uint256' },
      { indexed: false, name: 'idleAssets', type: 'uint256' },
      { indexed: false, name: 'deployedAssets', type: 'uint256' },
      { indexed: false, name: 'pricePerShare', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'VaultSnapshot',
    type: 'event',
  },
] as const;

// Strategy ABI
export const StrategyABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'vault',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'asset',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isActive',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'estimatedAPY',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'harvestTrigger',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lastHarvest',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalProfit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Inject yield (for RWA strategies)
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'injectYield',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ERC20 ABI (for underlying asset)
export const ERC20ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Mint function (for MockUSDC)
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ======================== PorRegistry ABI ========================
export const PorRegistryABI = [
  {
    inputs: [],
    name: 'proofCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestProof',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'timestamp', type: 'uint256' },
          { name: 'totalReserves', type: 'uint256' },
          { name: 'totalLiabilities', type: 'uint256' },
          { name: 'merkleRoot', type: 'bytes32' },
          { name: 'verified', type: 'bool' },
          { name: 'attester', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isHealthy',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'proofs',
    outputs: [
      { name: 'timestamp', type: 'uint256' },
      { name: 'totalReserves', type: 'uint256' },
      { name: 'totalLiabilities', type: 'uint256' },
      { name: 'merkleRoot', type: 'bytes32' },
      { name: 'verified', type: 'bool' },
      { name: 'attester', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'proofId', type: 'uint256' },
      { indexed: false, name: 'totalReserves', type: 'uint256' },
      { indexed: false, name: 'totalLiabilities', type: 'uint256' },
      { indexed: false, name: 'merkleRoot', type: 'bytes32' },
      { indexed: false, name: 'verified', type: 'bool' },
      { indexed: true, name: 'attester', type: 'address' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'ProofSubmitted',
    type: 'event',
  },
] as const;

// ======================== TrancheManager ABI ========================
export const TrancheManagerABI = [
  {
    inputs: [],
    name: 'seniorTranche',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'juniorTranche',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'seniorDeposits',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'juniorDeposits',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'seniorTargetAPR',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'seniorTotalAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'juniorTotalAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalManagedAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lastWaterfallTime',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Write functions
  {
    inputs: [
      { name: '_assets', type: 'uint256' },
      { name: '_receiver', type: 'address' },
    ],
    name: 'depositSenior',
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: '_assets', type: 'uint256' },
      { name: '_receiver', type: 'address' },
    ],
    name: 'depositJunior',
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: '_shares', type: 'uint256' },
      { name: '_receiver', type: 'address' },
    ],
    name: 'redeemSenior',
    outputs: [{ name: 'assets', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: '_shares', type: 'uint256' },
      { name: '_receiver', type: 'address' },
    ],
    name: 'redeemJunior',
    outputs: [{ name: 'assets', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'executeWaterfall',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'isSenior', type: 'bool' },
      { indexed: false, name: 'assets', type: 'uint256' },
      { indexed: false, name: 'shares', type: 'uint256' },
    ],
    name: 'Deposited',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'totalYield', type: 'uint256' },
      { indexed: false, name: 'seniorYield', type: 'uint256' },
      { indexed: false, name: 'juniorYield', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'WaterfallExecuted',
    type: 'event',
  },
] as const;
