import Link from 'next/link';
import { Vault } from '@/types';

export function VaultCard({ vault }: { vault: Vault }) {
  return (
    <Link
      href={`/vault/${vault.id}`}
      className="flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-[var(--primary)] transition-colors"
    >
      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4">
        <span className="text-xs font-bold">{vault.name.slice(0, 4)}</span>
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-900">{vault.name}</p>
      </div>
      <div className="text-right mr-8">
        <p className="text-xs text-gray-500">APR</p>
        <p className="font-semibold text-[var(--primary)]">{vault.apr}%</p>
      </div>
      <div className="text-right mr-8">
        <p className="text-xs text-gray-500">TVL</p>
        <p className="font-semibold">${(vault.tvl / 1000000).toFixed(2)}M</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">Total Earnings</p>
        <p className="font-semibold">${(vault.totalEarnings / 1000).toFixed(0)}K</p>
      </div>
    </Link>
  );
}
