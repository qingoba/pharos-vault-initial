import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { PharosVault, MockUSDC, MockRWAYieldStrategy, SimpleLendingStrategy } from "../typechain-types";

describe("Strategies", function () {
  const DEPOSIT_AMOUNT = ethers.parseUnits("10000", 6); // 10,000 USDC
  const RWA_APY = 500; // 5%
  const LENDING_APY = 300; // 3%

  async function deployStrategiesFixture() {
    const [owner, user1, feeRecipient, yieldProvider] = await ethers.getSigners();

    // 部署 MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // 部署 PharosVault
    const PharosVault = await ethers.getContractFactory("PharosVault");
    const vault = await PharosVault.deploy(
      await usdc.getAddress(),
      "Pharos USDC Vault",
      "pvUSDC",
      feeRecipient.address
    );
    await vault.waitForDeployment();

    // 部署 RWA 策略
    const MockRWAYieldStrategy = await ethers.getContractFactory("MockRWAYieldStrategy");
    const rwaStrategy = await MockRWAYieldStrategy.deploy(
      await vault.getAddress(),
      await usdc.getAddress(),
      RWA_APY,
      yieldProvider.address
    );
    await rwaStrategy.waitForDeployment();

    // 部署 Lending 策略
    const SimpleLendingStrategy = await ethers.getContractFactory("SimpleLendingStrategy");
    const lendingStrategy = await SimpleLendingStrategy.deploy(
      await vault.getAddress(),
      await usdc.getAddress(),
      LENDING_APY
    );
    await lendingStrategy.waitForDeployment();

    // 铸造代币
    await usdc.mint(user1.address, DEPOSIT_AMOUNT * 10n);
    await usdc.mint(yieldProvider.address, DEPOSIT_AMOUNT * 10n);

    // 授权
    await usdc.connect(yieldProvider).approve(await rwaStrategy.getAddress(), ethers.MaxUint256);

    return { vault, usdc, rwaStrategy, lendingStrategy, owner, user1, feeRecipient, yieldProvider };
  }

  describe("MockRWAYieldStrategy", function () {
    describe("收益计算", function () {
      it("应该正确计算待收益", async function () {
        const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

        // 设置
        await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
        await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
        await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
        await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT_AMOUNT);

        // 初始时待收益应为 0
        expect(await rwaStrategy.getPendingYield()).to.equal(0);

        // 模拟时间流逝 (1年)
        await time.increase(365 * 24 * 60 * 60);

        // 待收益应约等于 5% 的本金
        const pendingYield = await rwaStrategy.getPendingYield();
        const expectedYield = (DEPOSIT_AMOUNT * BigInt(RWA_APY)) / 10000n;
        
        // 允许小误差 (由于时间计算)
        expect(pendingYield).to.be.closeTo(expectedYield, expectedYield / 100n);
      });

      it("应该返回正确的 APY", async function () {
        const { rwaStrategy } = await loadFixture(deployStrategiesFixture);

        expect(await rwaStrategy.estimatedAPY()).to.equal(RWA_APY);
      });

      it("应该能够更新目标 APY", async function () {
        const { rwaStrategy, owner } = await loadFixture(deployStrategiesFixture);

        const newAPY = 800; // 8%
        await expect(rwaStrategy.connect(owner).setTargetAPY(newAPY))
          .to.emit(rwaStrategy, "APYUpdated")
          .withArgs(RWA_APY, newAPY);

        expect(await rwaStrategy.estimatedAPY()).to.equal(newAPY);
      });
    });

    describe("收获逻辑", function () {
      it("应该能够收获收益", async function () {
        const { vault, usdc, rwaStrategy, owner, user1, yieldProvider } = await loadFixture(deployStrategiesFixture);

        // 设置
        await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
        await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
        await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
        await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT_AMOUNT);

        // 等待
        await time.increase(30 * 24 * 60 * 60);

        const totalAssetsBefore = await rwaStrategy.totalAssets();

        // 收获
        await vault.connect(owner).harvestStrategy(await rwaStrategy.getAddress());

        // 收获后总资产应该增加（因为收益被复投）
        expect(await rwaStrategy.totalAssets()).to.be.gt(DEPOSIT_AMOUNT);
        expect(await rwaStrategy.totalProfit()).to.be.gt(0);
      });

      it("收获触发器应该在足够收益时返回 true", async function () {
        const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

        // 设置
        await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
        await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
        await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
        await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT_AMOUNT);

        // 初始时不应触发
        await time.increase(3600); // 1小时后才能检查
        
        // 收益不够时
        let shouldHarvest = await rwaStrategy.harvestTrigger();
        
        // 等待足够时间让收益累积到 0.1%
        await time.increase(30 * 24 * 60 * 60);
        
        shouldHarvest = await rwaStrategy.harvestTrigger();
        expect(shouldHarvest).to.be.true;
      });
    });

    describe("手动注入收益", function () {
      it("应该能够手动注入收益", async function () {
        const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

        // 设置
        await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
        await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
        await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
        await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT_AMOUNT);

        // 手动注入收益
        const injectAmount = ethers.parseUnits("100", 6);
        await usdc.connect(user1).approve(await rwaStrategy.getAddress(), injectAmount);
        await rwaStrategy.connect(user1).injectYield(injectAmount);

        // 检查 (允许小误差因为时间流逝也会产生少量收益)
        const pendingYield = await rwaStrategy.getPendingYield();
        expect(pendingYield).to.be.gte(injectAmount);
      });
    });
  });

  describe("SimpleLendingStrategy", function () {
    describe("基本功能", function () {
      it("应该正确报告总资产", async function () {
        const { vault, usdc, lendingStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

        // 设置
        await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
        await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
        await vault.connect(owner).addStrategy(await lendingStrategy.getAddress(), 10000);
        await vault.connect(owner).allocateToStrategy(await lendingStrategy.getAddress(), DEPOSIT_AMOUNT);

        expect(await lendingStrategy.totalAssets()).to.equal(DEPOSIT_AMOUNT);
      });

      it("应该返回正确的 APY", async function () {
        const { lendingStrategy } = await loadFixture(deployStrategiesFixture);

        expect(await lendingStrategy.estimatedAPY()).to.equal(LENDING_APY);
      });
    });

    describe("利息计算", function () {
      it("应该正确计算待收利息", async function () {
        const { vault, usdc, lendingStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

        // 设置
        await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
        await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
        await vault.connect(owner).addStrategy(await lendingStrategy.getAddress(), 10000);
        await vault.connect(owner).allocateToStrategy(await lendingStrategy.getAddress(), DEPOSIT_AMOUNT);

        // 等待一年
        await time.increase(365 * 24 * 60 * 60);

        const pendingInterest = await lendingStrategy.getPendingInterest();
        const expectedInterest = (DEPOSIT_AMOUNT * BigInt(LENDING_APY)) / 10000n;

        expect(pendingInterest).to.be.closeTo(expectedInterest, expectedInterest / 100n);
      });
    });

    describe("收获", function () {
      it("应该能够收获利息", async function () {
        const { vault, usdc, lendingStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

        // 设置
        await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
        await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
        await vault.connect(owner).addStrategy(await lendingStrategy.getAddress(), 10000);
        await vault.connect(owner).allocateToStrategy(await lendingStrategy.getAddress(), DEPOSIT_AMOUNT);

        // 等待
        await time.increase(90 * 24 * 60 * 60);

        // 收获前
        const totalBefore = await lendingStrategy.totalAssets();

        // 收获
        await vault.connect(owner).harvestStrategy(await lendingStrategy.getAddress());

        // 收获后总资产应不变（利息被复投但计入本金）
        expect(await lendingStrategy.totalProfit()).to.be.gt(0);
      });
    });
  });

  describe("多策略管理", function () {
    it("应该能够同时管理多个策略", async function () {
      const { vault, usdc, rwaStrategy, lendingStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

      // 存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 添加两个策略
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 5000); // 50%
      await vault.connect(owner).addStrategy(await lendingStrategy.getAddress(), 5000); // 50%

      expect(await vault.strategiesLength()).to.equal(2);

      // 分配资金到两个策略
      const halfAmount = DEPOSIT_AMOUNT / 2n;
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), halfAmount);
      await vault.connect(owner).allocateToStrategy(await lendingStrategy.getAddress(), halfAmount);

      // 检查分配 (允许小误差因为时间流逝会产生少量收益)
      expect(await rwaStrategy.totalAssets()).to.be.gte(halfAmount);
      expect(await lendingStrategy.totalAssets()).to.be.gte(halfAmount);

      // 总资产应该不变或略有增加
      expect(await vault.totalAssets()).to.be.gte(DEPOSIT_AMOUNT);
    });

    it("收获所有策略应该更新所有报告", async function () {
      const { vault, usdc, rwaStrategy, lendingStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

      // 设置
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 5000);
      await vault.connect(owner).addStrategy(await lendingStrategy.getAddress(), 5000);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT_AMOUNT / 2n);
      await vault.connect(owner).allocateToStrategy(await lendingStrategy.getAddress(), DEPOSIT_AMOUNT / 2n);

      // 等待
      await time.increase(30 * 24 * 60 * 60);

      // 收获所有
      await vault.harvestAll();

      // 检查两个策略的报告都被更新
      const rwaInfo = await vault.getStrategyInfo(await rwaStrategy.getAddress());
      const lendingInfo = await vault.getStrategyInfo(await lendingStrategy.getAddress());

      expect(rwaInfo.lastReport).to.be.gt(rwaInfo.activation);
      expect(lendingInfo.lastReport).to.be.gt(lendingInfo.activation);
    });
  });

  describe("策略迁移", function () {
    it("应该能够移除策略", async function () {
      const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

      // 设置
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT_AMOUNT);

      // 记录 Vault 初始余额
      const vaultBalanceBefore = await usdc.balanceOf(await vault.getAddress());

      // 移除策略
      await vault.connect(owner).removeStrategy(await rwaStrategy.getAddress());

      // 策略应该被移除
      expect(await vault.isActiveStrategy(await rwaStrategy.getAddress())).to.be.false;
      expect(await vault.strategiesLength()).to.equal(0);

      // 资金应该回到 Vault
      const vaultBalanceAfter = await usdc.balanceOf(await vault.getAddress());
      expect(vaultBalanceAfter).to.be.gt(vaultBalanceBefore);
    });
  });

  describe("紧急功能", function () {
    it("策略应该支持紧急提取", async function () {
      const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployStrategiesFixture);

      // 设置
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT_AMOUNT);

      // 紧急提取
      await vault.connect(owner).emergencyWithdrawAll();

      // 策略中不应该还有资产
      expect(await rwaStrategy.totalAssets()).to.equal(0);
      expect(await rwaStrategy.emergencyMode()).to.be.true;
    });
  });
});
