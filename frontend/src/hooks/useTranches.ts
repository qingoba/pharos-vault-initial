'use client';

/**
 * useTranches Hook - Read tranche system state from TrancheManager
 */

import { useReadContracts, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { TrancheManagerABI, getContracts } from '@/lib/contracts';

export interface TrancheData {
  seniorAddress: `0x${string}`;
  juniorAddress: `0x${string}`;
  seniorDeposits: bigint;
  juniorDeposits: bigint;
  seniorTotalAssets: bigint;
  juniorTotalAssets: bigint;
  totalManagedAssets: bigint;
  seniorTargetAPR: number;
  lastWaterfallTime: number;
}

export function useTranches() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const address = contracts.TrancheManager;

  const isValid = address && address !== '0x0000000000000000000000000000000000000000';

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      { address, abi: TrancheManagerABI, functionName: 'seniorTranche' },
      { address, abi: TrancheManagerABI, functionName: 'juniorTranche' },
      { address, abi: TrancheManagerABI, functionName: 'seniorDeposits' },
      { address, abi: TrancheManagerABI, functionName: 'juniorDeposits' },
      { address, abi: TrancheManagerABI, functionName: 'seniorTotalAssets' },
      { address, abi: TrancheManagerABI, functionName: 'juniorTotalAssets' },
      { address, abi: TrancheManagerABI, functionName: 'totalManagedAssets' },
      { address, abi: TrancheManagerABI, functionName: 'seniorTargetAPR' },
      { address, abi: TrancheManagerABI, functionName: 'lastWaterfallTime' },
    ],
    query: {
      enabled: isValid,
      refetchInterval: 15000,
    },
  });

  const trancheData: TrancheData | null =
    data && data[0].status === 'success'
      ? {
          seniorAddress: data[0].result as `0x${string}`,
          juniorAddress: data[1].result as `0x${string}`,
          seniorDeposits: data[2].result as bigint,
          juniorDeposits: data[3].result as bigint,
          seniorTotalAssets: data[4].result as bigint,
          juniorTotalAssets: data[5].result as bigint,
          totalManagedAssets: data[6].result as bigint,
          seniorTargetAPR: Number(data[7].result),
          lastWaterfallTime: Number(data[8].result),
        }
      : null;

  const seniorYield =
    trancheData && trancheData.seniorDeposits > 0n
      ? Number(trancheData.seniorTotalAssets - trancheData.seniorDeposits)
      : 0;

  const juniorYield =
    trancheData && trancheData.juniorDeposits > 0n
      ? Number(trancheData.juniorTotalAssets - trancheData.juniorDeposits)
      : 0;

  return {
    trancheData,
    seniorYield,
    juniorYield,
    isLoading,
    error,
    refetch,
    isDeployed: isValid,
    seniorAPR: trancheData ? (trancheData.seniorTargetAPR / 100).toFixed(2) : '0',
  };
}
