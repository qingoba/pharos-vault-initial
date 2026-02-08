import { ethers, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. MockUSDC
  const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
  await usdc.waitForDeployment();
  console.log("USDC:", await usdc.getAddress());

  // 2. HybridVault
  const vault = await (await ethers.getContractFactory("HybridVault")).deploy(
    await usdc.getAddress(),
    "Pharos Hybrid Vault",
    "phvUSDC",
    deployer.address
  );
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("HybridVault:", vaultAddr);

  // 3. DeFi Strategy (sync) — SimpleLendingStrategy
  const defi = await (await ethers.getContractFactory("SimpleLendingStrategy")).deploy(
    vaultAddr,
    await usdc.getAddress(),
    300 // 3% APY
  );
  await defi.waitForDeployment();
  const defiAddr = await defi.getAddress();
  console.log("DeFi Strategy:", defiAddr);

  // 4. Async RWA Strategy
  const rwa = await (await ethers.getContractFactory("AsyncRWAStrategy")).deploy(
    vaultAddr,
    await usdc.getAddress(),
    500 // 5% target APY
  );
  await rwa.waitForDeployment();
  const rwaAddr = await rwa.getAddress();
  console.log("AsyncRWA Strategy:", rwaAddr);

  // 5. Register strategies: 40% DeFi, 60% RWA
  await (await vault.addSyncStrategy(defiAddr, 4000)).wait();
  console.log("Added DeFi strategy (40%)");

  await (await vault.addAsyncStrategy(rwaAddr, 6000)).wait();
  console.log("Added AsyncRWA strategy (60%)");

  // 6. Mint test USDC
  await (await usdc.mint(deployer.address, ethers.parseUnits("100000", 6))).wait();
  console.log("Minted 100,000 USDC to deployer");

  console.log("\n=== Deployment Complete ===");
  const addresses = {
    USDC: await usdc.getAddress(),
    HybridVault: vaultAddr,
    DeFiStrategy: defiAddr,
    AsyncRWAStrategy: rwaAddr,
  };
  console.log(addresses);

  // Auto-update frontend addresses
  const addressFile = path.resolve(__dirname, "../../frontend/src/lib/contracts/addresses.ts");
  if (fs.existsSync(addressFile)) {
    let content = fs.readFileSync(addressFile, "utf-8");
    const replacements: Record<string, string> = {
      HybridVault: addresses.HybridVault,
      DeFiStrategy: addresses.DeFiStrategy,
      AsyncRWAStrategy: addresses.AsyncRWAStrategy,
      USDC: addresses.USDC,
    };
    for (const [key, addr] of Object.entries(replacements)) {
      // Match: KEY: '0x...' as `0x${string}`
      const regex = new RegExp(`(${key}:\\s*')0x[a-fA-F0-9]+'`, "g");
      content = content.replace(regex, `$1${addr}'`);
    }
    fs.writeFileSync(addressFile, content);
    console.log("\n✅ Frontend addresses updated:", addressFile);
  }

  // Verify contracts
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\nVerifying contracts...");
    const contracts = [
      { address: addresses.USDC, args: [] },
      { address: vaultAddr, args: [addresses.USDC, "Pharos Hybrid Vault", "phvUSDC", deployer.address] },
      { address: defiAddr, args: [vaultAddr, addresses.USDC, 300] },
      { address: rwaAddr, args: [vaultAddr, addresses.USDC, 500] },
    ];
    for (const c of contracts) {
      try {
        await run("verify:verify", { address: c.address, constructorArguments: c.args });
      } catch (e: any) {
        console.log(`Verify ${c.address}: ${e.message?.slice(0, 80)}`);
      }
    }
  }
}

main().catch(console.error);
