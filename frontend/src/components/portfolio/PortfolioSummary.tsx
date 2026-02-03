'use client';

import { useAccount } from 'wagmi';
import { mockUserPositions, mockVaults } from '@/data/mock';

export function PortfolioSummary() {
  const { isConnected } = useAccount();

  if (!isConnected) return null;

  const totalValue = mockUserPositions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalEarnings = mockUserPositions.reduce(
    (sum, p) => sum + p.earnedRealized + p.earnedPending,
    0
  );

  return (
    <div className="flex gap-6 mb-8">
      <div className="p-6 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-500">Total Value</p>
        <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
      </div>
      <div className="p-6 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-500">Total Earnings</p>
        <p className="text-2xl font-bold text-green-600">+${totalEarnings.toLocaleString()}</p>
      </div>
    </div>
  );
}
