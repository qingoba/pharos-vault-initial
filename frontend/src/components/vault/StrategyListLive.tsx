'use client';

/**
 * StrategyListLive Component
 * Displays real-time strategy information from the blockchain
 */

import { useChainId } from 'wagmi';
import { useVaultStrategies, useStrategyInfo, useVaultAdmin, useMounted } from '@/hooks';
import { getContracts } from '@/lib/contracts';

interface StrategyCardProps {
  strategyAddress: `0x${string}`;
  vaultAddress: `0x${string}`;
}

function StrategyCard({ strategyAddress, vaultAddress }: StrategyCardProps) {
  const { strategy, isLoading, allocationPercent, apyPercent } = useStrategyInfo(strategyAddress, vaultAddress);
  const { harvestStrategy, isLoading: isHarvesting, txState } = useVaultAdmin(vaultAddress);
  const mounted = useMounted();

  const handleHarvest = async () => {
    try {
      await harvestStrategy(strategyAddress);
    } catch (error) {
      console.error('Harvest failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-sm">Failed to load strategy</p>
      </div>
    );
  }

  // Calculate time since last harvest
  let timeSinceDisplay = '--';
  if (mounted) {
    const timeSinceHarvest = Date.now() / 1000 - strategy.lastHarvest;
    const hoursSinceHarvest = Math.floor(timeSinceHarvest / 3600);
    timeSinceDisplay = hoursSinceHarvest >= 24
      ? `${Math.floor(hoursSinceHarvest / 24)}d ago`
      : `${hoursSinceHarvest}h ago`;
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{strategy.name}</h4>
          <p className="text-xs text-gray-500 font-mono mt-1">
            {strategyAddress.slice(0, 8)}...{strategyAddress.slice(-6)}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${
          strategy.isActive 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          {strategy.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500">Allocation</p>
          <p className="font-semibold text-[var(--primary)]">{allocationPercent}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">APY</p>
          <p className="font-semibold text-green-600">{apyPercent}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Last Harvest</p>
          <p className="font-semibold">{timeSinceDisplay}</p>
        </div>
      </div>

      {/* Progress bar for allocation */}
      <div className="mb-3">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
            style={{ width: `${Math.min(parseFloat(allocationPercent), 100)}%` }}
          />
        </div>
      </div>

      {/* Total Profit */}
      <div className="flex justify-between text-sm mb-3">
        <span className="text-gray-500">Total Profit:</span>
        <span className="font-medium text-green-600">
          +${(Number(strategy.totalProfit) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Harvest Button */}
      <button
        onClick={handleHarvest}
        disabled={isHarvesting || !strategy.isActive}
        className="w-full py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isHarvesting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Harvesting...
          </span>
        ) : (
          '🌾 Harvest Yield'
        )}
      </button>

      {txState.hash && (
        <div className="mt-2 text-xs text-center">
          <a
            href={`https://atlantic.pharosscan.xyz/tx/${txState.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--primary)] hover:underline"
          >
            View Transaction →
          </a>
        </div>
      )}
    </div>
  );
}

export function StrategyListLive() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  
  const { strategyAddresses, isLoading, count } = useVaultStrategies(contracts.PharosVault);
  const { harvestAll, isLoading: isHarvestingAll, txState: harvestAllState } = useVaultAdmin(contracts.PharosVault);

  const isValidContract = contracts.PharosVault !== '0x0000000000000000000000000000000000000000';

  const handleHarvestAll = async () => {
    try {
      await harvestAll();
    } catch (error) {
      console.error('Harvest all failed:', error);
    }
  };

  if (!isValidContract) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Strategies</h3>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          Contracts not deployed yet. Deploy to see strategies.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Strategies</h3>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-lg animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">
          Strategies ({count})
        </h3>
        <button
          onClick={handleHarvestAll}
          disabled={isHarvestingAll || count === 0}
          className="px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isHarvestingAll ? 'Harvesting...' : '🌾 Harvest All'}
        </button>
      </div>

      {harvestAllState.hash && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
          <p className="text-green-700">Harvest All transaction submitted!</p>
          <a
            href={`https://atlantic.pharosscan.xyz/tx/${harvestAllState.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--primary)] hover:underline text-xs"
          >
            View on Explorer →
          </a>
        </div>
      )}

      {count === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
          No strategies added yet
        </div>
      ) : (
        <div className="space-y-3">
          {strategyAddresses.map((address) => (
            <StrategyCard
              key={address}
              strategyAddress={address}
              vaultAddress={contracts.PharosVault}
            />
          ))}
        </div>
      )}
    </div>
  );
}
