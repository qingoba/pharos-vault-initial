export interface Vault {
  id: string;
  name: string;
  icon: string;
  tokenAddress: string;
  contractAddress: string;
  apr: number;
  tvl: number;
  totalEarnings: number;
  description: string;
  managementFee: number;
  performanceFee: number;
  strategies: Strategy[];
  harvestHistory: HarvestRecord[];
}

export interface Strategy {
  id: string;
  name: string;
  allocation: number;
  apr: number;
  lastHarvest: number;
  maxDrawdown: number;
  proofOfReserve?: string;
}

export interface HarvestRecord {
  timestamp: number;
  amount: number;
  txHash: string;
}

export interface UserPosition {
  vaultId: string;
  shares: number;
  depositedValue: number;
  currentValue: number;
  earnedRealized: number;
  earnedPending: number;
  autoCompound: boolean;
}

export interface ProtocolStats {
  totalTvl: number;
  averageApr: number;
  totalVaults: number;
}
