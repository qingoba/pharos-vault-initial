import type { VaultHistoryPoint, VaultLot, VaultSnapshot } from '@/types/simulation';

export const SIMULATION_CONSTANTS = {
  initialCashUsd: 100000,
  btcAllocation: 0.4,
  rwaAllocation: 0.6,
  rwaActivationDelaySeconds: 3600,
  pendingRwaApy: 0.015,
  managementFeeRate: 0.02,
  performanceFeeRate: 0.1,
  minSpeed: 0.25,
  maxSpeed: 200,
  defaultSpeed: 1,
  yearSeconds: 365 * 24 * 60 * 60,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safePriceAt(prices: number[], index: number): number {
  if (prices.length === 0) {
    return 1;
  }

  const safeIndex = clamp(Math.floor(index), 0, prices.length - 1);
  const price = prices[safeIndex];
  return Number.isFinite(price) && price > 0 ? price : prices[0] || 1;
}

function hourlyMomentum(prices: number[], currentIndex: number, lookbackSeconds = 3600): number {
  if (prices.length === 0) {
    return 0;
  }

  const endPrice = safePriceAt(prices, currentIndex);
  const startPrice = safePriceAt(prices, Math.max(0, currentIndex - lookbackSeconds));
  if (startPrice <= 0) {
    return 0;
  }

  return endPrice / startPrice - 1;
}

function annualizeLinear(returnRate: number, holdingSeconds: number): number {
  if (!Number.isFinite(returnRate) || holdingSeconds <= 0) {
    return 0;
  }
  const annualized = returnRate * (SIMULATION_CONSTANTS.yearSeconds / holdingSeconds) * 100;
  return clamp(annualized, -95, 300);
}

export function normalizeSpeed(input: number): number {
  if (!Number.isFinite(input) || input <= 0) {
    return SIMULATION_CONSTANTS.defaultSpeed;
  }
  return clamp(input, SIMULATION_CONSTANTS.minSpeed, SIMULATION_CONSTANTS.maxSpeed);
}

export function createLotId(index: number): string {
  const salt = Math.random().toString(36).slice(2, 8);
  return `lot-${index}-${salt}`;
}

export function computeVaultSnapshot(
  lots: VaultLot[],
  currentIndex: number,
  btcClosePrices: number[],
  goldClosePrices: number[]
): VaultSnapshot {
  if (lots.length === 0) {
    return {
      totalDeposited: 0,
      grossValue: 0,
      netValue: 0,
      managementFeeAccrued: 0,
      performanceFeeAccrued: 0,
      netProfit: 0,
      netProfitPercent: 0,
      projectedApy: 0,
      realizedApy: 0,
      btcValue: 0,
      pendingRwaValue: 0,
      activeRwaValue: 0,
    };
  }

  let totalDeposited = 0;
  let btcValue = 0;
  let pendingRwaValue = 0;
  let activeRwaValue = 0;
  let managementFeeAccrued = 0;
  let weightedHoldingSeconds = 0;

  const btcCurrentPrice = safePriceAt(btcClosePrices, currentIndex);
  const goldCurrentPrice = safePriceAt(goldClosePrices, currentIndex);

  for (const lot of lots) {
    const ageSeconds = Math.max(0, currentIndex - lot.depositedAtIndex);
    const btcPrincipal = lot.principal * SIMULATION_CONSTANTS.btcAllocation;
    const rwaPrincipal = lot.principal * SIMULATION_CONSTANTS.rwaAllocation;

    totalDeposited += lot.principal;
    weightedHoldingSeconds += lot.principal * ageSeconds;

    const btcEntryPrice = lot.btcEntryPrice > 0 ? lot.btcEntryPrice : btcCurrentPrice;
    btcValue += btcPrincipal * (btcCurrentPrice / btcEntryPrice);

    if (ageSeconds < SIMULATION_CONSTANTS.rwaActivationDelaySeconds) {
      const pendingGrowth =
        1 + (SIMULATION_CONSTANTS.pendingRwaApy * ageSeconds) / SIMULATION_CONSTANTS.yearSeconds;
      pendingRwaValue += rwaPrincipal * pendingGrowth;
    } else {
      const activationIndex = Math.min(
        lot.depositedAtIndex + SIMULATION_CONSTANTS.rwaActivationDelaySeconds,
        goldClosePrices.length - 1
      );
      const pendingAtActivation =
        rwaPrincipal *
        (1 +
          (SIMULATION_CONSTANTS.pendingRwaApy * SIMULATION_CONSTANTS.rwaActivationDelaySeconds) /
            SIMULATION_CONSTANTS.yearSeconds);
      const goldEntryPrice = safePriceAt(goldClosePrices, activationIndex);
      activeRwaValue += pendingAtActivation * (goldCurrentPrice / goldEntryPrice);
    }

    managementFeeAccrued +=
      (lot.principal * SIMULATION_CONSTANTS.managementFeeRate * ageSeconds) /
      SIMULATION_CONSTANTS.yearSeconds;
  }

  const grossValue = btcValue + pendingRwaValue + activeRwaValue;
  const valueAfterManagementFee = Math.max(0, grossValue - managementFeeAccrued);
  const grossProfitAfterManagement = valueAfterManagementFee - totalDeposited;
  const performanceFeeAccrued =
    grossProfitAfterManagement > 0
      ? grossProfitAfterManagement * SIMULATION_CONSTANTS.performanceFeeRate
      : 0;

  const netValue = Math.max(0, valueAfterManagementFee - performanceFeeAccrued);
  const netProfit = netValue - totalDeposited;
  const netProfitPercent = totalDeposited > 0 ? (netProfit / totalDeposited) * 100 : 0;
  const averageHoldingSeconds =
    totalDeposited > 0 ? weightedHoldingSeconds / totalDeposited : 0;
  const realizedApy = annualizeLinear(netProfit / totalDeposited, averageHoldingSeconds);

  const btcHourly = hourlyMomentum(btcClosePrices, currentIndex);
  const goldHourly = hourlyMomentum(goldClosePrices, currentIndex);
  const projectedApyRaw =
    (btcHourly * SIMULATION_CONSTANTS.btcAllocation +
      goldHourly * SIMULATION_CONSTANTS.rwaAllocation) *
    24 *
    365 *
    100;
  const projectedApy = clamp(projectedApyRaw, -95, 300);

  return {
    totalDeposited,
    grossValue,
    netValue,
    managementFeeAccrued,
    performanceFeeAccrued,
    netProfit,
    netProfitPercent,
    projectedApy,
    realizedApy,
    btcValue,
    pendingRwaValue,
    activeRwaValue,
  };
}

export function computeMaxDrawdownPercent(history: VaultHistoryPoint[]): number {
  if (history.length === 0) {
    return 0;
  }

  let peak = history[0].totalPortfolioValue;
  let maxDrawdown = 0;

  for (const point of history) {
    if (point.totalPortfolioValue > peak) {
      peak = point.totalPortfolioValue;
      continue;
    }

    if (peak > 0) {
      const drawdown = (peak - point.totalPortfolioValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }

  return maxDrawdown * 100;
}

export function downsampleSeries(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) {
    return values;
  }

  const step = values.length / (maxPoints - 1);
  const sampled: number[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const sourceIndex = Math.min(values.length - 1, Math.round(i * step));
    sampled.push(values[sourceIndex]);
  }
  return sampled;
}

export function buildWindowSeries(
  values: number[],
  currentIndex: number,
  windowSeconds: number,
  maxPoints: number
): number[] {
  if (values.length === 0) {
    return [];
  }

  const start = Math.max(0, currentIndex - windowSeconds + 1);
  const windowValues = values.slice(start, currentIndex + 1);
  return downsampleSeries(windowValues, maxPoints);
}

export function normalizeToBase100(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const base = values[0] > 0 ? values[0] : 1;
  return values.map((value) => (value / base) * 100);
}
