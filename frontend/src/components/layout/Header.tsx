'use client';

import Link from 'next/link';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/vault', label: 'Vault' },
    { href: '/portfolio', label: 'Portfolio' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-[var(--primary)]">
          Pharos Vault
        </Link>

        <nav className="flex gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-gray-600 hover:text-[var(--primary)] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {isConnected ? (
          <button
            onClick={() => disconnect()}
            className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors"
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: injected() })}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm hover:bg-[var(--primary-hover)] transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
