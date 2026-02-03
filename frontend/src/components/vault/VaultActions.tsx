'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';

export function VaultActions({ vaultId }: { vaultId: string }) {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 实现合约交互
    console.log(`${tab} ${amount} to vault ${vaultId}`);
  };

  if (!isConnected) {
    return (
      <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-500">
        Connect wallet to deposit or withdraw
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
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
      <form onSubmit={handleSubmit}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={tab === 'deposit' ? 'Amount to deposit' : 'Shares to withdraw'}
          className="w-full p-3 border border-gray-200 rounded-lg mb-4"
        />
        <button
          type="submit"
          className="w-full py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
        >
          {tab === 'deposit' ? 'Deposit' : 'Withdraw'}
        </button>
      </form>
    </div>
  );
}
