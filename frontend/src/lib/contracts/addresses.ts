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
} as const;

// Sepolia Testnet Contract Addresses
// Update these after deploying to Sepolia with npm run deploy:sepolia
export const SEPOLIA_CONTRACTS = {
  // Core Token
  USDC: '0x4a0EDB585AB395A901Ce8EF9433Bbc27e4ed1453' as `0x${string}`,
  
  // Vault  
  PharosVault: '0x666057e10bd322189Fa65EE94Ad889717F1FB6c7' as `0x${string}`,
  
  // Strategies
  RWAYieldStrategy: '0xCd57578e511d628E4542712233a5275DcDf51839' as `0x${string}`,
  SimpleLendingStrategy: '0x82f311D38C2340b01BB8525e2C0FF19cCB32b2DE' as `0x${string}`,
} as const;

// Pharos Mainnet Contract Addresses (for future use)
export const PHAROS_MAINNET_CONTRACTS = {
  USDC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PharosVault: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  RWAYieldStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  SimpleLendingStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const;

// Local Development Contract Addresses
export const LOCAL_CONTRACTS = {
  USDC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PharosVault: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  RWAYieldStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  SimpleLendingStrategy: '0x0000000000000000000000000000000000000000' as `0x${string}`,
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
