import { ethers } from "hardhat";

/**
 * 模拟完整的 Hybrid Vault 7540 流程:
 * 1. 用户 deposit → 同步 mint + 异步 pending
 * 2. Operator 取出 USDC → 模拟买美债
 * 3. Operator fulfill → 用户 claim shares
 * 4. 注入收益
 * 5. 用户 redeem → 同步即时 + 异步 pending
 * 6. Operator fulfill redeem → 用户 claim assets
 */
async function main() {
  const [deployer, user] = await ethers.getSigners();

  // Deploy fresh
  const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
  const vault = await (await ethers.getContractFactory("HybridVault")).deploy(
    await usdc.getAddress(), "Test Hybrid", "thvUSDC", deployer.address
  );
  const defi = await (await ethers.getContractFactory("SimpleLendingStrategy")).deploy(
    await vault.getAddress(), await usdc.getAddress(), 300 // 3% APY
  );
  const rwa = await (await ethers.getContractFactory("AsyncRWAStrategy")).deploy(
    await vault.getAddress(), await usdc.getAddress(), 500
  );

  await vault.addSyncStrategy(await defi.getAddress(), 4000);
  await vault.addAsyncStrategy(await rwa.getAddress(), 6000);

  // Give user 1000 USDC
  await usdc.mint(user.address, ethers.parseUnits("1000", 6));
  await usdc.connect(user).approve(await vault.getAddress(), ethers.MaxUint256);

  const fmt = (v: bigint) => ethers.formatUnits(v, 6);

  // ========== Step 1: User deposits 1000 USDC ==========
  console.log("=== Step 1: Deposit 1000 USDC ===");
  await vault.connect(user).deposit(ethers.parseUnits("1000", 6), user.address);

  console.log("User shares:", fmt(await vault.balanceOf(user.address)));
  console.log("User pending deposit:", fmt(await vault.pendingDepositOf(user.address)));
  console.log("Vault totalAssets:", fmt(await vault.totalAssets()));

  // ========== Step 2: Operator takes USDC to buy bonds ==========
  console.log("\n=== Step 2: Operator withdraws USDC (buy bonds) ===");
  const rwaBalance = await usdc.balanceOf(await rwa.getAddress());
  console.log("RWA strategy USDC before:", fmt(rwaBalance));

  await rwa.withdrawToOperator(rwaBalance);
  console.log("Operator took:", fmt(rwaBalance));
  console.log("RWA offChainAssets:", fmt(await rwa.offChainAssets()));

  // ========== Step 3: Operator fulfills deposit ==========
  console.log("\n=== Step 3: Fulfill deposit ===");
  // Calculate shares at current PPS
  const pps = await vault.convertToAssets(ethers.parseUnits("1", 6));
  const asyncAmount = ethers.parseUnits("600", 6);
  const sharesToMint = (asyncAmount * ethers.parseUnits("1", 6)) / pps;
  console.log("Shares to mint for 600 USDC:", fmt(sharesToMint));

  await rwa.fulfillDeposit(user.address, sharesToMint);
  console.log("Claimable shares:", fmt(await vault.claimableSharesOf(user.address)));

  // ========== Step 4: User claims async shares ==========
  console.log("\n=== Step 4: User claims shares ===");
  await vault.connect(user).claimAsyncShares(user.address);
  console.log("User total shares:", fmt(await vault.balanceOf(user.address)));
  console.log("User pending deposit:", fmt(await vault.pendingDepositOf(user.address)));

  // ========== Step 5: Inject yield (bond interest) ==========
  console.log("\n=== Step 5: Inject 50 USDC yield ===");
  await usdc.mint(deployer.address, ethers.parseUnits("50", 6));
  await usdc.approve(await rwa.getAddress(), ethers.parseUnits("50", 6));
  await rwa.injectYield(ethers.parseUnits("50", 6));
  console.log("RWA totalAssets:", fmt(await rwa.totalAssets()));
  console.log("Vault totalAssets:", fmt(await vault.totalAssets()));

  // ========== Step 6: Allocate DeFi funds & advance time ==========
  console.log("\n=== Step 6: Allocate to DeFi & harvest ===");
  const idle = await usdc.balanceOf(await vault.getAddress());
  if (idle > 0n) {
    await vault.allocateToSyncStrategy(await defi.getAddress(), idle);
    console.log("Allocated", fmt(idle), "to DeFi");
  }

  // Advance time for lending interest
  await ethers.provider.send("evm_increaseTime", [86400 * 30]); // 30 days
  await ethers.provider.send("evm_mine", []);

  await vault.harvestSyncStrategy(await defi.getAddress());
  console.log("DeFi totalAssets:", fmt(await defi.totalAssets()));
  console.log("Vault totalAssets:", fmt(await vault.totalAssets()));

  // ========== Step 7: User redeems all ==========
  console.log("\n=== Step 7: User redeems all shares ===");
  const userShares = await vault.balanceOf(user.address);
  console.log("User shares:", fmt(userShares));

  const previewAssets = await vault.convertToAssets(userShares);
  console.log("Preview redeem:", fmt(previewAssets));

  await vault.connect(user).redeem(userShares, user.address, user.address);
  console.log("User USDC after sync part:", fmt(await usdc.balanceOf(user.address)));
  console.log("User pending redeem:", fmt(await vault.pendingRedeemOf(user.address)));

  // ========== Step 8: Operator fulfills redeem ==========
  console.log("\n=== Step 8: Fulfill redeem ===");
  // Operator returns USDC to strategy
  const operatorBal = await usdc.balanceOf(deployer.address);
  const redeemAssets = (previewAssets * 6000n) / 10000n; // 60% async portion
  const toReturn = redeemAssets > operatorBal ? operatorBal : redeemAssets;
  await usdc.approve(await rwa.getAddress(), toReturn);
  await rwa.returnAssets(toReturn);
  await rwa.fulfillRedeem(user.address, toReturn);

  // ========== Step 9: User claims assets ==========
  console.log("\n=== Step 9: User claims assets ===");
  console.log("Claimable assets:", fmt(await vault.claimableAssetsOf(user.address)));
  await vault.connect(user).claimAsyncAssets(user.address);
  console.log("User final USDC:", fmt(await usdc.balanceOf(user.address)));
  console.log("Vault totalAssets:", fmt(await vault.totalAssets()));

  console.log("\n=== Done ===");
}

main().catch(console.error);
