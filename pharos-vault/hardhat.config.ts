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
      url: process.env.PHAROS_TESTNET_RPC_URL || "https://atlantic.dplabs-internal.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 688689,
      gas: 8000000,
      // Use EIP-1559 gas settings
      maxFeePerGas: 50000000000, // 50 gwei
      maxPriorityFeePerGas: 50000000000, // 2 gwei
      timeout: 120000, // 2 minute timeout for large deployments
    },
    // Pharos Mainnet (for future use)
    pharos: {
      url: process.env.PHAROS_RPC_URL || "https://rpc.pharos.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1672,
    },
    // Sepolia Testnet
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      timeout: 120000, // 2 minute timeout for large deployments
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
          apiURL: "https://api.socialscan.io/pharos-atlantic-testnet",
          browserURL: "https://testnet.pharosscan.xyz",
        },
      },
    ],
  },
};

export default config;
