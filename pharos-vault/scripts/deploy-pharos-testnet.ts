import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Pharos Testnet Deployment Script
 * 
 * This script deploys all contracts to Pharos Testnet and
 * automatically updates the frontend contract addresses.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=====================================================");
  console.log("     Pharos Vault - Testnet Deployment Script");
  console.log("=====================================================\n");
  
  console.log("Network:", network.name, "(Chain ID:", network.chainId.toString(), ")");
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    throw new Error("Deployer has no balance! Please fund your wallet first.");
  }

  // ===================== 部署参数 =====================
  const FEE_RECIPIENT = deployer.address;
  const YIELD_PROVIDER = deployer.address;
  const RWA_APY = 500;  // 5% APY
  const LENDING_APY = 300;  // 3% APY

  console.log("Deployment Parameters:");
  console.log("├── Fee Recipient:", FEE_RECIPIENT);
  console.log("├── Yield Provider:", YIELD_PROVIDER);
  console.log("├── RWA Strategy APY:", RWA_APY / 100, "%");
  console.log("└── Lending Strategy APY:", LENDING_APY / 100, "%\n");

  // ===================== 1. Deploy MockUSDC =====================
  console.log("Step 1/5: Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✓ MockUSDC deployed:", usdcAddress);

  // ===================== 2. Deploy PharosVault =====================
  console.log("\nStep 2/5: Deploying PharosVault...");
  const PharosVault = await ethers.getContractFactory("PharosVault");
  
  // Get deployment transaction to verify bytecode
  const deployTx = await PharosVault.getDeployTransaction(
    usdcAddress,
    "Pharos USDC Vault",
    "pvUSDC",
    FEE_RECIPIENT
  );
  
  console.log("  Bytecode length:", deployTx.data?.length || 0);
  
  if (!deployTx.data || deployTx.data.length < 100) {
    throw new Error("Deployment bytecode is empty or too short!");
  }
  
  // Estimate gas
  const estimatedGas = await ethers.provider.estimateGas({
    ...deployTx,
    from: deployer.address
  });
  console.log("  Estimated gas:", estimatedGas.toString());
  
  // Get current gas price from network
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || 10000000000n; // Default 10 gwei
  console.log("  Gas price:", (gasPrice / 1000000000n).toString(), "gwei");
  
  // Send the deployment transaction manually
  console.log("  Sending deployment transaction...");
  const tx = await deployer.sendTransaction({
    data: deployTx.data,
    gasLimit: estimatedGas * 120n / 100n, // 20% buffer
    gasPrice: gasPrice,
  });
  console.log("  Tx hash:", tx.hash);
  console.log("  Waiting for confirmation...");
  
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("Deployment transaction failed");
  }
  
  const vaultAddress = receipt.contractAddress!;
  console.log("✓ PharosVault deployed:", vaultAddress);
  
  // Attach to the deployed contract for further interactions
  const vault = PharosVault.attach(vaultAddress);

  // ===================== 3. Deploy RWA Strategy =====================
  console.log("\nStep 3/5: Deploying MockRWAYieldStrategy...");
  const MockRWAYieldStrategy = await ethers.getContractFactory("MockRWAYieldStrategy");
  const rwaStrategy = await MockRWAYieldStrategy.deploy(
    vaultAddress,
    usdcAddress,
    RWA_APY,
    YIELD_PROVIDER
  );
  await rwaStrategy.waitForDeployment();
  const rwaStrategyAddress = await rwaStrategy.getAddress();
  console.log("✓ RWA Strategy deployed:", rwaStrategyAddress);

  // ===================== 4. Deploy Lending Strategy =====================
  console.log("\nStep 4/5: Deploying SimpleLendingStrategy...");
  const SimpleLendingStrategy = await ethers.getContractFactory("SimpleLendingStrategy");
  const lendingStrategy = await SimpleLendingStrategy.deploy(
    vaultAddress,
    usdcAddress,
    LENDING_APY
  );
  await lendingStrategy.waitForDeployment();
  const lendingStrategyAddress = await lendingStrategy.getAddress();
  console.log("✓ Lending Strategy deployed:", lendingStrategyAddress);

  // ===================== 5. Configure Vault =====================
  console.log("\nStep 5/5: Configuring Vault...");

  // Add RWA Strategy (60% allocation)
  console.log("  Adding RWA Strategy (60% allocation)...");
  const tx1 = await vault.addStrategy(rwaStrategyAddress, 6000);
  await tx1.wait();
  console.log("  ✓ RWA Strategy added");

  // Add Lending Strategy (40% allocation)
  console.log("  Adding Lending Strategy (40% allocation)...");
  const tx2 = await vault.addStrategy(lendingStrategyAddress, 4000);
  await tx2.wait();
  console.log("  ✓ Lending Strategy added");

  // Mint test tokens
  console.log("  Minting test tokens...");
  const mintAmount = ethers.parseUnits("1000000", 6); // 1M USDC
  await usdc.mint(deployer.address, mintAmount);
  await usdc.mint(YIELD_PROVIDER, mintAmount);
  console.log("  ✓ Minted 2,000,000 USDC (1M to deployer, 1M to yield provider)");

  // Approve strategy to pull yield
  console.log("  Setting up yield provider approval...");
  await usdc.approve(rwaStrategyAddress, ethers.MaxUint256);
  console.log("  ✓ Yield provider approved");

  // ===================== Deployment Summary =====================
  console.log("\n=====================================================");
  console.log("           Deployment Complete!");
  console.log("=====================================================\n");

  const addresses = {
    USDC: usdcAddress,
    PharosVault: vaultAddress,
    RWAYieldStrategy: rwaStrategyAddress,
    SimpleLendingStrategy: lendingStrategyAddress,
  };

  console.log("Contract Addresses:");
  console.log(JSON.stringify(addresses, null, 2));

  // ===================== Update Frontend Config =====================
  console.log("\n=====================================================");
  console.log("           Updating Frontend Config");
  console.log("=====================================================\n");

  const frontendAddressesPath = path.resolve(
    __dirname, 
    "../../frontend/src/lib/contracts/addresses.ts"
  );

  // Determine which contract block to update based on chain ID
  const chainId = network.chainId;
  const isSepolia = chainId === 11155111n;
  const contractBlockName = isSepolia ? 'SEPOLIA_CONTRACTS' : 'PHAROS_TESTNET_CONTRACTS';
  const networkLabel = isSepolia ? 'Sepolia' : 'Pharos Testnet';

  try {
    let content = fs.readFileSync(frontendAddressesPath, 'utf8');
    
    // Build the new contract block
    const newContractsBlock = `export const ${contractBlockName} = {
  // Core Token
  USDC: '${usdcAddress}' as \`0x\${string}\`,
  
  // Vault${isSepolia ? '' : ''}
  PharosVault: '${vaultAddress}' as \`0x\${string}\`,
  
  // Strategies
  RWAYieldStrategy: '${rwaStrategyAddress}' as \`0x\${string}\`,
  SimpleLendingStrategy: '${lendingStrategyAddress}' as \`0x\${string}\`,
} as const;`;

    // Use regex to replace the appropriate contracts block
    const regex = new RegExp(`export const ${contractBlockName} = \\{[\\s\\S]*?\\} as const;`);
    content = content.replace(regex, newContractsBlock);

    fs.writeFileSync(frontendAddressesPath, content);
    console.log(`✓ Frontend ${networkLabel} addresses updated successfully!`);
    console.log("  File:", frontendAddressesPath);
  } catch (error) {
    console.log("⚠ Could not auto-update frontend config. Please manually update:");
    console.log("  File: frontend/src/lib/contracts/addresses.ts");
    console.log(`\n  Copy these addresses to ${contractBlockName}:`);
    console.log(`    USDC: '${usdcAddress}'`);
    console.log(`    PharosVault: '${vaultAddress}'`);
    console.log(`    RWAYieldStrategy: '${rwaStrategyAddress}'`);
    console.log(`    SimpleLendingStrategy: '${lendingStrategyAddress}'`);
  }

  // ===================== Save Deployment Info =====================
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: addresses,
    config: {
      managementFee: "2%",
      performanceFee: "10%",
      rwaStrategyAPY: "5%",
      lendingStrategyAPY: "3%",
      rwaAllocation: "60%",
      lendingAllocation: "40%",
    },
  };

  const deploymentPath = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  const networkPrefix = isSepolia ? 'sepolia' : 'pharos-testnet';
  const fileName = `${networkPrefix}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentPath, fileName),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n✓ Deployment info saved to:", path.join(deploymentPath, fileName));

  // ===================== Next Steps =====================
  console.log("\n=====================================================");
  console.log("                 Next Steps");
  console.log("=====================================================\n");
  console.log("1. Start the frontend:");
  console.log("   cd frontend && npm run dev");
  
  if (isSepolia) {
    console.log("\n2. Connect your wallet to Sepolia");
    console.log("   - Network Name: Sepolia");
    console.log("   - RPC URL: https://ethereum-sepolia-rpc.publicnode.com");
    console.log("   - Chain ID: 11155111");
    console.log("   - Currency Symbol: ETH");
    console.log("   - Explorer: https://sepolia.etherscan.io");
  } else {
    console.log("\n2. Connect your wallet to Pharos Testnet");
    console.log("   - Network Name: Pharos Testnet");
    console.log("   - RPC URL: https://testnet.dplabs-internal.com");
    console.log("   - Chain ID: 688689");
    console.log("   - Currency Symbol: PTT");
  }
  
  console.log("\n3. Get test tokens from the faucet or use mint function");
  console.log("\n4. Test the vault operations:");
  console.log("   - Approve USDC");
  console.log("   - Deposit into vault");
  console.log("   - Check your shares");
  console.log("   - Withdraw or redeem");

  return addresses;
}

main()
  .then(() => {
    console.log("\n✓ Deployment script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Deployment failed:", error);
    process.exit(1);
  });
