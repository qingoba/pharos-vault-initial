import { Vault } from '@/types';

export function VaultInfo({ vault }: { vault: Vault }) {
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mr-4">
          <span className="text-sm font-bold">{vault.name.slice(0, 4)}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vault.name}</h1>
          <p className="text-sm text-gray-500 font-mono">
            {vault.contractAddress.slice(0, 10)}...{vault.contractAddress.slice(-8)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">TVL</p>
          <p className="text-xl font-bold">${(vault.tvl / 1000000).toFixed(2)}M</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">APR</p>
          <p className="text-xl font-bold text-[var(--primary)]">{vault.apr}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Management Fee</p>
          <p className="text-xl font-bold">{vault.managementFee}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Performance Fee</p>
          <p className="text-xl font-bold">{vault.performanceFee}%</p>
        </div>
      </div>
    </div>
  );
}
