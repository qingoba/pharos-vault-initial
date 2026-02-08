'use client';

import { useAccount, useConnect, useChainId } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useVaultInfo, useUserPosition, useSharePrice, useVaultStrategies } from '@/hooks';
import { getContracts } from '@/lib/contracts';
import { formatUnits } from 'viem';
import Link from 'next/link';

export default function PortfolioPage() {
  const { isConnected } = useAccount();
  const { connect } = useConnect();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {!isConnected ? (
        <div className="text-center py-24">
          <p className="text-gray-500 mb-4">Connect your wallet to view your portfolio</p>
          <button
            onClick={() => connect({ connector: injected() })}
            className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)]"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <PortfolioContent />
      )}
    </div>
  );
}

function PortfolioContent() {
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const vaultAddress = contracts.PharosVault;

  const { vaultData, isLoading: vaultLoading, tvl, apr } = useVaultInfo(vaultAddress);
  const { position, isLoading: posLoading, sharesFormatted, valueFormatted, hasPosition } = useUserPosition(vaultAddress);
  const { pricePerShareFormatted } = useSharePrice(vaultAddress);
  const { count } = useVaultStrategies(vaultAddress);

  const isLoading = vaultLoading || posLoading;

  const value = parseFloat(valueFormatted);
  const shares = parseFloat(sharesFormatted);
  const pps = parseFloat(pricePerShareFormatted);
  const profit = hasPosition ? value - shares : 0; // value - deposited (approx: shares * 1.0 at deposit)
  const totalTVL = parseFloat(tvl);

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Portfolio</h1>
        <p className="text-sm text-gray-500 font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-5 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Portfolio Value</p>
          <p className="text-2xl font-bold">
            {isLoading ? '...' : `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          </p>
        </div>
        <div className="p-5 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Shares Held</p>
          <p className="text-2xl font-bold">
            {isLoading ? '...' : shares.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">pvUSDC</p>
        </div>
        <div className="p-5 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Unrealized P&L</p>
          <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {isLoading ? '...' : `${profit >= 0 ? '+' : ''}$${profit.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          </p>
        </div>
        <div className="p-5 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Price per Share</p>
          <p className="text-2xl font-bold">
            {isLoading ? '...' : `$${pps.toFixed(6)}`}
          </p>
        </div>
      </div>

      {/* Vault Position Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold">Vault Positions</h2>
          <Link
            href="/vault/live"
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Go to Vault →
          </Link>
        </div>

        {!hasPosition ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 mb-3">No active positions</p>
            <Link
              href="/vault/live"
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm hover:bg-[var(--primary-hover)]"
            >
              Deposit Now
            </Link>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-blue-700">PV</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold">{vaultData?.name || 'Pharos Vault'}</p>
                <p className="text-xs text-gray-500">{vaultData?.symbol || 'pvUSDC'} · {count} strategies · APY {apr}%</p>
              </div>
              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
            </div>

            {/* Position Details Grid */}
            <div className="grid grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Shares</p>
                <p className="font-semibold">{shares.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Value</p>
                <p className="font-semibold">${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Max Withdraw</p>
                <p className="font-semibold">
                  ${position ? (Number(position.maxWithdraw) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Vault TVL</p>
                <p className="font-semibold">${totalTVL.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Your Share</p>
                <p className="font-semibold">
                  {totalTVL > 0 ? ((value / totalTVL) * 100).toFixed(2) : '0'}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
