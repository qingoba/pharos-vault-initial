'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SIMULATION_CONSTANTS,
  buildWindowSeries,
  computeMaxDrawdownPercent,
  computeVaultSnapshot,
  createLotId,
  downsampleSeries,
  normalizeSpeed,
  normalizeToBase100,
} from '@/lib/simulation';
import type { MarketHistoryResponse, VaultHistoryPoint, VaultLot } from '@/types/simulation';

const TICK_INTERVAL_MS = 200;
const MARKET_WINDOW_SECONDS = 6 * 3600;
const MAX_CHART_POINTS = 240;

interface SimulationActionResult {
  ok: boolean;
  message: string;
}

export function useVaultSimulation() {
  const [marketData, setMarketData] = useState<MarketHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [virtualSeconds, setVirtualSeconds] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(SIMULATION_CONSTANTS.defaultSpeed);
  const [isRunning, setIsRunning] = useState(true);

  const [cashBalance, setCashBalance] = useState(SIMULATION_CONSTANTS.initialCashUsd);
  const [lots, setLots] = useState<VaultLot[]>([]);
  const [history, setHistory] = useState<VaultHistoryPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/market-history');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as MarketHistoryResponse;
        if (
          !payload ||
          !Array.isArray(payload.btcClosePrices) ||
          !Array.isArray(payload.goldClosePrices) ||
          payload.datasetSeconds <= 0
        ) {
          throw new Error('Invalid market history payload');
        }

        if (!cancelled) {
          setMarketData(payload);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Unknown error';
        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentIndex = useMemo(() => {
    if (!marketData) {
      return 0;
    }
    const maxIndex = marketData.datasetSeconds - 1;
    return Math.min(Math.floor(virtualSeconds), maxIndex);
  }, [marketData, virtualSeconds]);

  const virtualTimestampMs = useMemo(() => {
    if (!marketData) {
      return Date.UTC(2025, 2, 3, 1, 0, 0);
    }
    return marketData.virtualStartUtcMs + currentIndex * 1000;
  }, [marketData, currentIndex]);

  useEffect(() => {
    if (!marketData || !isRunning) {
      return;
    }

    const lastIndex = marketData.datasetSeconds - 1;
    let previousRealMs = Date.now();

    const timer = window.setInterval(() => {
      const nowMs = Date.now();
      const deltaSeconds = (nowMs - previousRealMs) / 1000;
      previousRealMs = nowMs;

      setVirtualSeconds((prev) => {
        if (prev >= lastIndex) {
          return lastIndex;
        }
        const next = prev + deltaSeconds * speedMultiplier;
        return next >= lastIndex ? lastIndex : next;
      });
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [marketData, isRunning, speedMultiplier]);

  useEffect(() => {
    if (!marketData) {
      return;
    }
    const endReached = virtualSeconds >= marketData.datasetSeconds - 1;
    if (endReached && isRunning) {
      setIsRunning(false);
    }
  }, [marketData, virtualSeconds, isRunning]);

  const snapshot = useMemo(() => {
    if (!marketData) {
      return computeVaultSnapshot([], 0, [], []);
    }
    return computeVaultSnapshot(
      lots,
      currentIndex,
      marketData.btcClosePrices,
      marketData.goldClosePrices
    );
  }, [marketData, lots, currentIndex]);

  useEffect(() => {
    if (!marketData) {
      return;
    }

    const nextPoint: VaultHistoryPoint = {
      index: currentIndex,
      virtualTimeMs: virtualTimestampMs,
      netValue: snapshot.netValue,
      totalPortfolioValue: snapshot.netValue + cashBalance,
      netProfitPercent: snapshot.netProfitPercent,
    };

    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].index === currentIndex) {
        const updated = prev.slice();
        updated[updated.length - 1] = nextPoint;
        return updated;
      }

      const appended = [...prev, nextPoint];
      if (appended.length > 4000) {
        return appended.slice(appended.length - 4000);
      }
      return appended;
    });
  }, [
    marketData,
    currentIndex,
    virtualTimestampMs,
    snapshot.netValue,
    snapshot.netProfitPercent,
    cashBalance,
  ]);

  const currentBtcPrice = useMemo(() => {
    if (!marketData || marketData.btcClosePrices.length === 0) {
      return 0;
    }
    return marketData.btcClosePrices[currentIndex];
  }, [marketData, currentIndex]);

  const currentGoldPrice = useMemo(() => {
    if (!marketData || marketData.goldClosePrices.length === 0) {
      return 0;
    }
    return marketData.goldClosePrices[currentIndex];
  }, [marketData, currentIndex]);

  const deposit = useCallback(
    (amount: number): SimulationActionResult => {
      if (!marketData) {
        return { ok: false, message: 'Market data is not ready yet.' };
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, message: 'Please input a valid deposit amount.' };
      }

      const roundedAmount = Math.round(amount * 100) / 100;
      if (roundedAmount > cashBalance) {
        return { ok: false, message: 'Not enough virtual cash balance.' };
      }

      const newLot: VaultLot = {
        id: createLotId(currentIndex),
        principal: roundedAmount,
        depositedAtIndex: currentIndex,
        btcEntryPrice: currentBtcPrice > 0 ? currentBtcPrice : 1,
      };

      setCashBalance((prev) => prev - roundedAmount);
      setLots((prev) => [...prev, newLot]);

      return {
        ok: true,
        message: `Deposited $${roundedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} into Vault.`,
      };
    },
    [marketData, cashBalance, currentIndex, currentBtcPrice]
  );

  const redeemAll = useCallback((): SimulationActionResult => {
    if (lots.length === 0) {
      return { ok: false, message: 'No active vault position to redeem.' };
    }

    const payout = Math.round(snapshot.netValue * 100) / 100;
    setCashBalance((prev) => prev + payout);
    setLots([]);

    return {
      ok: true,
      message: `Redeemed all positions. Returned $${payout.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}.`,
    };
  }, [lots.length, snapshot.netValue]);

  const updateSpeed = useCallback((nextSpeed: number) => {
    setSpeedMultiplier(normalizeSpeed(nextSpeed));
  }, []);

  const restoreNormalSpeed = useCallback(() => {
    setSpeedMultiplier(SIMULATION_CONSTANTS.defaultSpeed);
  }, []);

  const toggleRunning = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const resetSimulation = useCallback(() => {
    setVirtualSeconds(0);
    setSpeedMultiplier(SIMULATION_CONSTANTS.defaultSpeed);
    setIsRunning(true);
    setCashBalance(SIMULATION_CONSTANTS.initialCashUsd);
    setLots([]);
    setHistory([]);
  }, []);

  const marketSeries = useMemo(() => {
    if (!marketData) {
      return { btc: [] as number[], gold: [] as number[] };
    }

    const btcRaw = buildWindowSeries(
      marketData.btcClosePrices,
      currentIndex,
      MARKET_WINDOW_SECONDS,
      MAX_CHART_POINTS
    );
    const goldRaw = buildWindowSeries(
      marketData.goldClosePrices,
      currentIndex,
      MARKET_WINDOW_SECONDS,
      MAX_CHART_POINTS
    );

    return {
      btc: normalizeToBase100(btcRaw),
      gold: normalizeToBase100(goldRaw),
    };
  }, [marketData, currentIndex]);

  const vaultValueSeries = useMemo(
    () => downsampleSeries(history.map((point) => point.netValue), MAX_CHART_POINTS),
    [history]
  );

  const pnlPercentSeries = useMemo(
    () => downsampleSeries(history.map((point) => point.netProfitPercent), MAX_CHART_POINTS),
    [history]
  );

  const maxDrawdownPercent = useMemo(() => computeMaxDrawdownPercent(history), [history]);

  const pendingRwaLots = useMemo(
    () =>
      lots.filter(
        (lot) =>
          currentIndex - lot.depositedAtIndex < SIMULATION_CONSTANTS.rwaActivationDelaySeconds
      ).length,
    [lots, currentIndex]
  );

  const activeRwaLots = lots.length - pendingRwaLots;

  return {
    loading,
    error,
    marketData,
    speedMultiplier,
    isRunning,
    virtualSeconds,
    currentIndex,
    virtualTimestampMs,
    currentBtcPrice,
    currentGoldPrice,
    cashBalance,
    lots,
    pendingRwaLots,
    activeRwaLots,
    snapshot,
    history,
    maxDrawdownPercent,
    marketSeries,
    vaultValueSeries,
    pnlPercentSeries,
    deposit,
    redeemAll,
    updateSpeed,
    restoreNormalSpeed,
    toggleRunning,
    resetSimulation,
  };
}
