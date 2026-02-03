import { mockProtocolStats } from '@/data/mock';
import { VaultList } from '@/components/vault/VaultList';

export default function VaultPage() {
  const stats = mockProtocolStats;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex gap-6 mb-8">
        <div className="p-6 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">Total Value Locked</p>
          <p className="text-2xl font-bold">${(stats.totalTvl / 1000000).toFixed(2)}M</p>
        </div>
        <div className="p-6 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">Average APR</p>
          <p className="text-2xl font-bold text-[var(--primary)]">{stats.averageApr}%</p>
        </div>
        <div className="p-6 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-500">Total Vaults</p>
          <p className="text-2xl font-bold">{stats.totalVaults}</p>
        </div>
      </div>
      <VaultList />
    </div>
  );
}
