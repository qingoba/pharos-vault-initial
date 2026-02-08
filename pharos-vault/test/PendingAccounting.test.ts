import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("PharosVault Pending Accounting", function () {
  const DEPOSIT_AMOUNT = ethers.parseUnits("10000", 6);
  const RWA_APY = 500; // 5%
  const LENDING_APY = 300; // 3%

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

    const MockRWAYieldStrategy = await ethers.getContractFactory("MockRWAYieldStrategy");
    const rwaStrategy = await MockRWAYieldStrategy.deploy(
      await vault.getAddress(),
      await usdc.getAddress(),
      RWA_APY,
      yieldProvider.address
    );
    await rwaStrategy.waitForDeployment();

    const SimpleLendingStrategy = await ethers.getContractFactory("SimpleLendingStrategy");
    const lendingStrategy = await SimpleLendingStrategy.deploy(
      await vault.getAddress(),
      await usdc.getAddress(),
      LENDING_APY
    );
    await lendingStrategy.waitForDeployment();

    await usdc.mint(user.address, DEPOSIT_AMOUNT * 10n);
    await usdc.mint(yieldProvider.address, DEPOSIT_AMOUNT * 10n);
    await usdc.connect(yieldProvider).approve(await rwaStrategy.getAddress(), ethers.MaxUint256);

    await vault.addStrategy(await rwaStrategy.getAddress(), 6000);
    await vault.addStrategy(await lendingStrategy.getAddress(), 4000);

    return { owner, user, vault, usdc, rwaStrategy, lendingStrategy };
  }

  it("queues async RWA allocation into pending bucket", async function () {
    const { user, vault, usdc, rwaStrategy, lendingStrategy } = await loadFixture(deployFixture);

    await vault.setStrategyAsync(await rwaStrategy.getAddress(), true);

    await usdc.connect(user).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
    await vault.connect(user).deposit(DEPOSIT_AMOUNT, user.address);

    expect(await vault.pendingAssets()).to.equal(ethers.parseUnits("6000", 6));
    expect(await vault.pendingAssetsByStrategy(await rwaStrategy.getAddress())).to.equal(
      ethers.parseUnits("6000", 6)
    );
    expect(await vault.deployedAssets()).to.equal(ethers.parseUnits("4000", 6));
    expect(await lendingStrategy.totalAssets()).to.equal(ethers.parseUnits("4000", 6));
  });

  it("executes pending investment when RWA trade settles", async function () {
    const { user, vault, usdc, rwaStrategy } = await loadFixture(deployFixture);

    await vault.setStrategyAsync(await rwaStrategy.getAddress(), true);
    await usdc.connect(user).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
    await vault.connect(user).deposit(DEPOSIT_AMOUNT, user.address);

    const executeAmount = ethers.parseUnits("2000", 6);
    await vault.executePendingInvestment(await rwaStrategy.getAddress(), executeAmount);

    expect(await vault.pendingAssets()).to.equal(ethers.parseUnits("4000", 6));
    expect(await vault.pendingAssetsByStrategy(await rwaStrategy.getAddress())).to.equal(
      ethers.parseUnits("4000", 6)
    );
    expect(await vault.deployedAssets()).to.equal(ethers.parseUnits("6000", 6));
    expect(await rwaStrategy.totalAssets()).to.be.gte(executeAmount);
  });

  it("releases pending reservations when withdrawal consumes pending liquidity", async function () {
    const { user, vault, usdc, rwaStrategy } = await loadFixture(deployFixture);

    await vault.setStrategyAsync(await rwaStrategy.getAddress(), true);
    await usdc.connect(user).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
    await vault.connect(user).deposit(DEPOSIT_AMOUNT, user.address);

    await vault.connect(user).withdraw(ethers.parseUnits("5000", 6), user.address, user.address);

    expect(await vault.pendingAssets()).to.equal(ethers.parseUnits("1000", 6));
    expect(await vault.pendingAssetsByStrategy(await rwaStrategy.getAddress())).to.equal(
      ethers.parseUnits("1000", 6)
    );
    expect(await vault.freeIdleAssets()).to.equal(0);
  });

  it("computes projected APY with pending and deployed buckets", async function () {
    const { user, vault, usdc, rwaStrategy } = await loadFixture(deployFixture);

    await vault.setStrategyAsync(await rwaStrategy.getAddress(), true);
    await vault.setPendingAPY(500); // pending bucket 5%
    await vault.setIdleAPY(100); // not used in this case (free idle is zero)

    await usdc.connect(user).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
    await vault.connect(user).deposit(DEPOSIT_AMOUNT, user.address);

    // 60% pending at 5% + 40% deployed at 3% => 4.2% (420 bps)
    expect(await vault.projectedAPY()).to.equal(420);
    expect(await vault.estimatedAPY()).to.equal(420);
  });

  it("updates realized APY from PPS movement after harvest", async function () {
    const { user, vault, usdc, rwaStrategy } = await loadFixture(deployFixture);

    await usdc.connect(user).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
    await vault.connect(user).deposit(DEPOSIT_AMOUNT, user.address);

    await time.increase(30 * 24 * 60 * 60);
    await vault.harvestStrategy(await rwaStrategy.getAddress());

    expect(await vault.realizedAPY()).to.be.gt(0);
    expect(await vault.maxDrawdownBps()).to.equal(0);
  });
});
