import Link from 'next/link';
import { mockProtocolStats } from '@/data/mock';

export function StatsOverview() {
  const stats = mockProtocolStats;

  return (
    <section className="flex items-center justify-center gap-12 py-8">
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-1">Total Value Locked</p>
        <p className="text-3xl font-bold text-gray-900">
          ${(stats.totalTvl / 1000000).toFixed(2)}M
        </p>
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-1">Average APR</p>
        <p className="text-3xl font-bold text-[var(--primary)]">
          {stats.averageApr.toFixed(2)}%
        </p>
      </div>
      <Link
        href="/vault"
        className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
      >
        Explore Vaults
      </Link>
    </section>
  );
}
