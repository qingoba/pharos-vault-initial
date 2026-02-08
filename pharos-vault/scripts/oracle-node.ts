import { ethers } from "hardhat";
import * as readline from "readline";

/**
 * RWA Oracle Node - 预言机节点
 * 
 * 功能:
 * 1. 更新 NAV 数据
 * 2. 更新利率数据  
 * 3. 向策略注入收益 (模拟链下收益)
 * 
 * 使用: 
 *   npx hardhat run scripts/oracle-node.ts --network localhost
 *   npx hardhat run scripts/oracle-node.ts --network pharosTestnet
 */

// 配置
const CONFIG = {
  // 合约地址 (从环境变量或默认值)
  strategyAddress: process.env.STRATEGY_ADDRESS || "",
  usdcAddress: process.env.USDC_ADDRESS || "",
  
  // Mock 数据参数
  baseYieldPerDay: 100,  // 每天基础收益 $100 (用于演示)
};

// 状态
let currentNAV = CONFIG.initialNAV;
let currentRate = CONFIG.initialRate;
let updateCount = 0;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Oracle Node started");
  console.log("Operator:", signer.address);
  
  // 如果没有配置地址，进入交互模式
  if (!CONFIG.strategyAddress) {
    console.log("\n⚠️  No STRATEGY_ADDRESS configured. Running in demo mode.\n");
    console.log("To inject yield to a real strategy, run with:");
    console.log("STRATEGY_ADDRESS=0x... USDC_ADDRESS=0x... npx hardhat run scripts/oracle-node.ts --network pharosTestnet\n");
    await runDemoMode();
    return;
  }
  
  const strategy = await ethers.getContractAt("OracleRWAStrategy", CONFIG.strategyAddress, signer);
  const usdc = await ethers.getContractAt("MockUSDC", CONFIG.usdcAddress, signer);
  
  console.log("Strategy:", CONFIG.strategyAddress);
  console.log("USDC:", CONFIG.usdcAddress);
  
  await runInteractiveMode(strategy, usdc, signer);
}

/**
 * Demo 模式 - 仅打印模拟数据
 */
async function runDemoMode() {
  console.log("=== Demo Mode: Simulating Oracle Data ===\n");
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const prompt = () => {
    console.log("\nCommands:");
    console.log("  1. Simulate NAV update");
    console.log("  2. Simulate rate update");
    console.log("  3. Simulate yield distribution");
    console.log("  4. Run continuous simulation (10 updates)");
    console.log("  5. Show current state");
    console.log("  q. Quit\n");
    
    rl.question("Enter command: ", async (answer) => {
      switch (answer.trim()) {
        case "1":
          simulateNAVUpdate();
          break;
        case "2":
          simulateRateUpdate();
          break;
        case "3":
          simulateYieldDistribution();
          break;
        case "4":
          await runContinuousSimulation();
          break;
        case "5":
          showCurrentState();
          break;
        case "q":
          console.log("Goodbye!");
          rl.close();
          process.exit(0);
        default:
          console.log("Unknown command");
      }
      prompt();
    });
  };
  
  prompt();
}

/**
 * 交互模式 - 实际更新链上合约
 */
async function runInteractiveMode(strategy: any, usdc: any, signer: any) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const prompt = () => {
    console.log("\nCommands:");
    console.log("  1. Show strategy state");
    console.log("  2. Inject yield (simulate off-chain income)");
    console.log("  3. Inject custom amount");
    console.log("  4. Run auto-inject loop (5 times)");
    console.log("  q. Quit\n");
    
    rl.question("Enter command: ", async (answer) => {
      try {
        switch (answer.trim()) {
          case "1":
            await showStrategyState(strategy);
            break;
          case "2":
            await injectYield(strategy, usdc, signer, CONFIG.baseYieldPerDay);
            break;
          case "3":
            rl.question("Enter amount (USDC): ", async (amt) => {
              await injectYield(strategy, usdc, signer, parseFloat(amt));
              prompt();
            });
            return;
          case "4":
            await runAutoInjectLoop(strategy, usdc, signer);
            break;
          case "q":
            console.log("Goodbye!");
            rl.close();
            process.exit(0);
          default:
            console.log("Unknown command");
        }
      } catch (error: any) {
        console.error("Error:", error.message);
      }
      prompt();
    });
  };
  
  prompt();
}

async function showStrategyState(strategy: any) {
  const principal = await strategy.principal();
  const pendingYield = await strategy.pendingYield();
  const totalAssets = await strategy.totalAssets();
  const targetAPY = await strategy.targetAPY();
  
  console.log("\n=== Strategy State ===");
  console.log(`  Principal: $${ethers.formatUnits(principal, 6)}`);
  console.log(`  Pending Yield: $${ethers.formatUnits(pendingYield, 6)}`);
  console.log(`  Total Assets: $${ethers.formatUnits(totalAssets, 6)}`);
  console.log(`  Target APY: ${Number(targetAPY) / 100}%`);
}

async function injectYield(strategy: any, usdc: any, signer: any, amount: number) {
  const amountWei = ethers.parseUnits(amount.toString(), 6);
  
  console.log(`\nInjecting $${amount} yield...`);
  
  // 1. Mint USDC to signer (if needed)
  const balance = await usdc.balanceOf(signer.address);
  if (balance < amountWei) {
    console.log("  Minting USDC...");
    await (await usdc.mint(signer.address, amountWei)).wait();
  }
  
  // 2. Approve strategy
  console.log("  Approving strategy...");
  await (await usdc.approve(await strategy.getAddress(), amountWei)).wait();
  
  // 3. Deposit yield to strategy
  console.log("  Depositing yield...");
  const tx = await strategy.depositYield(amountWei);
  await tx.wait();
  
  console.log(`✓ Yield injected: $${amount}`);
  console.log(`  Tx: ${tx.hash}`);
  
  await showStrategyState(strategy);
}

async function runAutoInjectLoop(strategy: any, usdc: any, signer: any) {
  console.log("\n=== Running Auto-Inject Loop (5 times, 3s interval) ===\n");
  
  for (let i = 0; i < 5; i++) {
    console.log(`\n--- Injection ${i + 1}/5 ---`);
    await injectYield(strategy, usdc, signer, CONFIG.baseYieldPerDay);
    
    if (i < 4) {
      console.log("Waiting 3 seconds...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log("\n=== Auto-Inject Complete ===");
}

// ============== 模拟函数 ==============

function simulateNAVUpdate() {
  // NAV 每日增长 (模拟复利)
  const growth = (currentNAV * CONFIG.navDailyGrowth) / 1_000_000n;
  currentNAV += growth;
  updateCount++;
  
  const navFormatted = Number(currentNAV) / 1e18;
  console.log(`\n[Update #${updateCount}] NAV Updated`);
  console.log(`  New NAV: $${navFormatted.toFixed(6)}`);
  console.log(`  Growth: +${Number(growth) / 1e18} (+${Number(CONFIG.navDailyGrowth) / 10000}%)`);
}

function simulateRateUpdate() {
  // 利率随机波动
  const variance = Math.floor(Math.random() * CONFIG.rateVariance * 2) - CONFIG.rateVariance;
  currentRate = Math.max(100, Math.min(1000, currentRate + variance));  // 1% - 10% 范围
  updateCount++;
  
  console.log(`\n[Update #${updateCount}] Interest Rate Updated`);
  console.log(`  New Rate: ${currentRate / 100}% APY`);
  console.log(`  Change: ${variance >= 0 ? '+' : ''}${variance / 100}%`);
}

function simulateYieldDistribution() {
  const yieldAmount = Number(CONFIG.yieldAmount) / 1e6;
  updateCount++;
  
  console.log(`\n[Update #${updateCount}] Yield Distributed`);
  console.log(`  Amount: ${yieldAmount} USDC`);
  console.log(`  Based on rate: ${currentRate / 100}% APY`);
}

function showCurrentState() {
  console.log("\n=== Current Oracle State ===");
  console.log(`  NAV: $${(Number(currentNAV) / 1e18).toFixed(6)}`);
  console.log(`  Interest Rate: ${currentRate / 100}% APY`);
  console.log(`  Total Updates: ${updateCount}`);
}

async function runContinuousSimulation() {
  console.log("\n=== Running 10 Continuous Updates ===\n");
  
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    simulateNAVUpdate();
    
    if (i % 3 === 0) {
      simulateRateUpdate();
    }
    
    if (i % 5 === 4) {
      simulateYieldDistribution();
    }
  }
  
  console.log("\n=== Simulation Complete ===");
  showCurrentState();
}

// ============== 链上更新函数 ==============

async function updateNAV(oracle: any) {
  simulateNAVUpdate();
  
  console.log("Submitting to chain...");
  const tx = await oracle.updateNAV(currentNAV);
  await tx.wait();
  console.log("✓ NAV updated on-chain. Tx:", tx.hash);
}

async function updateRate(oracle: any) {
  simulateRateUpdate();
  
  console.log("Submitting to chain...");
  const tx = await oracle.updateInterestRate(currentRate);
  await tx.wait();
  console.log("✓ Rate updated on-chain. Tx:", tx.hash);
}

async function distributeYield(oracle: any, usdc: any) {
  const amount = CONFIG.yieldAmount;
  
  // 检查 Oracle 合约余额
  const balance = await usdc.balanceOf(await oracle.getAddress());
  if (balance < amount) {
    console.log(`Oracle balance insufficient. Minting ${Number(amount) / 1e6} USDC...`);
    const mintTx = await usdc.mint(await oracle.getAddress(), amount);
    await mintTx.wait();
    console.log("✓ USDC minted to Oracle");
  }
  
  console.log(`Distributing ${Number(amount) / 1e6} USDC...`);
  const tx = await oracle.distributeYield(amount);
  await tx.wait();
  console.log("✓ Yield distributed. Tx:", tx.hash);
}

async function updateAll(oracle: any) {
  simulateNAVUpdate();
  simulateRateUpdate();
  
  console.log("Submitting to chain...");
  const tx = await oracle.updateAll(currentNAV, currentRate);
  await tx.wait();
  console.log("✓ All data updated on-chain. Tx:", tx.hash);
}

async function showOracleState(oracle: any) {
  const nav = await oracle.nav();
  const rate = await oracle.interestRate();
  const navUpdatedAt = await oracle.navUpdatedAt();
  const rateUpdatedAt = await oracle.rateUpdatedAt();
  const totalYield = await oracle.totalYieldDistributed();
  
  console.log("\n=== On-chain Oracle State ===");
  console.log(`  NAV: $${(Number(nav) / 1e18).toFixed(6)}`);
  console.log(`  NAV Updated: ${new Date(Number(navUpdatedAt) * 1000).toISOString()}`);
  console.log(`  Interest Rate: ${Number(rate) / 100}% APY`);
  console.log(`  Rate Updated: ${new Date(Number(rateUpdatedAt) * 1000).toISOString()}`);
  console.log(`  Total Yield Distributed: ${Number(totalYield) / 1e6} USDC`);
}

async function runAutoUpdateLoop(oracle: any) {
  console.log("\n=== Starting Auto-Update Loop (5 updates, 3s interval) ===\n");
  
  for (let i = 0; i < 5; i++) {
    console.log(`\n--- Update ${i + 1}/5 ---`);
    await updateAll(oracle);
    
    if (i < 4) {
      console.log("Waiting 3 seconds...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log("\n=== Auto-Update Complete ===");
  await showOracleState(oracle);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
