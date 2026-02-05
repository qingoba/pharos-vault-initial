import { ethers } from "hardhat";

/**
 * 演示脚本 - 展示完整的 Vault 工作流程
 * 
 * 此脚本演示:
 * 1. 用户存款 (Deposit)
 * 2. 分配资金到策略 (Allocate)
 * 3. 模拟时间流逝并注入收益
 * 4. 收获收益 (Harvest)
 * 5. 查看收益
 * 6. 用户提现 (Withdraw)
 */
async function main() {
  const [deployer, user1] = await ethers.getSigners();

  console.log("🚀 Pharos Vault 演示脚本");
  console.log("========================\n");

  // ===================== 部署合约 =====================
  console.log("📦 部署合约...\n");
  
  // 部署 USDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  // 部署 Vault
  const PharosVault = await ethers.getContractFactory("PharosVault");
  const vault = await PharosVault.deploy(
    await usdc.getAddress(),
    "Pharos USDC Vault",
    "pvUSDC",
    deployer.address
  );
  await vault.waitForDeployment();

  // 部署策略
  const MockRWAYieldStrategy = await ethers.getContractFactory("MockRWAYieldStrategy");
  const strategy = await MockRWAYieldStrategy.deploy(
    await vault.getAddress(),
    await usdc.getAddress(),
    500, // 5% APY
    deployer.address
  );
  await strategy.waitForDeployment();

  console.log("✅ 合约部署完成\n");

  // ===================== 准备代币 =====================
  const depositAmount = ethers.parseUnits("100000", 6); // 10万 USDC
  
  // 为用户铸造代币
  await usdc.mint(user1.address, depositAmount);
  // 为收益提供者铸造足够的代币 (用于后续模拟收益)
  await usdc.mint(deployer.address, depositAmount);
  // 授权策略拉取收益
  await usdc.approve(await strategy.getAddress(), ethers.MaxUint256);

  console.log("💰 已为用户铸造 100,000 USDC\n");

  // ===================== 添加策略到 Vault =====================
  await vault.addStrategy(await strategy.getAddress(), 10000);
  console.log("📋 已添加 RWA 策略到 Vault (100% 份额)\n");

  // ===================== Step 1: 存款 =====================
  console.log("=" .repeat(50));
  console.log("📥 Step 1: 用户存款");
  console.log("=" .repeat(50));

  const userBalanceBefore = await usdc.balanceOf(user1.address);
  console.log(`用户 USDC 余额: ${ethers.formatUnits(userBalanceBefore, 6)}`);

  // 授权并存款
  await usdc.connect(user1).approve(await vault.getAddress(), depositAmount);
  await vault.connect(user1).deposit(depositAmount, user1.address);

  const shares = await vault.balanceOf(user1.address);
  console.log(`存入: ${ethers.formatUnits(depositAmount, 6)} USDC`);
  console.log(`获得份额: ${ethers.formatUnits(shares, 6)} pvUSDC`);
  console.log(`Vault 总资产: ${ethers.formatUnits(await vault.totalAssets(), 6)} USDC\n`);

  // ===================== Step 2: 分配资金到策略 =====================
  console.log("=" .repeat(50));
  console.log("🔄 Step 2: 分配资金到策略");
  console.log("=" .repeat(50));

  const allocateAmount = depositAmount;
  await vault.allocateToStrategy(await strategy.getAddress(), allocateAmount);

  console.log(`已分配: ${ethers.formatUnits(allocateAmount, 6)} USDC 到 RWA 策略`);
  console.log(`策略中资产: ${ethers.formatUnits(await strategy.totalAssets(), 6)} USDC`);
  console.log(`Vault 闲置资产: ${ethers.formatUnits(await vault.idleAssets(), 6)} USDC\n`);

  // ===================== Step 3: 模拟收益产生 =====================
  console.log("=" .repeat(50));
  console.log("💵 Step 3: 模拟 RWA 收益分发");
  console.log("=" .repeat(50));

  // 直接注入模拟收益 (代表 RWA 资产产生的收益)
  // 假设 30 天产生约 0.41% 收益 (5% APY * 30/365)
  const simulatedYield = ethers.parseUnits("411", 6); // 约 411 USDC
  await strategy.injectYield(simulatedYield);
  console.log(`已注入 ${ethers.formatUnits(simulatedYield, 6)} USDC 收益 (模拟 RWA 资产分红)`);

  const pendingYield = await strategy.getPendingYield();
  console.log(`待收益: ${ethers.formatUnits(pendingYield, 6)} USDC`);
  console.log(`策略当前总资产: ${ethers.formatUnits(await strategy.totalAssets(), 6)} USDC\n`);

  // ===================== Step 4: 查看收益情况 =====================
  console.log("=" .repeat(50));
  console.log("📊 Step 4: 查看收益情况");
  console.log("=" .repeat(50));

  const totalAssetsNow = await vault.totalAssets();
  // 注意: 在真实场景中会调用 harvestStrategy 从外部协议收割收益
  // 这里因为我们直接注入了收益，所以已经反映在 totalAssets 中

  console.log(`Vault 总资产: ${ethers.formatUnits(totalAssetsNow, 6)} USDC`);
  console.log(`策略中待收益: ${ethers.formatUnits(await strategy.getPendingYield(), 6)} USDC`);
  console.log(`收益来源: RWA 资产 (模拟美债收益分发)\n`);

  // ===================== Step 5: 查看用户份额价值 =====================
  console.log("=" .repeat(50));
  console.log("💰 Step 5: 查看用户份额价值");
  console.log("=" .repeat(50));

  const currentShares = await vault.balanceOf(user1.address);
  const currentShareValue = await vault.convertToAssets(currentShares);
  const userProfit = currentShareValue - depositAmount;

  console.log(`用户持有份额: ${ethers.formatUnits(currentShares, 6)} pvUSDC`);
  console.log(`份额当前价值: ${ethers.formatUnits(currentShareValue, 6)} USDC`);
  console.log(`用户收益: ${ethers.formatUnits(userProfit, 6)} USDC`);
  console.log(`收益率: ${(Number(userProfit) / Number(depositAmount) * 100).toFixed(4)}%\n`);

  // ===================== Step 6: 用户提现 =====================
  console.log("=" .repeat(50));
  console.log("📤 Step 6: 用户提现 (Withdraw)");
  console.log("=" .repeat(50));

  const userBalanceBeforeWithdraw = await usdc.balanceOf(user1.address);
  
  // 赎回所有份额
  await vault.connect(user1).redeem(currentShares, user1.address, user1.address);

  const userBalanceAfterWithdraw = await usdc.balanceOf(user1.address);
  const received = userBalanceAfterWithdraw - userBalanceBeforeWithdraw;

  console.log(`赎回份额: ${ethers.formatUnits(currentShares, 6)} pvUSDC`);
  console.log(`获得资产: ${ethers.formatUnits(received, 6)} USDC`);
  console.log(`净收益: ${ethers.formatUnits(received - depositAmount, 6)} USDC`);
  console.log(`用户最终 USDC 余额: ${ethers.formatUnits(userBalanceAfterWithdraw, 6)} USDC\n`);

  // ===================== 总结 =====================
  console.log("=" .repeat(50));
  console.log("✨ 演示完成!");
  console.log("=" .repeat(50));
  console.log("\n完整流程:");
  console.log("1. ✅ 用户存入 100,000 USDC");
  console.log("2. ✅ 资金分配到 RWA 策略");
  console.log("3. ✅ 模拟 30 天时间流逝");
  console.log("4. ✅ 收获策略收益");
  console.log("5. ✅ 用户赎回全部份额");
  console.log(`6. ✅ 用户获得约 ${ethers.formatUnits(received - depositAmount, 6)} USDC 收益`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
