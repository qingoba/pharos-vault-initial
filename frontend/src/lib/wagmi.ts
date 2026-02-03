import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';

export const pharos = defineChain({
  id: 1672,
  name: 'Pharos',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.pharos.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Pharos Explorer', url: 'https://explorer.pharos.xyz' },
  },
});

export const config = createConfig({
  chains: [pharos],
  transports: {
    [pharos.id]: http(),
  },
});
