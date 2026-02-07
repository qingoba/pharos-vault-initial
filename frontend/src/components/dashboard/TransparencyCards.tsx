import Link from 'next/link';

const cards = [
  {
    title: 'zk-Proof of Reserve',
    description: 'On-chain verifiable asset backing with zero-knowledge proofs. Verify reserves exceed liabilities without revealing individual positions.',
  },
  {
    title: 'Risk Tranches',
    description: 'Senior/Junior waterfall structure. Senior gets priority yield, Junior absorbs losses for higher upside.',
  },
  {
    title: 'Auto-Compound Keepers',
    description: 'Chainlink Automation & Gelato Ops harvest strategies in gas-efficient round-robin order.',
  },
];

export function TransparencyCards() {
  return (
    <section className="py-12">
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
        Transparency First
      </h2>
      <p className="text-center text-gray-500 mb-8 text-sm">
        Every metric is verifiable on-chain.{' '}
        <Link href="/transparency" className="text-blue-600 hover:underline">
          View Full Dashboard &rarr;
        </Link>
      </p>
      <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
        {cards.map((card) => (
          <div
            key={card.title}
            className="p-6 bg-gray-50 rounded-xl border border-gray-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {card.title}
            </h3>
            <p className="text-sm text-gray-600">{card.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
