# Pharos Vault - RWA Yield Infrastructure

<div align="center">

![Pharos Vault](https://img.shields.io/badge/Pharos-Vault-blue?style=for-the-badge)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![ERC4626](https://img.shields.io/badge/Standard-ERC4626-purple?style=for-the-badge)

**为 Pharos 链构建的资产管理与收益基础设施**

[English](#english) | [中文](#中文)

</div>

---

## 中文

### 🎯 项目概述

Pharos Vault 是一个符合 ERC4626 标准的收益型保险库协议，专为 Pharos 链设计，支持用户一键捕获多元化的 RWA (Real World Assets) 资产收益。

### ✨ 核心功能

| 功能 | 描述 |
|------|------|
| 🏦 **ERC4626 标准** | 完全兼容 Pharos 标准的收益型代币接口 |
| 📊 **多策略管理** | 支持多个收益策略的自动管理和资金分配 |
| 💰 **动态费率** | 管理费和绩效费的自动化计算与收取 |
| 🌾 **自动复投** | Chainlink Automation + Gelato Ops 轮询收获，gas 最优 |
| 📈 **透明度看板** | 实时展示资产组合、收益率、zk-POR 和 Tranche 数据 |
| 🔒 **紧急模式** | 支持紧急暂停和资金撤回机制 |
| 🛡️ **zk-Proof of Reserve** | 链上零知识证明验证储备金充足性 |
| ⚖️ **Senior/Junior 风险分级** | 瀑布分配模型——Senior 优先收益、Junior 吸收损失 |
| ⏳ **Timelock 治理** | 24 小时延迟锁，确保管理操作透明可审计 |
| 🔗 **RWA 协议适配器** | ERC4626-to-ERC4626 适配器，对接任意外部 RWA 收益源 |

### 🛠 技术栈

**智能合约:**
- Solidity 0.8.20
- Hardhat
- OpenZeppelin Contracts 5.0

**前端:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- wagmi + viem

### 📁 项目结构

```
pharos-vault-initial/
├── pharos-vault/          # 智能合约
│   ├── contracts/
│   │   ├── PharosVault.sol           # 主 Vault 合约 (Gas优化 + Keeper兼容)
│   │   ├── PharosTimelock.sol        # 治理延迟锁
│   │   ├── PorRegistry.sol           # zk-POR 链上注册中心
│   │   ├── interfaces/
│   │   │   ├── IStrategy.sol
│   │   │   └── IZkPorVerifier.sol    # zk证明验证器接口
│   │   ├── strategies/
│   │   │   ├── BaseStrategy.sol
│   │   │   ├── MockRWAYieldStrategy.sol
│   │   │   ├── SimpleLendingStrategy.sol
│   │   │   └── RWAAdapterStrategy.sol # ERC4626 RWA 适配器
│   │   ├── tranches/
│   │   │   ├── TrancheManager.sol     # Senior/Junior 风险管理
│   │   │   └── TrancheVault.sol       # 分级代币
│   │   └── mocks/
│   │       ├── MockUSDC.sol
│   │       ├── MockZkVerifier.sol     # zk验证器桩
│   │       └── MockRWAVault.sol       # 外部RWA金库模拟
│   ├── test/
│   │   ├── PharosVault.test.ts
│   │   ├── Strategies.test.ts
│   │   └── Advanced.test.ts          # 新功能集成测试 (21 cases)
│   └── scripts/
│       ├── deploy.ts
│       └── deploy-pharos-testnet.ts
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── app/
│   │   │   ├── vault/live/           # 实时 Vault 页面
│   │   │   └── transparency/         # 透明度仪表板
│   │   ├── hooks/
│   │   │   ├── useVault.ts           # Vault 读取
│   │   │   ├── useVaultActions.ts    # Vault 写入
│   │   │   ├── usePoR.ts            # zk-POR 状态
│   │   │   ├── useTranches.ts       # 分级数据
│   │   │   └── useKeeperStatus.ts   # Keeper 状态
│   │   ├── lib/contracts/
│   │   └── components/
└── DEPLOYMENT_GUIDE.md
```

### 🚀 快速开始

#### 1. 安装依赖

```bash
# 安装合约依赖
cd pharos-vault
npm install

# 安装前端依赖
cd ../frontend
npm install
```

#### 2. 配置环境

```bash
cd pharos-vault
cp .env.example .env
# 编辑 .env 填入你的私钥
```

#### 3. 部署到 Pharos 测试网

```bash
npm run deploy:pharos-testnet
```

#### 4. 启动前端

```bash
cd frontend
npm run dev
```

访问 http://localhost:3000/vault/live 查看实时数据

### 📖 详细部署教程

请参阅 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 获取完整的部署步骤。

### 🌐 Pharos 测试网配置

| 配置项 | 值 |
|--------|------|
| 网络名称 | Pharos Testnet |
| RPC URL | https://testnet.dplabs-internal.com |
| Chain ID | 688689 |
| 货币符号 | PTT |
| 区块浏览器 | https://testnet.pharosscan.xyz |

---

## English

### 🎯 Project Overview

Pharos Vault is an ERC4626-compliant yield vault protocol designed for the Pharos chain, enabling users to capture diversified RWA (Real World Assets) yields with one click.

### ✨ Core Features

- **ERC4626 Standard** - Fully compatible with the tokenized vault standard
- **Multi-Strategy Management** - Automatic management and fund allocation across strategies
- **Dynamic Fees** - Automated calculation of management and performance fees
- **Auto-Compound** - Chainlink Automation + Gelato Ops round-robin harvest for gas efficiency
- **zk-Proof of Reserve** - On-chain zero-knowledge proof verifying reserve adequacy
- **Senior/Junior Tranches** - Waterfall yield distribution with first-loss protection
- **Timelock Governance** - 24-hour delay lock on admin operations
- **RWA Protocol Adapter** - ERC4626-to-ERC4626 adapter for external RWA yield sources
- **Transparency Dashboard** - Real-time portfolio, APY, zk-POR, and tranche data
- **Emergency Mode** - Emergency pause and fund withdrawal mechanisms
- **Pending Settlement Bucket** - Async RWA allocations are accounted as `pendingAssets` before final investment
- **Dual APY Metrics** - `projectedAPY` (bucket-weighted) + `realizedAPY` (annualized PPS change)

### Pending Settlement Model

When a strategy is marked async (`setStrategyAsync(strategy, true)`), auto-allocation does not immediately invest funds:

1. Funds are reserved in `pendingAssets`.
2. `projectedAPY` includes pending bucket APY (`pendingAPY`) during settlement delay.
3. Operator finalizes execution with `executePendingInvestment(strategy, amount)`.

Useful view functions:

- `getAssetBreakdown()` -> idle / pending / deployed / freeIdle
- `maxDrawdownBps()` -> PPS-based max drawdown

### 🔧 Quick Start

```bash
# Install dependencies
cd pharos-vault && npm install
cd ../frontend && npm install

# Configure environment
cd ../pharos-vault && cp .env.example .env

# Deploy to Pharos Testnet
npm run deploy:pharos-testnet

# Start frontend
cd ../frontend && npm run dev
```

### 📝 License

MIT License

---

<div align="center">

**Built for the 2026 GWDC Hackathon**

🔗 [Pharos Network](https://pharos.xyz) | 📚 [Documentation](./DEPLOYMENT_GUIDE.md)

</div>
