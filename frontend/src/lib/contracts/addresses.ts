/**
 * Contract Addresses for Pharos Network
 * Update these addresses after deployment
 */

// Pharos Testnet Contract Addresses
// TODO: Update these after deploying to Pharos Testnet
export const PHAROS_TESTNET_CONTRACTS = {
  // Core Token
  USDC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
  // Vault
  PharosVault: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
  // Strategies
  RWAYieldStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  SimpleLendingStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  RWAAdapterStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
  // Advanced modules
  PorRegistry: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  TrancheManager: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PharosTimelock: '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const;

// Sepolia Testnet Contract Addresses
// Update these after deploying to Sepolia with npm run deploy:sepolia
export const SEPOLIA_CONTRACTS = {
  // Core Token
  USDC: '0x8E14Ea3659202E0fde2E94DCD8956c8E98B19ec6' as `0x${string}`,
  
  // Vault
  PharosVault: '0xC636aAA726dBb9298882CddA9BCedfa11CDe453b' as `0x${string}`,
  
  // Strategies
  RWAYieldStrategy: '0x85bfdcd00E0bBb9dDce3dcD2A58A62380703AdA6' as `0x${string}`,
  SimpleLendingStrategy: '0x7eb44f73368d14DBE4c2E30F8490a60513Fe17B0' as `0x${string}`,
  RWAAdapterStrategy: '0xe6f491B9ffb23B576E04f6f41967877D48DefECc' as `0x${string}`,
  
  // Advanced modules
  PorRegistry: '0x7901d6F2eD0D5b69Cc7a22EbEdce50E70E54700c' as `0x${string}`,
  TrancheManager: '0xC966eE52484EA77Fe8DFB3ae54bc3dc3D199b386' as `0x${string}`,
  PharosTimelock: '0x9111f103671152037F910D311ACd07E340401927' as `0x${string}`,
} as const;

// Pharos Mainnet Contract Addresses (for future use)
export const PHAROS_MAINNET_CONTRACTS = {
  USDC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PharosVault: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  RWAYieldStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  SimpleLendingStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  RWAAdapterStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PorRegistry: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  TrancheManager: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PharosTimelock: '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const;

// Local Development Contract Addresses
export const LOCAL_CONTRACTS = {
  USDC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PharosVault: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  RWAYieldStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  SimpleLendingStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  RWAAdapterStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PorRegistry: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  TrancheManager: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PharosTimelock: '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const;

// Get contracts based on chain ID
export function getContracts(chainId: number | undefined) {
  switch (chainId) {
    case 1672: // Pharos Mainnet
      return PHAROS_MAINNET_CONTRACTS;
    case 688689: // Pharos Testnet
      return PHAROS_TESTNET_CONTRACTS;
    case 11155111: // Sepolia Testnet
      return SEPOLIA_CONTRACTS;
    case 1337: // Local Hardhat
    case 31337:
      return LOCAL_CONTRACTS;
    default:
      return PHAROS_TESTNET_CONTRACTS;
  }
}

export type ContractAddresses = typeof PHAROS_TESTNET_CONTRACTS;
