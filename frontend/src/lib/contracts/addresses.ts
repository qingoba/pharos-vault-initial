/**
 * Contract Addresses for Pharos Network
 * Update these addresses after deployment
 */

// Pharos Testnet Contract Addresses
// TODO: Update these after deploying to Pharos Testnet
export const PHAROS_TESTNET_CONTRACTS = {
  // Core Token
  USDC: '0xc1D439B0d30F753710f8577B91411A7F5536dd05' as `0x${string}`,
  WBTC: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  WBNB: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
  // Vault
  PharosVault: '0x8ab1B049b7588B21Ef17fd1aA9fB42b18408FA1e' as `0x${string}`,
  SwapRouter: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
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
  USDC: '0x790f76355b973097a92530Bbd59c387E2C0CbeFC' as `0x${string}`,
  WBTC: '0xBdbA4F8d67043023df9f76604B9bC7F1f8631F29' as `0x${string}`,
  WBNB: '0xa4D14CFa41E1c18EA348Ecec26C15F8BF2F27cff' as `0x${string}`,
  
  // Vault
  PharosVault: '0x557D4666F39e4b10aDcE30c17B0A2A780a126FBa' as `0x${string}`,
  SwapRouter: '0x707f59f0c4d2E836Bbe36576b0105106F50DEf68' as `0x${string}`,
  
  // Strategies
  RWAYieldStrategy: '0xEB0e5bdfedA8E1482cd4923393945C5A7Dcdb72B' as `0x${string}`,
  SimpleLendingStrategy: '0xc409f4C6c715d9c1dBDaFe707514d7152DfEE0a4' as `0x${string}`,
  RWAAdapterStrategy: '0x80180e25963394B4E501792c893a10d83c664b8A' as `0x${string}`,
  
  // Advanced modules
  PorRegistry: '0x4d111E3564a36a51d0182550840e89051a808a13' as `0x${string}`,
  TrancheManager: '0xE185aa2C6607A687de12201eC386023a85a0F4d9' as `0x${string}`,
  PharosTimelock: '0x019061Ef90c085E138fE9e92495744745344E416' as `0x${string}`,
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
