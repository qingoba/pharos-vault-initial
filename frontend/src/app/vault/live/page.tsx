'use client';

import { useState, useEffect } from 'react';
import { VaultInfoLive } from '@/components/vault/VaultInfoLive';
import { StrategyListLive } from '@/components/vault/StrategyListLive';
import { UserPositionLive } from '@/components/vault/UserPositionLive';
import { VaultActions } from '@/components/vault/VaultActions';
import { useChainId, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getContracts } from '@/lib/contracts';
import { HybridVaultABI, AsyncRWAStrategyABI } from '@/lib/contracts/hybrid-abis';
import { useOperatorActions } from '@/hooks/useHybridVault';

const USDC_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
] as const;

export default function LiveVaultPage() {
  const [mounted, setMounted] = useState(false);
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const vaultAddr = (contracts as any).HybridVault as `0x${string}`;
  const asyncAddr = (contracts as any).AsyncRWAStrategy as `0x${string}`;
  const defiAddr = (contracts as any).DeFiStrategy as `0x${string}`;
  
  useEffect(() => { setMounted(true); }, []);

  const isValid = vaultAddr && vaultAddr !== '0x0000000000000000000000000000000000000000';
  const networkName = chainId === 688689 ? 'Pharos Testnet' : chainId === 1672 ? 'Pharos Mainnet' : `Chain ${chainId}`;

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl animate-pulse"><div className="h-4 bg-blue-200 rounded w-48" /></div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 h-48 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Network Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-blue-700">Connected to {networkName}</span>
        </div>
        {isValid && (
          <a href={`https://atlantic.pharosscan.xyz/address/${vaultAddr}`} target="_blank" rel="noopener noreferrer"
            className="text-sm text-[var(--primary)] hover:underline">View Contract →</a>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2"><VaultInfoLive /></div>
        <VaultActions vaultId="live" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2"><StrategyListLive /></div>
        <UserPositionLive />
      </div>

      {/* Operator Panel */}
      {isValid && <OperatorPanel asyncAddr={asyncAddr} />}

      {/* Contract Addresses */}
      {isValid && (
        <div className="p-6 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-4">Contract Addresses</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['HybridVault', vaultAddr],
              ['USDC', contracts.USDC],
              ['DeFi Strategy', defiAddr],
              ['RWA Strategy', asyncAddr],
            ].map(([label, addr]) => (
              <div key={label} className="flex justify-between p-3 bg-white rounded-lg">
                <span className="text-gray-500">{label}:</span>
                <a href={`https://atlantic.pharosscan.xyz/address/${addr}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-xs text-[var(--primary)] hover:underline">
                  {(addr as string).slice(0, 10)}...{(addr as string).slice(-8)}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* About */}
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="font-semibold mb-3">About Hybrid Vault</h3>
        <p className="text-gray-600 text-sm mb-4">
          Pharos Hybrid Vault combines synchronous DeFi strategies (instant deposit/withdraw) with asynchronous RWA strategies 
          (request → fulfill → claim flow for real-world assets). Users receive unified ERC20 share tokens.
        </p>
        <div className="flex gap-3 text-sm">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">⚡ ERC4626</span>
          <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full">⏳ ERC7540</span>
          <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">RWA Yields</span>
        </div>
      </div>
    </div>
  );
}

function OperatorPanel({ asyncAddr }: { asyncAddr: `0x${string}` }) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const { withdrawToOperator, fulfillDeposit, fulfillRedeem, reportNAV, returnAssets, isPending } = useOperatorActions(asyncAddr);
  const { writeContract: approveWrite, data: approveHash, isPending: isApproving } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const [navAmount, setNavAmount] = useState('');
  const [pendingReturn, setPendingReturn] = useState(0);

  const { data: strategyData, refetch } = useReadContracts({
    contracts: [
      { address: asyncAddr, abi: AsyncRWAStrategyABI, functionName: 'totalPendingDeposits' },
      { address: asyncAddr, abi: AsyncRWAStrategyABI, functionName: 'totalPendingRedeems' },
      { address: asyncAddr, abi: AsyncRWAStrategyABI, functionName: 'offChainAssets' },
    ],
    query: { enabled: !!asyncAddr && asyncAddr !== '0x0000000000000000000000000000000000000000', refetchInterval: 10000 },
  });

  const pendingDep = strategyData?.[0]?.status === 'success' ? Number(strategyData[0].result) : 0;
  const pendingRed = strategyData?.[1]?.status === 'success' ? Number(strategyData[1].result) : 0;
  const offChain = strategyData?.[2]?.status === 'success' ? Number(strategyData[2].result) : 0;
  const fmt = (v: number) => (v / 1e6).toFixed(2);

  const handleWithdraw = async () => {
    if (pendingDep <= 0) return;
    await withdrawToOperator(BigInt(pendingDep));
    refetch();
  };

  const handleFulfillDeposits = async () => {
    // Batch fulfill — address/shares params ignored by contract
    await fulfillDeposit('0x0000000000000000000000000000000000000000' as `0x${string}`, 0n);
    refetch();
  };

  const handleReportNAV = async () => {
    if (!navAmount) return;
    await reportNAV(BigInt(Math.floor(parseFloat(navAmount) * 1e6)));
    setNavAmount('');
    refetch();
  };

  const handleFulfillRedeems = async () => {
    await fulfillRedeem('0x0000000000000000000000000000000000000000' as `0x${string}`, 0n);
    refetch();
  };

  const handleReturnAssets = async () => {
    if (offChain <= 0) return;
    setPendingReturn(offChain);
    approveWrite(
      { address: contracts.USDC, abi: USDC_ABI, functionName: 'approve', args: [asyncAddr, BigInt(offChain)] },
    );
  };

  // After approve confirmed, do returnAssets
  useEffect(() => {
    if (approveConfirmed && pendingReturn > 0) {
      returnAssets(BigInt(pendingReturn));
      setPendingReturn(0);
      refetch();
    }
  }, [approveConfirmed]);

  return (
    <div className="p-6 bg-orange-50 border border-orange-200 rounded-xl">
      <h3 className="font-semibold text-orange-800 mb-4">Operator Panel (RWA Strategy)</h3>
      
      {/* Status */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div className="p-3 bg-white rounded-lg">
          <p className="text-gray-500">Pending Deposits</p>
          <p className="font-semibold">${fmt(pendingDep)}</p>
        </div>
        <div className="p-3 bg-white rounded-lg">
          <p className="text-gray-500">Pending Redeems</p>
          <p className="font-semibold">{fmt(pendingRed)} shares</p>
        </div>
        <div className="p-3 bg-white rounded-lg">
          <p className="text-gray-500">Off-chain Assets</p>
          <p className="font-semibold">${fmt(offChain)}</p>
        </div>
      </div>

      {/* Deposit Flow */}
      <div className="mb-3 p-4 bg-white rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-3">Deposit Flow</p>
        <div className="flex gap-2">
          <button onClick={handleWithdraw} disabled={isPending || pendingDep <= 0}
            className="flex-1 py-2 text-sm bg-orange-100 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-200 disabled:opacity-50">
            1. Withdraw USDC and buy RWA asset
          </button>
          <button onClick={handleFulfillDeposits} disabled={isPending || pendingDep <= 0}
            className="flex-1 py-2 text-sm bg-green-100 text-green-700 border border-green-200 rounded-lg hover:bg-green-200 disabled:opacity-50">
            2. Confirm Purchase
          </button>
        </div>
        {pendingDep > 0 && <p className="text-xs text-gray-500 mt-2">Will withdraw ${fmt(pendingDep)} USDC, all pending users become claimable</p>}
      </div>

      {/* Redeem Flow */}
      <div className="mb-3 p-4 bg-white rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-3">Redeem Flow</p>
        <div className="flex gap-2">
          <button onClick={handleReturnAssets} disabled={isPending || offChain <= 0}
            className="flex-1 py-2 text-sm bg-orange-100 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-200 disabled:opacity-50">
            1. Sell RWA asset and return USDC
          </button>
          <button onClick={handleFulfillRedeems} disabled={isPending || pendingRed <= 0}
            className="flex-1 py-2 text-sm bg-green-100 text-green-700 border border-green-200 rounded-lg hover:bg-green-200 disabled:opacity-50">
            2. Confirm Redemption
          </button>
        </div>
      </div>

      {/* Report NAV */}
      <div className="p-4 bg-white rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-3">Report NAV</p>
        <div className="flex gap-2">
          <input type="number" value={navAmount} onChange={e => setNavAmount(e.target.value)}
            placeholder="USD value" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <button onClick={handleReportNAV} disabled={isPending || !navAmount}
            className="px-4 py-2 text-sm bg-blue-100 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-200 disabled:opacity-50">
            Report
          </button>
        </div>
      </div>
    </div>
  );
}
