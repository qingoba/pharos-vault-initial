'use client';

import { useMemo, useState } from 'react';
import { useVaultSimulation } from '@/hooks/useVaultSimulation';
import { SIMULATION_CONSTANTS } from '@/lib/simulation';
import { SimulationLineChart } from './SimulationLineChart';

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatShanghaiTime(timestampMs: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(timestampMs);
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;
  return `${hours}h ${minutes}m ${remainSeconds}s`;
}

export function VaultSimulationBoard() {
  const {
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
  } = useVaultSimulation();

  const [depositAmount, setDepositAmount] = useState('');
  const [speedInput, setSpeedInput] = useState(String(SIMULATION_CONSTANTS.defaultSpeed));
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const totalPortfolioValue = snapshot.netValue + cashBalance;

  const progressPercent = useMemo(() => {
    if (!marketData || marketData.datasetSeconds <= 1) {
      return 0;
    }
    return (currentIndex / (marketData.datasetSeconds - 1)) * 100;
  }, [marketData, currentIndex]);

  const composition = useMemo(() => {
    const denominator = snapshot.netValue > 0 ? snapshot.netValue : 1;
    return {
      btcPercent: (snapshot.btcValue / denominator) * 100,
      pendingRwaPercent: (snapshot.pendingRwaValue / denominator) * 100,
      activeRwaPercent: (snapshot.activeRwaValue / denominator) * 100,
    };
  }, [snapshot]);

  const handleApplySpeed = () => {
    const parsed = Number(speedInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMessage({ type: 'error', text: '请输入有效倍速（> 0）。' });
      return;
    }

    updateSpeed(parsed);
    setMessage({ type: 'info', text: `时间倍速已设置为 ${parsed}x。` });
  };

  const handleDeposit = () => {
    const parsed = Number(depositAmount);
    const result = deposit(parsed);
    if (result.ok) {
      setDepositAmount('');
      setMessage({ type: 'success', text: result.message });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleRedeemAll = () => {
    const result = redeemAll();
    if (result.ok) {
      setMessage({ type: 'success', text: result.message });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="p-6 bg-white border border-gray-200 rounded-xl animate-pulse">
          <div className="h-6 w-64 bg-gray-200 rounded mb-4" />
          <div className="h-4 w-full bg-gray-200 rounded mb-2" />
          <div className="h-4 w-2/3 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error || !marketData) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
          Failed to load market simulation data: {error || 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="p-6 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-amber-50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vault Simulation Arena</h1>
            <p className="text-sm text-gray-600 mt-1">
              虚拟起点: 2025-03-03 09:00:00 (Asia/Shanghai)
            </p>
            <p className="text-sm text-gray-600">
              当前虚拟时间: <span className="font-medium">{formatShanghaiTime(virtualTimestampMs)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={SIMULATION_CONSTANTS.minSpeed}
              max={SIMULATION_CONSTANTS.maxSpeed}
              step="0.25"
              value={speedInput}
              onChange={(event) => setSpeedInput(event.target.value)}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="倍速"
            />
            <button
              type="button"
              onClick={handleApplySpeed}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              应用倍速
            </button>
            <button
              type="button"
              onClick={restoreNormalSpeed}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            >
              恢复 1x
            </button>
            <button
              type="button"
              onClick={toggleRunning}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            >
              {isRunning ? '暂停' : '继续'}
            </button>
            <button
              type="button"
              onClick={resetSimulation}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            >
              重置到开盘
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-blue-100 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-gray-600 gap-2">
            <span>已回放: {formatDuration(virtualSeconds)}</span>
            <span>速度: {speedMultiplier.toFixed(2)}x</span>
            <span>数据点: {currentIndex + 1}/{marketData.datasetSeconds}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">市场走势（近 6 小时，归一化到 100）</h2>
              <div className="text-sm text-gray-600">
                BTC: <span className="font-medium">{formatUsd(currentBtcPrice)}</span> | Gold(XAU):{' '}
                <span className="font-medium">{formatUsd(currentGoldPrice)}</span>
              </div>
            </div>
            <SimulationLineChart
              series={[
                { name: 'BTC Index', color: '#2563eb', values: marketSeries.btc },
                { name: 'Gold Index', color: '#d97706', values: marketSeries.gold },
              ]}
              valueFormatter={(value) => value.toFixed(2)}
            />
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Vault 收益曲线（实时）</h2>
              <div className={`text-sm font-medium ${snapshot.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(snapshot.netProfitPercent)}
              </div>
            </div>
            <SimulationLineChart
              series={[
                { name: 'Vault Net Value (USDC)', color: '#16a34a', values: vaultValueSeries },
              ]}
              valueFormatter={formatUsd}
            />
            <div className="mt-4">
              <SimulationLineChart
                series={[
                  { name: 'PnL %', color: '#9333ea', values: pnlPercentSeries },
                ]}
                valueFormatter={(value) => `${value.toFixed(2)}%`}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-white border border-gray-200 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">资金操作</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">虚拟现金余额</span>
                <span className="font-semibold">{formatUsd(cashBalance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Vault 净值</span>
                <span className="font-semibold">{formatUsd(snapshot.netValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">总资产</span>
                <span className="font-semibold">{formatUsd(totalPortfolioValue)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                placeholder="输入买入金额（USDC）"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleDeposit}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                买入 Vault
              </button>
              <button
                type="button"
                onClick={handleRedeemAll}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
              >
                赎回全部仓位
              </button>
            </div>

            {message && (
              <div
                className={`mt-3 rounded-lg border p-3 text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : message.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}
              >
                {message.text}
              </div>
            )}
          </div>

          <div className="p-6 bg-white border border-gray-200 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">透明度指标</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Projected APY</span>
                <span className="font-semibold text-blue-700">{snapshot.projectedApy.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Realized APY</span>
                <span className="font-semibold text-green-700">{snapshot.realizedApy.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">历史最大回撤</span>
                <span className="font-semibold">{maxDrawdownPercent.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">管理费（自动）</span>
                <span className="font-semibold">{formatUsd(snapshot.managementFeeAccrued)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">表现费（自动）</span>
                <span className="font-semibold">{formatUsd(snapshot.performanceFeeAccrued)}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">BTC 策略敞口</span>
                <span className="font-medium">{composition.btcPercent.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">RWA 待激活（&lt; 1h）</span>
                <span className="font-medium">{composition.pendingRwaPercent.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">RWA 已激活（Gold）</span>
                <span className="font-medium">{composition.activeRwaPercent.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">仓位与策略状态</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">总买入笔数</p>
            <p className="text-xl font-bold">{lots.length}</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700">RWA Pending (&lt; 1h)</p>
            <p className="text-xl font-bold text-amber-700">{pendingRwaLots}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-xs text-green-700">RWA Active (&gt;= 1h)</p>
            <p className="text-xl font-bold text-green-700">{activeRwaLots}</p>
          </div>
        </div>

        {lots.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
            暂无仓位，输入金额后点击“买入 Vault”即可开始演示收益。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4">Lot ID</th>
                  <th className="py-2 pr-4">买入时间(上海)</th>
                  <th className="py-2 pr-4">本金</th>
                  <th className="py-2 pr-4">BTC 入场价</th>
                  <th className="py-2 pr-4">RWA 状态</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => {
                  const ageSeconds = currentIndex - lot.depositedAtIndex;
                  const activationSecondsLeft = SIMULATION_CONSTANTS.rwaActivationDelaySeconds - ageSeconds;
                  const isRwaActive = activationSecondsLeft <= 0;

                  return (
                    <tr key={lot.id} className="border-b border-gray-100 last:border-none">
                      <td className="py-2 pr-4 font-mono text-xs">{lot.id}</td>
                      <td className="py-2 pr-4">
                        {formatShanghaiTime(marketData.virtualStartUtcMs + lot.depositedAtIndex * 1000)}
                      </td>
                      <td className="py-2 pr-4">{formatUsd(lot.principal)}</td>
                      <td className="py-2 pr-4">{formatUsd(lot.btcEntryPrice)}</td>
                      <td className="py-2 pr-4">
                        {isRwaActive ? (
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">Active</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs">
                            Pending ({Math.max(0, Math.floor(activationSecondsLeft / 60))}m)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
        数据来源:
        <span className="font-mono ml-2">{marketData.source.btcFile}</span>
        <span className="mx-2">|</span>
        <span className="font-mono">{marketData.source.goldFile}</span>
      </div>
    </div>
  );
}
