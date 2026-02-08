# Pharos Vault - 测试网部署完整教程

本文档提供了在测试网上部署 Pharos Vault 的详细步骤。支持两个测试网：

- **Pharos Testnet** - Pharos 官方测试网（推荐用于正式提交）
- **Sepolia Testnet** - 以太坊 Sepolia 测试网（用于开发测试）

## 目录

1. [环境准备](#1-环境准备)
2. [获取测试网代币](#2-获取测试网代币)
3. [配置部署环境](#3-配置部署环境)
4. [部署智能合约](#4-部署智能合约)
5. [运行单元测试](#5-运行单元测试)
6. [启动前端](#6-启动前端)
7. [测试功能](#7-测试功能)
8. [高级功能操作](#8-高级功能操作)
9. [常见问题](#9-常见问题)

---

## 0. 2026-02 重要更新（Pending Settlement + 双 APY）

当前版本新增了真实 RWA 延迟成交建模：

- `setStrategyAsync(strategy, true)`：把策略标记为异步结算（例如 RWA T+1）。
- `pendingAssets`：资金先进入 pending 桶，不会立即进入策略净值。
- `executePendingInvestment(strategy, amount)`：成交完成后再把 pending 资金落地到策略。
- `projectedAPY()`：按 `idle + pending + deployed` 权重计算的预期 APY。
- `realizedAPY()`：基于 PPS（Price Per Share）变化年化的已实现 APY。

部署脚本已默认配置：

- RWA strategy `async = true`
- `pendingAPY = RWA_APY`
- `idleAPY = 0`

你可以在 `/vault/live` 和 `/transparency` 看到 Idle/Pending/Deployed 与 Projected/Realized APY。

---

## 1. 环境准备

### 1.1 安装 Node.js

确保你已安装 Node.js 18 或更高版本：

```bash
node --version  # 应该显示 v18.x.x 或更高
npm --version   # 应该显示 9.x.x 或更高
```

### 1.2 安装项目依赖

```bash
# 进入项目根目录
cd pharos-vault-initial

# 安装合约依赖
cd pharos-vault
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 1.3 配置 MetaMask 钱包

#### 方式一：Pharos Testnet（官方测试网）

| 配置项 | 值 |
|--------|------|
| **网络名称** | Pharos Testnet |
| **RPC URL** | https://testnet.dplabs-internal.com |
| **Chain ID** | 688689 |
| **货币符号** | PTT |
| **区块浏览器** | https://testnet.pharosscan.xyz |

#### 方式二：Sepolia Testnet（以太坊测试网）

| 配置项 | 值 |
|--------|------|
| **网络名称** | Sepolia |
| **RPC URL** | https://ethereum-sepolia-rpc.publicnode.com |
| **Chain ID** | 11155111 |
| **货币符号** | ETH |
| **区块浏览器** | https://sepolia.etherscan.io |

> 💡 **提示：** Sepolia 是以太坊官方测试网，MetaMask 通常已内置支持，只需在网络列表中启用即可。

**添加步骤：**
1. 打开 MetaMask
2. 点击网络选择器 (顶部)
3. 点击 "Add Network" 或 "添加网络"
4. 选择 "Add a network manually" 或 "手动添加网络"
5. 填入上述信息并保存

---

## 2. 获取测试网代币

### 2.1 获取 Pharos 测试网代币 (PTT)

你需要测试网原生代币来支付 Gas 费用。获取方式：

**方式一：Pharos 官方水龙头**
- 访问 Pharos 官方水龙头网站
- 连接钱包并领取测试代币

**方式二：Discord/Telegram 水龙头**
- 加入 Pharos 官方 Discord 或 Telegram
- 在水龙头频道发送你的钱包地址

**方式三：联系团队**
- 如果是黑客松参赛者，可联系组织方获取测试代币

### 2.2 获取 Sepolia 测试网代币 (SepoliaETH)

如果使用 Sepolia 测试网，可以从以下水龙头获取：

**推荐水龙头：**
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/) - 需要 Alchemy 账号
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia) - 需要 Infura 账号
- [QuickNode Sepolia Faucet](https://faucet.quicknode.com/ethereum/sepolia)
- [Google Cloud Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)

> 💡 **提示：** Sepolia 水龙头通常每 24 小时可领取一次，建议提前准备。

### 2.2 获取私钥

部署合约需要私钥。**请注意安全！**

1. 打开 MetaMask
2. 点击账户头像 → "Account details" → "Show private key"
3. 输入密码确认
4. 复制私钥（不要带 0x 前缀）

⚠️ **重要安全提示：**
- 永远不要将真实资金的私钥暴露
- 建议使用专门用于测试的钱包
- 不要将私钥提交到 Git 仓库

---

## 3. 配置部署环境

### 3.1 创建环境变量文件

```bash
cd pharos-vault

# 复制示例文件
cp .env.example .env

# 编辑 .env 文件
```

### 3.2 编辑 .env 文件

打开 `pharos-vault/.env` 文件，填入你的私钥：

```env
# 你的私钥（不带 0x 前缀）
PRIVATE_KEY=your_private_key_here

# Pharos 测试网 RPC URL
PHAROS_TESTNET_RPC_URL=https://testnet.dplabs-internal.com

# Pharos 主网 RPC URL（暂不使用）
PHAROS_RPC_URL=https://rpc.pharos.xyz

# Sepolia 测试网 RPC URL
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# 区块浏览器 API Key（可选，用于验证合约）
PHAROS_API_KEY=your_api_key_here
```

### 3.3 验证配置

```bash
# 编译合约，确保没有错误
npm run compile
```

预期输出：
```
Compiled 19 Solidity files successfully
Successfully generated 50 typings!
```

---

## 4. 部署智能合约

### 4.1 运行部署脚本

```bash
cd pharos-vault

# 部署到 Pharos 测试网（推荐用于正式提交）
npm run deploy:pharos-testnet

# 或者部署到 Sepolia 测试网（用于开发测试）
npm run deploy:sepolia
```

> 💡 **推荐使用 Sepolia：** 如果 Pharos 测试网部署遇到问题，可以先使用 Sepolia 进行开发测试。
> Sepolia 是以太坊官方测试网，稳定性更好，适合快速迭代开发。

### 4.2 部署过程说明

部署脚本会自动执行以下操作：

1. **部署 MockUSDC** - 测试用稳定币
2. **部署 PharosVault** - 主 Vault 合约（Gas 优化版，含 Keeper 接口）
3. **部署 MockRWAYieldStrategy** - RWA 收益策略（5% APY）
4. **部署 SimpleLendingStrategy** - 借贷策略（3% APY）
5. **配置 Vault** - 添加策略，设置分配比例
6. **部署 MockRWAVault + RWAAdapterStrategy** - ERC4626 RWA 适配器
7. **部署 MockZkVerifier + PorRegistry** - zk-Proof of Reserve 系统
8. **部署 PharosTimelock** - 24 小时治理延迟锁
9. **部署 TrancheManager** - Senior/Junior 风险分级系统
10. **铸造测试代币** - 为测试提供初始代币
11. **更新前端配置** - 自动更新合约地址

### 4.3 预期输出

**Pharos Testnet:**
```
=====================================================
     Pharos Vault - Testnet Deployment Script
=====================================================

Network: pharosTestnet (Chain ID: 688689)
Deployer: 0xYourAddress...
Balance: 1.5 ETH

Deployment Parameters:
├── Fee Recipient: 0xYourAddress...
├── Yield Provider: 0xYourAddress...
├── RWA Strategy APY: 5 %
└── Lending Strategy APY: 3 %

Step 1/5: Deploying MockUSDC...
✓ MockUSDC deployed: 0x...

Step 2/5: Deploying PharosVault...
✓ PharosVault deployed: 0x...

Step 3/5: Deploying MockRWAYieldStrategy...
✓ RWA Strategy deployed: 0x...

Step 4/5: Deploying SimpleLendingStrategy...
✓ Lending Strategy deployed: 0x...

Step 5/5: Configuring Vault...
  ✓ RWA Strategy added
  ✓ Lending Strategy added
  ✓ Minted 2,000,000 USDC
  ✓ Yield provider approved

Step 6: Deploying advanced modules...
  ✓ MockRWAVault deployed: 0x...
  ✓ RWAAdapterStrategy deployed: 0x...
  ✓ MockZkVerifier deployed: 0x...
  ✓ PorRegistry deployed: 0x...
  ✓ PharosTimelock deployed: 0x...
  ✓ TrancheManager deployed: 0x...

=====================================================
           Deployment Complete!
=====================================================

Contract Addresses:
{
  "USDC": "0x...",
  "PharosVault": "0x...",
  "RWAYieldStrategy": "0x...",
  "SimpleLendingStrategy": "0x...",
  "RWAAdapterStrategy": "0x...",
  "PorRegistry": "0x...",
  "TrancheManager": "0x...",
  "PharosTimelock": "0x..."
}

✓ Frontend addresses updated successfully!
```

**Sepolia Testnet:**
```
Network: sepolia (Chain ID: 11155111)
Deployer: 0xYourAddress...
Balance: 0.2 ETH
...
```

### 4.4 保存合约地址

部署完成后，合约地址会：
1. 显示在终端输出中
2. 保存在 `pharos-vault/deployments/` 目录
3. 自动更新到 `frontend/src/lib/contracts/addresses.ts`

如果自动更新失败，需要手动更新前端配置。

---

## 5. 运行单元测试

所有合约在部署前应通过本地测试。当前项目包含 5 个测试文件，共 68 个测试用例。

### 5.1 运行全部测试

```bash
cd pharos-vault

# 运行所有测试
npm test
```

预期输出：
```
  Advanced Features
    Cached Accounting
      ✔ totalDeployedAssets tracks allocations
      ✔ totalAssets == idle + cached deployed
      ✔ deposit emits VaultSnapshot
    Keeper Integration
      ✔ harvestNext round-robins through strategies
      ✔ checkUpkeep returns correct strategy
      ✔ performUpkeep harvests the specified strategy
      ✔ checker (Gelato) returns executable payload
    zk-POR Registry
      ✔ should accept valid proofs
      ✔ should mark unhealthy when reserves < liabilities
      ✔ should reject unauthorized attesters
      ✔ owner can add/remove attesters
    Timelock Governance
      ✔ should deploy with correct min delay
      ✔ owner can schedule + execute vault admin actions via timelock
    RWA Adapter Strategy
      ✔ deposits into external ERC4626 vault
      ✔ reflects yield from external vault
      ✔ withdraws from external vault when needed
    Tranche System
      ✔ deploys senior and junior tranche tokens
      ✔ senior deposit mints tranche shares
      ✔ junior deposit mints tranche shares
      ✔ waterfall distributes yield correctly
    Weighted APY
      ✔ should return weighted APY based on debt allocation

  PharosVault
    ...37 existing tests...

  68 passing
```

### 5.2 测试文件说明

| 测试文件 | 用例数 | 覆盖范围 |
|---------|--------|---------|
| `test/PharosVault.test.ts` | 21 | 核心 Vault：部署、存取款、策略管理、费用、紧急模式、ERC4626 兼容性 |
| `test/Strategies.test.ts` | 16 | 策略：RWA 收益计算、Lending 利息、多策略管理、策略迁移、紧急提取 |
| `test/Advanced.test.ts` | 21 | 新功能：缓存记账、Keeper 集成、zk-POR、Timelock、RWA 适配器、Tranche 分级、加权 APY |
| `test/MultiAssetVault.test.ts` | 5 | 多资产存入（WBTC/WBNB->USDC）与自动分配 |
| `test/PendingAccounting.test.ts` | 5 | RWA 异步 pending 结算、分段 APY、realized APY |

### 5.3 运行单个测试文件

```bash
# 只运行高级功能测试
npx hardhat test test/Advanced.test.ts

# 只运行核心 Vault 测试
npx hardhat test test/PharosVault.test.ts

# 只运行策略测试
npx hardhat test test/Strategies.test.ts
```

### 5.4 运行覆盖率报告

```bash
npm run test:coverage
```

### 5.5 关键测试场景说明

#### Keeper 自动复投

```
harvestNext()  →  round-robin 轮询所有策略，每次调用只收获 1 个策略（省 Gas）
checkUpkeep()  →  Chainlink Automation 兼容，返回需要收获的策略地址
checker()      →  Gelato Ops 兼容，返回可执行的 payload
performUpkeep  →  Chainlink 调用此函数执行实际收获
```

#### zk-POR 证明

```
submitProof()  →  提交 zk 证明 + public inputs (reserves, liabilities, merkleRoot)
isHealthy()    →  检查最新证明是否 reserves >= liabilities
latestProof()  →  获取最新的证明记录
```

#### Tranche 瀑布分配

```
depositSenior()    →  存入 Senior 分级（优先收益）
depositJunior()    →  存入 Junior 分级（吸收损失）
executeWaterfall() →  执行收益瀑布分配:
                      1. Senior 先获得目标 APR（如 3%）
                      2. 剩余收益归 Junior
                      3. 亏损时 Junior 先承担
```

---

## 6. 启动前端

### 5.1 确认合约地址已更新

检查 `frontend/src/lib/contracts/addresses.ts`：

```typescript
export const PHAROS_TESTNET_CONTRACTS = {
  USDC: '0x实际部署的地址' as `0x${string}`,
  PharosVault: '0x实际部署的地址' as `0x${string}`,
  RWAYieldStrategy: '0x实际部署的地址' as `0x${string}`,
  SimpleLendingStrategy: '0x实际部署的地址' as `0x${string}`,
  RWAAdapterStrategy: '0x实际部署的地址' as `0x${string}`,
  PorRegistry: '0x实际部署的地址' as `0x${string}`,
  TrancheManager: '0x实际部署的地址' as `0x${string}`,
  PharosTimelock: '0x实际部署的地址' as `0x${string}`,
} as const;
```

### 6.2 启动开发服务器

```bash
cd frontend

# 启动开发服务器
npm run dev
```

### 6.3 访问应用

打开浏览器访问：http://localhost:3000

| 页面 | URL | 说明 |
|------|-----|------|
| 首页 Dashboard | http://localhost:3000 | 总览 & 功能介绍 |
| Live Vault | http://localhost:3000/vault/live | 实时 Vault 数据、存取款操作 |
| 透明度仪表板 | http://localhost:3000/transparency | zk-POR、Tranche、Keeper 状态 |
| Portfolio | http://localhost:3000/portfolio | 用户持仓 |

---

## 7. 测试功能

### 7.1 连接钱包

1. 点击页面右上角的 "Connect Wallet"
2. 选择 MetaMask
3. 确保已切换到 Pharos Testnet

### 7.2 铸造测试代币

在 Vault 详情页，点击 "🪙 Mint 10,000 Test USDC" 按钮获取测试 USDC。

### 7.3 存款测试

1. 进入 Vault 页面
2. 选择 "Deposit" 标签
3. 输入存款金额（如 1000）
4. 点击 "Deposit" 按钮
5. 确认 MetaMask 交易（可能需要两次：一次 Approve，一次 Deposit）

### 7.3.1 Owner 操作：将 Idle Assets 分配到策略

适用场景：前端显示 `Idle Assets` > 0，但 `Deployed to Strategies` = 0，说明资金仅停留在 Vault 内部，尚未投入策略。

操作步骤（必须使用部署合约的 Owner 钱包）：

```bash
cd pharos-vault
npx hardhat console --network sepolia
```

```javascript
// 1) 选择最新部署文件（替换为你的文件名）
const deployment = require("./deployments/sepolia-xxxxxxxxxxxx.json");

// 2) 获取 Vault
const vault = await ethers.getContractAt("PharosVault", deployment.contracts.PharosVault);

// 3) 读取 Idle Assets，并按 60/40 分配
const idle = await vault.idleAssets();
const rwa = (idle * 60n) / 100n;
const lending = idle - rwa;

// 4) 分配到策略（触发投资）
await (await vault.allocateToStrategy(deployment.contracts.RWAYieldStrategy, rwa)).wait();
await (await vault.allocateToStrategy(deployment.contracts.SimpleLendingStrategy, lending)).wait();

// 5) 查看结果
const deployed = await vault.deployedAssets();
const pending = await vault.pendingAssets();
console.log("Deployed to Strategies:", ethers.formatUnits(deployed, 6), "USDC");
console.log("Pending (async RWA):", ethers.formatUnits(pending, 6), "USDC");

// 6) RWA 成交后再执行落地（例如 T+1）
await (await vault.executePendingInvestment(deployment.contracts.RWAYieldStrategy, pending)).wait();
```

提示：
- 只能由 Owner 执行，否则会 revert：`Ownable: caller is not the owner`
- Sepolia 用 `deployments/sepolia-*.json`，Pharos Testnet 用 `deployments/pharos-testnet-*.json`
- 当前默认 RWA 为 async：先进入 `pendingAssets`，执行 `executePendingInvestment` 后才进入 `deployedAssets`

### 7.4 查看持仓

存款后，你可以看到：
- 持有的 Vault 份额 (pvUSDC)
- 当前价值
- 存取款按钮

### 7.5 收获收益

1. 在策略列表中，点击 "🌾 Harvest Yield" 按钮收获单个策略
2. 或点击 "🌾 Harvest All" 收获所有策略
3. 收益会自动复投

### 7.6 模拟收益（测试环境）

由于测试网上策略不会真正产生收益，我们提供了脚本来模拟收益产生。

#### 方式一：使用命令行脚本（推荐）

```bash
cd pharos-vault

# Sepolia 测试网
npm run simulate:yield

# Pharos 测试网
npm run simulate:yield:pharos
```

脚本会自动：
1. 铸造 USDC 作为模拟收益
2. 注入收益到策略合约
3. 触发 harvestAll 收割收益

#### 方式二：使用 Hardhat Console

```bash
cd pharos-vault
npx hardhat console --network sepolia
```

然后在控制台执行：

```javascript
// 获取合约
const vault = await ethers.getContractAt("PharosVault", "0x666057e10bd322189Fa65EE94Ad889717F1FB6c7");
const usdc = await ethers.getContractAt("MockUSDC", "0x4a0EDB585AB395A901Ce8EF9433Bbc27e4ed1453");
const rwaStrategy = await ethers.getContractAt("MockRWAYieldStrategy", "0xCd57578e511d628E4542712233a5275DcDf51839");

// 检查当前状态
const totalAssets = await vault.totalAssets();
console.log("Total Assets:", ethers.formatUnits(totalAssets, 6), "USDC");

// 铸造并注入收益 (100 USDC 模拟收益)
const yieldAmount = ethers.parseUnits("100", 6);
await usdc.mint((await ethers.getSigners())[0].address, yieldAmount);
await usdc.approve(await rwaStrategy.getAddress(), yieldAmount);
await rwaStrategy.injectYield(yieldAmount);

// 触发收割
await vault.harvestAll();

// 查看新的总资产
const newTotalAssets = await vault.totalAssets();
console.log("New Total Assets:", ethers.formatUnits(newTotalAssets, 6), "USDC");
```

#### 收益机制说明

| 策略 | 模拟 APY | 收益来源 |
|------|---------|---------|
| MockRWAYieldStrategy | 5% | yieldProvider 地址提供，或通过 injectYield() 注入 |
| SimpleLendingStrategy | 3% | 类似机制 |
| RWAAdapterStrategy | 5% | 通过外部 ERC4626 RWA 金库产生，测试时用 MockRWAVault.addYield() |

**真实环境 vs 测试环境：**

- **真实环境：** 策略会与 Ondo Finance、Backed Finance 等 RWA 协议集成，自动产生收益
- **测试环境：** 需要手动注入 USDC 模拟收益，然后调用 harvest 收割

### 7.7 提款测试

1. 选择 "Withdraw" 标签
2. 输入提款金额
3. 点击 "Withdraw" 按钮
4. 确认交易

---

## 8. 高级功能操作

### 8.1 Keeper 自动收获（Chainlink / Gelato）

部署后，Vault 支持 Chainlink Automation 和 Gelato Ops 自动触发收获。

#### 手动触发 round-robin 收获

```bash
npx hardhat console --network sepolia
```

```javascript
const vault = await ethers.getContractAt("PharosVault", "0xVaultAddress");

// 查看是否有策略需要收获
const [needed, data] = await vault.checkUpkeep("0x");
console.log("Upkeep needed:", needed);

// 手动触发 round-robin 收获（一次只收获一个策略，省 Gas）
await vault.harvestNext();

// 查看当前轮询索引
const idx = await vault.nextHarvestIndex();
console.log("Next harvest index:", idx.toString());
```

#### 注册 Chainlink Automation

1. 前往 [Chainlink Automation](https://automation.chain.link/)
2. 选择 "Custom logic" Upkeep
3. 填入 PharosVault 合约地址
4. Vault 的 `checkUpkeep` 和 `performUpkeep` 函数会自动被调用

#### 注册 Gelato Ops

1. 前往 [Gelato Network](https://app.gelato.network/)
2. 创建新任务，选择 "Resolver" 模式
3. Resolver 合约 = PharosVault 地址
4. Resolver 函数 = `checker()`
5. 执行函数 = `harvestStrategy(address)`

### 8.2 zk-Proof of Reserve 操作

#### 提交储备金证明

```bash
npx hardhat console --network sepolia
```

```javascript
const porRegistry = await ethers.getContractAt("PorRegistry", "0xPorRegistryAddress");

// 构造 public inputs: (totalReserves, totalLiabilities, merkleRoot)
const publicInputs = ethers.AbiCoder.defaultAbiCoder().encode(
  ["uint256", "uint256", "bytes32"],
  [
    ethers.parseUnits("1000000", 6),  // 1M USDC reserves
    ethers.parseUnits("900000", 6),   // 900K USDC liabilities
    ethers.ZeroHash                    // merkle root (demo)
  ]
);

// 提交证明
await porRegistry.submitProof("0x1234", publicInputs);

// 检查健康状态
const healthy = await porRegistry.isHealthy();
console.log("Vault is healthy:", healthy);

// 查看最新证明
const latest = await porRegistry.latestProof();
console.log("Reserves:", ethers.formatUnits(latest.totalReserves, 6));
console.log("Liabilities:", ethers.formatUnits(latest.totalLiabilities, 6));
console.log("Verified:", latest.verified);
```

#### 添加/移除证明提交者

```javascript
// 授权新的 attester
await porRegistry.setAttester("0xNewAttesterAddress", true);

// 撤销授权
await porRegistry.setAttester("0xOldAttesterAddress", false);
```

### 8.3 Tranche 分级存款操作

#### Senior 分级（低风险，固定目标收益）

```javascript
const trancheManager = await ethers.getContractAt("TrancheManager", "0xTrancheManagerAddress");
const usdc = await ethers.getContractAt("MockUSDC", "0xUSDCAddress");
const [deployer] = await ethers.getSigners();

// 授权 TrancheManager 使用 USDC
await usdc.approve(await trancheManager.getAddress(), ethers.MaxUint256);

// 存入 Senior（1000 USDC）
const amount = ethers.parseUnits("1000", 6);
await trancheManager.depositSenior(amount, deployer.address);

// 查看 Senior 分级资产
const seniorAssets = await trancheManager.seniorTotalAssets();
console.log("Senior Total Assets:", ethers.formatUnits(seniorAssets, 6));
```

#### Junior 分级（高风险，更高收益潜力）

```javascript
// 存入 Junior（1000 USDC）
await trancheManager.depositJunior(amount, deployer.address);

// 查看 Junior 分级资产
const juniorAssets = await trancheManager.juniorTotalAssets();
console.log("Junior Total Assets:", ethers.formatUnits(juniorAssets, 6));
```

#### 执行瀑布分配

```javascript
// 在收获收益后，执行 waterfall 分配不同 tranche 的收益
await trancheManager.executeWaterfall();
```

#### 赎回

```javascript
// 赎回 Senior（全部份额）
const seniorAddr = await trancheManager.seniorTranche();
const seniorVault = await ethers.getContractAt("TrancheVault", seniorAddr);
const shares = await seniorVault.balanceOf(deployer.address);
await trancheManager.redeemSenior(shares, deployer.address);
```

### 8.4 Timelock 治理操作

所有管理操作都可以通过 Timelock 执行，确保 24 小时延迟。

```javascript
const vault = await ethers.getContractAt("PharosVault", "0xVaultAddress");
const timelock = await ethers.getContractAt("PharosTimelock", "0xTimelockAddress");

// 1) 将 Vault 所有权转移给 Timelock
await vault.transferOwnership(await timelock.getAddress());

// 2) 通过 Timelock 调度管理操作（如修改管理费为 3%）
const callData = vault.interface.encodeFunctionData("setManagementFee", [300]);
await timelock.schedule(
  await vault.getAddress(), 0, callData,
  ethers.ZeroHash, ethers.ZeroHash, 86400  // 24h delay
);

// 3) 等待 24 小时后执行
// await timelock.execute(vaultAddr, 0, callData, ethers.ZeroHash, ethers.ZeroHash);
```

### 8.5 RWA 适配器策略操作

```javascript
const rwaAdapter = await ethers.getContractAt("RWAAdapterStrategy", "0xAdapterAddress");
const rwaVault = await ethers.getContractAt("MockRWAVault", "0xRWAVaultAddress");
const usdc = await ethers.getContractAt("MockUSDC", "0xUSDCAddress");

// 模拟外部 RWA 金库产生收益
const yieldAmount = ethers.parseUnits("500", 6);
await usdc.mint((await ethers.getSigners())[0].address, yieldAmount);
await usdc.approve(await rwaVault.getAddress(), yieldAmount);
await rwaVault.addYield(yieldAmount);

// 收获适配器策略（将外部收益同步到 Vault）
const vault = await ethers.getContractAt("PharosVault", "0xVaultAddress");
await vault.harvestStrategy(await rwaAdapter.getAddress());

// 查看适配器持有的外部金库份额
const shares = await rwaAdapter.rwaShares();
console.log("RWA shares held:", shares.toString());
```

### 8.6 透明度仪表板

部署后访问 http://localhost:3000/transparency 可查看：

| 模块 | 展示内容 |
|------|---------|
| **Key Metrics** | TVL、Projected/Realized APY、Idle/Pending/Deployed、份额价格与最大回撤 |
| **zk-Proof of Reserve** | 储备金健康状态、储备率、最新证明详情、验证状态 |
| **Keeper Status** | Chainlink Upkeep 状态、Gelato 可执行状态、轮询索引 |
| **Risk Tranches** | Senior/Junior 存款、总资产、目标APR、瀑布分配比例条 |
| **Asset Composition** | 闲置/待成交/已部署资金分布条、活跃策略列表 |
| **Fee & Governance** | 管理费、绩效费、存款限额、Timelock 地址 |

---

## 9. 常见问题

### Q1: 部署时提示 "insufficient funds"

**原因：** 钱包没有足够的测试网 ETH (PTT) 支付 Gas

**解决：** 通过水龙头获取更多测试代币

### Q2: 交易一直 Pending

**原因：** 可能是 Gas Price 设置太低或网络拥堵

**解决：**
1. 在 MetaMask 中取消交易
2. 重新发起并设置更高的 Gas Price

### Q3: 前端显示 "Contracts not deployed"

**原因：** 合约地址未正确配置

**解决：**
1. 确认 `.env` 文件配置正确
2. 重新运行部署脚本
3. 手动更新 `frontend/src/lib/contracts/addresses.ts`

### Q4: MetaMask 无法连接

**原因：** 网络配置错误

**解决：**
1. 检查网络配置是否正确
2. Pharos Testnet: Chain ID 应为 688689，RPC URL 应为 https://testnet.dplabs-internal.com
3. Sepolia: Chain ID 应为 11155111，RPC URL 应为 https://ethereum-sepolia-rpc.publicnode.com

### Q5: Pharos 测试网部署失败

**原因：** Pharos 测试网可能有特殊的部署限制

**解决：**
1. 先使用 Sepolia 测试网进行开发：`npm run deploy:sepolia`
2. 联系 Hackathon 组织方咨询 Pharos 测试网的部署权限
3. 确认账户是否需要白名单

### Q6: 交易失败 "execution reverted"

**原因：** 合约执行失败，可能是参数错误或状态不满足

**解决：**
1. 检查输入金额是否有效
2. 确保有足够的代币余额
3. 检查是否已 Approve

### Q7: 如何验证合约？

```bash
cd pharos-vault

# 验证单个合约
npx hardhat verify --network pharosTestnet <合约地址> <构造函数参数...>

# 例如验证 MockUSDC（无构造函数参数）
npx hardhat verify --network pharosTestnet 0x1234...
```

---

## 附录：项目架构

### 智能合约

```
pharos-vault/contracts/
├── PharosVault.sol              # 主 Vault 合约 (ERC4626, Gas 优化, Keeper 兼容)
├── PharosTimelock.sol           # 24h 治理延迟锁
├── PorRegistry.sol              # zk-POR 链上注册中心
├── interfaces/
│   ├── IStrategy.sol            # 策略接口
│   └── IZkPorVerifier.sol       # zk 证明验证器接口
├── strategies/
│   ├── BaseStrategy.sol         # 策略基类
│   ├── MockRWAYieldStrategy.sol # RWA 收益策略
│   ├── SimpleLendingStrategy.sol# 借贷策略
│   └── RWAAdapterStrategy.sol   # ERC4626 RWA 适配器
├── tranches/
│   ├── TrancheManager.sol       # Senior/Junior 风险管理
│   └── TrancheVault.sol         # 分级代币
└── mocks/
    ├── MockUSDC.sol             # 测试用 USDC
    ├── MockZkVerifier.sol       # zk 验证器桩
    └── MockRWAVault.sol          # 外部 RWA 金库模拟
```

### 测试

```
pharos-vault/test/
├── PharosVault.test.ts     # 核心 Vault 测试 (21 cases)
├── Strategies.test.ts      # 策略测试 (16 cases)
├── Advanced.test.ts        # 高级功能测试 (21 cases)
├── MultiAssetVault.test.ts # 多资产存入与路由测试 (5 cases)
└── PendingAccounting.test.ts # Pending 结算与分段 APY 测试 (5 cases)
    ├─ Cached Accounting      # 缓存记账 & VaultSnapshot
    ├─ Keeper Integration      # harvestNext, checkUpkeep, checker
    ├─ zk-POR Registry         # 证明提交, 健康检查, 权限控制
    ├─ Timelock Governance     # 调度 + 延迟执行
    ├─ RWA Adapter Strategy    # 外部金库存取, 收益同步
    ├─ Tranche System          # 分级存款, 瀑布分配
    └─ Weighted APY            # 加权 APY 计算
```

### 前端

```
frontend/src/
├── app/
│   ├── page.tsx                   # 首页 Dashboard
│   ├── vault/live/page.tsx         # 实时 Vault 页面
│   └── transparency/page.tsx      # 透明度仪表板 (zk-POR, Tranche, Keeper)
├── hooks/
│   ├── useVault.ts               # Vault 读取 hooks
│   ├── useVaultActions.ts        # Vault 写操作 hooks
│   ├── usePoR.ts                 # zk-POR 状态 hook
│   ├── useTranches.ts            # Tranche 分级数据 hook
│   └── useKeeperStatus.ts        # Keeper 状态 hook
├── lib/
│   ├── wagmi.ts                  # Wagmi 配置
│   └── contracts/
│       ├── abis.ts               # 合约 ABI (Vault, Strategy, PorRegistry, TrancheManager)
│       └── addresses.ts          # 合约地址 (多网络)
└── components/
    ├── vault/
    │   ├── VaultActions.tsx      # 存取款组件
    │   ├── VaultInfoLive.tsx     # 实时 Vault 信息
    │   ├── StrategyListLive.tsx  # 策略列表
    │   └── UserPositionLive.tsx  # 用户持仓
    ├── dashboard/
    │   ├── Hero.tsx
    │   ├── StatsOverview.tsx
    │   └── TransparencyCards.tsx # 功能介绍卡片
    └── layout/
        └── Header.tsx            # 导航栏
```

---

## 联系方式

如有问题，请联系：
- GitHub Issues
- Discord: [Pharos Discord]
- Email: team@pharos.xyz

**祝部署顺利！🚀**

