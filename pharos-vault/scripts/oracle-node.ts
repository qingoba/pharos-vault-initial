import { ethers } from "hardhat";
import * as readline from "readline";

/**
 * RWA Oracle Node - 模拟预言机节点
 * 
 * 功能:
 * 1. 定时更新 NAV (模拟每日增长)
 * 2. 定时更新利率 (模拟市场波动)
 * 3. 定时分发收益 (模拟月度利息)
 * 
 * 使用: npx hardhat run scripts/oracle-node.ts --network localhost
 */

// 配置
const CONFIG = {
  oracleAddress: process.env.ORACLE_ADDRESS || "",
  usdcAddress: process.env.USDC_ADDRESS || "",
  
  // Mock 数据参数
  initialNAV: 1_000_000_000_000_000_000n,  // 1e18 = $1.00
  navDailyGrowth: 137n,  // 每日增长 0.0137% ≈ 5% APY
  
  initialRate: 500,  // 5% APY
  rateVariance: 50,  // ±0.5% 波动
  
  yieldAmount: 1000_000_000n,  // 每次分发 1000 USDC (6 decimals)
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
  if (!CONFIG.oracleAddress) {
    console.log("\n⚠️  No ORACLE_ADDRESS configured. Running in demo mode.\n");
    await runDemoMode();
    return;
  }
  
  const oracle = await ethers.getContractAt("RWAOracle", CONFIG.oracleAddress, signer);
  const usdc = await ethers.getContractAt("MockUSDC", CONFIG.usdcAddress, signer);
  
  console.log("Oracle:", CONFIG.oracleAddress);
  console.log("USDC:", CONFIG.usdcAddress);
  
  await runInteractiveMode(oracle, usdc);
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
async function runInteractiveMode(oracle: any, usdc: any) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const prompt = () => {
    console.log("\nCommands:");
    console.log("  1. Update NAV");
    console.log("  2. Update interest rate");
    console.log("  3. Distribute yield");
    console.log("  4. Update all (NAV + rate)");
    console.log("  5. Show oracle state");
    console.log("  6. Run auto-update loop");
    console.log("  q. Quit\n");
    
    rl.question("Enter command: ", async (answer) => {
      try {
        switch (answer.trim()) {
          case "1":
            await updateNAV(oracle);
            break;
          case "2":
            await updateRate(oracle);
            break;
          case "3":
            await distributeYield(oracle, usdc);
            break;
          case "4":
            await updateAll(oracle);
            break;
          case "5":
            await showOracleState(oracle);
            break;
          case "6":
            await runAutoUpdateLoop(oracle);
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
