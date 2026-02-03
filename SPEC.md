# Pharos Vault - 产品规格说明书

## 项目概述

Web3 黑客松项目，为 Pharos 链构建资产管理与收益基础设施（Vault Infra），支持用户一键捕获多元化 RWA 资产收益。

## 技术栈

- 框架: Next.js 14 (App Router)
- 语言: TypeScript
- 样式: Tailwind CSS
- Web3: wagmi + viem + @tanstack/react-query
- 链: Pharos (Chain ID: 1672, RPC: https://rpc.pharos.xyz)

## 设计规范

- 主题: 亮色主题
- 主色调: 白色背景
- 强调色: 蓝色 (#3B82F6 作为主蓝色)
- 仅支持桌面端

---

## 页面结构

### 全局组件

#### Header
- 布局: 左侧 Logo，中间导航，右侧钱包按钮
- 导航项: Dashboard | Vault | Portfolio
- 钱包按钮: 未连接显示 "Connect Wallet"，已连接显示地址缩写

---

### 页面 1: Dashboard (首页 `/`)

#### 1.1 Hero 区域
- 位置: 页面正中央
- 内容:
  - 项目标题: "Pharos Vault"
  - 一句话简介: "Capture diversified RWA yields with one click"

#### 1.2 数据概览区域
- 位置: Hero 下方
- 内容:
  - TVL (Total Value Locked): 显示总锁仓价值
  - APR (Annual Percentage Rate): 显示平均年化收益率
  - CTA 按钮: "Explore Vaults" → 跳转至 `/vault`

#### 1.3 透明度卡片区域
- 位置: 数据概览下方
- 布局: 3 个并排卡片
- 卡片内容: (待定义)
  - 卡片 1: Proof of Reserve
  - 卡片 2: On-chain Audit
  - 卡片 3: Real-time Monitoring

---

### 页面 2: Vault 列表 (`/vault`)

#### 2.1 顶部数据卡片
- 内容: TVL、APR 等汇总数据

#### 2.2 Vault 列表
- 布局: 表格或卡片列表
- 每个 Vault 项包含:
  | 字段 | 说明 |
  |------|------|
  | icon | 抵押品代币图标 (如 USDC) |
  | name | Vault 名称 |
  | apr | 预估年化收益率 (%) |
  | totalEarnings | 历史总收益 |
  | tvl | 当前总锁仓量 |

- 交互: 点击任意 Vault → 跳转至 `/vault/[id]`

---

### 页面 3: Vault 详情 (`/vault/[id]`)

#### 3.1 基本信息卡片
- Vault 图标 + 名称
- 合约地址 (可复制)
- TVL
- APR
- 存款/取款操作按钮

#### 3.2 策略与收益卡片
- 左侧: Strategy 资金分配
  - 饼图或列表展示各策略占比
- 右侧: Harvest 历史记录
  - 时间、金额、交易链接
- 下方: 策略详情表格
  | 字段 | 说明 |
  |------|------|
  | strategyName | 策略名称 |
  | allocation | 资金占比 |
  | apr | 该策略 APR |
  | lastHarvest | 上次收益 |
  | maxDrawdown | 最大回撤 |
  | proofOfReserve | 资产证明链接 |

#### 3.3 信息区域
- About: Vault 介绍文字
- Info: 
  - 合约地址
  - Token 地址
  - 管理费 (Management Fee)
  - 收益费 (Performance Fee)

#### 3.4 交互表单
- Deposit 表单:
  - 输入金额
  - 显示预估获得的 shares
  - 提交 → 拉起钱包执行 deposit 交易
- Withdraw 表单:
  - 输入 shares 数量
  - 显示预估获得的资产
  - 提交 → 拉起钱包执行 withdraw 交易

---

### 页面 4: Portfolio (`/portfolio`)

#### 4.1 总览卡片
- 总持仓价值 (Total Value)
- 总收益 (Total Earnings)
- 未连接钱包时显示 "Connect Wallet" 按钮

#### 4.2 持仓列表
- 布局: 表格或卡片
- 每个持仓项包含:
  | 字段 | 说明 |
  |------|------|
  | vaultName | Vault 名称 |
  | shares | 持有份额 |
  | value | 当前价值 |
  | allocation | 占总持仓比例 (%) |
  | earnedRealized | 已实现收益 |
  | earnedPending | 待 claim 收益 |
  | totalReturn | 总回报率 (%) |
  | autoCompound | 是否开启自动复投 |

---

## 数据层设计

### 原则
1. 数据与 UI 解耦，使用独立的数据模块
2. Mock 数据可随时替换为真实合约调用
3. 类型定义清晰，便于后续对接

### 数据类型定义

```typescript
// types/vault.ts

interface Vault {
  id: string;
  name: string;
  icon: string;
  tokenAddress: string;
  contractAddress: string;
  apr: number;
  tvl: number;
  totalEarnings: number;
  description: string;
  managementFee: number;  // 百分比
  performanceFee: number; // 百分比
  strategies: Strategy[];
  harvestHistory: HarvestRecord[];
}

interface Strategy {
  id: string;
  name: string;
  allocation: number;     // 百分比
  apr: number;
  lastHarvest: number;    // 金额
  maxDrawdown: number;    // 百分比
  proofOfReserve?: string; // 链接
}

interface HarvestRecord {
  timestamp: number;
  amount: number;
  txHash: string;
}

interface UserPosition {
  vaultId: string;
  shares: number;
  depositedValue: number;
  currentValue: number;
  earnedRealized: number;
  earnedPending: number;
  autoCompound: boolean;
}

interface ProtocolStats {
  totalTvl: number;
  averageApr: number;
  totalVaults: number;
}
```

### 目录结构

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # Dashboard
│   ├── vault/
│   │   ├── page.tsx          # Vault 列表
│   │   └── [id]/
│   │       └── page.tsx      # Vault 详情
│   └── portfolio/
│       └── page.tsx          # Portfolio
├── components/
│   ├── layout/
│   │   └── Header.tsx
│   ├── dashboard/
│   │   ├── Hero.tsx
│   │   ├── StatsOverview.tsx
│   │   └── TransparencyCards.tsx
│   ├── vault/
│   │   ├── VaultList.tsx
│   │   ├── VaultCard.tsx
│   │   ├── VaultInfo.tsx
│   │   ├── StrategyAllocation.tsx
│   │   ├── HarvestHistory.tsx
│   │   ├── StrategyDetails.tsx
│   │   └── VaultActions.tsx  # Deposit/Withdraw 表单
│   └── portfolio/
│       ├── PortfolioSummary.tsx
│       └── PositionList.tsx
├── data/
│   └── mock.ts               # Mock 数据
├── hooks/
│   ├── useVaults.ts
│   ├── useVaultDetail.ts
│   ├── useUserPositions.ts
│   └── useProtocolStats.ts
├── lib/
│   ├── wagmi.ts              # wagmi 配置
│   └── utils.ts              # 工具函数
└── types/
    └── index.ts              # 类型定义
```

---

## 开发任务拆分

### Phase 1: 基础架构
- [x] Task 1.1: 项目依赖安装 (wagmi, viem, react-query)
- [x] Task 1.2: 类型定义 (`types/index.ts`)
- [x] Task 1.3: Mock 数据 (`data/mock.ts`)
- [x] Task 1.4: wagmi 配置 (`lib/wagmi.ts`)
- [x] Task 1.5: 全局样式调整 (`globals.css`)

### Phase 2: 全局组件
- [x] Task 2.1: Header 组件 (导航 + 钱包连接)

### Phase 3: Dashboard 页面
- [x] Task 3.1: Hero 组件
- [x] Task 3.2: StatsOverview 组件
- [x] Task 3.3: TransparencyCards 组件
- [x] Task 3.4: Dashboard 页面组装

### Phase 4: Vault 列表页面
- [x] Task 4.1: VaultCard 组件
- [x] Task 4.2: VaultList 组件
- [x] Task 4.3: Vault 列表页面组装

### Phase 5: Vault 详情页面
- [x] Task 5.1: VaultInfo 组件
- [x] Task 5.2: StrategyAllocation 组件
- [x] Task 5.3: HarvestHistory 组件
- [x] Task 5.4: StrategyDetails 组件
- [x] Task 5.5: VaultActions 组件 (Deposit/Withdraw)
- [x] Task 5.6: Vault 详情页面组装

### Phase 6: Portfolio 页面
- [x] Task 6.1: PortfolioSummary 组件
- [x] Task 6.2: PositionList 组件
- [x] Task 6.3: Portfolio 页面组装

### Phase 7: 合约交互
- [ ] Task 7.1: Deposit 交易逻辑
- [ ] Task 7.2: Withdraw 交易逻辑
- [ ] Task 7.3: 读取用户真实持仓

---

## 待确认事项

1. 透明度卡片的具体内容
2. Vault 合约 ABI (用于真实交互)
3. 是否需要支持多语言
4. 是否需要移动端适配 (当前仅桌面端)
