/**
 * Simulate Yield Script
 * 
 * 此脚本用于在测试网上模拟收益产生，以便测试 harvest 功能
 * 
 * 工作原理：
 * 1. 获取已部署的合约地址
 * 2. yieldProvider (部署者) 铸造测试 USDC
 * 3. yieldProvider 授权策略合约可以提取 USDC
 * 4. 触发 harvestAll 来收割收益
 * 
 * 使用方法：
 *   npx hardhat run scripts/simulate-yield.ts --network sepolia
 */

import { ethers, network } from "hardhat";

// 已部署的合约地址 (需要与 addresses.ts 保持一致)
const SEPOLIA_CONTRACTS = {
  USDC: '0x4a0EDB585AB395A901Ce8EF9433Bbc27e4ed1453',
  PharosVault: '0x666057e10bd322189Fa65EE94Ad889717F1FB6c7',
  RWAYieldStrategy: '0xCd57578e511d628E4542712233a5275DcDf51839',
  SimpleLendingStrategy: '0x82f311D38C2340b01BB8525e2C0FF19cCB32b2DE',
};

const PHAROS_TESTNET_CONTRACTS = {
  USDC: '0x0000000000000000000000000000000000000000',
  PharosVault: '0x0000000000000000000000000000000000000000',
  RWAYieldStrategy: '0x0000000000000000000000000000000000000000',
  SimpleLendingStrategy: '0x0000000000000000000000000000000000000000',
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  
  console.log("\n=====================================================");
  console.log("     Pharos Vault - Yield Simulation Script");
  console.log("=====================================================\n");
  
  console.log(`Network: ${network.name} (Chain ID: ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  
  // 选择合约地址
  let contracts;
  if (chainId === 11155111n) {
    contracts = SEPOLIA_CONTRACTS;
  } else if (chainId === 688689n) {
    contracts = PHAROS_TESTNET_CONTRACTS;
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }
  
  // 检查合约地址是否已配置
  if (contracts.PharosVault === '0x0000000000000000000000000000000000000000') {
    throw new Error("Contracts not deployed yet. Run deploy script first.");
  }
  
  console.log("\nContract Addresses:");
  console.log(`├── USDC: ${contracts.USDC}`);
  console.log(`├── PharosVault: ${contracts.PharosVault}`);
  console.log(`├── RWAYieldStrategy: ${contracts.RWAYieldStrategy}`);
  console.log(`└── SimpleLendingStrategy: ${contracts.SimpleLendingStrategy}`);
  
  // 获取合约实例
  const usdc = await ethers.getContractAt("MockUSDC", contracts.USDC);
  const vault = await ethers.getContractAt("PharosVault", contracts.PharosVault);
  const rwaStrategy = await ethers.getContractAt("MockRWAYieldStrategy", contracts.RWAYieldStrategy);
  const lendingStrategy = await ethers.getContractAt("SimpleLendingStrategy", contracts.SimpleLendingStrategy);
  
  // 获取当前状态
  console.log("\n--- Current State ---");
  
  const totalAssets = await vault.totalAssets();
  console.log(`Vault Total Assets: ${ethers.formatUnits(totalAssets, 6)} USDC`);
  
  const rwaAssets = await rwaStrategy.totalAssets();
  const lendingAssets = await lendingStrategy.totalAssets();
  console.log(`RWA Strategy Assets: ${ethers.formatUnits(rwaAssets, 6)} USDC`);
  console.log(`Lending Strategy Assets: ${ethers.formatUnits(lendingAssets, 6)} USDC`);
  
  // 检查 yieldProvider
  const rwaYieldProvider = await rwaStrategy.yieldProvider();
  console.log(`\nRWA Yield Provider: ${rwaYieldProvider}`);
  
  // 计算模拟收益金额 (1% of deployed assets)
  const simulatedYield = (rwaAssets + lendingAssets) / 100n;
  
  // 如果资金还没有分配到策略，先进行分配
  if (rwaAssets === 0n && lendingAssets === 0n && totalAssets > 0n) {
    console.log("\n--- Allocating Funds to Strategies ---");
    console.log("Idle assets detected. Allocating to strategies first...");
    
    // 获取 vault 空闲资金
    const idleAssets = await vault.totalAssets();
    
    if (idleAssets > 0n) {
      // 60% 分配给 RWA 策略，40% 分配给 Lending 策略
      const rwaAllocation = (idleAssets * 60n) / 100n;
      const lendingAllocation = idleAssets - rwaAllocation;
      
      try {
        console.log(`\nAllocating ${ethers.formatUnits(rwaAllocation, 6)} USDC to RWA Strategy...`);
        const allocTx1 = await vault.allocateToStrategy(contracts.RWAYieldStrategy, rwaAllocation);
        await allocTx1.wait();
        console.log("✓ RWA Strategy allocation complete");
        
        console.log(`Allocating ${ethers.formatUnits(lendingAllocation, 6)} USDC to Lending Strategy...`);
        const allocTx2 = await vault.allocateToStrategy(contracts.SimpleLendingStrategy, lendingAllocation);
        await allocTx2.wait();
        console.log("✓ Lending Strategy allocation complete");
        
        // 重新获取策略资产
        const newRwaAssets = await rwaStrategy.totalAssets();
        const newLendingAssets = await lendingStrategy.totalAssets();
        console.log(`\nNew RWA Strategy Assets: ${ethers.formatUnits(newRwaAssets, 6)} USDC`);
        console.log(`New Lending Strategy Assets: ${ethers.formatUnits(newLendingAssets, 6)} USDC`);
        
        // 继续模拟收益
        return simulateYieldGeneration(deployer, vault, usdc, rwaStrategy, lendingStrategy, newRwaAssets, newLendingAssets, contracts);
      } catch (err: any) {
        console.log(`❌ Allocation failed: ${err.message?.slice(0, 100)}`);
        console.log("You may not be the vault owner, or strategies are not properly configured.");
        return;
      }
    }
  }
  
  if (simulatedYield === 0n) {
    console.log("\n⚠️ No assets deployed to strategies.");
    console.log("   Visit http://localhost:3000/vault/live and deposit USDC.");
    return;
  }
  
  await simulateYieldGeneration(deployer, vault, usdc, rwaStrategy, lendingStrategy, rwaAssets, lendingAssets, contracts);
}

async function simulateYieldGeneration(
  deployer: any,
  vault: any,
  usdc: any,
  rwaStrategy: any,
  lendingStrategy: any,
  rwaAssets: bigint,
  lendingAssets: bigint,
  contracts: any
) {
  const simulatedYield = (rwaAssets + lendingAssets) / 100n;
  const totalAssets = await vault.totalAssets();
  
  console.log(`\n--- Simulating Yield ---`);
  console.log(`Will inject ${ethers.formatUnits(simulatedYield, 6)} USDC as simulated yield`);
  
  // Step 1: 铸造 USDC 给 yieldProvider
  console.log("\nStep 1: Minting USDC for yield simulation...");
  const mintTx = await usdc.mint(deployer.address, simulatedYield * 2n);
  await mintTx.wait();
  console.log("✓ Minted USDC");
  
  // Step 2: 授权策略合约
  console.log("\nStep 2: Approving strategies to pull yield...");
  const approveTx = await usdc.approve(contracts.RWAYieldStrategy, simulatedYield);
  await approveTx.wait();
  console.log("✓ Approved RWA Strategy");
  
  const approveTx2 = await usdc.approve(contracts.SimpleLendingStrategy, simulatedYield);
  await approveTx2.wait();
  console.log("✓ Approved Lending Strategy");
  
  // Step 3: 注入收益 (使用 injectYield 函数)
  console.log("\nStep 3: Injecting yield into strategies...");
  
  try {
    // 使用 injectYield 直接注入收益
    const injectTx = await rwaStrategy.injectYield(simulatedYield / 2n);
    await injectTx.wait();
    console.log(`✓ Injected ${ethers.formatUnits(simulatedYield / 2n, 6)} USDC to RWA Strategy`);
  } catch (err) {
    console.log("ℹ️ Could not inject yield to RWA Strategy (may need different method)");
  }
  
  // Step 4: 触发 harvest
  console.log("\nStep 4: Triggering harvestAll...");
  try {
    const harvestTx = await vault.harvestAll();
    const receipt = await harvestTx.wait();
    console.log(`✓ HarvestAll completed! Tx: ${receipt?.hash}`);
  } catch (err: any) {
    console.log(`ℹ️ HarvestAll skipped: ${err.message?.slice(0, 100)}`);
  }
  
  // 显示更新后的状态
  console.log("\n--- Updated State ---");
  const newTotalAssets = await vault.totalAssets();
  console.log(`Vault Total Assets: ${ethers.formatUnits(newTotalAssets, 6)} USDC`);
  
  const yieldGained = newTotalAssets - totalAssets;
  if (yieldGained > 0n) {
    console.log(`\n🎉 Yield Generated: +${ethers.formatUnits(yieldGained, 6)} USDC`);
  }
  
  console.log("\n=====================================================");
  console.log("           Yield Simulation Complete!");
  console.log("=====================================================");
  console.log("\nRefresh the frontend to see updated balances.");
  console.log("Visit: http://localhost:3000/vault/live");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
