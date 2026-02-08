'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { getContracts } from '@/lib/contracts';
import { useHybridVaultInfo, useAsyncPosition, useHybridActions } from '@/hooks/useHybridVault';

const USDC_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'mint', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;

export function VaultActions({ vaultId }: { vaultId: string }) {
  const { isConnected, address: userAddress } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const vaultAddr = (contracts as any).HybridVault as `0x${string}`;
  const isValid = vaultAddr && vaultAddr !== '0x0000000000000000000000000000000000000000';

  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: contracts.USDC,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress && isValid, refetchInterval: 10000 },
  });
  const usdcNum = Number(usdcBalance || 0n) / 1e6;

  const { info, refetch: refetchVault } = useHybridVaultInfo();
  const { shares } = useAsyncPosition();
  const { deposit, redeem, isPending, isConfirming, isSuccess, error, reset } = useHybridActions();
  const { writeContract: approveWrite, data: approveHash, isPending: isApproving, reset: resetApprove } = useWriteContract();
  const { writeContract: mintWrite, isPending: isMinting } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

  const syncPct = info ? info.syncRatio / (info.syncRatio + info.asyncRatio) * 100 : 40;
  const asyncPct = 100 - syncPct;

  useEffect(() => {
    if (isSuccess) {
      setStatus({ type: 'success', text: tab === 'deposit' ? 'Deposit successful!' : 'Withdraw submitted!' });
      setAmount('');
      refetchVault();
      refetchBalance();
      setTimeout(() => { setStatus(null); reset(); }, 3000);
    }
    if (error) setStatus({ type: 'error', text: error.message.slice(0, 80) });
  }, [isSuccess, error]);

  const handleDeposit = async () => {
    if (!amount || !userAddress) return;
    resetApprove();
    const assets = parseUnits(amount, 6);
    setStatus({ type: 'info', text: 'Approving USDC...' });
    approveWrite(
      { address: contracts.USDC, abi: USDC_ABI, functionName: 'approve', args: [vaultAddr, assets] },
      { 
        onSuccess: () => {
          setStatus({ type: 'info', text: 'Waiting for approval confirmation...' });
        },
        onError: (err) => {
          setStatus({ type: 'error', text: 'Approve failed: ' + err.message.slice(0, 50) });
        }
      }
    );
  };
  
  useEffect(() => {
    if (approveConfirmed && amount && userAddress && status?.text?.includes('approval')) {
      setStatus({ type: 'info', text: 'Depositing...' });
      const assets = parseUnits(amount, 6);
      deposit(assets, userAddress);
    }
  }, [approveConfirmed]);

  const handleWithdraw = async () => {
    if (!amount || !userAddress) return;
    const shareAmt = parseUnits(amount, info?.decimals ?? 6);
    redeem(shareAmt, userAddress, userAddress);
  };

  const handleMint = () => {
    if (!userAddress) return;
    setStatus({ type: 'info', text: 'Minting test USDC...' });
    mintWrite(
      { address: contracts.USDC, abi: USDC_ABI, functionName: 'mint', args: [userAddress, parseUnits('10000', 6)] },
      { onSuccess: () => { setStatus({ type: 'success', text: 'Minted 10,000 USDC!' }); setTimeout(() => setStatus(null), 3000); } }
    );
  };

  if (!mounted) return <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-500">Loading...</div>;
  if (!isConnected) return <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-500">Connect wallet to deposit or withdraw</div>;

  const busy = isPending || isConfirming || isApproving;
  const userShares = Number(shares) / 1e6;

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <div className="flex gap-2 mb-4">
        {(['deposit', 'withdraw'] as const).map(m => (
          <button key={m} onClick={() => { setTab(m); setStatus(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === m ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-600'}`}>
            {m === 'deposit' ? 'Deposit' : 'Withdraw'}
          </button>
        ))}
      </div>

      {/* Balance display */}
      <div className="mb-3 p-3 bg-gray-50 rounded-lg text-sm flex justify-between">
        <span className="text-gray-500">{tab === 'deposit' ? 'USDC Balance:' : 'Your Shares:'}</span>
        <span className="font-medium">
          {tab === 'deposit' 
            ? usdcNum.toLocaleString('en-US', { maximumFractionDigits: 2 })
            : userShares.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="relative mb-3">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder={tab === 'deposit' ? 'USDC amount' : 'Shares to redeem'}
          className="w-full p-3 pr-16 border border-gray-200 rounded-lg" disabled={busy} />
        <button type="button" onClick={() => setAmount(tab === 'deposit' ? usdcNum.toString() : userShares.toString())}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--primary)] font-medium">MAX</button>
      </div>

      {/* Sync/Async split preview */}
      {amount && parseFloat(amount) > 0 && (
        <div className={`p-3 rounded-lg mb-3 text-xs ${tab === 'deposit' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
          <p>⚡ {syncPct.toFixed(0)}% → {(parseFloat(amount) * syncPct / 100).toFixed(2)} {tab === 'deposit' ? 'USDC → instant shares' : 'shares → instant USDC'}</p>
          <p>⏳ {asyncPct.toFixed(0)}% → {(parseFloat(amount) * asyncPct / 100).toFixed(2)} {tab === 'deposit' ? 'USDC → pending (claim later)' : 'shares → pending (claim later)'}</p>
        </div>
      )}

      {status && (
        <div className={`mb-3 p-3 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700' : status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {status.text}
        </div>
      )}

      <button onClick={tab === 'deposit' ? handleDeposit : handleWithdraw}
        disabled={busy || !amount || parseFloat(amount) <= 0 || !isValid}
        className="w-full py-3 bg-[var(--primary)] text-white rounded-lg disabled:opacity-50">
        {busy ? 'Processing...' : tab === 'deposit' ? 'Deposit' : 'Withdraw'}
      </button>

      {isValid && (
        <button onClick={handleMint} disabled={isMinting}
          className="w-full mt-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          {isMinting ? 'Minting...' : '🪙 Mint 10,000 Test USDC'}
        </button>
      )}
    </div>
  );
}
