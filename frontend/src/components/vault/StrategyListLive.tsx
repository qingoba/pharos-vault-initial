'use client';

import { useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getContracts } from '@/lib/contracts';
import { useHybridVaultInfo, useOperatorActions } from '@/hooks/useHybridVault';
import { HybridVaultABI } from '@/lib/contracts/hybrid-abis';
import { useMounted } from '@/hooks';
import { useState, useEffect } from 'react';

const USDC_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
] as const;

const StrategyABI = [
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalAssets', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'isActive', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'lastHarvest', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalProfit', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

function StrategyCard({ strategyAddress, isRWA, vaultAddr }: { strategyAddress: `0x${string}`; isRWA: boolean; vaultAddr: `0x${string}` }) {
  const mounted = useMounted();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const poll = { refetchInterval: 10000 } as const;
  const { data: name } = useReadContract({ address: strategyAddress, abi: StrategyABI, functionName: 'name' });
  const { data: totalAssets } = useReadContract({ address: strategyAddress, abi: StrategyABI, functionName: 'totalAssets', query: poll });
  const { data: isActive } = useReadContract({ address: strategyAddress, abi: StrategyABI, functionName: 'isActive', query: poll });
  const { data: lastHarvest } = useReadContract({ address: strategyAddress, abi: StrategyABI, functionName: 'lastHarvest', query: poll });
  const { data: totalProfit } = useReadContract({ address: strategyAddress, abi: StrategyABI, functionName: 'totalProfit', query: poll });

  const { injectYield, isPending } = useOperatorActions(strategyAddress);
  const { writeContract: approveWrite, data: approveHash, isPending: isApproving, reset: resetApprove } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const { writeContract: harvestWrite, isPending: isHarvesting } = useWriteContract();
  const [showInject, setShowInject] = useState(false);
  const [injectAmount, setInjectAmount] = useState('100');
  const [pendingInjectAmt, setPendingInjectAmt] = useState(0n);

  const handleInject = async () => {
    if (!injectAmount || parseFloat(injectAmount) <= 0) return;
    const amt = BigInt(Math.floor(parseFloat(injectAmount) * 1e6));
    setPendingInjectAmt(amt);
    resetApprove();
    approveWrite(
      { address: contracts.USDC, abi: USDC_ABI, functionName: 'approve', args: [strategyAddress, amt] },
    );
    setShowInject(false);
    setInjectAmount('100');
  };

  // After approve confirmed, fire inject
  useEffect(() => {
    if (approveConfirmed && pendingInjectAmt > 0n) {
      injectYield(pendingInjectAmt);
      setPendingInjectAmt(0n);
    }
  }, [approveConfirmed, pendingInjectAmt, injectYield]);

  const handleHarvest = () => {
    const fn = isRWA ? 'harvestAsyncStrategy' : 'harvestSyncStrategy';
    harvestWrite({ address: vaultAddr, abi: HybridVaultABI, functionName: fn, args: [strategyAddress] });
  };

  let timeSinceDisplay = '--';
  if (mounted && lastHarvest) {
    const timeSinceHarvest = Date.now() / 1000 - Number(lastHarvest);
    const hoursSinceHarvest = Math.floor(timeSinceHarvest / 3600);
    timeSinceDisplay = hoursSinceHarvest >= 24
      ? `${Math.floor(hoursSinceHarvest / 24)}d ago`
      : `${hoursSinceHarvest}h ago`;
  }

  const tvl = Number(totalAssets || 0n) / 1e6;
  const profit = Number(totalProfit || 0n) / 1e6;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{name || 'Strategy'}</h4>
          <p className="text-xs text-gray-500 font-mono mt-1">
            {strategyAddress.slice(0, 8)}...{strategyAddress.slice(-6)}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500">TVL</p>
          <p className="font-semibold">${tvl.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Allocation</p>
          <p className="font-semibold text-[var(--primary)]">{isRWA ? '60' : '40'}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">APY</p>
          <p className="font-semibold text-green-600">{isRWA ? '4.5' : '3.0'}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Last Harvest</p>
          <p className="font-semibold">{timeSinceDisplay}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
            style={{ width: `${isRWA ? 60 : 40}%` }} />
        </div>
      </div>

      <div className="flex justify-between text-sm mb-3">
        <span className="text-gray-500">Total Profit:</span>
        <span className="font-medium text-green-600">+${profit.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button onClick={handleHarvest} disabled={isHarvesting || !isActive}
          className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
          {isHarvesting ? 'Harvesting...' : '🌾 Harvest'}
        </button>
        {isRWA && (
          <button onClick={() => setShowInject(!showInject)}
            className="flex-1 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            💉 Inject Yield
          </button>
        )}
      </div>

      {showInject && (
        <div className="p-3 bg-blue-50 rounded-lg mt-2">
          <p className="text-xs text-blue-600 mb-2">Inject off-chain yield (USDC)</p>
          <div className="flex gap-2">
            <input type="number" value={injectAmount} onChange={(e) => setInjectAmount(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-blue-200 rounded" placeholder="Amount" min="0" />
            <button onClick={handleInject} disabled={isPending || isApproving || !injectAmount}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {isApproving ? 'Approving...' : isPending ? 'Injecting...' : 'Inject'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StrategyListLive() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const vaultAddr = (contracts as any).HybridVault as `0x${string}`;
  const isValid = vaultAddr && vaultAddr !== '0x0000000000000000000000000000000000000000';

  const { info, isLoading } = useHybridVaultInfo();

  if (!isValid) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Strategies</h3>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          Contracts not deployed yet. Deploy to see strategies.
        </div>
      </div>
    );
  }

  if (isLoading || !info) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Strategies</h3>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-lg animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const total = info.syncStrategies.length + info.asyncStrategies.length;

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Strategies ({total})</h3>
      </div>

      {total === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
          No strategies added yet
        </div>
      ) : (
        <div className="space-y-3">
          {info.syncStrategies.map(addr => (
            <StrategyCard key={addr} strategyAddress={addr} isRWA={false} vaultAddr={vaultAddr} />
          ))}
          {info.asyncStrategies.map(addr => (
            <StrategyCard key={addr} strategyAddress={addr} isRWA={true} vaultAddr={vaultAddr} />
          ))}
        </div>
      )}
    </div>
  );
}
