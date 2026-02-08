'use client';

import { useAccount, useChainId } from 'wagmi';
import { getContracts } from '@/lib/contracts';
import { useHybridVaultInfo, useAsyncPosition, useHybridActions } from '@/hooks/useHybridVault';

export function UserPositionLive() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const vaultAddr = (contracts as any).HybridVault as `0x${string}`;
  const isValid = vaultAddr && vaultAddr !== '0x0000000000000000000000000000000000000000';

  const { info } = useHybridVaultInfo();
  const { shares, pendingDeposit, claimableShares, pendingRedeem, claimableAssets } = useAsyncPosition();
  const { claimShares, claimAssets, isPending, isConfirming } = useHybridActions();

  const fmt = (v: bigint) => (Number(v) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 });

  if (!isConnected) return <div className="p-6 bg-white border border-gray-200 rounded-xl"><p className="text-center text-gray-500">Connect wallet to view position</p></div>;
  if (!isValid) return <div className="p-6 bg-white border border-gray-200 rounded-xl"><p className="text-yellow-600">Contracts not deployed</p></div>;

  const sharesNum = Number(shares) / 1e6;
  const pps = info && info.totalSupply > 0n ? Number(info.totalAssets) / Number(info.totalSupply) : 1;
  const value = sharesNum * pps;
  const busy = isPending || isConfirming;

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <h3 className="text-lg font-semibold mb-4">Your Position</h3>

      <div className="text-center py-4 mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
        <p className="text-sm text-gray-500">Current Value</p>
        <p className="text-3xl font-bold">${value.toFixed(2)}</p>
        <p className="text-sm text-gray-500 mt-1">{sharesNum.toFixed(2)} shares</p>
        {pendingDeposit > 0n && (
          <p className="text-xs text-yellow-600 mt-1">+ ${(Number(pendingDeposit) / 1e6).toFixed(2)} pending</p>
        )}
      </div>

      <div className="space-y-2">
        {pendingDeposit > 0n && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex justify-between">
            <span className="text-yellow-700">⏳ Pending Deposit</span>
            <span className="font-semibold">${fmt(pendingDeposit)}</span>
          </div>
        )}
        {claimableShares > 0n && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
            <span className="text-green-700">✅ Claimable Shares: {fmt(claimableShares)}</span>
            <button onClick={() => address && claimShares(address)} disabled={busy}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg disabled:opacity-50">Claim</button>
          </div>
        )}
        {pendingRedeem > 0n && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex justify-between">
            <span className="text-orange-700">⏳ Pending Redeem</span>
            <span className="font-semibold">{fmt(pendingRedeem)} shares</span>
          </div>
        )}
        {claimableAssets > 0n && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
            <span className="text-green-700">✅ Claimable USDC: ${fmt(claimableAssets)}</span>
            <button onClick={() => address && claimAssets(address)} disabled={busy}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg disabled:opacity-50">Claim</button>
          </div>
        )}
      </div>

      {shares === 0n && pendingDeposit === 0n && claimableShares === 0n && (
        <p className="text-center text-gray-400 py-4">No position yet</p>
      )}
    </div>
  );
}
