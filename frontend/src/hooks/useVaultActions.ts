'use client';

/**
 * useVaultActions Hook - Write operations for vault interactions
 * Provides functions for deposit, withdraw, redeem, and approval
 */

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, useChainId, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { useState, useCallback, useEffect } from 'react';
import { PharosVaultABI, ERC20ABI, StrategyABI, getContracts } from '@/lib/contracts';

// Gas limits for different operations
const GAS_LIMITS = {
  approve: 100000n,
  deposit: 300000n,
  withdraw: 300000n,
  redeem: 300000n,
};

export type TransactionStatus = 'idle' | 'approving' | 'pending' | 'confirming' | 'success' | 'error';

export interface TransactionState {
  status: TransactionStatus;
  hash?: `0x${string}`;
  error?: Error;
}

/**
 * Hook for vault deposit/withdraw operations
 */
export function useVaultActions(vaultAddress?: `0x${string}`) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const publicClient = usePublicClient();
  const vault = vaultAddress || contracts.PharosVault;
  
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });
  
  // Get asset address
  const { data: assetAddress, refetch: refetchAssetAddress, error: assetError, isLoading: assetLoading } = useReadContract({
    address: vault,
    abi: PharosVaultABI,
    functionName: 'asset',
    query: {
      staleTime: 0,
    },
  });
  
  // Debug: Log asset address fetch
  useEffect(() => {
    console.log('[useVaultActions] Debug Info:', {
      chainId,
      vault,
      userAddress,
      assetAddress,
      assetError: assetError?.message,
      assetLoading,
    });
  }, [chainId, vault, userAddress, assetAddress, assetError, assetLoading]);
  
  // Get decimals
  const { data: decimals, error: decimalsError } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20ABI,
    functionName: 'decimals',
    query: {
      enabled: !!assetAddress,
    },
  });
  
  // Debug: Log decimals
  useEffect(() => {
    if (assetAddress) {
      console.log('[useVaultActions] Decimals:', {
        assetAddress,
        decimals,
        decimalsError: decimalsError?.message,
      });
    }
  }, [assetAddress, decimals, decimalsError]);
  
  // Check current allowance
  const { data: allowance, refetch: refetchAllowance, error: allowanceError } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: [userAddress!, vault],
    query: {
      enabled: !!assetAddress && !!userAddress,
    },
  });
  
  // Check user's asset balance
  const { data: assetBalance, refetch: refetchBalance, error: balanceError, isLoading: balanceLoading } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: {
      enabled: !!assetAddress && !!userAddress,
      staleTime: 0, // Always consider data stale
      gcTime: 0, // Don't cache
      refetchInterval: 5000, // Poll every 5 seconds
    },
  });
  
  // Debug: Log balance fetch result
  useEffect(() => {
    if (assetAddress && userAddress) {
      console.log('[useVaultActions] Balance Query:', {
        assetAddress,
        userAddress,
        assetBalance: assetBalance?.toString(),
        balanceError: balanceError?.message,
        balanceLoading,
        allowance: allowance?.toString(),
        allowanceError: allowanceError?.message,
      });
    }
  }, [assetAddress, userAddress, assetBalance, balanceError, balanceLoading, allowance, allowanceError]);
  
  // Write contract hooks
  const { writeContractAsync: writeApprove, data: approveHash } = useWriteContract();
  const { writeContractAsync: writeDeposit, data: depositHash } = useWriteContract();
  const { writeContractAsync: writeWithdraw, data: withdrawHash } = useWriteContract();
  const { writeContractAsync: writeRedeem, data: redeemHash } = useWriteContract();
  
  // Wait for transaction receipts
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });
  
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  });
  
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });
  
  const { isLoading: isRedeemConfirming, isSuccess: isRedeemSuccess } = useWaitForTransactionReceipt({
    hash: redeemHash,
  });
  
  // Update state when confirmations complete
  useEffect(() => {
    if (isDepositSuccess || isWithdrawSuccess || isRedeemSuccess) {
      setTxState({ status: 'success', hash: depositHash || withdrawHash || redeemHash });
      refetchBalance();
      refetchAllowance();
    }
  }, [isDepositSuccess, isWithdrawSuccess, isRedeemSuccess, depositHash, withdrawHash, redeemHash, refetchBalance, refetchAllowance]);
  
  /**
   * Approve the vault to spend tokens
   */
  const approve = useCallback(async (amount?: string) => {
    if (!assetAddress || !userAddress || !publicClient) {
      throw new Error('Not connected or asset not loaded');
    }
    
    setTxState({ status: 'approving' });
    
    try {
      const amountToApprove = amount 
        ? parseUnits(amount, decimals || 6) 
        : maxUint256;
      
      const hash = await writeApprove({
        address: assetAddress as `0x${string}`,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [vault, amountToApprove],
        gas: GAS_LIMITS.approve,
      });
      
      // Wait for transaction to be confirmed on chain
      await publicClient.waitForTransactionReceipt({ hash });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [assetAddress, userAddress, vault, decimals, writeApprove, publicClient]);
  
  /**
   * Deposit assets into the vault
   */
  const deposit = useCallback(async (amount: string) => {
    if (!userAddress) {
      throw new Error('Not connected');
    }
    
    const amountParsed = parseUnits(amount, decimals || 6);
    
    // Check if approval is needed
    if (allowance !== undefined && allowance < amountParsed) {
      setTxState({ status: 'approving' });
      await approve();
      // Approval confirmation is now handled inside approve() with waitForTransactionReceipt
      await refetchAllowance();
    }
    
    setTxState({ status: 'pending' });
    
    try {
      const hash = await writeDeposit({
        address: vault,
        abi: PharosVaultABI,
        functionName: 'deposit',
        args: [amountParsed, userAddress],
        gas: GAS_LIMITS.deposit,
      });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [userAddress, vault, decimals, allowance, approve, refetchAllowance, writeDeposit]);
  
  /**
   * Withdraw assets from the vault (specify assets amount)
   */
  const withdraw = useCallback(async (amount: string) => {
    if (!userAddress) {
      throw new Error('Not connected');
    }
    
    setTxState({ status: 'pending' });
    
    try {
      const amountParsed = parseUnits(amount, decimals || 6);
      
      const hash = await writeWithdraw({
        address: vault,
        abi: PharosVaultABI,
        functionName: 'withdraw',
        args: [amountParsed, userAddress, userAddress],
        gas: GAS_LIMITS.withdraw,
      });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [userAddress, vault, decimals, writeWithdraw]);
  
  /**
   * Redeem shares from the vault (specify shares amount)
   */
  const redeem = useCallback(async (shares: string) => {
    if (!userAddress) {
      throw new Error('Not connected');
    }
    
    setTxState({ status: 'pending' });
    
    try {
      const sharesParsed = parseUnits(shares, decimals || 6);
      
      const hash = await writeRedeem({
        address: vault,
        abi: PharosVaultABI,
        functionName: 'redeem',
        args: [sharesParsed, userAddress, userAddress],
        gas: GAS_LIMITS.redeem,
      });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [userAddress, vault, decimals, writeRedeem]);
  
  /**
   * Reset transaction state
   */
  const reset = useCallback(() => {
    setTxState({ status: 'idle' });
  }, []);
  
  return {
    // Actions
    approve,
    deposit,
    withdraw,
    redeem,
    reset,
    
    // State
    txState,
    isLoading: txState.status === 'approving' || 
               txState.status === 'pending' || 
               txState.status === 'confirming' ||
               isApproveConfirming ||
               isDepositConfirming ||
               isWithdrawConfirming ||
               isRedeemConfirming,
    isSuccess: txState.status === 'success',
    isError: txState.status === 'error',
    
    // Token info
    assetAddress: assetAddress as `0x${string}`,
    decimals: decimals || 6,
    allowance: allowance || 0n,
    assetBalance: assetBalance || 0n,
    assetBalanceFormatted: assetBalance 
      ? formatUnits(assetBalance, decimals || 6) 
      : '0',
    
    // Helper functions
    hasEnoughAllowance: (amount: string) => {
      try {
        const amountParsed = parseUnits(amount, decimals || 6);
        return (allowance || 0n) >= amountParsed;
      } catch {
        return false;
      }
    },
    hasEnoughBalance: (amount: string) => {
      try {
        const amountParsed = parseUnits(amount, decimals || 6);
        return (assetBalance || 0n) >= amountParsed;
      } catch {
        return false;
      }
    },
    
    // Refetch functions
    refetchBalance,
    refetchAllowance,
  };
}

/**
 * Hook for vault admin actions (harvest, allocate)
 */
export function useVaultAdmin(vaultAddress?: `0x${string}`) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const vault = vaultAddress || contracts.PharosVault;
  
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });
  
  const { writeContractAsync: writeHarvest, data: harvestHash } = useWriteContract();
  const { writeContractAsync: writeHarvestAll, data: harvestAllHash } = useWriteContract();
  const { writeContractAsync: writeAllocate, data: allocateHash } = useWriteContract();
  const { writeContractAsync: writeInjectYield, data: injectHash } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: harvestHash || harvestAllHash || allocateHash || injectHash,
  });
  
  useEffect(() => {
    if (isSuccess) {
      setTxState({ status: 'success', hash: harvestHash || harvestAllHash || allocateHash || injectHash });
    }
  }, [isSuccess, harvestHash, harvestAllHash, allocateHash, injectHash]);
  
  /**
   * Harvest a specific strategy
   */
  const harvestStrategy = useCallback(async (strategyAddress: `0x${string}`) => {
    setTxState({ status: 'pending' });
    
    try {
      const hash = await writeHarvest({
        address: vault,
        abi: PharosVaultABI,
        functionName: 'harvestStrategy',
        args: [strategyAddress],
      });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [vault, writeHarvest]);
  
  /**
   * Harvest all strategies
   */
  const harvestAll = useCallback(async () => {
    setTxState({ status: 'pending' });
    
    try {
      const hash = await writeHarvestAll({
        address: vault,
        abi: PharosVaultABI,
        functionName: 'harvestAll',
        args: [],
      });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [vault, writeHarvestAll]);
  
  const reset = useCallback(() => {
    setTxState({ status: 'idle' });
  }, []);
  
  /**
   * Allocate funds to a specific strategy
   */
  const allocateToStrategy = useCallback(async (strategyAddress: `0x${string}`, amount: bigint) => {
    setTxState({ status: 'pending' });
    
    try {
      const hash = await writeAllocate({
        address: vault,
        abi: PharosVaultABI,
        functionName: 'allocateToStrategy',
        args: [strategyAddress, amount],
      });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [vault, writeAllocate]);
  
  /**
   * Inject yield into a strategy (simulate off-chain yield)
   */
  const injectYield = useCallback(async (strategyAddress: `0x${string}`, amount: bigint) => {
    setTxState({ status: 'pending' });
    
    try {
      const hash = await writeInjectYield({
        address: strategyAddress,
        abi: StrategyABI,
        functionName: 'injectYield',
        args: [amount],
      });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [writeInjectYield]);
  
  return {
    harvestStrategy,
    harvestAll,
    allocateToStrategy,
    injectYield,
    reset,
    txState,
    isLoading: txState.status === 'pending' || txState.status === 'confirming' || isConfirming,
    isSuccess: txState.status === 'success',
    isError: txState.status === 'error',
  };
}

/**
 * Hook for minting test tokens (only for testnet)
 */
export function useMintTestTokens(tokenAddress?: `0x${string}`) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const token = tokenAddress || contracts.USDC;
  
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });
  
  const { writeContractAsync: writeMint, data: mintHash } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: mintHash,
  });
  
  useEffect(() => {
    if (isSuccess) {
      setTxState({ status: 'success', hash: mintHash });
    }
  }, [isSuccess, mintHash]);
  
  /**
   * Mint test tokens
   */
  const mint = useCallback(async (amount: string) => {
    if (!userAddress) {
      throw new Error('Not connected');
    }
    
    setTxState({ status: 'pending' });
    
    try {
      const amountParsed = parseUnits(amount, 6); // USDC has 6 decimals
      
      const hash = await writeMint({
        address: token,
        abi: ERC20ABI,
        functionName: 'mint',
        args: [userAddress, amountParsed],
      });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [userAddress, token, writeMint]);
  
  const reset = useCallback(() => {
    setTxState({ status: 'idle' });
  }, []);
  
  return {
    mint,
    reset,
    txState,
    isLoading: txState.status === 'pending' || txState.status === 'confirming' || isConfirming,
    isSuccess: txState.status === 'success',
    isError: txState.status === 'error',
  };
}
