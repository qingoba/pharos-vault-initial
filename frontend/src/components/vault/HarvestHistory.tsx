import { HarvestRecord } from '@/types';

export function HarvestHistory({ records }: { records: HarvestRecord[] }) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <h3 className="font-semibold text-gray-900 mb-4">Harvest History</h3>
      <div className="space-y-2">
        {records.map((r) => (
          <div key={r.txHash} className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {new Date(r.timestamp).toLocaleDateString()}
            </span>
            <span className="font-medium text-green-600">+${r.amount.toLocaleString()}</span>
            <a
              href={`https://explorer.pharos.xyz/tx/${r.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              {r.txHash.slice(0, 8)}...
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
