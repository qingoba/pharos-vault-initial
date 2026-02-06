import { ethers } from "hardhat";

/**
 * Debug script to test raw transaction sending
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Get fee data
  const feeData = await ethers.provider.getFeeData();
  console.log("\nFee Data:");
  console.log("  gasPrice:", feeData.gasPrice?.toString());
  console.log("  maxFeePerGas:", feeData.maxFeePerGas?.toString());
  console.log("  maxPriorityFeePerGas:", feeData.maxPriorityFeePerGas?.toString());

  // Get nonce
  const nonce = await ethers.provider.getTransactionCount(deployer.address);
  console.log("\nCurrent nonce:", nonce);

  // Check pending transactions
  const pendingNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log("Pending nonce:", pendingNonce);

  if (pendingNonce > nonce) {
    console.log("⚠️ There are pending transactions!");
  }

  // Get MinimalTest bytecode - simplest possible contract
  const MinimalTest = await ethers.getContractFactory("MinimalTest");
  const deployTx = await MinimalTest.getDeployTransaction();
  
  console.log("\nMinimalTest deploy transaction:");
  console.log("  data length:", deployTx.data?.length || 0);
  console.log("  data preview:", deployTx.data?.slice(0, 66) || "EMPTY");

  // Try a simple value transfer first
  console.log("\n--- Testing simple value transfer ---");
  try {
    const selfTx = await deployer.sendTransaction({
      to: deployer.address,
      value: 0n,
      gasLimit: 21000n,
    });
    console.log("Self-transfer tx hash:", selfTx.hash);
    const receipt = await selfTx.wait();
    console.log("Self-transfer status:", receipt?.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Gas used:", receipt?.gasUsed.toString());
  } catch (e: any) {
    console.log("Self-transfer failed:", e.message);
  }

  // Now try contract deployment with explicit transaction construction
  console.log("\n--- Testing contract deployment ---");
  try {
    const deployData = deployTx.data;
    if (!deployData) {
      throw new Error("No bytecode!");
    }

    const estimatedGas = await ethers.provider.estimateGas({
      from: deployer.address,
      data: deployData,
    });
    console.log("Estimated gas:", estimatedGas.toString());

    // Construct transaction manually - TRY LEGACY TYPE
    const tx = {
      type: 0, // Legacy
      nonce: await ethers.provider.getTransactionCount(deployer.address, "latest"),
      to: null as null, // Contract creation
      data: deployData,
      gasLimit: estimatedGas * 150n / 100n,
      gasPrice: 10000000000n, // 10 gwei from eth_gasPrice
      chainId: network.chainId,
    };

    console.log("\nPrepared transaction:");
    console.log("  type:", tx.type);
    console.log("  nonce:", tx.nonce);
    console.log("  gasLimit:", tx.gasLimit.toString());
    console.log("  gasPrice:", tx.gasPrice.toString());
    console.log("  data length:", tx.data.length);

    console.log("\nSending transaction...");
    const response = await deployer.sendTransaction(tx);
    console.log("Tx hash:", response.hash);

    console.log("Waiting for confirmation...");
    const receipt = await response.wait();
    console.log("Status:", receipt?.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Contract address:", receipt?.contractAddress || "N/A");
    console.log("Gas used:", receipt?.gasUsed.toString());
    console.log("Block:", receipt?.blockNumber);

  } catch (e: any) {
    console.log("Deployment failed:", e.code || e.message);
    if (e.receipt) {
      console.log("Receipt status:", e.receipt.status);
      console.log("Receipt gasUsed:", e.receipt.gasUsed?.toString());
    }
  }
}

main().catch(console.error);
