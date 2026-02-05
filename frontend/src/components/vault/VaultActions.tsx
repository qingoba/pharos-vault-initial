'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useVaultActions, useMintTestTokens, useUserPosition } from '@/hooks';
import { getContracts } from '@/lib/contracts';

export function VaultActions({ vaultId }: { vaultId: string }) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Contract hooks
  const {
    deposit,
    withdraw,
    approve,
    reset: resetVaultActions,
    isLoading: isVaultLoading,
    isSuccess: isVaultSuccess,
    isError: isVaultError,
    txState,
    assetBalanceFormatted,
    hasEnoughAllowance,
    hasEnoughBalance,
    decimals,
  } = useVaultActions(contracts.PharosVault);

  const { position, sharesFormatted, valueFormatted, refetch: refetchPosition } = useUserPosition(contracts.PharosVault);

  const { mint: mintTokens, isLoading: isMinting } = useMintTestTokens(contracts.USDC);

  // Update status message based on transaction state
  useEffect(() => {
    if (txState.status === 'approving') {
      setStatusMessage({ type: 'info', text: 'Approving token spend...' });
    } else if (txState.status === 'pending') {
      setStatusMessage({ type: 'info', text: 'Waiting for transaction...' });
    } else if (txState.status === 'confirming') {
      setStatusMessage({ type: 'info', text: 'Confirming transaction...' });
    } else if (txState.status === 'success') {
      setStatusMessage({ 
        type: 'success', 
        text: tab === 'deposit' ? 'Deposit successful!' : 'Withdrawal successful!' 
      });
      setAmount('');
      refetchPosition();
      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatusMessage(null);
        resetVaultActions();
      }, 3000);
    } else if (txState.status === 'error') {
      setStatusMessage({ 
        type: 'error', 
        text: txState.error?.message || 'Transaction failed' 
      });
    }
  }, [txState, tab, refetchPosition, resetVaultActions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    
    if (!amount || parseFloat(amount) <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid amount' });
      return;
    }

    try {
      if (tab === 'deposit') {
        if (!hasEnoughBalance(amount)) {
          setStatusMessage({ type: 'error', text: 'Insufficient balance' });
          return;
        }
        await deposit(amount);
      } else {
        await withdraw(amount);
      }
    } catch (error: unknown) {
      console.error('Transaction error:', error);
      setStatusMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Transaction failed' 
      });
    }
  };

  const handleMintTestTokens = async () => {
    try {
      setStatusMessage({ type: 'info', text: 'Minting test tokens...' });
      await mintTokens('10000'); // Mint 10,000 USDC
      setStatusMessage({ type: 'success', text: 'Minted 10,000 test USDC!' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error: unknown) {
      setStatusMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to mint test tokens' 
      });
    }
  };

  const handleMaxClick = () => {
    if (tab === 'deposit') {
      setAmount(assetBalanceFormatted);
    } else {
      setAmount(valueFormatted);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-500">
        Connect wallet to deposit or withdraw
      </div>
    );
  }

  const isValidContract = contracts.PharosVault !== '0x0000000000000000000000000000000000000000';

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      {/* Contract Status Warning */}
      {!isValidContract && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
          ⚠️ Contracts not deployed yet. Please deploy to Pharos Testnet first.
        </div>
      )}

      {/* Tab Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('deposit')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'deposit'
              ? 'bg-[var(--primary)] text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setTab('withdraw')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'withdraw'
              ? 'bg-[var(--primary)] text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Withdraw
        </button>
      </div>

      {/* Balance Info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
        {tab === 'deposit' ? (
          <div className="flex justify-between">
            <span className="text-gray-500">Available Balance:</span>
            <span className="font-medium">{parseFloat(assetBalanceFormatted).toLocaleString()} USDC</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">Your Shares:</span>
              <span className="font-medium">{parseFloat(sharesFormatted).toLocaleString()} pvUSDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Value:</span>
              <span className="font-medium">{parseFloat(valueFormatted).toLocaleString()} USDC</span>
            </div>
          </>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="relative mb-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={tab === 'deposit' ? 'Amount to deposit' : 'Amount to withdraw'}
            className="w-full p-3 pr-16 border border-gray-200 rounded-lg"
            disabled={isVaultLoading || !isValidContract}
            step="any"
            min="0"
          />
          <button
            type="button"
            onClick={handleMaxClick}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-[var(--primary)] font-medium hover:underline"
          >
            MAX
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            statusMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {statusMessage.text}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isVaultLoading || !isValidContract || !amount || parseFloat(amount) <= 0}
          className="w-full py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isVaultLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : (
            tab === 'deposit' ? 'Deposit' : 'Withdraw'
          )}
        </button>
      </form>

      {/* Mint Test Tokens Button (for testnet) */}
      {isValidContract && (
        <button
          type="button"
          onClick={handleMintTestTokens}
          disabled={isMinting}
          className="w-full mt-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {isMinting ? 'Minting...' : '🪙 Mint 10,000 Test USDC'}
        </button>
      )}

      {/* Transaction Hash */}
      {txState.hash && (
        <div className="mt-4 text-xs text-gray-500 text-center break-all">
          TX: <a 
            href={`https://testnet.pharosscan.xyz/tx/${txState.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--primary)] hover:underline"
          >
            {txState.hash.slice(0, 10)}...{txState.hash.slice(-8)}
          </a>
        </div>
      )}
    </div>
  );
}
