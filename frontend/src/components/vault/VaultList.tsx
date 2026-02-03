import { mockVaults } from '@/data/mock';
import { VaultCard } from './VaultCard';

export function VaultList() {
  return (
    <div className="space-y-4">
      {mockVaults.map((vault) => (
        <VaultCard key={vault.id} vault={vault} />
      ))}
    </div>
  );
}
