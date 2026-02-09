/**
 * Contract Addresses for Pharos Network
 * Update these addresses after deployment
 */

// Pharos Testnet Contract Addresses
// TODO: Update these after deploying to Pharos Testnet
export const PHAROS_TESTNET_CONTRACTS = {
  // Core Token
  USDC: '0xCcf43a04c71504F6B2a402667A9f9f15C07CbcA2' as `0x${string}`,
  
  // Vault (Legacy ERC4626)
  PharosVault: '0xaD0E91b64304B4B239e4cDB31EFf4D62122811E6' as `0x${string}`,
  
  // Hybrid Vault (ERC4626 + ERC7540)
  HybridVault: '0x4d11903533251131bEd17133aB686458207D2451' as `0x${string}`,
  DeFiStrategy: '0x498f8D7ACDBEC57789150DBE7f276c43a8035d45' as `0x${string}`,
  AsyncRWAStrategy: '0x42d70347AA1217D7A4F6713fe5919b8669d7AD1a' as `0x${string}`,
  
  // Legacy Strategies
  RWAYieldStrategy: '0xebB7BC8F0e13f3925BC6EEEdd6b84E1960910b54' as `0x${string}`,
  SimpleLendingStrategy: '0x3B71e3BCEAFBA9EAe09110B8060D03B45EcA9d60' as `0x${string}`,
  RWAAdapterStrategy: '0xED09Aed69Bd8c089490351C2e937cCcd64e37033' as `0x${string}`,
  
  // Advanced modules
  PorRegistry: '0x75e47665D5611Af633cD584D5C3aD724910882FC' as `0x${string}`,
  TrancheManager: '0x3d27D3f363C627d7e691c4CEC396D1177e247e88' as `0x${string}`,
  PharosTimelock: '0x3D80982802c712BdeB9Ca0eE2eb231d007683D2b' as `0x${string}`,
} as const;

// Sepolia Testnet Contract Addresses
// Update these after deploying to Sepolia with npm run deploy:sepolia
export const SEPOLIA_CONTRACTS = {
  // Core Token
  USDC: '0xCcf43a04c71504F6B2a402667A9f9f15C07CbcA2' as `0x${string}`,
  
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
  USDC: '0xCcf43a04c71504F6B2a402667A9f9f15C07CbcA2' as `0x${string}`,
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
  USDC: '0xCcf43a04c71504F6B2a402667A9f9f15C07CbcA2' as `0x${string}`,
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
