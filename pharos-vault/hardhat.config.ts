import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris", // Use Paris EVM version for better compatibility
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
    // Pharos Testnet
    pharosTestnet: {
      url: process.env.PHAROS_TESTNET_RPC_URL || "https://testnet.dplabs-internal.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 688689,
      gas: 8000000,
      gasPrice: 20000000000, // 20 gwei - increase for safety
      timeout: 120000, // 2 minute timeout for large deployments
    },
    // Pharos Mainnet (for future use)
    pharos: {
      url: process.env.PHAROS_RPC_URL || "https://rpc.pharos.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1672,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      pharosTestnet: process.env.PHAROS_API_KEY || "no-api-key",
    },
    customChains: [
      {
        network: "pharosTestnet",
        chainId: 688689,
        urls: {
          apiURL: "https://testnet.pharosscan.xyz/api",
          browserURL: "https://testnet.pharosscan.xyz",
        },
      },
    ],
  },
};

export default config;
