import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // ===================== 部署参数 =====================
  const FEE_RECIPIENT = deployer.address;  // 费用接收地址 (可以修改为多签钱包)
  const YIELD_PROVIDER = deployer.address; // 收益提供者 (测试用)
  const RWA_APY = 500;  // 5% 年化收益率
  const LENDING_APY = 300;  // 3% 年化收益率

  console.log("\n===================== 开始部署 =====================\n");

  // ===================== 1. 部署 MockUSDC =====================
  console.log("1. 部署 MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("   MockUSDC 部署成功:", usdcAddress);

  // ===================== 2. 部署 PharosVault =====================
  console.log("\n2. 部署 PharosVault...");
  const PharosVault = await ethers.getContractFactory("PharosVault");
  const vault = await PharosVault.deploy(
    usdcAddress,
    "Pharos USDC Vault",
    "pvUSDC",
    FEE_RECIPIENT
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   PharosVault 部署成功:", vaultAddress);

  // ===================== 3. 部署 RWA 策略 =====================
  console.log("\n3. 部署 MockRWAYieldStrategy...");
  const MockRWAYieldStrategy = await ethers.getContractFactory("MockRWAYieldStrategy");
  const rwaStrategy = await MockRWAYieldStrategy.deploy(
    vaultAddress,
    usdcAddress,
    RWA_APY,
    YIELD_PROVIDER
  );
  await rwaStrategy.waitForDeployment();
  const rwaStrategyAddress = await rwaStrategy.getAddress();
  console.log("   RWA 策略部署成功:", rwaStrategyAddress);

  // ===================== 4. 部署 Lending 策略 =====================
  console.log("\n4. 部署 SimpleLendingStrategy...");
  const SimpleLendingStrategy = await ethers.getContractFactory("SimpleLendingStrategy");
  const lendingStrategy = await SimpleLendingStrategy.deploy(
    vaultAddress,
    usdcAddress,
    LENDING_APY
  );
  await lendingStrategy.waitForDeployment();
  const lendingStrategyAddress = await lendingStrategy.getAddress();
  console.log("   Lending 策略部署成功:", lendingStrategyAddress);

  // ===================== 5. 配置 Vault =====================
  console.log("\n5. 配置 Vault...");

  // 添加 RWA 策略 (分配 60% 的资金)
  const tx1 = await vault.addStrategy(rwaStrategyAddress, 6000);
  await tx1.wait();
  console.log("   已添加 RWA 策略 (60% 份额)");

  // 添加 Lending 策略 (分配 40% 的资金)
  const tx2 = await vault.addStrategy(lendingStrategyAddress, 4000);
  await tx2.wait();
  console.log("   已添加 Lending 策略 (40% 份额)");

  // ===================== 5b. 部署 MockRWAVault + RWAAdapterStrategy =====================
  console.log("\n5b. 部署 MockRWAVault & RWAAdapterStrategy...");
  const MockRWAVault = await ethers.getContractFactory("MockRWAVault");
  const rwaVault = await MockRWAVault.deploy(usdcAddress);
  await rwaVault.waitForDeployment();
  const rwaVaultAddress = await rwaVault.getAddress();
  console.log("   MockRWAVault 部署成功:", rwaVaultAddress);

  const RWAAdapter = await ethers.getContractFactory("RWAAdapterStrategy");
  const rwaAdapter = await RWAAdapter.deploy(vaultAddress, usdcAddress, rwaVaultAddress, RWA_APY);
  await rwaAdapter.waitForDeployment();
  const rwaAdapterAddress = await rwaAdapter.getAddress();
  console.log("   RWAAdapterStrategy 部署成功:", rwaAdapterAddress);

  // ===================== 5c. 部署 zk-POR (MockZkVerifier + PorRegistry) =====================
  console.log("\n5c. 部署 zk-POR 系统...");
  const MockZkVerifier = await ethers.getContractFactory("MockZkVerifier");
  const zkVerifier = await MockZkVerifier.deploy();
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log("   MockZkVerifier 部署成功:", zkVerifierAddress);

  const PorRegistry = await ethers.getContractFactory("PorRegistry");
  const porRegistry = await PorRegistry.deploy(zkVerifierAddress);
  await porRegistry.waitForDeployment();
  const porRegistryAddress = await porRegistry.getAddress();
  console.log("   PorRegistry 部署成功:", porRegistryAddress);

  // ===================== 5d. 部署 PharosTimelock =====================
  console.log("\n5d. 部署 PharosTimelock...");
  const PharosTimelock = await ethers.getContractFactory("PharosTimelock");
  const timelock = await PharosTimelock.deploy(
    86400,                             // 24h delay
    [deployer.address],                // proposers
    [ethers.ZeroAddress],              // anyone can execute
    deployer.address                   // admin
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("   PharosTimelock 部署成功:", timelockAddress);

  // ===================== 5e. 部署 TrancheManager =====================
  console.log("\n5e. 部署 TrancheManager...");
  const TrancheManager = await ethers.getContractFactory("TrancheManager");
  const trancheManager = await TrancheManager.deploy(usdcAddress, vaultAddress, 300);
  await trancheManager.waitForDeployment();
  const trancheManagerAddress = await trancheManager.getAddress();
  console.log("   TrancheManager 部署成功:", trancheManagerAddress);

  // ===================== 6. 铸造测试代币 =====================
  console.log("\n6. 铸造测试代币...");
  const mintAmount = ethers.parseUnits("1000000", 6); // 100万 USDC
  await usdc.mint(deployer.address, mintAmount);
  console.log("   已为部署者铸造 1,000,000 USDC");

  // 为 yield provider 铸造代币 (用于模拟收益分发)
  await usdc.mint(YIELD_PROVIDER, mintAmount);
  console.log("   已为收益提供者铸造 1,000,000 USDC");

  // 授权 RWA 策略从 yield provider 拉取代币
  await usdc.approve(rwaStrategyAddress, ethers.MaxUint256);
  console.log("   已授权 RWA 策略拉取代币");

  // ===================== 部署完成 =====================
  console.log("\n===================== 部署完成 =====================\n");
  console.log("合约地址汇总:");
  console.log("├── MockUSDC:              ", usdcAddress);
  console.log("├── PharosVault:           ", vaultAddress);
  console.log("├── MockRWAYieldStrategy:  ", rwaStrategyAddress);
  console.log("├── SimpleLendingStrategy: ", lendingStrategyAddress);
  console.log("├── MockRWAVault:          ", rwaVaultAddress);
  console.log("├── RWAAdapterStrategy:    ", rwaAdapterAddress);
  console.log("├── MockZkVerifier:        ", zkVerifierAddress);
  console.log("├── PorRegistry:           ", porRegistryAddress);
  console.log("├── PharosTimelock:        ", timelockAddress);
  console.log("└── TrancheManager:        ", trancheManagerAddress);
  
  console.log("\n配置信息:");
  console.log("├── 费用接收地址:         ", FEE_RECIPIENT);
  console.log("├── 管理费:               ", await vault.managementFee(), "基点 (2%)");
  console.log("├── 绩效费:               ", await vault.performanceFee(), "基点 (10%)");
  console.log("├── RWA 策略 APY:         ", RWA_APY, "基点 (5%)");
  console.log("└── Lending 策略 APY:     ", LENDING_APY, "基点 (3%)");

  console.log("\n接下来可以:");
  console.log("1. 调用 usdc.approve(vault, amount) 授权 Vault");
  console.log("2. 调用 vault.deposit(amount, your_address) 存入资金");
  console.log("3. 调用 vault.allocateToStrategy(strategy, amount) 分配资金到策略");
  console.log("4. 调用 vault.harvestAll() 收获所有策略的收益");
  console.log("5. 调用 vault.withdraw(amount, your_address, your_address) 提取资金");

  // 返回部署信息
  return {
    usdc: usdcAddress,
    vault: vaultAddress,
    rwaStrategy: rwaStrategyAddress,
    lendingStrategy: lendingStrategyAddress,
    rwaVault: rwaVaultAddress,
    rwaAdapter: rwaAdapterAddress,
    zkVerifier: zkVerifierAddress,
    porRegistry: porRegistryAddress,
    timelock: timelockAddress,
    trancheManager: trancheManagerAddress,
  };
}

main()
  .then((addresses) => {
    console.log("\n部署脚本执行成功!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
