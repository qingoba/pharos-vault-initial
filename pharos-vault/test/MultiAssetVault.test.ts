import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("PharosVault Multi-Asset Deposits", function () {
  async function deployFixture() {
    const [owner, user, feeRecipient, yieldProvider] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const PharosVault = await ethers.getContractFactory("PharosVault");
    const vault = await PharosVault.deploy(
      await usdc.getAddress(),
      "Pharos USDC Vault",
      "pvUSDC",
      feeRecipient.address
    );
    await vault.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const wbtc = await MockERC20.deploy("Wrapped BTC", "WBTC", 8);
    await wbtc.waitForDeployment();
    const wbnb = await MockERC20.deploy("Wrapped BNB", "WBNB", 18);
    await wbnb.waitForDeployment();

    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    const router = await MockSwapRouter.deploy();
    await router.waitForDeployment();

    // WBTC (8d) -> USDC (6d): 1 WBTC => 60,000 USDC
    const WBTC_TO_USDC_RATE = 600n * 10n ** 18n;
    // WBNB (18d) -> USDC (6d): 1 WBNB => 500 USDC
    const WBNB_TO_USDC_RATE = 500n * 10n ** 6n;

    await router.setRoute(await wbtc.getAddress(), await usdc.getAddress(), WBTC_TO_USDC_RATE, true);
    await router.setRoute(await wbnb.getAddress(), await usdc.getAddress(), WBNB_TO_USDC_RATE, true);

    // Router liquidity for swap payouts
    await usdc.mint(await router.getAddress(), ethers.parseUnits("100000000", 6));

    // User balances
    await wbtc.mint(user.address, 10n * 10n ** 8n);
    await wbnb.mint(user.address, ethers.parseUnits("100", 18));
    await usdc.mint(user.address, ethers.parseUnits("100000", 6));
    await usdc.mint(yieldProvider.address, ethers.parseUnits("100000", 6));

    await vault.connect(owner).setSwapRouter(await router.getAddress());
    await vault.connect(owner).setSupportedDepositAsset(await wbtc.getAddress(), true);
    await vault.connect(owner).setSupportedDepositAsset(await wbnb.getAddress(), true);

    const SimpleLendingStrategy = await ethers.getContractFactory("SimpleLendingStrategy");
    const strategyA = await SimpleLendingStrategy.deploy(
      await vault.getAddress(),
      await usdc.getAddress(),
      300
    );
    await strategyA.waitForDeployment();
    const strategyB = await SimpleLendingStrategy.deploy(
      await vault.getAddress(),
      await usdc.getAddress(),
      500
    );
    await strategyB.waitForDeployment();

    return {
      owner,
      user,
      vault,
      usdc,
      wbtc,
      wbnb,
      router,
      strategyA,
      strategyB,
      feeRecipient,
      yieldProvider,
    };
  }

  it("swaps WBTC to USDC and mints vault shares", async function () {
    const { user, vault, wbtc } = await loadFixture(deployFixture);

    const amountIn = 1n * 10n ** 8n; // 1 WBTC
    const [assetsOut, sharesOut] = await vault.previewDepositAsset(await wbtc.getAddress(), amountIn);
    expect(assetsOut).to.equal(ethers.parseUnits("60000", 6));
    expect(sharesOut).to.equal(assetsOut);

    await wbtc.connect(user).approve(await vault.getAddress(), amountIn);
    await expect(
      vault.connect(user).depositAsset(await wbtc.getAddress(), amountIn, assetsOut, user.address)
    ).to.emit(vault, "MultiAssetDeposited");

    expect(await vault.balanceOf(user.address)).to.equal(sharesOut);
    expect(await vault.totalAssets()).to.equal(assetsOut);
  });

  it("automatically allocates swapped USDC by strategy debt ratios", async function () {
    const { owner, user, vault, usdc, wbnb, strategyA, strategyB } = await loadFixture(deployFixture);

    await vault.connect(owner).addStrategy(await strategyA.getAddress(), 6000);
    await vault.connect(owner).addStrategy(await strategyB.getAddress(), 4000);

    const amountIn = ethers.parseUnits("10", 18); // 10 WBNB -> 5,000 USDC
    const [assetsOut] = await vault.previewDepositAsset(await wbnb.getAddress(), amountIn);
    expect(assetsOut).to.equal(ethers.parseUnits("5000", 6));

    await wbnb.connect(user).approve(await vault.getAddress(), amountIn);
    await vault.connect(user).depositAsset(await wbnb.getAddress(), amountIn, assetsOut, user.address);

    const strategyABalance = await strategyA.totalAssets();
    const strategyBBalance = await strategyB.totalAssets();

    // 60/40 with integer rounding
    expect(strategyABalance).to.equal((assetsOut * 6000n) / 10000n);
    expect(strategyBBalance).to.equal((assetsOut * 4000n) / 10000n);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(
      assetsOut - strategyABalance - strategyBBalance
    );
  });

  it("reverts for unsupported deposit asset", async function () {
    const { user, vault } = await loadFixture(deployFixture);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const randomToken = await MockERC20.deploy("Random", "RND", 18);
    await randomToken.waitForDeployment();
    await randomToken.mint(user.address, ethers.parseUnits("100", 18));

    const amountIn = ethers.parseUnits("1", 18);
    await randomToken.connect(user).approve(await vault.getAddress(), amountIn);

    await expect(
      vault.connect(user).depositAsset(await randomToken.getAddress(), amountIn, 0, user.address)
    ).to.be.revertedWithCustomError(vault, "UnsupportedDepositAsset");
  });

  it("enforces min output check", async function () {
    const { user, vault, wbnb } = await loadFixture(deployFixture);

    const amountIn = ethers.parseUnits("1", 18); // quote = 500 USDC
    const minOutTooHigh = ethers.parseUnits("700", 6);

    await wbnb.connect(user).approve(await vault.getAddress(), amountIn);

    await expect(
      vault.connect(user).depositAsset(await wbnb.getAddress(), amountIn, minOutTooHigh, user.address)
    ).to.be.revertedWith("Slippage too high");
  });

  it("supports direct USDC via depositAsset", async function () {
    const { user, vault, usdc } = await loadFixture(deployFixture);

    const amountIn = ethers.parseUnits("1000", 6);
    await usdc.connect(user).approve(await vault.getAddress(), amountIn);

    const [, previewShares] = await vault.previewDepositAsset(await usdc.getAddress(), amountIn);
    await vault.connect(user).depositAsset(await usdc.getAddress(), amountIn, amountIn, user.address);

    expect(await vault.balanceOf(user.address)).to.equal(previewShares);
    expect(await vault.totalAssets()).to.equal(amountIn);
  });
});

