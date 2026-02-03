import { Vault, UserPosition, ProtocolStats } from '@/types';

export const mockVaults: Vault[] = [
  {
    id: 'usdc-vault',
    name: 'USDC Vault',
    icon: '/icons/usdc.svg',
    tokenAddress: '0x1234567890abcdef1234567890abcdef12345678',
    contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    apr: 8.5,
    tvl: 2500000,
    totalEarnings: 125000,
    description: 'Earn yield on USDC through diversified RWA strategies including US Treasury bonds and trade finance.',
    managementFee: 2,
    performanceFee: 20,
    strategies: [
      {
        id: 'treasury',
        name: 'US Treasury Bonds',
        allocation: 60,
        apr: 5.2,
        lastHarvest: 3200,
        maxDrawdown: 0.5,
        proofOfReserve: 'https://explorer.pharos.xyz/proof/treasury',
      },
      {
        id: 'trade-finance',
        name: 'Trade Finance',
        allocation: 40,
        apr: 12.8,
        lastHarvest: 2100,
        maxDrawdown: 2.1,
      },
    ],
    harvestHistory: [
      { timestamp: 1706860800000, amount: 5300, txHash: '0xabc123' },
      { timestamp: 1706774400000, amount: 4800, txHash: '0xdef456' },
      { timestamp: 1706688000000, amount: 5100, txHash: '0xghi789' },
    ],
  },
  {
    id: 'usdt-vault',
    name: 'USDT Vault',
    icon: '/icons/usdt.svg',
    tokenAddress: '0x2345678901abcdef2345678901abcdef23456789',
    contractAddress: '0xbcdef2345678901abcdef2345678901abcdef234',
    apr: 7.2,
    tvl: 1800000,
    totalEarnings: 89000,
    description: 'Stable yield generation through institutional-grade RWA lending protocols.',
    managementFee: 2,
    performanceFee: 20,
    strategies: [
      {
        id: 'rwa-lending',
        name: 'RWA Lending',
        allocation: 100,
        apr: 7.2,
        lastHarvest: 2800,
        maxDrawdown: 1.2,
      },
    ],
    harvestHistory: [
      { timestamp: 1706860800000, amount: 2800, txHash: '0xjkl012' },
      { timestamp: 1706774400000, amount: 2650, txHash: '0xmno345' },
    ],
  },
];

export const mockUserPositions: UserPosition[] = [
  {
    vaultId: 'usdc-vault',
    shares: 1000,
    depositedValue: 10000,
    currentValue: 10850,
    earnedRealized: 500,
    earnedPending: 350,
    autoCompound: true,
  },
  {
    vaultId: 'usdt-vault',
    shares: 500,
    depositedValue: 5000,
    currentValue: 5360,
    earnedRealized: 200,
    earnedPending: 160,
    autoCompound: false,
  },
];

export const mockProtocolStats: ProtocolStats = {
  totalTvl: 4300000,
  averageApr: 7.85,
  totalVaults: 2,
};
