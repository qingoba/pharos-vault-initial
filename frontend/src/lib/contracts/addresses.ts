/**
 * Contract Addresses for Pharos Network
 * Update these addresses after deployment
 */

// Pharos Testnet Contract Addresses
// TODO: Update these after deploying to Pharos Testnet
export const PHAROS_TESTNET_CONTRACTS = {
  // Core Token
  USDC: '0xc1D439B0d30F753710f8577B91411A7F5536dd05' as `0x${string}`,
  
  // Vault
  PharosVault: '0x8ab1B049b7588B21Ef17fd1aA9fB42b18408FA1e' as `0x${string}`,
  
  // Strategies
  RWAYieldStrategy: '0x05F244d0680A552B2e5d3ea924873E9987307eB6' as `0x${string}`,
  SimpleLendingStrategy: '0x4b4eDeB9Cf8BAA870459F7f4464F3FD09668d28c' as `0x${string}`,
  RWAAdapterStrategy: '0x36CB87CEe739F5176e7535Fa883F6F6Bbd7f871d' as `0x${string}`,
  
  // Advanced modules
  PorRegistry: '0xf6aa3466019b3C9417a26167E26eDEf8a5Aa7cDE' as `0x${string}`,
  TrancheManager: '0x17F13C54082e65d7D25FCc67527a9B92c43cB938' as `0x${string}`,
  PharosTimelock: '0x3EC84DC1Cd96A6e39eCC62200a030605f7bA120C' as `0x${string}`,
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
  let contracts;
  let networkName;
  
  switch (chainId) {
    case 1672: // Pharos Mainnet
      contracts = PHAROS_MAINNET_CONTRACTS;
      networkName = 'Pharos Mainnet';
      break;
    case 688689: // Pharos Testnet
      contracts = PHAROS_TESTNET_CONTRACTS;
      networkName = 'Pharos Testnet';
      break;
    case 11155111: // Sepolia Testnet
      contracts = SEPOLIA_CONTRACTS;
      networkName = 'Sepolia';
      break;
    case 1337: // Local Hardhat
    case 31337:
      contracts = LOCAL_CONTRACTS;
      networkName = 'Local';
      break;
    default:
      contracts = PHAROS_TESTNET_CONTRACTS;
      networkName = 'Default (Pharos Testnet)';
  }
  
  console.log('[getContracts] Network:', networkName, 'ChainId:', chainId);
  console.log('[getContracts] Contracts:', {
    USDC: contracts.USDC,
    PharosVault: contracts.PharosVault,
  });
  
  return contracts;
}

export type ContractAddresses = typeof PHAROS_TESTNET_CONTRACTS;
