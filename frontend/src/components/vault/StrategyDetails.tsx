import { Strategy } from '@/types';

export function StrategyDetails({ strategies }: { strategies: Strategy[] }) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <h3 className="font-semibold text-gray-900 mb-4">Strategy Details</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pb-2">Strategy</th>
            <th className="pb-2">Allocation</th>
            <th className="pb-2">APR</th>
            <th className="pb-2">Last Harvest</th>
            <th className="pb-2">Max Drawdown</th>
            <th className="pb-2">PoR</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((s) => (
            <tr key={s.id} className="border-t border-gray-200">
              <td className="py-2 font-medium">{s.name}</td>
              <td className="py-2">{s.allocation}%</td>
              <td className="py-2 text-[var(--primary)]">{s.apr}%</td>
              <td className="py-2">${s.lastHarvest.toLocaleString('en-US')}</td>
              <td className="py-2 text-red-500">{s.maxDrawdown}%</td>
              <td className="py-2">
                {s.proofOfReserve ? (
                  <a href={s.proofOfReserve} target="_blank" className="text-[var(--primary)] hover:underline">
                    View
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
