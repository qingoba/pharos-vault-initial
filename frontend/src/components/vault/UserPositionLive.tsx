'use client';

/**
 * UserPositionLive Component
 * Displays the user's current position in the vault
 */

import { useAccount, useChainId } from 'wagmi';
import { useUserPosition, useSharePrice } from '@/hooks';
import { getContracts } from '@/lib/contracts';

export function UserPositionLive() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  
  const { 
    position, 
    sharesFormatted, 
    valueFormatted, 
    hasPosition, 
    isLoading 
  } = useUserPosition(contracts.PharosVault);

  const { pricePerShareFormatted } = useSharePrice(contracts.PharosVault);

  const isValidContract = contracts.PharosVault !== '0x0000000000000000000000000000000000000000';

  if (!isConnected) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Your Position</h3>
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
          Connect wallet to view your position
        </div>
      </div>
    );
  }

  if (!isValidContract) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Your Position</h3>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          Contracts not deployed yet.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl animate-pulse">
        <h3 className="text-lg font-semibold mb-4">Your Position</h3>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    );
  }

  if (!hasPosition) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Your Position</h3>
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-gray-500 mb-2">No position yet</p>
          <p className="text-sm text-gray-400">Deposit assets to start earning yield</p>
        </div>
      </div>
    );
  }

  // Calculate profit/loss (simplified - would need deposit history for accurate calculation)
  const shares = parseFloat(sharesFormatted);
  const value = parseFloat(valueFormatted);
  const pricePerShare = parseFloat(pricePerShareFormatted);
  
  // Assuming shares were minted at 1:1 ratio initially
  const estimatedDeposit = shares; // This is simplified
  const estimatedProfit = value - estimatedDeposit;
  const profitPercent = estimatedDeposit > 0 ? ((value / estimatedDeposit - 1) * 100) : 0;

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Your Position</h3>
        <span className="text-xs text-gray-500 font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
      </div>

      {/* Main Value Display */}
      <div className="text-center py-4 mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
        <p className="text-sm text-gray-500 mb-1">Current Value</p>
        <p className="text-3xl font-bold text-gray-900">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {estimatedProfit !== 0 && (
          <p className={`text-sm mt-1 ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {estimatedProfit >= 0 ? '+' : ''}${estimatedProfit.toFixed(2)} 
            ({estimatedProfit >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%)
          </p>
        )}
      </div>

      {/* Position Details */}
      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500">Vault Shares</p>
            <p className="font-semibold">{shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} pvUSDC</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Price per Share</p>
            <p className="font-semibold">${pricePerShare.toFixed(6)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Max Withdraw</p>
            <p className="font-semibold text-sm">
              ${position?.maxWithdraw ? 
                (Number(position.maxWithdraw) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) 
                : '0'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Max Redeem</p>
            <p className="font-semibold text-sm">
              {position?.maxRedeem ? 
                (Number(position.maxRedeem) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) 
                : '0'} shares
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Earning Yield</span>
          <span className="flex items-center text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Active
          </span>
        </div>
      </div>
    </div>
  );
}
