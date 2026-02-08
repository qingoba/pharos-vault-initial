import { ethers } from "hardhat";

/**
 * 分配 Vault 闲置资金到策略
 * 
 * 使用: npx hardhat run scripts/allocate-funds.ts --network pharosTestnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Operator:", deployer.address);

  // 合约地址 (从 addresses.ts 获取)
  const VAULT = process.env.VAULT_ADDRESS || "0x4c41f368647ed1F430D82e6ba8E20569561A8f05";
  const RWA_STRATEGY = process.env.RWA_STRATEGY || "0x453D6D8A38b701E5C3bBfa4260F6566722D8a974";
  const LENDING_STRATEGY = process.env.LENDING_STRATEGY || "0x3b56Ea06cac46Be9f92b1Fd6A2867d54257897e0";

  const vault = await ethers.getContractAt("PharosVault", VAULT);

  // 查看当前状态
  const idle = await vault.idleAssets();
  const deployed = await vault.totalDeployedAssets();
  const total = await vault.totalAssets();

  console.log("\n=== Current Vault State ===");
  console.log("Total Assets:", ethers.formatUnits(total, 6), "USDC");
  console.log("Idle Assets:", ethers.formatUnits(idle, 6), "USDC");
  console.log("Deployed Assets:", ethers.formatUnits(deployed, 6), "USDC");

  if (idle === 0n) {
    console.log("\n⚠️  No idle assets to allocate");
    return;
  }

  // 获取策略的 debtRatio
  const rwaInfo = await vault.getStrategyInfo(RWA_STRATEGY);
  const lendingInfo = await vault.getStrategyInfo(LENDING_STRATEGY);
  
  const rwaRatio = Number(rwaInfo.debtRatio);
  const lendingRatio = Number(lendingInfo.debtRatio);
  const totalRatio = rwaRatio + lendingRatio;

  console.log("\n=== Strategy Allocation ===");
  console.log("RWA Strategy ratio:", rwaRatio / 100, "%");
  console.log("Lending Strategy ratio:", lendingRatio / 100, "%");

  // 按比例分配
  const rwaAmount = (idle * BigInt(rwaRatio)) / BigInt(totalRatio);
  const lendingAmount = (idle * BigInt(lendingRatio)) / BigInt(totalRatio);

  console.log("\n=== Allocating Funds ===");
  
  // 分配到 RWA 策略
  if (rwaAmount > 0n) {
    console.log(`Allocating ${ethers.formatUnits(rwaAmount, 6)} USDC to RWA Strategy...`);
    const tx1 = await vault.allocateToStrategy(RWA_STRATEGY, rwaAmount);
    await tx1.wait();
    console.log("✓ RWA allocation complete. Tx:", tx1.hash);
  }

  // 分配到 Lending 策略
  if (lendingAmount > 0n) {
    console.log(`Allocating ${ethers.formatUnits(lendingAmount, 6)} USDC to Lending Strategy...`);
    const tx2 = await vault.allocateToStrategy(LENDING_STRATEGY, lendingAmount);
    await tx2.wait();
    console.log("✓ Lending allocation complete. Tx:", tx2.hash);
  }

  // 显示最终状态
  const newIdle = await vault.idleAssets();
  const newDeployed = await vault.totalDeployedAssets();

  console.log("\n=== Final State ===");
  console.log("Idle Assets:", ethers.formatUnits(newIdle, 6), "USDC");
  console.log("Deployed Assets:", ethers.formatUnits(newDeployed, 6), "USDC");
  console.log("\n✓ Allocation complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
