import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

// Pharos Testnet Configuration
export const pharosTestnet = defineChain({
  id: 688689,
  name: 'Pharos Testnet',
  nativeCurrency: { name: 'Pharos ETH', symbol: 'PTT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.dplabs-internal.com'] },
  },
  blockExplorers: {
    default: { name: 'Pharos Testnet Explorer', url: 'https://testnet.pharosscan.xyz' },
  },
  testnet: true,
});

// Pharos Mainnet Configuration (for future use)
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

// Local Development Chain
export const localhost = defineChain({
  id: 1337,
  name: 'Localhost',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
});

export const config = createConfig({
  chains: [pharosTestnet, sepolia, pharos, localhost],
  transports: {
    [pharosTestnet.id]: http(),
      [sepolia.id]: http('https://sepolia.infura.io/v3/f4b1765357b1449e84efc12dcdbc502d'),
    [pharos.id]: http(),
    [localhost.id]: http(),
  },
});
