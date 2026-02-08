/**
 * Contract Addresses for Pharos Network
 * Update these addresses after deployment
 */

// Pharos Testnet Contract Addresses
// TODO: Update these after deploying to Pharos Testnet
export const PHAROS_TESTNET_CONTRACTS = {
  // Core Token
  USDC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  WBTC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  WBNB: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
  // Vault
  PharosVault: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  SwapRouter: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
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
  USDC: '0xca423B0fC4117bFc2125A4bcd49f192fa989E3C6' as `0x${string}`,
  WBTC: '0x879019D2cF514d583214B83A96D9574D3565b144' as `0x${string}`,
  WBNB: '0xc2890Cd0Bec76d3Ec1842b77a60024541A6e37DB' as `0x${string}`,
  
  // Vault
  PharosVault: '0x86AD58952202645198Be2d21f24CA5aBCE8D10F9' as `0x${string}`,
  SwapRouter: '0x6205A429cE70F18214d4EFD00689e269d51D2497' as `0x${string}`,
  
  // Strategies
  RWAYieldStrategy: '0xd4FB18312e5B3fA5f4C30f607779C4fC61E9bA21' as `0x${string}`,
  SimpleLendingStrategy: '0x6ED57277FD6dB02D4796b14cEed977f417655070' as `0x${string}`,
  RWAAdapterStrategy: '0xD5b917e89821CFa39f51efB39e0A0C02B54142CD' as `0x${string}`,
  
  // Advanced modules
  PorRegistry: '0x7C12daCb2eD8894390F9aA8dA86c42eBeD83C8E7' as `0x${string}`,
  TrancheManager: '0xCF77f7F90bAC3F0Ab17008caaf6D12f82845F82c' as `0x${string}`,
  PharosTimelock: '0xDa360ee947930dbfC7fb1E0e837142d787083B9B' as `0x${string}`,
} as const;

// Pharos Mainnet Contract Addresses (for future use)
export const PHAROS_MAINNET_CONTRACTS = {
  USDC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  WBTC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  WBNB: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PharosVault: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  SwapRouter: '0x0000000000000000000000000000000000000000' as `0x${string}`,
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
  WBTC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  WBNB: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  PharosVault: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  SwapRouter: '0x0000000000000000000000000000000000000000' as `0x${string}`,
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
