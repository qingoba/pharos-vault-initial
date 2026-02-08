import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const FEE_RECIPIENT = deployer.address;
  const YIELD_PROVIDER = deployer.address;
  const RWA_APY = 500; // 5%
  const LENDING_APY = 300; // 3%
  const WBTC_TO_USDC_RATE = 600n * 10n ** 18n; // 1 WBTC -> 60,000 USDC
  const WBNB_TO_USDC_RATE = 500n * 10n ** 6n; // 1 WBNB -> 500 USDC

  // Core tokens
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const wbtc = await MockERC20.deploy("Wrapped BTC", "WBTC", 8);
  await wbtc.waitForDeployment();
  const wbnb = await MockERC20.deploy("Wrapped BNB", "WBNB", 18);
  await wbnb.waitForDeployment();

  // Vault
  const PharosVault = await ethers.getContractFactory("PharosVault");
  const vault = await PharosVault.deploy(
    await usdc.getAddress(),
    "Pharos USDC Vault",
    "pvUSDC",
    FEE_RECIPIENT
  );
  await vault.waitForDeployment();

  // Strategies
  const MockRWAYieldStrategy = await ethers.getContractFactory("MockRWAYieldStrategy");
  const rwaStrategy = await MockRWAYieldStrategy.deploy(
    await vault.getAddress(),
    await usdc.getAddress(),
    RWA_APY,
    YIELD_PROVIDER
  );
  await rwaStrategy.waitForDeployment();

  const SimpleLendingStrategy = await ethers.getContractFactory("SimpleLendingStrategy");
  const lendingStrategy = await SimpleLendingStrategy.deploy(
    await vault.getAddress(),
    await usdc.getAddress(),
    LENDING_APY
  );
  await lendingStrategy.waitForDeployment();

  await (await vault.addStrategy(await rwaStrategy.getAddress(), 6000)).wait();
  await (await vault.addStrategy(await lendingStrategy.getAddress(), 4000)).wait();
  await (await vault.setStrategyAsync(await rwaStrategy.getAddress(), true)).wait();
  await (await vault.setPendingAPY(RWA_APY)).wait();
  await (await vault.setIdleAPY(0)).wait();

  // Swap router + multi-asset support
  const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
  const swapRouter = await MockSwapRouter.deploy();
  await swapRouter.waitForDeployment();
  await swapRouter.setRoute(await wbtc.getAddress(), await usdc.getAddress(), WBTC_TO_USDC_RATE, true);
  await swapRouter.setRoute(await wbnb.getAddress(), await usdc.getAddress(), WBNB_TO_USDC_RATE, true);

  await (await vault.setSwapRouter(await swapRouter.getAddress())).wait();
  await (await vault.setSupportedDepositAsset(await wbtc.getAddress(), true)).wait();
  await (await vault.setSupportedDepositAsset(await wbnb.getAddress(), true)).wait();

  // Advanced modules
  const MockRWAVault = await ethers.getContractFactory("MockRWAVault");
  const rwaVault = await MockRWAVault.deploy(await usdc.getAddress());
  await rwaVault.waitForDeployment();

  const RWAAdapterStrategy = await ethers.getContractFactory("RWAAdapterStrategy");
  const rwaAdapter = await RWAAdapterStrategy.deploy(
    await vault.getAddress(),
    await usdc.getAddress(),
    await rwaVault.getAddress(),
    RWA_APY
  );
  await rwaAdapter.waitForDeployment();

  const MockZkVerifier = await ethers.getContractFactory("MockZkVerifier");
  const zkVerifier = await MockZkVerifier.deploy();
  await zkVerifier.waitForDeployment();

  const PorRegistry = await ethers.getContractFactory("PorRegistry");
  const porRegistry = await PorRegistry.deploy(await zkVerifier.getAddress());
  await porRegistry.waitForDeployment();

  const PharosTimelock = await ethers.getContractFactory("PharosTimelock");
  const timelock = await PharosTimelock.deploy(
    86400,
    [deployer.address],
    [ethers.ZeroAddress],
    deployer.address
  );
  await timelock.waitForDeployment();

  const TrancheManager = await ethers.getContractFactory("TrancheManager");
  const trancheManager = await TrancheManager.deploy(
    await usdc.getAddress(),
    await vault.getAddress(),
    300
  );
  await trancheManager.waitForDeployment();

  // Test balances
  const mintAmount = ethers.parseUnits("1000000", 6);
  await usdc.mint(deployer.address, mintAmount);
  await usdc.mint(YIELD_PROVIDER, mintAmount);
  await usdc.mint(await swapRouter.getAddress(), ethers.parseUnits("100000000", 6));
  await wbtc.mint(deployer.address, 10n * 10n ** 8n);
  await wbnb.mint(deployer.address, ethers.parseUnits("5000", 18));
  await usdc.approve(await rwaStrategy.getAddress(), ethers.MaxUint256);

  console.log("\nDeployment complete:");
  console.log("USDC:", await usdc.getAddress());
  console.log("WBTC:", await wbtc.getAddress());
  console.log("WBNB:", await wbnb.getAddress());
  console.log("Vault:", await vault.getAddress());
  console.log("SwapRouter:", await swapRouter.getAddress());
  console.log("RWA Strategy:", await rwaStrategy.getAddress());
  console.log("Lending Strategy:", await lendingStrategy.getAddress());
  console.log("RWA Adapter:", await rwaAdapter.getAddress());
  console.log("PorRegistry:", await porRegistry.getAddress());
  console.log("Timelock:", await timelock.getAddress());
  console.log("TrancheManager:", await trancheManager.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
