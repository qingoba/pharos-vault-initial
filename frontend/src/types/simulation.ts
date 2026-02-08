export interface MarketHistoryResponse {
  virtualStartUtcMs: number;
  datasetSeconds: number;
  btcClosePrices: number[];
  goldClosePrices: number[];
  source: {
    btcFile: string;
    goldFile: string;
    btcDataStartUtcMs: number;
    goldDataStartUtcMs: number;
  };
}

export interface VaultLot {
  id: string;
  principal: number;
  depositedAtIndex: number;
  btcEntryPrice: number;
}

export interface VaultSnapshot {
  totalDeposited: number;
  grossValue: number;
  netValue: number;
  managementFeeAccrued: number;
  performanceFeeAccrued: number;
  netProfit: number;
  netProfitPercent: number;
  projectedApy: number;
  realizedApy: number;
  btcValue: number;
  pendingRwaValue: number;
  activeRwaValue: number;
}

export interface VaultHistoryPoint {
  index: number;
  virtualTimeMs: number;
  netValue: number;
  totalPortfolioValue: number;
  netProfitPercent: number;
}
