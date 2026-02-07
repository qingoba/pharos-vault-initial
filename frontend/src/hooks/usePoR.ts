'use client';

/**
 * usePoR Hook - Read Proof-of-Reserve status from PorRegistry
 */

import { useReadContract, useReadContracts, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { PorRegistryABI, getContracts } from '@/lib/contracts';

export interface ProofRecord {
  timestamp: number;
  totalReserves: bigint;
  totalLiabilities: bigint;
  merkleRoot: `0x${string}`;
  verified: boolean;
  attester: `0x${string}`;
}

export function usePoR() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const address = contracts.PorRegistry;

  const isValid = address && address !== '0x0000000000000000000000000000000000000000';

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      { address, abi: PorRegistryABI, functionName: 'isHealthy' },
      { address, abi: PorRegistryABI, functionName: 'proofCount' },
      { address, abi: PorRegistryABI, functionName: 'latestProof' },
    ],
    query: {
      enabled: isValid,
      refetchInterval: 30000,
    },
  });

  const isHealthy = data?.[0]?.status === 'success' ? (data[0].result as boolean) : false;
  const proofCount = data?.[1]?.status === 'success' ? Number(data[1].result) : 0;

  const latestRaw = data?.[2]?.status === 'success' ? data[2].result : null;
  const latestProof: ProofRecord | null = latestRaw
    ? {
        timestamp: Number((latestRaw as any).timestamp),
        totalReserves: (latestRaw as any).totalReserves as bigint,
        totalLiabilities: (latestRaw as any).totalLiabilities as bigint,
        merkleRoot: (latestRaw as any).merkleRoot as `0x${string}`,
        verified: (latestRaw as any).verified as boolean,
        attester: (latestRaw as any).attester as `0x${string}`,
      }
    : null;

  const reserveRatio =
    latestProof && latestProof.totalLiabilities > 0n
      ? Number((latestProof.totalReserves * 10000n) / latestProof.totalLiabilities) / 100
      : 0;

  return {
    isHealthy,
    proofCount,
    latestProof,
    reserveRatio,
    isLoading,
    error,
    refetch,
    isDeployed: isValid,
  };
}
