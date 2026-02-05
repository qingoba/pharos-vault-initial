'use client';

/**
 * useVaultActions Hook - Write operations for vault interactions
 * Provides functions for deposit, withdraw, redeem, and approval
 */

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, useChainId } from 'wagmi';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { useState, useCallback, useEffect } from 'react';
import { PharosVaultABI, ERC20ABI, getContracts } from '@/lib/contracts';

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
  const vault = vaultAddress || contracts.PharosVault;
  
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });
  
  // Get asset address
  const { data: assetAddress } = useReadContract({
    address: vault,
    abi: PharosVaultABI,
    functionName: 'asset',
  });
  
  // Get decimals
  const { data: decimals } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20ABI,
    functionName: 'decimals',
    query: {
      enabled: !!assetAddress,
    },
  });
  
  // Check current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: [userAddress!, vault],
    query: {
      enabled: !!assetAddress && !!userAddress,
    },
  });
  
  // Check user's asset balance
  const { data: assetBalance, refetch: refetchBalance } = useReadContract({
    address: assetAddress as `0x${string}`,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: {
      enabled: !!assetAddress && !!userAddress,
    },
  });
  
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
    if (!assetAddress || !userAddress) {
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
      });
      
      setTxState({ status: 'confirming', hash });
      return hash;
    } catch (error) {
      setTxState({ status: 'error', error: error as Error });
      throw error;
    }
  }, [assetAddress, userAddress, vault, decimals, writeApprove]);
  
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
      // Wait for approval to be confirmed
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetchAllowance();
    }
    
    setTxState({ status: 'pending' });
    
    try {
      const hash = await writeDeposit({
        address: vault,
        abi: PharosVaultABI,
        functionName: 'deposit',
        args: [amountParsed, userAddress],
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
  };
}

/**
 * Hook for vault admin actions (harvest)
 */
export function useVaultAdmin(vaultAddress?: `0x${string}`) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const vault = vaultAddress || contracts.PharosVault;
  
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });
  
  const { writeContractAsync: writeHarvest, data: harvestHash } = useWriteContract();
  const { writeContractAsync: writeHarvestAll, data: harvestAllHash } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: harvestHash || harvestAllHash,
  });
  
  useEffect(() => {
    if (isSuccess) {
      setTxState({ status: 'success', hash: harvestHash || harvestAllHash });
    }
  }, [isSuccess, harvestHash, harvestAllHash]);
  
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
  
  return {
    harvestStrategy,
    harvestAll,
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
