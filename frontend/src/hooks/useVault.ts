'use client';

/**
 * useVault Hook - Read vault data from smart contract
 * Provides real-time vault information including TVL, APY, fees, and strategies
 */

import { useReadContract, useReadContracts, useAccount, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { PharosVaultABI, StrategyABI, getContracts } from '@/lib/contracts';

// Types for vault data
export interface VaultData {
  name: string;
  symbol: string;
  decimals: number;
  totalAssets: bigint;
  totalSupply: bigint;
  assetAddress: `0x${string}`;
  managementFee: number; // in basis points
  performanceFee: number; // in basis points
  depositLimit: bigint;
  emergencyShutdown: boolean;
  idleAssets: bigint;
  deployedAssets: bigint;
  estimatedAPY: number; // in basis points
  strategies: `0x${string}`[];
}

export interface StrategyData {
  address: `0x${string}`;
  name: string;
  totalAssets: bigint;
  isActive: boolean;
  estimatedAPY: number; // in basis points
  lastHarvest: number; // timestamp
  totalProfit: bigint;
  // From vault's strategyParams
  activation: number;
  debtRatio: number; // in basis points
  totalDebt: bigint;
  totalGain: bigint;
  totalLoss: bigint;
  lastReport: number;
}

export interface UserVaultPosition {
  shares: bigint;
  assetsValue: bigint;
  maxWithdraw: bigint;
  maxRedeem: bigint;
}

/**
 * Hook to read vault basic information
 */
export function useVaultInfo(vaultAddress?: `0x${string}`) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const address = vaultAddress || contracts.PharosVault;
  
  const isValidAddress = address && address !== '0x0000000000000000000000000000000000000000';
  
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      { address, abi: PharosVaultABI, functionName: 'name' },
      { address, abi: PharosVaultABI, functionName: 'symbol' },
      { address, abi: PharosVaultABI, functionName: 'decimals' },
      { address, abi: PharosVaultABI, functionName: 'totalAssets' },
      { address, abi: PharosVaultABI, functionName: 'totalSupply' },
      { address, abi: PharosVaultABI, functionName: 'asset' },
      { address, abi: PharosVaultABI, functionName: 'managementFee' },
      { address, abi: PharosVaultABI, functionName: 'performanceFee' },
      { address, abi: PharosVaultABI, functionName: 'depositLimit' },
      { address, abi: PharosVaultABI, functionName: 'emergencyShutdown' },
      { address, abi: PharosVaultABI, functionName: 'idleAssets' },
      { address, abi: PharosVaultABI, functionName: 'deployedAssets' },
      { address, abi: PharosVaultABI, functionName: 'estimatedAPY' },
      { address, abi: PharosVaultABI, functionName: 'getStrategies' },
    ],
    query: {
      enabled: isValidAddress,
      refetchInterval: 15000, // Refetch every 15 seconds
    },
  });

  const vaultData: VaultData | null = data && data[0].status === 'success' ? {
    name: data[0].result as string,
    symbol: data[1].result as string,
    decimals: data[2].result as number,
    totalAssets: data[3].result as bigint,
    totalSupply: data[4].result as bigint,
    assetAddress: data[5].result as `0x${string}`,
    managementFee: Number(data[6].result),
    performanceFee: Number(data[7].result),
    depositLimit: data[8].result as bigint,
    emergencyShutdown: data[9].result as boolean,
    idleAssets: data[10].result as bigint,
    deployedAssets: data[11].result as bigint,
    estimatedAPY: Number(data[12].result),
    strategies: (data[13].result as `0x${string}`[]) || [],
  } : null;

  return {
    vaultData,
    isLoading,
    error,
    refetch,
    // Computed values
    tvl: vaultData ? formatUnits(vaultData.totalAssets, vaultData.decimals) : '0',
    apr: vaultData ? (vaultData.estimatedAPY / 100).toFixed(2) : '0',
    managementFeePercent: vaultData ? (vaultData.managementFee / 100).toFixed(2) : '0',
    performanceFeePercent: vaultData ? (vaultData.performanceFee / 100).toFixed(2) : '0',
  };
}

/**
 * Hook to read user's position in the vault
 */
export function useUserPosition(vaultAddress?: `0x${string}`) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const address = vaultAddress || contracts.PharosVault;
  
  const isValidAddress = address && address !== '0x0000000000000000000000000000000000000000';
  
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      { address, abi: PharosVaultABI, functionName: 'balanceOf', args: [userAddress!] },
      { address, abi: PharosVaultABI, functionName: 'maxWithdraw', args: [userAddress!] },
      { address, abi: PharosVaultABI, functionName: 'maxRedeem', args: [userAddress!] },
      { address, abi: PharosVaultABI, functionName: 'decimals' },
    ],
    query: {
      enabled: isValidAddress && !!userAddress,
      refetchInterval: 15000,
    },
  });

  // Get the asset value for the user's shares
  const shares = data?.[0]?.status === 'success' ? (data[0].result as bigint) : 0n;
  
  const { data: assetsValue } = useReadContract({
    address,
    abi: PharosVaultABI,
    functionName: 'convertToAssets',
    args: [shares],
    query: {
      enabled: isValidAddress && shares > 0n,
    },
  });

  const decimals = data?.[3]?.status === 'success' ? (data[3].result as number) : 6;
  
  const position: UserVaultPosition | null = data && data[0].status === 'success' ? {
    shares: data[0].result as bigint,
    assetsValue: assetsValue as bigint || 0n,
    maxWithdraw: data[1].result as bigint,
    maxRedeem: data[2].result as bigint,
  } : null;

  return {
    position,
    isLoading,
    error,
    refetch,
    // Formatted values
    sharesFormatted: position ? formatUnits(position.shares, decimals) : '0',
    valueFormatted: position ? formatUnits(position.assetsValue, decimals) : '0',
    hasPosition: position && position.shares > 0n,
  };
}

/**
 * Hook to read strategy information
 */
export function useStrategyInfo(strategyAddress: `0x${string}`, vaultAddress?: `0x${string}`) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const vault = vaultAddress || contracts.PharosVault;
  
  const isValidStrategy = strategyAddress && strategyAddress !== '0x0000000000000000000000000000000000000000';
  const isValidVault = vault && vault !== '0x0000000000000000000000000000000000000000';
  
  // Read strategy contract data
  const { data: strategyData, isLoading: strategyLoading } = useReadContracts({
    contracts: [
      { address: strategyAddress, abi: StrategyABI, functionName: 'name' },
      { address: strategyAddress, abi: StrategyABI, functionName: 'totalAssets' },
      { address: strategyAddress, abi: StrategyABI, functionName: 'isActive' },
      { address: strategyAddress, abi: StrategyABI, functionName: 'estimatedAPY' },
      { address: strategyAddress, abi: StrategyABI, functionName: 'lastHarvest' },
      { address: strategyAddress, abi: StrategyABI, functionName: 'totalProfit' },
    ],
    query: {
      enabled: isValidStrategy,
      refetchInterval: 15000,
    },
  });

  // Read vault's strategy params
  const { data: vaultStrategyParams, isLoading: paramsLoading } = useReadContract({
    address: vault,
    abi: PharosVaultABI,
    functionName: 'getStrategyInfo',
    args: [strategyAddress],
    query: {
      enabled: isValidVault && isValidStrategy,
      refetchInterval: 15000,
    },
  });

  const strategy: StrategyData | null = strategyData && strategyData[0].status === 'success' ? {
    address: strategyAddress,
    name: strategyData[0].result as string,
    totalAssets: strategyData[1].result as bigint,
    isActive: strategyData[2].result as boolean,
    estimatedAPY: Number(strategyData[3].result),
    lastHarvest: Number(strategyData[4].result),
    totalProfit: strategyData[5].result as bigint,
    // From vault params - cast to any for flexible access
    activation: vaultStrategyParams ? Number((vaultStrategyParams as any).activation ?? 0) : 0,
    debtRatio: vaultStrategyParams ? Number((vaultStrategyParams as any).debtRatio ?? 0) : 0,
    totalDebt: vaultStrategyParams ? ((vaultStrategyParams as any).totalDebt ?? 0n) as bigint : 0n,
    totalGain: vaultStrategyParams ? ((vaultStrategyParams as any).totalGain ?? 0n) as bigint : 0n,
    totalLoss: vaultStrategyParams ? ((vaultStrategyParams as any).totalLoss ?? 0n) as bigint : 0n,
    lastReport: vaultStrategyParams ? Number((vaultStrategyParams as any).lastReport ?? 0) : 0,
  } : null;

  return {
    strategy,
    isLoading: strategyLoading || paramsLoading,
    // Computed values
    allocationPercent: strategy ? (strategy.debtRatio / 100).toFixed(2) : '0',
    apyPercent: strategy ? (strategy.estimatedAPY / 100).toFixed(2) : '0',
  };
}

/**
 * Hook to read all strategies for a vault
 */
export function useVaultStrategies(vaultAddress?: `0x${string}`) {
  const { vaultData, isLoading: vaultLoading } = useVaultInfo(vaultAddress);
  
  const strategyAddresses = vaultData?.strategies || [];
  
  // This would need to be implemented differently for multiple strategies
  // For now, return the addresses and let components fetch individually
  return {
    strategyAddresses,
    isLoading: vaultLoading,
    count: strategyAddresses.length,
  };
}

/**
 * Hook to calculate share price
 */
export function useSharePrice(vaultAddress?: `0x${string}`) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const address = vaultAddress || contracts.PharosVault;
  
  const isValidAddress = address && address !== '0x0000000000000000000000000000000000000000';
  
  const { data, isLoading } = useReadContracts({
    contracts: [
      { address, abi: PharosVaultABI, functionName: 'decimals' },
    ],
    query: {
      enabled: isValidAddress,
      refetchInterval: 30000,
    },
  });

  const decimals = data?.[0]?.status === 'success' ? Number(data[0].result) : 6;
  const oneShare = BigInt(10 ** decimals);

  const { data: ppsData, isLoading: ppsLoading } = useReadContracts({
    contracts: [
      { address, abi: PharosVaultABI, functionName: 'convertToAssets', args: [oneShare] },
    ],
    query: {
      enabled: isValidAddress && !!data,
      refetchInterval: 30000,
    },
  });

  const pricePerShare = ppsData?.[0]?.status === 'success' ? ppsData[0].result : oneShare;

  return {
    pricePerShare: pricePerShare as bigint,
    pricePerShareFormatted: formatUnits(pricePerShare as bigint, decimals),
    isLoading: isLoading || ppsLoading,
  };
}
