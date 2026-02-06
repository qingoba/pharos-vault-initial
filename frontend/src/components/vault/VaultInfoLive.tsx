'use client';

/**
 * VaultInfoLive Component
 * Displays real-time vault information from the blockchain
 */

import { useChainId } from 'wagmi';
import { useVaultInfo } from '@/hooks';
import { getContracts } from '@/lib/contracts';

export function VaultInfoLive() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  
  const { vaultData, isLoading, tvl, apr, managementFeePercent, performanceFeePercent } = useVaultInfo(contracts.PharosVault);

  const isValidContract = contracts.PharosVault !== '0x0000000000000000000000000000000000000000';

  if (!isValidContract) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mr-4">
            <span className="text-sm font-bold">????</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pharos Vault</h1>
            <p className="text-sm text-yellow-600">
              ⚠️ Contracts not deployed - Deploy to Pharos Testnet first
            </p>
          </div>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          Please deploy the contracts to Pharos Testnet. See the deployment tutorial for instructions.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl animate-pulse">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-gray-200 rounded-full mr-4"></div>
          <div>
            <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!vaultData) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <div className="text-center text-gray-500">
          Failed to load vault data. Please check your connection.
        </div>
      </div>
    );
  }

  // Format TVL for display
  const tvlNumber = parseFloat(tvl);
  const tvlDisplay = tvlNumber >= 1000000 
    ? `$${(tvlNumber / 1000000).toFixed(2)}M`
    : tvlNumber >= 1000 
    ? `$${(tvlNumber / 1000).toFixed(2)}K`
    : `$${tvlNumber.toFixed(2)}`;

  // If actual APY is 0, show target APY
  // Target APY: RWA = 5%, Lending = 3%, weighted average ≈ 4%
  const displayApr = parseFloat(apr) > 0 ? apr : '4.00';
  const isTargetApy = parseFloat(apr) === 0;

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
          <span className="text-lg font-bold text-blue-600">
            {vaultData.symbol.slice(0, 2)}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vaultData.name}</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500 font-mono">
              {contracts.PharosVault.slice(0, 10)}...{contracts.PharosVault.slice(-8)}
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(contracts.PharosVault)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy address"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <a
              href={`https://testnet.pharosscan.xyz/address/${contracts.PharosVault}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-[var(--primary)] transition-colors"
              title="View on Explorer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
        {/* Status Badge */}
        <div className="ml-auto">
          {vaultData.emergencyShutdown ? (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              Emergency Shutdown
            </span>
          ) : (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              Active
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Total Value Locked</p>
          <p className="text-xl font-bold">{tvlDisplay}</p>
          <p className="text-xs text-gray-400">{vaultData.strategies.length} strategies</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Estimated APY</p>
          <p className="text-xl font-bold text-[var(--primary)]">{displayApr}%</p>
          <p className="text-xs text-gray-400">{isTargetApy ? 'Target (no history yet)' : 'Based on performance'}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Management Fee</p>
          <p className="text-xl font-bold">{managementFeePercent}%</p>
          <p className="text-xs text-gray-400">Annualized</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">Performance Fee</p>
          <p className="text-xl font-bold">{performanceFeePercent}%</p>
          <p className="text-xs text-gray-400">On profits</p>
        </div>
      </div>

      {/* Asset Breakdown */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Idle Assets:</span>
          <span className="font-medium">
            ${parseFloat(tvl) > 0 ? 
              ((Number(vaultData.idleAssets) / Math.pow(10, vaultData.decimals))).toLocaleString(undefined, { maximumFractionDigits: 2 }) 
              : '0'}
          </span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-500">Deployed to Strategies:</span>
          <span className="font-medium">
            ${parseFloat(tvl) > 0 ? 
              ((Number(vaultData.deployedAssets) / Math.pow(10, vaultData.decimals))).toLocaleString(undefined, { maximumFractionDigits: 2 }) 
              : '0'}
          </span>
        </div>
      </div>
    </div>
  );
}
