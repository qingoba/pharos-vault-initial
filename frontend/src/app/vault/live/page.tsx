'use client';

/**
 * Live Vault Page
 * Displays real-time vault data directly from the blockchain
 * This page uses the new live components connected to smart contracts
 */

import { useState, useEffect } from 'react';
import { VaultInfoLive } from '@/components/vault/VaultInfoLive';
import { StrategyListLive } from '@/components/vault/StrategyListLive';
import { UserPositionLive } from '@/components/vault/UserPositionLive';
import { VaultActions } from '@/components/vault/VaultActions';
import { useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getContracts } from '@/lib/contracts';
import { PharosVaultABI } from '@/lib/contracts/abis';

export default function LiveVaultPage() {
  const [mounted, setMounted] = useState(false);
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl animate-pulse">
          <div className="h-4 bg-blue-200 rounded w-48"></div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 p-6 bg-white border border-gray-200 rounded-xl animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 bg-white border border-gray-200 rounded-xl animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-24 mb-4"></div>
            <div className="h-9 bg-gray-200 rounded mb-3"></div>
            <div className="h-9 bg-gray-200 rounded"></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 p-6 bg-white border border-gray-200 rounded-xl animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg">
                  <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 bg-white border border-gray-200 rounded-xl animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-28 mb-4"></div>
            <div className="h-9 bg-gray-200 rounded mb-3"></div>
            <div className="h-9 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }
  
  const isValidContract = contracts.PharosVault !== '0x0000000000000000000000000000000000000000';

  // Get network name
  const getNetworkName = () => {
    if (!mounted) return 'Loading...';
    if (chainId === 688689) return 'Pharos Testnet';
    if (chainId === 1672) return 'Pharos Mainnet';
    if (chainId === 11155111) return 'Sepolia Testnet';
    return `Chain ${chainId}`;
  };

  // Get explorer URL
  const getExplorerUrl = () => {
    if (chainId === 11155111) return `https://sepolia.etherscan.io/address/${contracts.PharosVault}`;
    return `https://atlantic.pharosscan.xyz/address/${contracts.PharosVault}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Network Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-blue-700">
            Connected to {getNetworkName()}
          </span>
        </div>
        {isValidContract && mounted && (
          <a
            href={getExplorerUrl()}
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
                  href={`https://atlantic.pharosscan.xyz/address/${contracts.PharosVault}`}
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
                  href={`https://atlantic.pharosscan.xyz/address/${contracts.USDC}`}
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
                  href={`https://atlantic.pharosscan.xyz/address/${contracts.RWAYieldStrategy}`}
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
                  href={`https://atlantic.pharosscan.xyz/address/${contracts.SimpleLendingStrategy}`}
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

      {/* About & Settings Tabs */}
      <AboutAndSettings vaultAddress={contracts.PharosVault as `0x${string}`} />
    </div>
  );
}

function AboutAndSettings({ vaultAddress }: { vaultAddress: `0x${string}` }) {
  const [tab, setTab] = useState<'about' | 'settings'>('about');
  const [mgmtFee, setMgmtFee] = useState('2');
  const [perfFee, setPerfFee] = useState('10');
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [lastAction, setLastAction] = useState('');

  const handleSetMgmtFee = () => {
    const bps = Math.round(parseFloat(mgmtFee) * 100);
    writeContract({ address: vaultAddress, abi: PharosVaultABI, functionName: 'setManagementFee', args: [BigInt(bps)] });
    setLastAction('management');
  };

  const handleSetPerfFee = () => {
    const bps = Math.round(parseFloat(perfFee) * 100);
    writeContract({ address: vaultAddress, abi: PharosVaultABI, functionName: 'setPerformanceFee', args: [BigInt(bps)] });
    setLastAction('performance');
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('about')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${tab === 'about' ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          About
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${tab === 'settings' ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          ⚙️ Fee Settings
        </button>
      </div>

      <div className="p-6">
        {tab === 'about' ? (
          <>
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
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Only vault owner can update fees. Values in percentage (e.g. 2 = 2%).</p>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm text-gray-600 mb-1 block">Management Fee (%)</label>
                <input
                  type="number"
                  value={mgmtFee}
                  onChange={(e) => setMgmtFee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  min="0" max="100" step="0.01"
                />
              </div>
              <button
                onClick={handleSetMgmtFee}
                disabled={isPending || isConfirming}
                className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50"
              >
                {isPending && lastAction === 'management' ? 'Signing...' : isConfirming && lastAction === 'management' ? 'Confirming...' : 'Update'}
              </button>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-sm text-gray-600 mb-1 block">Performance Fee (%)</label>
                <input
                  type="number"
                  value={perfFee}
                  onChange={(e) => setPerfFee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  min="0" max="50" step="0.01"
                />
              </div>
              <button
                onClick={handleSetPerfFee}
                disabled={isPending || isConfirming}
                className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50"
              >
                {isPending && lastAction === 'performance' ? 'Signing...' : isConfirming && lastAction === 'performance' ? 'Confirming...' : 'Update'}
              </button>
            </div>

            {isSuccess && <p className="text-xs text-green-600">✓ Fee updated successfully</p>}
            {error && <p className="text-xs text-red-600">Error: {error.message.slice(0, 100)}</p>}

            <div className="pt-3 border-t border-gray-100 text-xs text-gray-400">
              <p>Management Fee: max 100% (10000 bps) · annualized, accrued per second</p>
              <p>Performance Fee: max 50% (5000 bps) · charged on harvest gains</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
