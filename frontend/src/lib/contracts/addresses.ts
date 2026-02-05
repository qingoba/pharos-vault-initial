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
    case 1337: // Local Hardhat
    case 31337:
      return LOCAL_CONTRACTS;
    default:
      return PHAROS_TESTNET_CONTRACTS;
  }
}

export type ContractAddresses = typeof PHAROS_TESTNET_CONTRACTS;
