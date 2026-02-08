'use client';

import { useAccount, useChainId, useReadContracts, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getContracts } from '@/lib/contracts';
import { HybridVaultABI, AsyncRWAStrategyABI } from '@/lib/contracts/hybrid-abis';
import { StrategyABI } from '@/lib/contracts/abis';
import { formatUnits } from 'viem';

const ZERO = '0x0000000000000000000000000000000000000000' as `0x${string}`;

function useHybridAddress() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const addr = (contracts as any).HybridVault as `0x${string}` | undefined;
  return addr && addr !== ZERO ? addr : undefined;
}

// ======================== Vault Info ========================

export function useHybridVaultInfo() {
  const address = useHybridAddress();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: address!, abi: HybridVaultABI, functionName: 'name' },
      { address: address!, abi: HybridVaultABI, functionName: 'symbol' },
      { address: address!, abi: HybridVaultABI, functionName: 'decimals' },
      { address: address!, abi: HybridVaultABI, functionName: 'totalAssets' },
      { address: address!, abi: HybridVaultABI, functionName: 'totalSupply' },
      { address: address!, abi: HybridVaultABI, functionName: 'syncTotalRatio' },
      { address: address!, abi: HybridVaultABI, functionName: 'asyncTotalRatio' },
      { address: address!, abi: HybridVaultABI, functionName: 'totalSyncDebt' },
      { address: address!, abi: HybridVaultABI, functionName: 'getSyncStrategies' },
      { address: address!, abi: HybridVaultABI, functionName: 'getAsyncStrategies' },
      { address: address!, abi: HybridVaultABI, functionName: 'managementFee' },
      { address: address!, abi: HybridVaultABI, functionName: 'performanceFee' },
    ],
    query: { enabled: !!address, refetchInterval: 15000 },
  });

  const r = (i: number) => data?.[i]?.status === 'success' ? data[i].result : undefined;

  const info = data && data[0]?.status === 'success' ? {
    name: r(0) as string,
    symbol: r(1) as string,
    decimals: Number(r(2) ?? 6),
    totalAssets: r(3) as bigint,
    totalSupply: r(4) as bigint,
    syncRatio: Number(r(5) ?? 0),
    asyncRatio: Number(r(6) ?? 0),
    totalSyncDebt: r(7) as bigint,
    syncStrategies: (r(8) as `0x${string}`[]) ?? [],
    asyncStrategies: (r(9) as `0x${string}`[]) ?? [],
    managementFee: Number(r(10) ?? 0),
    performanceFee: Number(r(11) ?? 0),
  } : null;

  const decimals = info?.decimals ?? 6;

  return {
    info,
    isLoading,
    refetch,
    address,
    tvl: info ? formatUnits(info.totalAssets, decimals) : '0',
    syncPercent: info ? (info.syncRatio / 100).toFixed(0) : '0',
    asyncPercent: info ? (info.asyncRatio / 100).toFixed(0) : '0',
  };
}

// ======================== Async Position ========================

export function useAsyncPosition() {
  const { address: user } = useAccount();
  const vaultAddr = useHybridAddress();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: vaultAddr!, abi: HybridVaultABI, functionName: 'pendingDepositOf', args: [user!] },
      { address: vaultAddr!, abi: HybridVaultABI, functionName: 'claimableSharesOf', args: [user!] },
      { address: vaultAddr!, abi: HybridVaultABI, functionName: 'pendingRedeemOf', args: [user!] },
      { address: vaultAddr!, abi: HybridVaultABI, functionName: 'claimableAssetsOf', args: [user!] },
      { address: vaultAddr!, abi: HybridVaultABI, functionName: 'balanceOf', args: [user!] },
    ],
    query: { enabled: !!vaultAddr && !!user, refetchInterval: 10000 },
  });

  const r = (i: number) => data?.[i]?.status === 'success' ? (data[i].result as bigint) : 0n;

  return {
    pendingDeposit: r(0),
    claimableShares: r(1),
    pendingRedeem: r(2),
    claimableAssets: r(3),
    shares: r(4),
    isLoading,
    refetch,
    hasPending: r(0) > 0n || r(2) > 0n,
    hasClaimable: r(1) > 0n || r(3) > 0n,
  };
}

// ======================== Write Actions ========================

export function useHybridActions() {
  const vaultAddr = useHybridAddress();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const deposit = (assets: bigint, receiver: `0x${string}`) =>
    writeContract({ address: vaultAddr!, abi: HybridVaultABI, functionName: 'deposit', args: [assets, receiver] });

  const redeem = (shares: bigint, receiver: `0x${string}`, owner: `0x${string}`) =>
    writeContract({ address: vaultAddr!, abi: HybridVaultABI, functionName: 'redeem', args: [shares, receiver, owner] });

  const claimShares = (receiver: `0x${string}`) =>
    writeContract({ address: vaultAddr!, abi: HybridVaultABI, functionName: 'claimAsyncShares', args: [receiver] });

  const claimAssets = (receiver: `0x${string}`) =>
    writeContract({ address: vaultAddr!, abi: HybridVaultABI, functionName: 'claimAsyncAssets', args: [receiver] });

  return { deposit, redeem, claimShares, claimAssets, hash, isPending, isConfirming, isSuccess, error, reset };
}

// ======================== Operator Actions ========================

export function useOperatorActions(strategyAddress?: `0x${string}`) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdrawToOperator = (amount: bigint) =>
    writeContract({ address: strategyAddress!, abi: AsyncRWAStrategyABI, functionName: 'withdrawToOperator', args: [amount] });

  const reportNAV = (nav: bigint) =>
    writeContract({ address: strategyAddress!, abi: AsyncRWAStrategyABI, functionName: 'reportNAV', args: [nav] });

  const fulfillDeposit = (depositor: `0x${string}`, shares: bigint) =>
    writeContract({ address: strategyAddress!, abi: AsyncRWAStrategyABI, functionName: 'fulfillDeposit', args: [depositor, shares] });

  const fulfillRedeem = (redeemer: `0x${string}`, assets: bigint) =>
    writeContract({ address: strategyAddress!, abi: AsyncRWAStrategyABI, functionName: 'fulfillRedeem', args: [redeemer, assets] });

  const injectYield = (amount: bigint) =>
    writeContract({ address: strategyAddress!, abi: AsyncRWAStrategyABI, functionName: 'injectYield', args: [amount] });

  const returnAssets = (amount: bigint) =>
    writeContract({ address: strategyAddress!, abi: AsyncRWAStrategyABI, functionName: 'returnAssets', args: [amount] });

  return { withdrawToOperator, reportNAV, fulfillDeposit, fulfillRedeem, injectYield, returnAssets, hash, isPending, isConfirming, isSuccess, error };
}
