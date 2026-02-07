'use client';

/**
 * useKeeperStatus Hook - Read keeper upkeep status from PharosVault
 */

import { useReadContract, useChainId } from 'wagmi';
import { PharosVaultABI, getContracts } from '@/lib/contracts';

export function useKeeperStatus() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const address = contracts.PharosVault;

  const isValid = address && address !== '0x0000000000000000000000000000000000000000';

  const { data: checkResult, isLoading: checkLoading } = useReadContract({
    address,
    abi: PharosVaultABI,
    functionName: 'checkUpkeep',
    args: ['0x'],
    query: {
      enabled: isValid,
      refetchInterval: 10000,
    },
  });

  const { data: gelatoResult, isLoading: gelatoLoading } = useReadContract({
    address,
    abi: PharosVaultABI,
    functionName: 'checker',
    query: {
      enabled: isValid,
      refetchInterval: 10000,
    },
  });

  const { data: nextIndex } = useReadContract({
    address,
    abi: PharosVaultABI,
    functionName: 'nextHarvestIndex',
    query: {
      enabled: isValid,
      refetchInterval: 15000,
    },
  });

  const upkeepNeeded = checkResult ? (checkResult as [boolean, string])[0] : false;
  const gelatoCanExec = gelatoResult ? (gelatoResult as [boolean, string])[0] : false;

  return {
    upkeepNeeded,
    gelatoCanExec,
    nextHarvestIndex: nextIndex ? Number(nextIndex) : 0,
    isLoading: checkLoading || gelatoLoading,
    isDeployed: isValid,
  };
}
