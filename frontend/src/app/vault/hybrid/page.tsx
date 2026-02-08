'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseUnits, formatUnits } from 'viem';
import { useHybridVaultInfo, useAsyncPosition, useHybridActions, useOperatorActions } from '@/hooks/useHybridVault';
import { getContracts } from '@/lib/contracts';
import { PharosVaultABI } from '@/lib/contracts/abis';

const USDC_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export default function HybridVaultPage() {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 text-center py-24">
        <p className="text-gray-500 mb-4">Connect wallet to use Hybrid Vault</p>
        <button onClick={() => connect({ connector: injected() })} className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl flex items-center gap-3">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        <span className="text-sm text-blue-700 font-medium">Hybrid Vault — ⚡ ERC4626 + ⏳ ERC7540</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2"><VaultInfo /></div>
        <DepositWithdraw />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2"><StrategyCards /></div>
        <AsyncClaimPanel />
      </div>

      <OperatorPanel />
    </div>
  );
}

// ======================== Vault Info ========================

function VaultInfo() {
  const { info, isLoading, tvl, syncPercent, asyncPercent } = useHybridVaultInfo();

  if (isLoading || !info) {
    return <div className="p-6 bg-white border border-gray-200 rounded-xl animate-pulse"><div className="h-32" /></div>;
  }

  const fmt = (v: bigint) => (Number(v) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 });

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-4">
          <span className="text-lg font-bold text-white">HV</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">{info.name}</h1>
          <p className="text-sm text-gray-500">{info.symbol} · ⚡ {syncPercent}% + ⏳ {asyncPercent}%</p>
        </div>
        <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">Active</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Value Locked</p>
          <p className="text-xl font-bold">${parseFloat(tvl).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">⚡ DeFi</p>
          <p className="text-xl font-bold">${fmt(info.totalSyncDebt)}</p>
          <p className="text-xs text-gray-400">{syncPercent}% allocation</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">⏳ RWA</p>
          <p className="text-xl font-bold">${fmt(info.totalAssets - info.totalSyncDebt)}</p>
          <p className="text-xs text-gray-400">{asyncPercent}% allocation</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Fees</p>
          <p className="text-xl font-bold">{(info.managementFee / 100).toFixed(1)}% / {(info.performanceFee / 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-400">Mgmt / Perf</p>
        </div>
      </div>
    </div>
  );
}

// ======================== Deposit / Withdraw ========================

function DepositWithdraw() {
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const { info, refetch } = useHybridVaultInfo();
  const { deposit, redeem, isPending, isConfirming, isSuccess, error } = useHybridActions();
  const { writeContract: approveWrite } = useWriteContract();

  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');

  const vaultAddr = (contracts as any).HybridVault as `0x${string}`;
  const syncPct = info ? (info.syncRatio / (info.syncRatio + info.asyncRatio) * 100).toFixed(0) : '40';
  const asyncPct = info ? (100 - Number(syncPct)).toFixed(0) : '60';

  const handleDeposit = async () => {
    if (!amount || !address) return;
    const assets = parseUnits(amount, 6);
    // Approve first
    approveWrite({ address: contracts.USDC, abi: USDC_ABI, functionName: 'approve', args: [vaultAddr, assets] });
    // Small delay for approval
    setTimeout(() => deposit(assets, address), 2000);
  };

  const handleWithdraw = async () => {
    if (!amount || !address || !info) return;
    const shares = parseUnits(amount, info.decimals);
    redeem(shares, address, address);
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <div className="flex gap-2 mb-4">
        {(['deposit', 'withdraw'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm rounded-lg ${mode === m ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-600'}`}>
            {m === 'deposit' ? 'Deposit' : 'Withdraw'}
          </button>
        ))}
      </div>

      <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
        placeholder={mode === 'deposit' ? 'USDC amount' : 'Shares amount'}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3" />

      {mode === 'deposit' && amount && (
        <div className="p-3 bg-blue-50 rounded-lg mb-3 text-xs text-blue-700">
          <p>⚡ {syncPct}% → {(parseFloat(amount || '0') * Number(syncPct) / 100).toFixed(2)} USDC → instant shares</p>
          <p>⏳ {asyncPct}% → {(parseFloat(amount || '0') * Number(asyncPct) / 100).toFixed(2)} USDC → pending (claim later)</p>
        </div>
      )}

      {mode === 'withdraw' && amount && (
        <div className="p-3 bg-orange-50 rounded-lg mb-3 text-xs text-orange-700">
          <p>⚡ {syncPct}% shares → instant USDC</p>
          <p>⏳ {asyncPct}% shares → pending (claim later)</p>
        </div>
      )}

      <button onClick={mode === 'deposit' ? handleDeposit : handleWithdraw}
        disabled={isPending || isConfirming || !amount}
        className="w-full py-2 bg-[var(--primary)] text-white rounded-lg text-sm disabled:opacity-50">
        {isPending ? 'Signing...' : isConfirming ? 'Confirming...' : mode === 'deposit' ? 'Deposit' : 'Withdraw'}
      </button>

      {isSuccess && <p className="text-xs text-green-600 mt-2">✓ Transaction confirmed</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error.message.slice(0, 80)}</p>}
    </div>
  );
}

// ======================== Strategy Cards ========================

function StrategyCards() {
  const { info } = useHybridVaultInfo();
  if (!info) return null;

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <h3 className="font-semibold mb-4">Strategies</h3>
      <div className="space-y-3">
        {info.syncStrategies.map(addr => (
          <div key={addr} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded mr-2">⚡ DeFi</span>
                <span className="text-sm font-mono text-gray-500">{addr.slice(0, 8)}...{addr.slice(-6)}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">${(Number(info.totalSyncDebt) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-400">{(info.syncRatio / 100).toFixed(0)}% allocation</p>
              </div>
            </div>
          </div>
        ))}
        {info.asyncStrategies.map(addr => (
          <AsyncStrategyCard key={addr} address={addr} ratio={info.asyncRatio} totalAssets={info.totalAssets} totalSyncDebt={info.totalSyncDebt} />
        ))}
      </div>
    </div>
  );
}

function AsyncStrategyCard({ address, ratio, totalAssets, totalSyncDebt }: { address: `0x${string}`; ratio: number; totalAssets: bigint; totalSyncDebt: bigint }) {
  const asyncAssets = totalAssets - totalSyncDebt;
  return (
    <div className="p-4 border border-purple-200 bg-purple-50/30 rounded-lg">
      <div className="flex justify-between items-center">
        <div>
          <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded mr-2">⏳ RWA</span>
          <span className="text-sm font-mono text-gray-500">{address.slice(0, 8)}...{address.slice(-6)}</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">${(Number(asyncAssets) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400">{(ratio / 100).toFixed(0)}% allocation</p>
        </div>
      </div>
    </div>
  );
}

// ======================== Async Claim Panel ========================

function AsyncClaimPanel() {
  const { address } = useAccount();
  const { pendingDeposit, claimableShares, pendingRedeem, claimableAssets, shares, isLoading, hasPending, hasClaimable, refetch: refetchPosition } = useAsyncPosition();
  const { refetch: refetchVault } = useHybridVaultInfo();
  const { claimShares, claimAssets, isPending, isConfirming, isSuccess } = useHybridActions();

  // Refetch position and vault info after successful claim
  useEffect(() => {
    if (isSuccess) {
      refetchPosition();
      refetchVault();
    }
  }, [isSuccess, refetchPosition, refetchVault]);

  const fmt = (v: bigint) => (Number(v) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 });

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <h3 className="font-semibold mb-4">Your Position</h3>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Shares</span>
          <span className="font-semibold">{fmt(shares)}</span>
        </div>

        {pendingDeposit > 0n && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-yellow-700">⏳ Pending Deposit</p>
                <p className="font-semibold text-yellow-800">${fmt(pendingDeposit)}</p>
              </div>
              <span className="px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded">Awaiting</span>
            </div>
          </div>
        )}

        {claimableShares > 0n && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-green-700">✅ Claimable Shares</p>
                <p className="font-semibold text-green-800">{fmt(claimableShares)}</p>
              </div>
              <button onClick={() => address && claimShares(address)} disabled={isPending || isConfirming}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg disabled:opacity-50">
                {isPending || isConfirming ? '...' : 'Claim'}
              </button>
            </div>
          </div>
        )}

        {pendingRedeem > 0n && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-orange-700">⏳ Pending Redeem</p>
                <p className="font-semibold text-orange-800">{fmt(pendingRedeem)} shares</p>
              </div>
              <span className="px-2 py-1 text-xs bg-orange-200 text-orange-800 rounded">Awaiting</span>
            </div>
          </div>
        )}

        {claimableAssets > 0n && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-green-700">✅ Claimable USDC</p>
                <p className="font-semibold text-green-800">${fmt(claimableAssets)}</p>
              </div>
              <button onClick={() => address && claimAssets(address)} disabled={isPending || isConfirming}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg disabled:opacity-50">
                {isPending || isConfirming ? '...' : 'Claim'}
              </button>
            </div>
          </div>
        )}

        {!hasPending && !hasClaimable && shares === 0n && (
          <p className="text-gray-400 text-center py-4">No position yet</p>
        )}

        {isSuccess && <p className="text-xs text-green-600 text-center">✓ Claimed successfully</p>}
      </div>
    </div>
  );
}

// ======================== Operator Panel ========================

function OperatorPanel() {
  const { info } = useHybridVaultInfo();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const [tab, setTab] = useState<'withdraw' | 'fulfill' | 'yield'>('withdraw');
  const [amount, setAmount] = useState('');
  const [userAddr, setUserAddr] = useState('');

  const asyncAddr = info?.asyncStrategies?.[0];
  const { withdrawToOperator, reportNAV, fulfillDeposit, fulfillRedeem, injectYield, returnAssets, isPending, isConfirming, isSuccess, error } = useOperatorActions(asyncAddr);

  // Approve flow for injectYield / returnAssets (both use safeTransferFrom)
  const { writeContract: approveWrite, data: approveHash, isPending: isApproving, reset: resetApprove } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const pendingAction = useRef<{ fn: 'inject' | 'return'; amt: bigint } | null>(null);

  useEffect(() => {
    if (approveConfirmed && pendingAction.current) {
      const { fn, amt } = pendingAction.current;
      pendingAction.current = null;
      if (fn === 'inject') injectYield(amt);
      else returnAssets(amt);
    }
  }, [approveConfirmed, injectYield, returnAssets]);

  const approveAndCall = (fn: 'inject' | 'return') => {
    const amt = parseUnits(amount || '0', 6);
    pendingAction.current = { fn, amt };
    resetApprove();
    approveWrite({ address: contracts.USDC, abi: USDC_ABI, functionName: 'approve', args: [asyncAddr!, amt] });
  };

  if (!info || !asyncAddr) return null;

  const busy = isPending || isConfirming || isApproving;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex border-b border-gray-200">
        {([['withdraw', '📤 Withdraw USDC'], ['fulfill', '✅ Fulfill'], ['yield', '💰 Yield']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-6 py-3 text-sm font-medium ${tab === key ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-6">
        <p className="text-xs text-gray-400 mb-3">Operator actions for RWA Strategy ({asyncAddr.slice(0, 8)}...)</p>

        {tab === 'withdraw' && (
          <div className="space-y-3">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="USDC amount" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex gap-2">
              <button onClick={() => withdrawToOperator(parseUnits(amount || '0', 6))} disabled={busy || !amount}
                className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
                {busy ? '...' : '📤 Withdraw & Buy RWA'}
              </button>
              <button onClick={() => reportNAV(parseUnits(amount || '0', 6))} disabled={busy || !amount}
                className="flex-1 py-2 text-sm bg-purple-600 text-white rounded-lg disabled:opacity-50">
                {busy ? '...' : '📊 Report NAV'}
              </button>
            </div>
          </div>
        )}

        {tab === 'fulfill' && (
          <div className="space-y-3">
            <input type="text" value={userAddr} onChange={e => setUserAddr(e.target.value)} placeholder="User address (0x...)" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Shares or USDC amount" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex gap-2">
              <button onClick={() => fulfillDeposit(userAddr as `0x${string}`, parseUnits(amount || '0', 6))} disabled={busy || !amount || !userAddr}
                className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">
                {busy ? '...' : '✅ Fulfill Deposit'}
              </button>
              <button onClick={() => fulfillRedeem(userAddr as `0x${string}`, parseUnits(amount || '0', 6))} disabled={busy || !amount || !userAddr}
                className="flex-1 py-2 text-sm bg-orange-600 text-white rounded-lg disabled:opacity-50">
                {busy ? '...' : '✅ Fulfill Redeem'}
              </button>
            </div>
          </div>
        )}

        {tab === 'yield' && (
          <div className="space-y-3">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="USDC amount" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex gap-2">
              <button onClick={() => approveAndCall('inject')} disabled={busy || !amount}
                className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">
                {isApproving ? 'Approving...' : isPending ? 'Injecting...' : '💰 Inject Yield'}
              </button>
              <button onClick={() => approveAndCall('return')} disabled={busy || !amount}
                className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
                {isApproving ? 'Approving...' : isPending ? 'Returning...' : '🔙 Return Assets'}
              </button>
            </div>
          </div>
        )}

        {isSuccess && <p className="text-xs text-green-600 mt-2">✓ Transaction confirmed</p>}
        {error && <p className="text-xs text-red-600 mt-2">{error.message.slice(0, 100)}</p>}
      </div>
    </div>
  );
}
