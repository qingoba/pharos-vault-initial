import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

/**
 * Tests for new features:
 *  1. Gas-optimised cached accounting in PharosVault
 *  2. Keeper interfaces (Chainlink + Gelato + harvestNext)
 *  3. PharosTimelock governance
 *  4. PorRegistry + MockZkVerifier (zk-POR)
 *  5. RWAAdapterStrategy + MockRWAVault
 *  6. Tranche system (TrancheManager + TrancheVault)
 */
describe("Advanced Features", function () {
  const DEPOSIT = ethers.parseUnits("10000", 6);
  const RWA_APY = 500;

  // ──────────── Shared fixture ────────────
  async function deployFullFixture() {
    const [owner, user1, user2, feeRecipient, yieldProvider] = await ethers.getSigners();

    // USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    // Vault
    const PharosVault = await ethers.getContractFactory("PharosVault");
    const vault = await PharosVault.deploy(
      await usdc.getAddress(), "Pharos USDC Vault", "pvUSDC", feeRecipient.address
    );

    // Mock RWA strategy (legacy)
    const MockRWA = await ethers.getContractFactory("MockRWAYieldStrategy");
    const rwaStrategy = await MockRWA.deploy(
      await vault.getAddress(), await usdc.getAddress(), RWA_APY, yieldProvider.address
    );

    // Lending strategy
    const Lending = await ethers.getContractFactory("SimpleLendingStrategy");
    const lendingStrategy = await Lending.deploy(
      await vault.getAddress(), await usdc.getAddress(), 300
    );

    // ---- New contracts ----

    // MockRWAVault (external ERC4626 target)
    const MockRWAVault = await ethers.getContractFactory("MockRWAVault");
    const rwaVault = await MockRWAVault.deploy(await usdc.getAddress());

    // RWAAdapterStrategy
    const RWAAdapter = await ethers.getContractFactory("RWAAdapterStrategy");
    const rwaAdapter = await RWAAdapter.deploy(
      await vault.getAddress(), await usdc.getAddress(),
      await rwaVault.getAddress(), RWA_APY
    );

    // zk-POR
    const MockZk = await ethers.getContractFactory("MockZkVerifier");
    const zkVerifier = await MockZk.deploy();
    const PorRegistry = await ethers.getContractFactory("PorRegistry");
    const porRegistry = await PorRegistry.deploy(await zkVerifier.getAddress());

    // Timelock
    const PharosTimelock = await ethers.getContractFactory("PharosTimelock");
    const timelock = await PharosTimelock.deploy(
      86400,                             // 24 h
      [owner.address],                   // proposer
      [ethers.ZeroAddress],              // anyone can execute
      owner.address                      // admin
    );

    // TrancheManager
    const TrancheMgr = await ethers.getContractFactory("TrancheManager");
    const trancheManager = await TrancheMgr.deploy(
      await usdc.getAddress(),
      await vault.getAddress(),
      300 // 3% senior target
    );

    // Mint tokens
    const big = DEPOSIT * 100n;
    await usdc.mint(owner.address, big);
    await usdc.mint(user1.address, big);
    await usdc.mint(user2.address, big);
    await usdc.mint(yieldProvider.address, big);

    // Approvals
    await usdc.connect(yieldProvider).approve(await rwaStrategy.getAddress(), ethers.MaxUint256);

    return {
      vault, usdc, rwaStrategy, lendingStrategy,
      rwaVault, rwaAdapter,
      zkVerifier, porRegistry,
      timelock, trancheManager,
      owner, user1, user2, feeRecipient, yieldProvider,
    };
  }

  // ================================================================
  //  1.  CACHED ACCOUNTING + SNAPSHOT EVENTS
  // ================================================================
  describe("Cached Accounting", function () {
    it("totalDeployedAssets tracks allocations", async function () {
      const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployFullFixture);
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 5000);

      expect(await vault.totalDeployedAssets()).to.equal(0);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT / 2n);
      expect(await vault.totalDeployedAssets()).to.equal(DEPOSIT / 2n);
    });

    it("totalAssets == idle + cached deployed", async function () {
      const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployFullFixture);
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT);

      const total = await vault.totalAssets();
      const idle = await vault.idleAssets();
      const deployed = await vault.totalDeployedAssets();
      expect(total).to.equal(idle + deployed);
    });

    it("deposit emits VaultSnapshot", async function () {
      const { vault, usdc, user1 } = await loadFixture(deployFullFixture);
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await expect(vault.connect(user1).deposit(DEPOSIT, user1.address))
        .to.emit(vault, "VaultSnapshot");
    });
  });

  // ================================================================
  //  2.  KEEPER / AUTO-COMPOUND
  // ================================================================
  describe("Keeper Integration", function () {
    it("harvestNext round-robins through strategies", async function () {
      const { vault, usdc, rwaStrategy, lendingStrategy, owner, user1 } =
        await loadFixture(deployFullFixture);

      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 5000);
      await vault.connect(owner).addStrategy(await lendingStrategy.getAddress(), 5000);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT / 2n);
      await vault.connect(owner).allocateToStrategy(await lendingStrategy.getAddress(), DEPOSIT / 2n);

      // Advance time so triggers fire
      await time.increase(30 * 24 * 3600);
      const harvested = await vault.harvestNext.staticCall();
      expect(harvested).to.be.true;
    });

    it("checkUpkeep returns correct strategy", async function () {
      const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployFullFixture);
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT);

      await time.increase(30 * 24 * 3600);
      const [needed, data] = await vault.checkUpkeep("0x");
      expect(needed).to.be.true;

      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["address"], data);
      expect(decoded[0]).to.equal(await rwaStrategy.getAddress());
    });

    it("performUpkeep harvests the specified strategy", async function () {
      const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployFullFixture);
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT);
      await time.increase(30 * 24 * 3600);

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"], [await rwaStrategy.getAddress()]
      );
      await expect(vault.performUpkeep(data)).to.emit(vault, "StrategyReported");
    });

    it("checker (Gelato) returns executable payload", async function () {
      const { vault, usdc, rwaStrategy, owner, user1 } = await loadFixture(deployFullFixture);
      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT);
      await time.increase(30 * 24 * 3600);

      const [canExec, payload] = await vault.checker();
      expect(canExec).to.be.true;
      expect(payload.length).to.be.gt(0);
    });
  });

  // ================================================================
  //  3.  ZK-POR
  // ================================================================
  describe("zk-POR Registry", function () {
    it("should accept valid proofs", async function () {
      const { porRegistry, owner } = await loadFixture(deployFullFixture);

      const publicInputs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bytes32"],
        [ethers.parseUnits("1000000", 6), ethers.parseUnits("900000", 6), ethers.ZeroHash]
      );

      await expect(porRegistry.connect(owner).submitProof("0x1234", publicInputs))
        .to.emit(porRegistry, "ProofSubmitted");

      expect(await porRegistry.isHealthy()).to.be.true;
      const latest = await porRegistry.latestProof();
      expect(latest.verified).to.be.true;
      expect(latest.totalReserves).to.equal(ethers.parseUnits("1000000", 6));
    });

    it("should mark unhealthy when reserves < liabilities", async function () {
      const { porRegistry, owner } = await loadFixture(deployFullFixture);

      const publicInputs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bytes32"],
        [ethers.parseUnits("800000", 6), ethers.parseUnits("900000", 6), ethers.ZeroHash]
      );

      await porRegistry.connect(owner).submitProof("0x1234", publicInputs);
      expect(await porRegistry.isHealthy()).to.be.false;
    });

    it("should reject unauthorized attesters", async function () {
      const { porRegistry, user1 } = await loadFixture(deployFullFixture);

      const publicInputs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bytes32"],
        [1000, 900, ethers.ZeroHash]
      );

      await expect(
        porRegistry.connect(user1).submitProof("0x1234", publicInputs)
      ).to.be.revertedWithCustomError(porRegistry, "Unauthorized");
    });

    it("owner can add/remove attesters", async function () {
      const { porRegistry, owner, user1 } = await loadFixture(deployFullFixture);

      await porRegistry.connect(owner).setAttester(user1.address, true);
      const publicInputs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256", "bytes32"],
        [1000, 900, ethers.ZeroHash]
      );
      await expect(porRegistry.connect(user1).submitProof("0x", publicInputs))
        .to.emit(porRegistry, "ProofSubmitted");
    });
  });

  // ================================================================
  //  4.  TIMELOCK
  // ================================================================
  describe("Timelock Governance", function () {
    it("should deploy with correct min delay", async function () {
      const { timelock } = await loadFixture(deployFullFixture);
      expect(await timelock.getMinDelay()).to.equal(86400);
    });

    it("owner can schedule + execute vault admin actions via timelock", async function () {
      const { vault, timelock, owner } = await loadFixture(deployFullFixture);

      // Transfer vault ownership to timelock
      await vault.connect(owner).transferOwnership(await timelock.getAddress());

      // Prepare call: setManagementFee(300)
      const vaultAddr = await vault.getAddress();
      const callData = vault.interface.encodeFunctionData("setManagementFee", [300]);

      // Schedule
      await timelock.connect(owner).schedule(
        vaultAddr, 0, callData,
        ethers.ZeroHash, ethers.ZeroHash, 86400
      );

      // Cannot execute before delay
      await expect(
        timelock.connect(owner).execute(vaultAddr, 0, callData, ethers.ZeroHash, ethers.ZeroHash)
      ).to.be.reverted;

      // Wait 24h
      await time.increase(86400);

      // Execute
      await timelock.connect(owner).execute(
        vaultAddr, 0, callData, ethers.ZeroHash, ethers.ZeroHash
      );
      expect(await vault.managementFee()).to.equal(300);
    });
  });

  // ================================================================
  //  5.  RWA ADAPTER STRATEGY
  // ================================================================
  describe("RWA Adapter Strategy", function () {
    it("deposits into external ERC4626 vault", async function () {
      const { vault, usdc, rwaAdapter, rwaVault, owner, user1 } =
        await loadFixture(deployFullFixture);

      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaAdapter.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await rwaAdapter.getAddress(), DEPOSIT);

      // Adapter should hold shares in external vault
      expect(await rwaAdapter.rwaShares()).to.be.gt(0);
      expect(await rwaAdapter.totalAssets()).to.be.gte(DEPOSIT);
    });

    it("reflects yield from external vault", async function () {
      const { vault, usdc, rwaAdapter, rwaVault, owner, user1 } =
        await loadFixture(deployFullFixture);

      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaAdapter.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await rwaAdapter.getAddress(), DEPOSIT);

      // Simulate yield in external vault
      const yield_ = ethers.parseUnits("500", 6);
      await usdc.mint(owner.address, yield_);
      await usdc.connect(owner).approve(await rwaVault.getAddress(), yield_);
      await rwaVault.connect(owner).addYield(yield_);

      // Adapter should now report higher value
      expect(await rwaAdapter.totalAssets()).to.be.gt(DEPOSIT);
    });

    it("withdraws from external vault when needed", async function () {
      const { vault, usdc, rwaAdapter, owner, user1 } =
        await loadFixture(deployFullFixture);

      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaAdapter.getAddress(), 10000);
      await vault.connect(owner).allocateToStrategy(await rwaAdapter.getAddress(), DEPOSIT);

      // User withdraws half
      const half = DEPOSIT / 2n;
      await vault.connect(user1).withdraw(half, user1.address, user1.address);

      // Adapter shares should decrease
      expect(await rwaAdapter.totalAssets()).to.be.lt(DEPOSIT);
    });
  });

  // ================================================================
  //  6.  TRANCHE SYSTEM
  // ================================================================
  describe("Tranche System", function () {
    it("deploys senior and junior tranche tokens", async function () {
      const { trancheManager } = await loadFixture(deployFullFixture);

      const senior = await trancheManager.seniorTranche();
      const junior = await trancheManager.juniorTranche();
      expect(senior).to.not.equal(ethers.ZeroAddress);
      expect(junior).to.not.equal(ethers.ZeroAddress);
    });

    it("senior deposit mints tranche shares", async function () {
      const { trancheManager, vault, usdc, owner, user1 } =
        await loadFixture(deployFullFixture);

      // Approve
      await usdc.connect(user1).approve(await trancheManager.getAddress(), DEPOSIT);

      // Also need vault to accept manager deposits
      // The tranche manager approves vault in constructor

      await trancheManager.connect(user1).depositSenior(DEPOSIT, user1.address);

      const seniorAddr = await trancheManager.seniorTranche();
      const seniorVault = await ethers.getContractAt("TrancheVault", seniorAddr);
      expect(await seniorVault.balanceOf(user1.address)).to.equal(DEPOSIT);
      expect(await trancheManager.seniorDeposits()).to.equal(DEPOSIT);
    });

    it("junior deposit mints tranche shares", async function () {
      const { trancheManager, usdc, user2 } = await loadFixture(deployFullFixture);

      await usdc.connect(user2).approve(await trancheManager.getAddress(), DEPOSIT);
      await trancheManager.connect(user2).depositJunior(DEPOSIT, user2.address);

      const juniorAddr = await trancheManager.juniorTranche();
      const juniorVault = await ethers.getContractAt("TrancheVault", juniorAddr);
      expect(await juniorVault.balanceOf(user2.address)).to.equal(DEPOSIT);
      expect(await trancheManager.juniorDeposits()).to.equal(DEPOSIT);
    });

    it("waterfall distributes yield correctly", async function () {
      const { trancheManager, vault, usdc, rwaStrategy, owner, user1, user2, yieldProvider } =
        await loadFixture(deployFullFixture);

      // Setup: deposit into both tranches
      await usdc.connect(user1).approve(await trancheManager.getAddress(), DEPOSIT);
      await trancheManager.connect(user1).depositSenior(DEPOSIT, user1.address);

      await usdc.connect(user2).approve(await trancheManager.getAddress(), DEPOSIT);
      await trancheManager.connect(user2).depositJunior(DEPOSIT, user2.address);

      // Setup vault strategy and allocate
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 10000);

      // The tranche manager deposits into vault — vault now has 2*DEPOSIT
      // Allocate to strategy
      await vault.connect(owner).allocateToStrategy(
        await rwaStrategy.getAddress(), DEPOSIT * 2n
      );

      // Simulate yield (30 days)
      await time.increase(30 * 24 * 3600);

      // Harvest to materialise gains
      await vault.connect(owner).harvestStrategy(await rwaStrategy.getAddress());

      // Execute waterfall
      await expect(trancheManager.executeWaterfall())
        .to.emit(trancheManager, "WaterfallExecuted");
    });
  });

  // ================================================================
  //  Weighted APY
  // ================================================================
  describe("Weighted APY", function () {
    it("should return weighted APY based on debt allocation", async function () {
      const { vault, usdc, rwaStrategy, lendingStrategy, owner, user1 } =
        await loadFixture(deployFullFixture);

      await usdc.connect(user1).approve(await vault.getAddress(), DEPOSIT);
      await vault.connect(user1).deposit(DEPOSIT, user1.address);
      await vault.connect(owner).addStrategy(await rwaStrategy.getAddress(), 6000);
      await vault.connect(owner).addStrategy(await lendingStrategy.getAddress(), 4000);
      await vault.connect(owner).allocateToStrategy(await rwaStrategy.getAddress(), DEPOSIT * 6n / 10n);
      await vault.connect(owner).allocateToStrategy(await lendingStrategy.getAddress(), DEPOSIT * 4n / 10n);

      const apy = await vault.estimatedAPY();
      // Should be between lending (300) and rwa (500)
      expect(apy).to.be.gte(300);
      expect(apy).to.be.lte(500);
    });
  });
});
