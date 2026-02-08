# Pharos Vault - ERC4626 收益保险库

<div align="center">

![Pharos Vault](https://img.shields.io/badge/Pharos-Vault-blue)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)
![ERC4626](https://img.shields.io/badge/Standard-ERC4626-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

**一个符合 ERC4626 标准的模块化收益保险库系统，支持多策略管理和动态费率**

</div>

---

## 2026-02 Update Summary

The vault now supports delayed RWA execution with explicit pending accounting:

- `setStrategyAsync(strategy, true)` marks strategy as async settlement.
- `pendingAssets` tracks reserved capital before external RWA execution.
- `executePendingInvestment(strategy, amount)` finalizes pending into deployed debt.
- `projectedAPY()` uses weighted idle/pending/deployed buckets.
- `realizedAPY()` and `maxDrawdownBps()` provide PPS-based performance metrics.

Additional tests were added in:

- `test/MultiAssetVault.test.ts`
- `test/PendingAccounting.test.ts`

Current suite: **68 passing tests**.

---

## 📋 目录

- [项目概述](#-项目概述)
- [核心功能](#-核心功能)
- [架构设计](#-架构设计)
- [快速开始](#-快速开始)
- [测试指南](#-测试指南)
- [合约详解](#-合约详解)
- [策略开发指南](#-策略开发指南)
- [使用流程](#-使用流程)
- [API 参考](#-api-参考)
- [安全考虑](#-安全考虑)
- [TODO 列表](#-todo-列表)

---

## 🎯 项目概述

Pharos Vault 是一个为 Pharos 区块链生态设计的收益保险库基础设施，旨在让用户能够一键捕获多元化的收益来源，包括但不限于：

- 🏦 **RWA 收益**: 代币化美债、贸易融资等真实世界资产的收益
- 💰 **DeFi 借贷**: Aave、Compound 等借贷协议的利息
- 🌾 **流动性挖矿**: DEX 流动性提供者奖励
- 📈 **Staking 收益**: PoS 质押奖励

### 符合要求

✅ **Vault 标准**: 完全符合 ERC4626 标准，确保可组合性  
✅ **策略合约**: 实现了 RWA 收益策略和借贷策略  
✅ **动态费率管理**: 支持管理费和绩效费的自动化计算与收取  
✅ **透明度**: 提供完整的资产查询接口

---

## ✨ 核心功能

### 1. ERC4626 标准接口
```
deposit(assets, receiver) → shares      // 存款
mint(shares, receiver) → assets         // 按份额铸造
withdraw(assets, receiver, owner) → shares  // 提现
redeem(shares, receiver, owner) → assets    // 赎回
```

### 2. 多策略管理
- 最多支持 10 个策略同时运行
- 每个策略可配置资金分配比例 (debtRatio)
- 支持策略的添加、移除和迁移

### 3. 动态费率
- **管理费**: 基于 AUM 的年化费率 (默认 2%)
- **绩效费**: 基于策略收益的费率 (默认 10%)
- 费用自动累积，支持一键领取

### 4. 紧急功能
- 紧急模式: 暂停存款，保留提现能力
- 紧急撤回: 一键从所有策略撤回资金

---

## 🏗 架构设计

```
┌────────────────────────────────────────────────────────────────┐
│                         用户层                                  │
│                    deposit / withdraw                           │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                    PharosVault (ERC4626)                       │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐  │
│  │ 份额管理     │ 策略管理     │ 费率管理     │ 紧急控制    │  │
│  │ - deposit    │ - addStrategy│ - mgmtFee    │ - shutdown  │  │
│  │ - withdraw   │ - allocate   │ - perfFee    │ - emergency │  │
│  │ - redeem     │ - harvest    │ - claimFees  │ - pause     │  │
│  └──────────────┴──────────────┴──────────────┴─────────────┘  │
└───────────────────────────┬────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  RWA Strategy    │ │ Lending Strategy │ │  Other Strategy  │
│  ┌────────────┐  │ │  ┌────────────┐  │ │  ┌────────────┐  │
│  │ 美债收益   │  │ │  │ 借贷利息   │  │ │  │ 其他收益   │  │
│  │ 5% APY     │  │ │  │ 3% APY     │  │ │  │ ? APY      │  │
│  └────────────┘  │ │  └────────────┘  │ │  └────────────┘  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm 或 npm
- Git

### 安装步骤

```bash
# 1. 进入项目目录
cd pharos-vault

# 2. 安装依赖
npm install

# 3. 编译合约
npm run compile

# 4. 运行测试
npm run test
```

### 本地部署

```bash
# 启动本地节点
npm run node

# 新终端中部署合约
npm run deploy:local
```

### 运行演示

```bash
# 运行完整工作流程演示
npx hardhat run scripts/demo.ts
```

---

## 🧪 测试指南

### 运行全部测试

```bash
npm run test
```

### 查看测试覆盖率

```bash
npm run test:coverage
```

### 运行特定测试

```bash
# 只运行 Vault 测试
npx hardhat test test/PharosVault.test.ts

# 只运行策略测试
npx hardhat test test/Strategies.test.ts
```

### 测试文件说明

| 文件 | 说明 |
|------|------|
| `test/PharosVault.test.ts` | Vault 核心功能测试：存款、提现、费用、紧急功能 |
| `test/Strategies.test.ts` | 策略测试：RWA 策略、借贷策略、收益计算、多策略管理 |

### 主要测试场景

1. **部署测试**: 验证合约参数正确初始化
2. **存款功能**: 用户存款、获得份额、限额检查
3. **策略管理**: 添加、移除、更新策略
4. **资金分配**: 分配资金到策略
5. **收获逻辑**: 收获收益、绩效费计算
6. **提现功能**: 正常提现、从策略撤回
7. **费用管理**: 管理费计算、费率更新
8. **紧急功能**: 紧急模式、紧急撤回
9. **ERC4626 兼容性**: 标准函数测试

---

## 📄 合约详解

### PharosVault.sol

**核心保险库合约，实现 ERC4626 标准。**

主要功能:
- 接收用户存款，铸造份额代币
- 管理多个收益策略
- 自动计算和收取费用
- 处理用户提现请求

关键函数:
```solidity
// 存款: 存入资产，获得份额
function deposit(uint256 assets, address receiver) returns (uint256 shares)

// 提现: 提取资产，销毁份额
function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)

// 添加策略
function addStrategy(address strategy, uint256 debtRatio) external onlyOwner

// 分配资金到策略
function allocateToStrategy(address strategy, uint256 amount) external onlyOwner

// 收获单个策略
function harvestStrategy(address strategy) external

// 收获所有策略
function harvestAll() external

// 紧急撤回
function emergencyWithdrawAll() external onlyOwner
```

### BaseStrategy.sol

**策略基类，定义策略的通用接口和行为。**

所有策略都继承此合约，必须实现以下抽象函数:

```solidity
// 将资金投入目标协议
function _invest(uint256 amount) internal virtual;

// 收获收益
function _harvest() internal virtual returns (uint256 profit);

// 从协议提取资金
function _withdraw(uint256 amount) internal virtual returns (uint256);

// 紧急撤回所有资金
function _emergencyWithdraw() internal virtual returns (uint256);
```

### MockRWAYieldStrategy.sol

**模拟 RWA (真实世界资产) 收益的策略。**

工作原理:
1. 接收来自 Vault 的资金
2. 模拟将资金投入代币化美债
3. 按照配置的 APY 生成收益
4. harvest() 时收割收益并复投

真实场景中可集成:
- **Ondo Finance (OUSG)**: 代币化短期美债
- **Backed Finance (bIB01)**: 短期政府债券
- **Maple Finance**: 贸易融资收益
- **Centrifuge**: 实物资产代币化

### SimpleLendingStrategy.sol

**模拟 DeFi 借贷协议收益的策略。**

可集成的借贷协议:
- Aave V3
- Compound V3
- Venus Protocol

---

## 🔧 策略开发指南

### 创建新策略

继承 `BaseStrategy` 合约并实现抽象函数:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseStrategy.sol";

contract MyCustomStrategy is BaseStrategy {
    constructor(
        address _vault,
        address _asset
    ) BaseStrategy(_vault, _asset, "My Custom Strategy") {}

    // 返回策略管理的总资产
    function totalAssets() public view override returns (uint256) {
        // 返回本金 + 收益
        return myPrincipal + myPendingYield;
    }

    // 投资逻辑
    function _invest(uint256 _amount) internal override {
        // 将资金存入目标协议
        IExternalProtocol(target).deposit(_amount);
    }

    // 收获逻辑
    function _harvest() internal override returns (uint256 profit) {
        // 从目标协议获取收益
        profit = IExternalProtocol(target).claimRewards();
        // 复投收益
        if (profit > 0) {
            IExternalProtocol(target).deposit(profit);
        }
    }

    // 提取逻辑
    function _withdraw(uint256 _amount) internal override returns (uint256) {
        return IExternalProtocol(target).withdraw(_amount);
    }

    // 紧急提取
    function _emergencyWithdraw() internal override returns (uint256) {
        return IExternalProtocol(target).withdrawAll();
    }
}
```

### 策略最佳实践

1. **实现 `totalAssets()`**: 准确返回策略管理的总资产
2. **处理 `_harvest()`**: 收割收益并考虑复投
3. **安全的 `_withdraw()`**: 确保能够提取请求的金额
4. **可靠的 `_emergencyWithdraw()`**: 无条件提取，接受可能的滑点

---

## 📖 使用流程

### 用户视角

```
1. 批准 Vault 使用你的代币
   usdc.approve(vaultAddress, amount)

2. 存入资产
   vault.deposit(amount, yourAddress)  // 返回份额

3. 查看收益
   vault.convertToAssets(vault.balanceOf(yourAddress))

4. 赎回
   vault.redeem(shares, yourAddress, yourAddress)  // 返回资产
```

### 管理员视角

```
1. 部署 Vault 和策略

2. 添加策略到 Vault
   vault.addStrategy(strategyAddress, 5000)  // 50% 份额

3. 分配资金到策略
   vault.allocateToStrategy(strategyAddress, amount)

4. 定期收获
   vault.harvestAll()  // 或单独收获某策略

5. 监控并调整
   vault.updateStrategyDebtRatio(strategy, newRatio)
```

### 完整示例 (TypeScript)

```typescript
import { ethers } from "hardhat";

async function example() {
  const [deployer, user] = await ethers.getSigners();
  
  // 假设合约已部署
  const vault = await ethers.getContractAt("PharosVault", VAULT_ADDRESS);
  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  
  // 用户存款
  const depositAmount = ethers.parseUnits("1000", 6); // 1000 USDC
  await usdc.connect(user).approve(VAULT_ADDRESS, depositAmount);
  await vault.connect(user).deposit(depositAmount, user.address);
  
  console.log("份额:", await vault.balanceOf(user.address));
  
  // 等待一段时间...
  
  // 管理员收获
  await vault.connect(deployer).harvestAll();
  
  // 用户查看当前价值
  const shares = await vault.balanceOf(user.address);
  const value = await vault.convertToAssets(shares);
  console.log("当前价值:", ethers.formatUnits(value, 6), "USDC");
  
  // 用户赎回
  await vault.connect(user).redeem(shares, user.address, user.address);
}
```

---

## 📚 API 参考

### PharosVault

#### 视图函数

| 函数 | 说明 | 返回 |
|------|------|------|
| `totalAssets()` | 获取 Vault 管理的总资产 | uint256 |
| `convertToShares(assets)` | 资产转换为份额 | uint256 |
| `convertToAssets(shares)` | 份额转换为资产 | uint256 |
| `previewDeposit(assets)` | 预览存款将获得的份额 | uint256 |
| `previewWithdraw(assets)` | 预览提现需要的份额 | uint256 |
| `idleAssets()` | 获取 Vault 中未分配的资产 | uint256 |
| `deployedAssets()` | 获取分配到策略的资产 | uint256 |
| `estimatedAPY()` | 获取预估年化收益率 | uint256 |
| `getStrategies()` | 获取所有策略地址 | address[] |
| `getStrategyInfo(strategy)` | 获取策略详情 | StrategyParams |

#### 写入函数

| 函数 | 说明 | 权限 |
|------|------|------|
| `deposit(assets, receiver)` | 存入资产 | 公开 |
| `withdraw(assets, receiver, owner)` | 提取资产 | 公开 |
| `mint(shares, receiver)` | 按份额铸造 | 公开 |
| `redeem(shares, receiver, owner)` | 赎回份额 | 公开 |
| `addStrategy(strategy, debtRatio)` | 添加策略 | 管理员 |
| `removeStrategy(strategy)` | 移除策略 | 管理员 |
| `allocateToStrategy(strategy, amount)` | 分配资金 | 管理员 |
| `harvestStrategy(strategy)` | 收获单个策略 | 公开 |
| `harvestAll()` | 收获所有策略 | 公开 |
| `setManagementFee(fee)` | 设置管理费 | 管理员 |
| `setPerformanceFee(fee)` | 设置绩效费 | 管理员 |
| `setDepositLimit(limit)` | 设置存款限额 | 管理员 |
| `claimFees()` | 领取累积费用 | 公开 |
| `setEmergencyShutdown(active)` | 设置紧急模式 | 管理员 |
| `emergencyWithdrawAll()` | 紧急撤回所有资金 | 管理员 |

### IStrategy

| 函数 | 说明 |
|------|------|
| `vault()` | 返回关联的 Vault 地址 |
| `asset()` | 返回底层资产地址 |
| `totalAssets()` | 返回策略管理的总资产 |
| `estimatedAPY()` | 返回预估年化收益率 |
| `harvestTrigger()` | 检查是否应该收获 |
| `invest()` | 投资新资金 |
| `harvest()` | 收割收益 |
| `withdraw(amount)` | 提取指定金额 |
| `emergencyWithdraw()` | 紧急撤回所有资金 |

---

## 🔒 安全考虑

### 已实现的安全措施

1. **重入保护**: 使用 OpenZeppelin 的 `ReentrancyGuard`
2. **访问控制**: 使用 `Ownable` 限制管理功能
3. **暂停机制**: 紧急情况下可暂停合约
4. **安全转账**: 使用 `SafeERC20` 库
5. **费用上限**: 管理费最高 100%，绩效费最高 50%
6. **策略验证**: 添加策略时验证资产和 Vault 匹配

### 审计建议

在主网部署前，建议:
1. 进行专业安全审计
2. 在测试网充分测试
3. 使用多签钱包管理
4. 实施时间锁机制

---

## 📋 TODO 列表

### 高优先级

- [ ] **zk-POR 证明**: 实现基于 zk 技术的储备金证明
- [ ] **风险分级**: 为同一资产池设计不同风险等级的 Tranche
- [ ] **自动复投**: 实现低 Gas 的自动收益复投机制,整合 Keeper 网络 (Gelato/Chainlink Automation)
- [ ] **时间锁**: 管理操作添加时间锁保护

### 中优先级

- [ ] **跨协议组合**: 与 Pharos 上其他 DeFi 协议集成
- [ ] **Oracle 集成**: 集成 Chainlink 或其他预言机获取实时 APY
- [ ] **提现队列**: 大额提现实现排队机制
- [ ] **策略白名单**: 策略合约白名单机制
- [ ] **多资产支持**: 支持多种底层资产

### 低优先级

- [ ] **治理代币**: 发行治理代币
- [ ] **前端 UI**: 开发 Web UI 展示 APY、资产组合、历史回撤
- [ ] **子图索引**: 部署 The Graph 子图用于数据查询
- [ ] **Gas 优化**: 批量操作和 Gas 优化
- [ ] **NFT 凭证**: 存款凭证 NFT 化

---

## 📜 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

<div align="center">

**Built for Pharos Hackathon 2026**

</div>
