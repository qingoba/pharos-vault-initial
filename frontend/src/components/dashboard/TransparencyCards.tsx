const cards = [
  {
    title: 'Proof of Reserve',
    description: 'On-chain verifiable asset backing with zk proofs',
  },
  {
    title: 'On-chain Audit',
    description: 'Transparent strategy execution and fund flows',
  },
  {
    title: 'Real-time Monitoring',
    description: 'Live tracking of yields, TVL and risk metrics',
  },
];

export function TransparencyCards() {
  return (
    <section className="py-12">
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
        Transparency First
      </h2>
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
