import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { PharosVault, MockUSDC, MockRWAYieldStrategy } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PharosVault", function () {
  // 测试固定配置
  const DEPOSIT_AMOUNT = ethers.parseUnits("10000", 6); // 10,000 USDC
  const TARGET_APY = 500; // 5% APY

  async function deployVaultFixture() {
    const [owner, user1, user2, feeRecipient, yieldProvider] = await ethers.getSigners();

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

    // 部署 MockRWAYieldStrategy
    const MockRWAYieldStrategy = await ethers.getContractFactory("MockRWAYieldStrategy");
    const strategy = await MockRWAYieldStrategy.deploy(
      await vault.getAddress(),
      await usdc.getAddress(),
      TARGET_APY,
      yieldProvider.address
    );
    await strategy.waitForDeployment();

    // 铸造测试代币
    await usdc.mint(user1.address, DEPOSIT_AMOUNT * 10n);
    await usdc.mint(user2.address, DEPOSIT_AMOUNT * 10n);
    await usdc.mint(yieldProvider.address, DEPOSIT_AMOUNT * 10n);

    // yieldProvider 授权策略拉取代币
    await usdc.connect(yieldProvider).approve(await strategy.getAddress(), ethers.MaxUint256);

    return { vault, usdc, strategy, owner, user1, user2, feeRecipient, yieldProvider };
  }

  describe("部署测试", function () {
    it("应该正确设置 Vault 参数", async function () {
      const { vault, usdc, feeRecipient } = await loadFixture(deployVaultFixture);

      expect(await vault.name()).to.equal("Pharos USDC Vault");
      expect(await vault.symbol()).to.equal("pvUSDC");
      expect(await vault.asset()).to.equal(await usdc.getAddress());
      expect(await vault.feeRecipient()).to.equal(feeRecipient.address);
      expect(await vault.managementFee()).to.equal(200); // 2%
      expect(await vault.performanceFee()).to.equal(1000); // 10%
    });

    it("应该正确设置策略参数", async function () {
      const { vault, strategy, usdc } = await loadFixture(deployVaultFixture);

      expect(await strategy.vault()).to.equal(await vault.getAddress());
      expect(await strategy.asset()).to.equal(await usdc.getAddress());
      expect(await strategy.estimatedAPY()).to.equal(TARGET_APY);
    });
  });

  describe("存款功能 (Deposit)", function () {
    it("用户应该能够存入资产并获得份额", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      // 授权 Vault
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);

      // 存款
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 检查份额 (第一笔存款，1:1 比例)
      const shares = await vault.balanceOf(user1.address);
      expect(shares).to.equal(DEPOSIT_AMOUNT);

      // 检查总资产
      expect(await vault.totalAssets()).to.equal(DEPOSIT_AMOUNT);
    });

    it("应该阻止超过存款限额的存款", async function () {
      const { vault, usdc, user1, owner } = await loadFixture(deployVaultFixture);

      // 设置存款限额
      await vault.connect(owner).setDepositLimit(DEPOSIT_AMOUNT / 2n);

      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);

      await expect(
        vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address)
      ).to.be.revertedWithCustomError(vault, "DepositLimitExceeded");
    });

    it("紧急模式下应该阻止存款", async function () {
      const { vault, usdc, user1, owner } = await loadFixture(deployVaultFixture);

      await vault.connect(owner).setEmergencyShutdown(true);
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);

      // 紧急模式会触发暂停，所以会抛出 EnforcedPause 错误
      await expect(
        vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });
  });

  describe("策略管理", function () {
    it("管理员应该能够添加策略", async function () {
      const { vault, strategy, owner } = await loadFixture(deployVaultFixture);

      await expect(vault.connect(owner).addStrategy(await strategy.getAddress(), 5000))
        .to.emit(vault, "StrategyAdded")
        .withArgs(await strategy.getAddress(), 5000);

      expect(await vault.isActiveStrategy(await strategy.getAddress())).to.be.true;
      expect(await vault.strategiesLength()).to.equal(1);
    });

    it("应该阻止非管理员添加策略", async function () {
      const { vault, strategy, user1 } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(user1).addStrategy(await strategy.getAddress(), 5000)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("应该阻止添加重复策略", async function () {
      const { vault, strategy, owner } = await loadFixture(deployVaultFixture);

      await vault.connect(owner).addStrategy(await strategy.getAddress(), 5000);

      await expect(
        vault.connect(owner).addStrategy(await strategy.getAddress(), 3000)
      ).to.be.revertedWithCustomError(vault, "StrategyAlreadyExists");
    });
  });

  describe("资金分配到策略", function () {
    it("应该能够将资金分配到策略", async function () {
      const { vault, usdc, strategy, owner, user1 } = await loadFixture(deployVaultFixture);

      // 用户存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 添加策略
      await vault.connect(owner).addStrategy(await strategy.getAddress(), 5000);

      // 分配资金到策略
      const allocateAmount = DEPOSIT_AMOUNT / 2n;
      await expect(vault.connect(owner).allocateToStrategy(await strategy.getAddress(), allocateAmount))
        .to.emit(vault, "FundsAllocatedToStrategy")
        .withArgs(await strategy.getAddress(), allocateAmount);

      // 检查策略中的资产
      expect(await strategy.totalAssets()).to.equal(allocateAmount);

      // 总资产应该保持不变
      expect(await vault.totalAssets()).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("收获功能 (Harvest)", function () {
    it("应该能够收获策略收益", async function () {
      const { vault, usdc, strategy, owner, user1, yieldProvider } = await loadFixture(deployVaultFixture);

      // 用户存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 添加策略并分配资金
      await vault.connect(owner).addStrategy(await strategy.getAddress(), 5000);
      await vault.connect(owner).allocateToStrategy(await strategy.getAddress(), DEPOSIT_AMOUNT);

      // 模拟时间流逝 (30天)
      await time.increase(30 * 24 * 60 * 60);

      // 在收获前检查待收益
      const pendingYield = await strategy.getPendingYield();
      expect(pendingYield).to.be.gt(0);

      // 收获
      await vault.connect(owner).harvestStrategy(await strategy.getAddress());

      // 检查策略的累计收益
      expect(await strategy.totalProfit()).to.be.gt(0);
    });

    it("应该能够收获所有策略", async function () {
      const { vault, usdc, strategy, owner, user1 } = await loadFixture(deployVaultFixture);

      // 用户存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 添加策略并分配资金
      await vault.connect(owner).addStrategy(await strategy.getAddress(), 5000);
      await vault.connect(owner).allocateToStrategy(await strategy.getAddress(), DEPOSIT_AMOUNT);

      // 模拟时间流逝
      await time.increase(7 * 24 * 60 * 60);

      // 收获所有策略
      await vault.harvestAll();

      // 检查策略报告已更新
      const strategyInfo = await vault.getStrategyInfo(await strategy.getAddress());
      expect(strategyInfo.lastReport).to.be.gt(strategyInfo.activation);
    });
  });

  describe("提现功能 (Withdraw)", function () {
    it("用户应该能够提现资产", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      // 存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 提现
      const withdrawAmount = DEPOSIT_AMOUNT / 2n;
      const balanceBefore = await usdc.balanceOf(user1.address);
      
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);

      const balanceAfter = await usdc.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
    });

    it("提现时应该能从策略中撤回资金", async function () {
      const { vault, usdc, strategy, owner, user1 } = await loadFixture(deployVaultFixture);

      // 存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 添加策略并分配所有资金
      await vault.connect(owner).addStrategy(await strategy.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await strategy.getAddress(), DEPOSIT_AMOUNT);

      // Vault 中应该没有闲置资金
      expect(await vault.idleAssets()).to.equal(0);

      // 用户提现应该触发从策略撤回
      const withdrawAmount = DEPOSIT_AMOUNT / 2n;
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);

      // 检查提现成功
      expect(await usdc.balanceOf(user1.address)).to.be.gt(DEPOSIT_AMOUNT * 9n);
    });

    it("应该能够赎回所有份额", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      // 存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      const shares = await vault.balanceOf(user1.address);

      // 赎回所有份额
      await vault.connect(user1).redeem(shares, user1.address, user1.address);

      // 用户应该拿回所有资产
      expect(await vault.balanceOf(user1.address)).to.equal(0);
    });
  });

  describe("费用管理", function () {
    it("应该正确计算管理费", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      // 存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 等待一段时间
      await time.increase(365 * 24 * 60 * 60); // 1年

      // 再次存款触发费用计算
      await usdc.connect(user1).approve(await vault.getAddress(), 1);
      await vault.connect(user1).deposit(1, user1.address);

      // 检查累计管理费 (约为 2% * 10000 = 200 USDC)
      const accumulatedFee = await vault.accumulatedManagementFee();
      expect(accumulatedFee).to.be.gt(0);
    });

    it("管理员应该能够修改费率", async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);

      await vault.connect(owner).setManagementFee(300); // 3%
      expect(await vault.managementFee()).to.equal(300);

      await vault.connect(owner).setPerformanceFee(2000); // 20%
      expect(await vault.performanceFee()).to.equal(2000);
    });

    it("应该阻止设置过高的费率", async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(owner).setManagementFee(10001)
      ).to.be.revertedWithCustomError(vault, "InvalidFee");

      await expect(
        vault.connect(owner).setPerformanceFee(5001)
      ).to.be.revertedWithCustomError(vault, "InvalidFee");
    });
  });

  describe("紧急功能", function () {
    it("应该能够激活紧急模式", async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);

      await expect(vault.connect(owner).setEmergencyShutdown(true))
        .to.emit(vault, "EmergencyShutdownActivated")
        .withArgs(true);

      expect(await vault.emergencyShutdown()).to.be.true;
      expect(await vault.paused()).to.be.true;
    });

    it("应该能够紧急撤回所有策略资金", async function () {
      const { vault, usdc, strategy, owner, user1 } = await loadFixture(deployVaultFixture);

      // 存款并分配到策略
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
      await vault.connect(owner).addStrategy(await strategy.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await strategy.getAddress(), DEPOSIT_AMOUNT);

      // 紧急撤回
      await vault.connect(owner).emergencyWithdrawAll();

      // 策略中不应该还有资金
      expect(await strategy.totalAssets()).to.equal(0);
    });

    it("紧急模式下用户仍然可以提现", async function () {
      const { vault, usdc, owner, user1 } = await loadFixture(deployVaultFixture);

      // 存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 激活紧急模式
      await vault.connect(owner).setEmergencyShutdown(true);

      // 用户应该仍然可以提现
      const shares = await vault.balanceOf(user1.address);
      await vault.connect(user1).redeem(shares, user1.address, user1.address);

      expect(await vault.balanceOf(user1.address)).to.equal(0);
    });
  });

  describe("ERC4626 标准兼容性", function () {
    it("应该正确计算 previewDeposit", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      const preview = await vault.previewDeposit(DEPOSIT_AMOUNT);
      
      // 首次存款，1:1
      expect(preview).to.equal(DEPOSIT_AMOUNT);

      // 实际存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      // 预览应该与实际相符
      expect(await vault.balanceOf(user1.address)).to.equal(preview);
    });

    it("应该正确计算 previewWithdraw", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      // 存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      const withdrawAmount = DEPOSIT_AMOUNT / 2n;
      const previewShares = await vault.previewWithdraw(withdrawAmount);

      // 提现
      const sharesBefore = await vault.balanceOf(user1.address);
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      const sharesAfter = await vault.balanceOf(user1.address);

      expect(sharesBefore - sharesAfter).to.equal(previewShares);
    });

    it("应该支持 convertToShares 和 convertToAssets", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployVaultFixture);

      // 存款
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);

      const shares = await vault.convertToShares(DEPOSIT_AMOUNT);
      const assets = await vault.convertToAssets(shares);

      expect(assets).to.equal(DEPOSIT_AMOUNT);
    });
  });
});
