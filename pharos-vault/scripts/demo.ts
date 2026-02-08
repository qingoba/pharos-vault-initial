import { ethers } from "hardhat";

/**
 * Multi-asset demo:
 * 1) User deposits WBTC/WBNB
 * 2) Vault swaps all inputs to USDC
 * 3) RWA leg is queued as pending (async settlement)
 * 4) Operator later executes pending investment into RWA strategy
 */
async function main() {
  const [deployer, user, feeRecipient, yieldProvider] = await ethers.getSigners();

  console.log("=== Pharos Vault Multi-Asset Demo ===");
  console.log("Deployer:", deployer.address);
  console.log("User:", user.address);

  // 1) Deploy base assets
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const wbtc = await MockERC20.deploy("Wrapped BTC", "WBTC", 8);
  await wbtc.waitForDeployment();
  const wbnb = await MockERC20.deploy("Wrapped BNB", "WBNB", 18);
  await wbnb.waitForDeployment();

  // 2) Deploy vault
  const PharosVault = await ethers.getContractFactory("PharosVault");
  const vault = await PharosVault.deploy(
    await usdc.getAddress(),
    "Pharos USDC Vault",
    "pvUSDC",
    feeRecipient.address
  );
  await vault.waitForDeployment();

  // 3) Deploy strategies (RWA async 60% + Lending 40%)
  const MockRWAYieldStrategy = await ethers.getContractFactory("MockRWAYieldStrategy");
  const strategyA = await MockRWAYieldStrategy.deploy(
    await vault.getAddress(),
    await usdc.getAddress(),
    500, // 5%
    yieldProvider.address
  );
  await strategyA.waitForDeployment();

  const SimpleLendingStrategy = await ethers.getContractFactory("SimpleLendingStrategy");
  const strategyB = await SimpleLendingStrategy.deploy(
    await vault.getAddress(),
    await usdc.getAddress(),
    300 // 3%
  );
  await strategyB.waitForDeployment();

  await vault.addStrategy(await strategyA.getAddress(), 6000);
  await vault.addStrategy(await strategyB.getAddress(), 4000);
  await vault.setStrategyAsync(await strategyA.getAddress(), true);
  await vault.setPendingAPY(500);
  await vault.setIdleAPY(0);

  // 4) Deploy + configure swap router
  const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
  const router = await MockSwapRouter.deploy();
  await router.waitForDeployment();

  // Rate precision is 1e18.
  // 1 WBTC (1e8) -> 60,000 USDC (6d) => rate = 600 * 1e18
  const WBTC_TO_USDC_RATE = 600n * 10n ** 18n;
  // 1 WBNB (1e18) -> 500 USDC (6d) => rate = 500e6
  const WBNB_TO_USDC_RATE = 500n * 10n ** 6n;

  await router.setRoute(await wbtc.getAddress(), await usdc.getAddress(), WBTC_TO_USDC_RATE, true);
  await router.setRoute(await wbnb.getAddress(), await usdc.getAddress(), WBNB_TO_USDC_RATE, true);

  await vault.setSwapRouter(await router.getAddress());
  await vault.setSupportedDepositAsset(await wbtc.getAddress(), true);
  await vault.setSupportedDepositAsset(await wbnb.getAddress(), true);

  // Router payout liquidity
  await usdc.mint(await router.getAddress(), ethers.parseUnits("100000000", 6));

  // User balances
  await wbtc.mint(user.address, 2n * 10n ** 8n); // 2 WBTC
  await wbnb.mint(user.address, ethers.parseUnits("20", 18)); // 20 WBNB
  await usdc.mint(yieldProvider.address, ethers.parseUnits("1000000", 6));
  await usdc.connect(yieldProvider).approve(await strategyA.getAddress(), ethers.MaxUint256);

  console.log("Contracts deployed:");
  console.log("  USDC:", await usdc.getAddress());
  console.log("  WBTC:", await wbtc.getAddress());
  console.log("  WBNB:", await wbnb.getAddress());
  console.log("  Vault:", await vault.getAddress());
  console.log("  Router:", await router.getAddress());
  console.log("  StrategyA:", await strategyA.getAddress(), "(RWA async 60%)");
  console.log("  StrategyB:", await strategyB.getAddress(), "(Lending 40%)");

  // 5) User deposits WBTC
  const wbtcIn = 1n * 10n ** 8n;
  const [wbtcAssetsOut] = await vault.previewDepositAsset(await wbtc.getAddress(), wbtcIn);
  await wbtc.connect(user).approve(await vault.getAddress(), wbtcIn);
  await vault.connect(user).depositAsset(await wbtc.getAddress(), wbtcIn, wbtcAssetsOut, user.address);

  console.log("\nAfter 1 WBTC deposit:");
  console.log("  USDC converted:", ethers.formatUnits(wbtcAssetsOut, 6));
  console.log("  User shares:", ethers.formatUnits(await vault.balanceOf(user.address), 6));
  console.log("  Pending assets:", ethers.formatUnits(await vault.pendingAssets(), 6));
  console.log("  StrategyA (RWA) assets:", ethers.formatUnits(await strategyA.totalAssets(), 6));
  console.log("  StrategyB assets:", ethers.formatUnits(await strategyB.totalAssets(), 6));

  // 6) User deposits WBNB
  const wbnbIn = ethers.parseUnits("10", 18);
  const [wbnbAssetsOut] = await vault.previewDepositAsset(await wbnb.getAddress(), wbnbIn);
  await wbnb.connect(user).approve(await vault.getAddress(), wbnbIn);
  await vault.connect(user).depositAsset(await wbnb.getAddress(), wbnbIn, wbnbAssetsOut, user.address);

  console.log("\nAfter 10 WBNB deposit:");
  console.log("  USDC converted:", ethers.formatUnits(wbnbAssetsOut, 6));
  console.log("  Vault total assets:", ethers.formatUnits(await vault.totalAssets(), 6));
  console.log("  Vault idle assets:", ethers.formatUnits(await vault.idleAssets(), 6));
  console.log("  Vault pending assets:", ethers.formatUnits(await vault.pendingAssets(), 6));
  console.log("  Vault free idle assets:", ethers.formatUnits(await vault.freeIdleAssets(), 6));
  console.log("  StrategyA (RWA) assets:", ethers.formatUnits(await strategyA.totalAssets(), 6));
  console.log("  StrategyB assets:", ethers.formatUnits(await strategyB.totalAssets(), 6));
  console.log("  Projected vault APY (pending-aware):", Number(await vault.projectedAPY()) / 100, "%");

  // 7) Simulate delayed RWA settlement, then execute pending
  await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
  await ethers.provider.send("evm_mine", []);

  const pendingBeforeExec = await vault.pendingAssetsByStrategy(await strategyA.getAddress());
  await vault.executePendingInvestment(await strategyA.getAddress(), pendingBeforeExec);

  console.log("\nAfter executing pending RWA settlement (+24h):");
  console.log("  Vault pending assets:", ethers.formatUnits(await vault.pendingAssets(), 6));
  console.log("  StrategyA (RWA) assets:", ethers.formatUnits(await strategyA.totalAssets(), 6));
  console.log("  StrategyB assets:", ethers.formatUnits(await strategyB.totalAssets(), 6));
  console.log("  Projected vault APY:", Number(await vault.projectedAPY()) / 100, "%");

  // 8) User redeem 20%
  const userShares = await vault.balanceOf(user.address);
  const redeemShares = userShares / 5n;
  await vault.connect(user).redeem(redeemShares, user.address, user.address);

  console.log("\nAfter redeeming 20% shares:");
  console.log("  Remaining shares:", ethers.formatUnits(await vault.balanceOf(user.address), 6));
  console.log("  User USDC balance:", ethers.formatUnits(await usdc.balanceOf(user.address), 6));
  console.log("  Vault total assets:", ethers.formatUnits(await vault.totalAssets(), 6));

  console.log("\nDemo completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
