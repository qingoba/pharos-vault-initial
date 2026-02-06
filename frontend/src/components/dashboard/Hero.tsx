import Link from 'next/link';

export function Hero() {
  return (
    <section className="text-center py-24">
      <h1 className="text-5xl font-bold text-gray-900 mb-4">Pharos Vault</h1>
      <p className="text-xl text-gray-600 mb-8">
        Capture diversified RWA yields with one click
      </p>
      <div className="flex gap-4 justify-center">
        <Link 
          href="/vault/live"
          className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors"
        >
          🏛️ Enter Live Vault
        </Link>
        <Link 
          href="/vault/usdc-vault"
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          📊 View Demo Vault
        </Link>
      </div>
    </section>
  );
}
