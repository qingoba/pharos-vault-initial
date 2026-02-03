'use client';

import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { PortfolioSummary } from '@/components/portfolio/PortfolioSummary';
import { PositionList } from '@/components/portfolio/PositionList';

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
        <>
          <PortfolioSummary />
          <PositionList />
        </>
      )}
    </div>
  );
}
