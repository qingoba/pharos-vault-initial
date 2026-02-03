import { notFound } from 'next/navigation';
import { mockVaults } from '@/data/mock';
import { VaultInfo } from '@/components/vault/VaultInfo';
import { StrategyAllocation } from '@/components/vault/StrategyAllocation';
import { HarvestHistory } from '@/components/vault/HarvestHistory';
import { StrategyDetails } from '@/components/vault/StrategyDetails';
import { VaultActions } from '@/components/vault/VaultActions';

export default async function VaultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vault = mockVaults.find((v) => v.id === id);

  if (!vault) return notFound();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <VaultInfo vault={vault} />
        </div>
        <VaultActions vaultId={vault.id} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <StrategyAllocation strategies={vault.strategies} />
        <HarvestHistory records={vault.harvestHistory} />
      </div>

      <StrategyDetails strategies={vault.strategies} />

      <div className="p-6 bg-gray-50 rounded-xl">
        <h3 className="font-semibold text-gray-900 mb-2">About</h3>
        <p className="text-gray-600 mb-4">{vault.description}</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Contract: </span>
            <span className="font-mono">{vault.contractAddress}</span>
          </div>
          <div>
            <span className="text-gray-500">Token: </span>
            <span className="font-mono">{vault.tokenAddress}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
