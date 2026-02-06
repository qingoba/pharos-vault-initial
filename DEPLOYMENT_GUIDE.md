# Pharos Vault - 测试网部署完整教程

本文档提供了在测试网上部署 Pharos Vault 的详细步骤。支持两个测试网：

- **Pharos Testnet** - Pharos 官方测试网（推荐用于正式提交）
- **Sepolia Testnet** - 以太坊 Sepolia 测试网（用于开发测试）

## 目录

1. [环境准备](#1-环境准备)
2. [获取测试网代币](#2-获取测试网代币)
3. [配置部署环境](#3-配置部署环境)
4. [部署智能合约](#4-部署智能合约)
5. [启动前端](#5-启动前端)
6. [测试功能](#6-测试功能)
7. [常见问题](#7-常见问题)

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
Compiled 10 Solidity files successfully
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
2. **部署 PharosVault** - 主要的 Vault 合约
3. **部署 MockRWAYieldStrategy** - RWA 收益策略（5% APY）
4. **部署 SimpleLendingStrategy** - 借贷策略（3% APY）
5. **配置 Vault** - 添加策略，设置分配比例
6. **铸造测试代币** - 为测试提供初始代币
7. **更新前端配置** - 自动更新合约地址

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

=====================================================
           Deployment Complete!
=====================================================

Contract Addresses:
{
  "USDC": "0x...",
  "PharosVault": "0x...",
  "RWAYieldStrategy": "0x...",
  "SimpleLendingStrategy": "0x..."
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

## 5. 启动前端

### 5.1 确认合约地址已更新

检查 `frontend/src/lib/contracts/addresses.ts`：

```typescript
export const PHAROS_TESTNET_CONTRACTS = {
  USDC: '0x实际部署的地址' as `0x${string}`,
  PharosVault: '0x实际部署的地址' as `0x${string}`,
  RWAYieldStrategy: '0x实际部署的地址' as `0x${string}`,
  SimpleLendingStrategy: '0x实际部署的地址' as `0x${string}`,
} as const;
```

### 5.2 启动开发服务器

```bash
cd frontend

# 启动开发服务器
npm run dev
```

### 5.3 访问应用

打开浏览器访问：http://localhost:3000

真实数据：http://localhost:3000/vault/live

---

## 6. 测试功能

### 6.1 连接钱包

1. 点击页面右上角的 "Connect Wallet"
2. 选择 MetaMask
3. 确保已切换到 Pharos Testnet

### 6.2 铸造测试代币

在 Vault 详情页，点击 "🪙 Mint 10,000 Test USDC" 按钮获取测试 USDC。

### 6.3 存款测试

1. 进入 Vault 页面
2. 选择 "Deposit" 标签
3. 输入存款金额（如 1000）
4. 点击 "Deposit" 按钮
5. 确认 MetaMask 交易（可能需要两次：一次 Approve，一次 Deposit）

### 6.4 查看持仓

存款后，你可以看到：
- 持有的 Vault 份额 (pvUSDC)
- 当前价值
- 存取款按钮

### 6.5 收获收益

1. 在策略列表中，点击 "🌾 Harvest Yield" 按钮收获单个策略
2. 或点击 "🌾 Harvest All" 收获所有策略
3. 收益会自动复投

### 6.6 模拟收益（测试环境）

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

**真实环境 vs 测试环境：**

- **真实环境：** 策略会与 Ondo Finance、Backed Finance 等 RWA 协议集成，自动产生收益
- **测试环境：** 需要手动注入 USDC 模拟收益，然后调用 harvest 收割

### 6.7 提款测试

1. 选择 "Withdraw" 标签
2. 输入提款金额
3. 点击 "Withdraw" 按钮
4. 确认交易

---

## 7. 常见问题

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
├── PharosVault.sol          # 主 Vault 合约 (ERC4626)
├── interfaces/
│   └── IStrategy.sol        # 策略接口
├── strategies/
│   ├── BaseStrategy.sol     # 策略基类
│   ├── MockRWAYieldStrategy.sol    # RWA 收益策略
│   └── SimpleLendingStrategy.sol   # 借贷策略
└── mocks/
    └── MockUSDC.sol         # 测试用 USDC
```

### 前端

```
frontend/src/
├── hooks/
│   ├── useVault.ts          # Vault 读取 hooks
│   └── useVaultActions.ts   # Vault 写操作 hooks
├── lib/
│   ├── wagmi.ts             # Wagmi 配置
│   └── contracts/
│       ├── abis.ts          # 合约 ABI
│       └── addresses.ts     # 合约地址
└── components/vault/
    ├── VaultActions.tsx     # 存取款组件（已连接合约）
    ├── VaultInfoLive.tsx    # 实时 Vault 信息
    └── StrategyListLive.tsx # 策略列表
```

---

## 联系方式

如有问题，请联系：
- GitHub Issues
- Discord: [Pharos Discord]
- Email: team@pharos.xyz

**祝部署顺利！🚀**
