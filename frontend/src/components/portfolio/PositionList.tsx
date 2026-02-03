'use client';

import { useAccount } from 'wagmi';
import { mockUserPositions, mockVaults } from '@/data/mock';
import Link from 'next/link';

export function PositionList() {
  const { isConnected } = useAccount();

  if (!isConnected) return null;

  const totalValue = mockUserPositions.reduce((sum, p) => sum + p.currentValue, 0);

  return (
    <div className="space-y-4">
      {mockUserPositions.map((pos) => {
        const vault = mockVaults.find((v) => v.id === pos.vaultId);
        if (!vault) return null;

        const allocation = ((pos.currentValue / totalValue) * 100).toFixed(1);
        const totalReturn = (((pos.currentValue - pos.depositedValue) / pos.depositedValue) * 100).toFixed(2);

        return (
          <Link
            key={pos.vaultId}
            href={`/vault/${pos.vaultId}`}
            className="flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-[var(--primary)]"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4">
              <span className="text-xs font-bold">{vault.name.slice(0, 4)}</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold">{vault.name}</p>
              <p className="text-sm text-gray-500">{pos.shares} shares</p>
            </div>
            <div className="text-right mr-6">
              <p className="text-xs text-gray-500">Value</p>
              <p className="font-semibold">${pos.currentValue.toLocaleString()}</p>
            </div>
            <div className="text-right mr-6">
              <p className="text-xs text-gray-500">Allocation</p>
              <p className="font-semibold">{allocation}%</p>
            </div>
            <div className="text-right mr-6">
              <p className="text-xs text-gray-500">Earned</p>
              <p className="font-semibold text-green-600">+${pos.earnedRealized}</p>
            </div>
            <div className="text-right mr-6">
              <p className="text-xs text-gray-500">Pending</p>
              <p className="font-semibold text-yellow-600">${pos.earnedPending}</p>
            </div>
            <div className="text-right mr-6">
              <p className="text-xs text-gray-500">Return</p>
              <p className="font-semibold text-[var(--primary)]">+{totalReturn}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Auto-compound</p>
              <p className="font-semibold">{pos.autoCompound ? '✓' : '-'}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
