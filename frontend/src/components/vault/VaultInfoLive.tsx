'use client';

import { useChainId, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getContracts } from '@/lib/contracts';
import { useHybridVaultInfo } from '@/hooks/useHybridVault';
import { HybridVaultABI } from '@/lib/contracts/hybrid-abis';

export function VaultInfoLive() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const vaultAddress = (contracts as any).HybridVault as `0x${string}`;
  const isValidContract = vaultAddress && vaultAddress !== '0x0000000000000000000000000000000000000000';

  const { info, isLoading, tvl } = useHybridVaultInfo();

  // Fee data
  const { data: feeData, refetch: refetchFees } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: HybridVaultABI, functionName: 'accumulatedFees' },
      { address: vaultAddress, abi: HybridVaultABI, functionName: 'feeRecipient' },
    ],
    query: { enabled: isValidContract, refetchInterval: 15000 },
  });
  const totalFee = feeData?.[0]?.status === 'success' ? Number(feeData[0].result) / 1e6 : 0;
  const feeRecipient = feeData?.[1]?.status === 'success' ? (feeData[1].result as string) : '';

  const { writeContract, data: claimHash, isPending: isClaiming } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: claimHash });
  const handleClaim = () => writeContract({ address: vaultAddress, abi: HybridVaultABI, functionName: 'claimFees' });
  if (isConfirmed) refetchFees();

  if (!isValidContract) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h1 className="text-2xl font-bold text-gray-900">Pharos Hybrid Vault</h1>
        <p className="text-sm text-yellow-600 mt-2">⚠️ Contracts not deployed — run deploy:hybrid first</p>
      </div>
    );
  }

  if (isLoading || !info) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-4" />
        <div className="grid grid-cols-5 gap-4">{[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg" />)}</div>
      </div>
    );
  }

  const tvlNum = parseFloat(tvl);
  const tvlDisplay = tvlNum >= 1e6 ? `$${(tvlNum/1e6).toFixed(2)}M` : tvlNum >= 1e3 ? `$${(tvlNum/1e3).toFixed(2)}K` : `$${tvlNum.toFixed(2)}`;
  const displayApr = '4.00';
  const fmt = (v: bigint) => (Number(v) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 });

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-4">
          <span className="text-lg font-bold text-white">HV</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{info.name}</h1>
          <p className="text-sm text-gray-500 font-mono">
            {vaultAddress.slice(0, 10)}...{vaultAddress.slice(-8)}
          </p>
        </div>
        <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Active</span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Value Locked</p>
          <p className="text-xl font-bold">{tvlDisplay}</p>
          <p className="text-xs text-gray-400">{info.syncStrategies.length + info.asyncStrategies.length} strategies</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Estimated APY</p>
          <p className="text-xl font-bold text-[var(--primary)]">{displayApr}%</p>
          <p className="text-xs text-gray-400">Target</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Max Drawdown</p>
          <p className="text-xl font-bold text-red-500">0%</p>
          <p className="text-xs text-gray-400">Historical</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Management Fee</p>
          <p className="text-xl font-bold">{(info.managementFee / 100).toFixed(2)}%</p>
          <p className="text-xs text-gray-400">Annualized</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Performance Fee</p>
          <p className="text-xl font-bold">{(info.performanceFee / 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-400">On profits</p>
        </div>
      </div>

      {/* Asset Breakdown */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">DeFi Deployed:</span>
          <span className="font-medium">${fmt(info.totalSyncDebt)}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-500">RWA Assets:</span>
          <span className="font-medium">${fmt(info.totalAssets - info.totalSyncDebt)}</span>
        </div>
      </div>

      {/* Accumulated Fees */}
      {totalFee > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Accumulated Fees: <span className="font-medium text-orange-600">${totalFee.toFixed(4)}</span></span>
            <button onClick={handleClaim} disabled={isClaiming || isConfirming}
              className="px-3 py-1 text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-200 disabled:opacity-50">
              {isClaiming || isConfirming ? 'Claiming...' : `Claim $${totalFee.toFixed(2)}`}
            </button>
          </div>
          {isConfirmed && <p className="text-xs text-green-600 mt-1">✓ Fees claimed</p>}
        </div>
      )}
    </div>
  );
}
