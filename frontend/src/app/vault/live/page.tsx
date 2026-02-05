'use client';

/**
 * Live Vault Page
 * Displays real-time vault data directly from the blockchain
 * This page uses the new live components connected to smart contracts
 */

import { VaultInfoLive } from '@/components/vault/VaultInfoLive';
import { StrategyListLive } from '@/components/vault/StrategyListLive';
import { UserPositionLive } from '@/components/vault/UserPositionLive';
import { VaultActions } from '@/components/vault/VaultActions';
import { useChainId } from 'wagmi';
import { getContracts } from '@/lib/contracts';

export default function LiveVaultPage() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  
  const isValidContract = contracts.PharosVault !== '0x0000000000000000000000000000000000000000';

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Network Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-blue-700">
            Connected to {chainId === 688688 ? 'Pharos Testnet' : chainId === 1672 ? 'Pharos Mainnet' : `Chain ${chainId}`}
          </span>
        </div>
        {isValidContract && (
          <a
            href={`https://testnet.pharosscan.xyz/address/${contracts.PharosVault}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--primary)] hover:underline"
          >
            View Contract on Explorer →
          </a>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <VaultInfoLive />
        </div>
        <VaultActions vaultId="live" />
      </div>

      {/* User Position */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <StrategyListLive />
        </div>
        <UserPositionLive />
      </div>

      {/* Contract Info */}
      {isValidContract && (
        <div className="p-6 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-4">Contract Addresses</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between p-3 bg-white rounded-lg">
              <span className="text-gray-500">PharosVault:</span>
              <span className="font-mono text-xs">
                <a
                  href={`https://testnet.pharosscan.xyz/address/${contracts.PharosVault}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] hover:underline"
                >
                  {contracts.PharosVault.slice(0, 10)}...{contracts.PharosVault.slice(-8)}
                </a>
              </span>
            </div>
            <div className="flex justify-between p-3 bg-white rounded-lg">
              <span className="text-gray-500">USDC:</span>
              <span className="font-mono text-xs">
                <a
                  href={`https://testnet.pharosscan.xyz/address/${contracts.USDC}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] hover:underline"
                >
                  {contracts.USDC.slice(0, 10)}...{contracts.USDC.slice(-8)}
                </a>
              </span>
            </div>
            <div className="flex justify-between p-3 bg-white rounded-lg">
              <span className="text-gray-500">RWA Strategy:</span>
              <span className="font-mono text-xs">
                <a
                  href={`https://testnet.pharosscan.xyz/address/${contracts.RWAYieldStrategy}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] hover:underline"
                >
                  {contracts.RWAYieldStrategy.slice(0, 10)}...{contracts.RWAYieldStrategy.slice(-8)}
                </a>
              </span>
            </div>
            <div className="flex justify-between p-3 bg-white rounded-lg">
              <span className="text-gray-500">Lending Strategy:</span>
              <span className="font-mono text-xs">
                <a
                  href={`https://testnet.pharosscan.xyz/address/${contracts.SimpleLendingStrategy}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary)] hover:underline"
                >
                  {contracts.SimpleLendingStrategy.slice(0, 10)}...{contracts.SimpleLendingStrategy.slice(-8)}
                </a>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* About Section */}
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="font-semibold text-gray-900 mb-2">About Pharos Vault</h3>
        <p className="text-gray-600 mb-4">
          Pharos Vault is an ERC4626-compliant yield aggregator that captures diversified RWA yields. 
          The vault supports multiple strategies including US Treasury bonds simulation and lending protocols, 
          providing users with transparent, composable yield generation.
        </p>
        <div className="flex gap-4 text-sm">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">ERC4626 Standard</span>
          <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">Multi-Strategy</span>
          <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full">RWA Yields</span>
          <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full">Auto-Compound</span>
        </div>
      </div>
    </div>
  );
}
