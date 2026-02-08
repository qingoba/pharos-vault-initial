import { ethers } from "hardhat";

/**
 * 部署 RWAOracle 合约
 * 
 * 使用:
 *   npx hardhat run scripts/deploy-oracle.ts --network localhost
 *   npx hardhat run scripts/deploy-oracle.ts --network pharosTestnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying RWAOracle...");
  console.log("Deployer:", deployer.address);
  
  // 获取 USDC 地址 (从环境变量或部署新的)
  let usdcAddress = process.env.USDC_ADDRESS;
  
  if (!usdcAddress) {
    console.log("\nNo USDC_ADDRESS provided, deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log("MockUSDC deployed:", usdcAddress);
  }
  
  // 部署 RWAOracle
  const RWAOracle = await ethers.getContractFactory("RWAOracle");
  const oracle = await RWAOracle.deploy(usdcAddress);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  
  console.log("\n✓ RWAOracle deployed:", oracleAddress);
  
  // 显示初始状态
  const nav = await oracle.nav();
  const rate = await oracle.interestRate();
  
  console.log("\nInitial State:");
  console.log("  NAV:", ethers.formatUnits(nav, 18), "($1.00)");
  console.log("  Interest Rate:", Number(rate) / 100, "% APY");
  
  console.log("\n=== Next Steps ===");
  console.log("1. Run oracle node:");
  console.log(`   ORACLE_ADDRESS=${oracleAddress} USDC_ADDRESS=${usdcAddress} npx hardhat run scripts/oracle-node.ts --network localhost`);
  console.log("\n2. Or set strategy and distribute yield:");
  console.log(`   await oracle.setStrategy("0x...")`);
  
  return { oracle: oracleAddress, usdc: usdcAddress };
}

main()
  .then((addresses) => {
    console.log("\nDeployment complete:", addresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
