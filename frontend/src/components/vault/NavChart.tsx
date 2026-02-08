'use client';

import { useEffect, useState } from 'react';
import { useChainId, usePublicClient } from 'wagmi';
import { getContracts } from '@/lib/contracts';
import { PharosVaultABI } from '@/lib/contracts/abis';

export interface SnapshotPoint {
  timestamp: number;
  pps: number;
  totalAssets: number;
}

export function useVaultSnapshots() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const client = usePublicClient();
  const [points, setPoints] = useState<SnapshotPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const vaultAddress = contracts.PharosVault;
  const isValid = vaultAddress !== '0x0000000000000000000000000000000000000000';

  useEffect(() => {
    if (!isValid || !client) return;
    (async () => {
      try {
        const logs = await client.getContractEvents({
          address: vaultAddress as `0x${string}`,
          abi: PharosVaultABI,
          eventName: 'VaultSnapshot',
          fromBlock: 0n,
          toBlock: 'latest',
        });
        setPoints(logs.map((log: any) => ({
          timestamp: Number(log.args.timestamp),
          pps: Number(log.args.pricePerShare) / 1e18,
          totalAssets: Number(log.args.totalAssets) / 1e6,
        })));
      } catch (e) {
        console.error('Failed to fetch snapshots:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isValid, client, vaultAddress]);

  // Max drawdown
  let maxDrawdownPercent = 0;
  if (points.length >= 2) {
    let peak = points[0].totalAssets;
    for (const p of points) {
      if (p.totalAssets > peak) peak = p.totalAssets;
      const dd = peak > 0 ? (peak - p.totalAssets) / peak : 0;
      if (dd > maxDrawdownPercent) maxDrawdownPercent = dd;
    }
    maxDrawdownPercent *= 100;
  }

  return { points, loading, maxDrawdownPercent };
}

export function TvlChart({ points, loading }: { points: SnapshotPoint[]; loading: boolean }) {
  if (loading) return <div className="h-36 bg-gray-50 rounded-lg animate-pulse" />;
  if (points.length < 2) return <FlatLine />;
  return <SvgChart points={points} />;
}

function FlatLine() {
  const W = 700, H = 140, y = H / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36">
      <line x1="40" y1={y} x2={W - 10} y2={y} stroke="#d1d5db" strokeWidth="1" strokeDasharray="6 4" />
      <text x={W / 2} y={y - 12} textAnchor="middle" fontSize="11" fill="#9ca3af">Awaiting data...</text>
    </svg>
  );
}

function SvgChart({ points }: { points: SnapshotPoint[] }) {
  const W = 700, H = 140;
  const PAD = { top: 10, right: 10, bottom: 25, left: 50 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const values = points.map((p) => p.totalAssets);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const minT = points[0].timestamp;
  const maxT = points[points.length - 1].timestamp;
  const tRange = maxT - minT || 1;

  const toX = (t: number) => PAD.left + ((t - minT) / tRange) * cw;
  const toY = (v: number) => PAD.top + ch - ((v - minVal) / range) * ch;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.timestamp).toFixed(1)},${toY(p.totalAssets).toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L${toX(maxT).toFixed(1)},${H - PAD.bottom} L${PAD.left},${H - PAD.bottom} Z`;
  const isUp = points[points.length - 1].totalAssets >= points[0].totalAssets;
  const color = isUp ? '#16a34a' : '#dc2626';

  const yTicks = 3;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => minVal + (range * i) / yTicks);

  const fmtTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)} stroke="#e5e7eb" strokeWidth="0.5" />
          <text x={PAD.left - 4} y={toY(v) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">
            ${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
      {points.map((p, i) => (
        <circle key={i} cx={toX(p.timestamp)} cy={toY(p.totalAssets)} r="2.5" fill={color} stroke="white" strokeWidth="1" />
      ))}
      <text x={PAD.left} y={H - 4} fontSize="9" fill="#9ca3af">{fmtTime(minT)}</text>
      <text x={W - PAD.right} y={H - 4} fontSize="9" fill="#9ca3af" textAnchor="end">{fmtTime(maxT)}</text>
    </svg>
  );
}
