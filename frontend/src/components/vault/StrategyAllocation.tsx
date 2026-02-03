import { Strategy } from '@/types';

export function StrategyAllocation({ strategies }: { strategies: Strategy[] }) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <h3 className="font-semibold text-gray-900 mb-4">Strategy Allocation</h3>
      <div className="space-y-3">
        {strategies.map((s) => (
          <div key={s.id} className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{s.name}</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--primary)]"
                  style={{ width: `${s.allocation}%` }}
                />
              </div>
              <span className="text-sm font-medium w-12 text-right">{s.allocation}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
