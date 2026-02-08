# Pharos Hybrid Vault — Spec v1

> 一个 Vault 同时管理同步（DeFi/ERC4626）和异步（RWA/ERC7540）策略，用户获得统一的 share token。

---

## 1. 设计决策

| 问题 | 决策 |
|------|------|
| RWA share 定价 | fulfill 时的 PPS |
| Pending 资产归属 | 计入 totalAssets（会稀释，但逻辑分开处理） |
| Withdraw 拆分 | 严格按策略比例分（DeFi 即时 + RWA 异步） |
| Vault 套 Vault | 仅叙事，不实现 |
| 预言机 | 模拟注入 |
| DeFi 策略 | 模拟生息（复用 SimpleLendingStrategy） |

---

## 2. 合约架构

```
contracts/
├── interfaces/
│   ├── IHybridVault.sol           # [新] Vault 标准接口
│   ├── ISyncStrategy.sol          # [新] 同步策略接口（继承自 IStrategy）
│   └── IAsyncStrategy.sol         # [新] 异步策略接口（7540 风格）
├── HybridVault.sol                # [新] 核心 Vault，实现 IHybridVault
├── strategies/
│   ├── BaseSyncStrategy.sol       # [复用] 改名自 BaseStrategy
│   ├── BaseAsyncStrategy.sol      # [新] 异步策略基类
│   ├── DeFiLendingStrategy.sol    # [复用] 基于 SimpleLendingStrategy
│   └── AsyncRWAStrategy.sol       # [新] 异步 RWA 策略（7540 流程）
├── oracles/
│   └── RWAOracle.sol              # [复用] 预言机，增加美债价值上报
└── mocks/
    └── MockUSDC.sol               # [复用]
```

---

## 3. 接口定义

### 3.1 ISyncStrategy（同步，复用现有 IStrategy）

```solidity
// 与现有 IStrategy 完全一致，无需修改
interface ISyncStrategy is IStrategy {}
```

### 3.2 IAsyncStrategy（异步，7540 风格）

```solidity
interface IAsyncStrategy {
    // === 视图 ===
    function name() external view returns (string memory);
    function vault() external view returns (address);
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);  // 链下资产价值（预言机）
    function isActive() external view returns (bool);
    function estimatedAPY() external view returns (uint256);

    // === 异步 Deposit（Vault → 策略）===
    function requestDeposit(uint256 assets, address depositor) external returns (uint256 requestId);
    function pendingDeposit(address depositor) external view returns (uint256 assets);
    function claimableShares(address depositor) external view returns (uint256 shares);
    function claimShares(address depositor) external returns (uint256 shares);

    // === 异步 Withdraw（策略 → Vault）===
    function requestRedeem(uint256 shares, address redeemer) external returns (uint256 requestId);
    function pendingRedeem(address redeemer) external view returns (uint256 shares);
    function claimableAssets(address redeemer) external view returns (uint256 assets);
    function claimAssets(address redeemer) external returns (uint256 assets);

    // === 管理员（Operator）===
    function fulfillDeposit(address depositor, uint256 shares) external;   // 处理完成，shares 可 claim
    function fulfillRedeem(address redeemer, uint256 assets) external;     // 赎回完成，assets 可 claim
    function withdrawToOperator(uint256 amount) external returns (uint256); // 取出 USDC 去链下
    function reportNAV(uint256 nav) external;                               // 上报资产价值

    // === 事件 ===
    event DepositRequested(address indexed depositor, uint256 assets, uint256 requestId);
    event DepositFulfilled(address indexed depositor, uint256 shares);
    event RedeemRequested(address indexed redeemer, uint256 shares, uint256 requestId);
    event RedeemFulfilled(address indexed redeemer, uint256 assets);
    event NAVReported(uint256 nav, uint256 timestamp);
}
```

### 3.3 IHybridVault 核心接口

```solidity
interface IHybridVault {
    // === 基础信息 ===
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function shareToken() external view returns (address);       // Vault 的 ERC20 share

    // === 策略注册 ===
    function addSyncStrategy(address strategy, uint256 debtRatio) external;
    function addAsyncStrategy(address strategy, uint256 debtRatio) external;
    function removeSyncStrategy(address strategy) external;
    function removeAsyncStrategy(address strategy) external;
    function getSyncStrategies() external view returns (address[] memory);
    function getAsyncStrategies() external view returns (address[] memory);
    function syncTotalRatio() external view returns (uint256);
    function asyncTotalRatio() external view returns (uint256);

    // === 同步操作（ERC4626 兼容）===
    function deposit(uint256 assets, address receiver) external returns (uint256 syncShares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);

    // === 异步操作（ERC7540 风格）===
    function claimAsyncShares(address receiver) external returns (uint256 shares);
    function claimAsyncAssets(address receiver) external returns (uint256 assets);
    function pendingDepositOf(address user) external view returns (uint256 assets);
    function claimableSharesOf(address user) external view returns (uint256 shares);
    function pendingRedeemOf(address user) external view returns (uint256 shares);
    function claimableAssetsOf(address user) external view returns (uint256 assets);

    // === 管理员操作 ===
    function allocateToSyncStrategy(address strategy, uint256 amount) external;
    function harvestSyncStrategy(address strategy) external;
    function harvestAll() external;

    // === 事件 ===
    event SyncDeposit(address indexed user, uint256 assets, uint256 shares);
    event AsyncDepositRequested(address indexed user, uint256 assets);
    event AsyncSharesClaimed(address indexed user, uint256 shares);
    event SyncWithdraw(address indexed user, uint256 assets, uint256 shares);
    event AsyncRedeemRequested(address indexed user, uint256 shares);
    event AsyncAssetsClaimed(address indexed user, uint256 assets);
    event SyncStrategyAdded(address indexed strategy, uint256 debtRatio);
    event AsyncStrategyAdded(address indexed strategy, uint256 debtRatio);
}
```

这个接口定义了 Vault 的完整规范：
- 任何资产只要实现 `ISyncStrategy` 或 `IAsyncStrategy` 即可接入
- Vault 本身的 share 是 ERC20，可作为另一个 Vault 的底层资产
- 外部协议可通过此接口查询 Vault 状态、用户持仓和异步请求

---

## 4. 核心流程

### 4.1 Deposit 流程

```
用户调用 vault.deposit(100 USDC)
│
├─ syncRatio = 40%  → 40 USDC
│   ├─ 转入 DeFi 策略，调用 invest()
│   ├─ 立即 mint 40 shares（按当前 PPS）
│   └─ shares 直接到用户余额
│
└─ asyncRatio = 60% → 60 USDC
    ├─ 转入 RWA 策略，调用 requestDeposit(60, user)
    ├─ 记录 pending: user → 60 USDC
    ├─ 不 mint shares（等 fulfill）
    │
    ├─ [管理员] withdrawToOperator(60) → 取出 USDC
    ├─ [链下] 用 USDC 购买美债
    ├─ [管理员] reportNAV(新价值) → 预言机更新
    ├─ [管理员] fulfillDeposit(user, shares数量)
    │   └─ shares 数量 = 60 USDC / 当前 PPS
    │
    └─ [用户] vault.claimAsyncShares() → 拿到 shares
```

### 4.2 Withdraw 流程

```
用户调用 vault.redeem(100 shares)
│
├─ syncRatio = 40% → 40 shares
│   ├─ 计算 assets = convertToAssets(40)
│   ├─ 从 DeFi 策略 withdraw
│   ├─ burn 40 shares，立即转 USDC 给用户
│
└─ asyncRatio = 60% → 60 shares
    ├─ 调用 RWA 策略 requestRedeem(60, user)
    ├─ 记录 pending: user → 60 shares
    ├─ 暂不 burn shares（锁定）
    │
    ├─ [管理员] 链下卖出美债
    ├─ [管理员] 将 USDC 转回策略
    ├─ [管理员] fulfillRedeem(user, assets数量)
    │
    └─ [用户] vault.claimAsyncAssets() → burn shares，拿到 USDC
```

### 4.3 收益流程

```
DeFi 策略:
  └─ 自动累积利息 → harvest() → vault._updateStrategyReport()

RWA 策略:
  ├─ [预言机] 上报美债收益 → reportNAV(新价值)
  ├─ [管理员] 将收益 USDC 注入策略
  └─ vault 通过 strategy.totalAssets() 感知价值变化
```

---

## 5. 任务拆解

### Phase 1: 合约（优先级最高）

| # | 任务 | 依赖 | 复用 |
|---|------|------|------|
| 1.1 | 创建 `IHybridVault.sol` 接口 | 无 | 新建 |
| 1.2 | 创建 `IAsyncStrategy.sol` 接口 | 无 | 新建 |
| 1.3 | 创建 `BaseAsyncStrategy.sol` 基类 | 1.2 | 新建 |
| 1.4 | 创建 `AsyncRWAStrategy.sol` 实现 | 1.3 | 参考 MockRWAYieldStrategy + RWAOracle |
| 1.5 | 创建 `HybridVault.sol` | 1.1, 1.2 | 参考 PharosVault，重写 deposit/withdraw |
| 1.6 | 适配 `SimpleLendingStrategy` 为 DeFi 策略 | 1.5 | 直接复用，无需改动 |
| 1.7 | 编写部署脚本 `deploy-hybrid.ts` | 1.5 | 参考 deploy-pharos-testnet.ts |
| 1.8 | 编写模拟脚本 `simulate-7540.ts` | 1.7 | 新建 |

### Phase 2: 前端

| # | 任务 | 依赖 | 复用 |
|---|------|------|------|
| 2.1 | 新增 ABI（HybridVault + AsyncRWAStrategy） | 1.4 | 扩展 abis.ts |
| 2.2 | 新增 hooks：`useAsyncPosition` | 2.1 | 新建 |
| 2.3 | 修改 VaultActions：deposit 显示同步/异步拆分 | 2.1 | 改造现有 |
| 2.4 | 新增 AsyncClaimPanel：显示 pending/claimable + claim 按钮 | 2.2 | 新建组件 |
| 2.5 | 修改 StrategyCard：区分 Sync/Async 标签 | 2.1 | 改造现有 |
| 2.6 | 新增管理员面板：取出 USDC / 购买美债 / 上报 / fulfill | 2.1 | 新建组件 |

### Phase 3: 脚本 & 演示

| # | 任务 | 依赖 |
|---|------|------|
| 3.1 | Oracle node 脚本：模拟美债价格更新 | 1.6 |
| 3.2 | 端到端演示脚本：deposit → fulfill → harvest → redeem → fulfill | 1.7 |

---

## 6. HybridVault 关键实现细节

### 6.1 状态变量

```solidity
// 策略注册
address[] public syncStrategies;
address[] public asyncStrategies;
mapping(address => bool) public isSyncStrategy;
mapping(address => bool) public isAsyncStrategy;

// 比例（bps）
uint256 public syncTotalRatio;   // e.g. 4000 = 40%
uint256 public asyncTotalRatio;  // e.g. 6000 = 60%

// 异步追踪（vault 层面）
mapping(address => uint256) public userPendingDeposit;   // 用户 pending 的 USDC
mapping(address => uint256) public userClaimableShares;  // 用户可 claim 的 shares
mapping(address => uint256) public userPendingRedeem;    // 用户 pending 的 shares（已锁定）
mapping(address => uint256) public userClaimableAssets;  // 用户可 claim 的 USDC
```

### 6.2 totalAssets 计算

```solidity
function totalAssets() public view override returns (uint256) {
    uint256 idle = IERC20(asset()).balanceOf(address(this));
    uint256 syncDeployed = _totalSyncDebt();
    uint256 asyncDeployed = _totalAsyncAssets();  // 来自预言机/策略上报
    return idle + syncDeployed + asyncDeployed;
}
```

### 6.3 deposit 拆分

```solidity
function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
    uint256 totalRatio = syncTotalRatio + asyncTotalRatio;

    // 同步部分：立即 mint
    uint256 syncAmount = (assets * syncTotalRatio) / totalRatio;
    shares = _syncDeposit(syncAmount, receiver);

    // 异步部分：进入 pending
    uint256 asyncAmount = assets - syncAmount;
    _asyncDeposit(asyncAmount, receiver);

    // 转入全部 USDC
    IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);
}
```

---

## 7. AsyncRWAStrategy 关键实现

```solidity
contract AsyncRWAStrategy is BaseAsyncStrategy {
    RWAOracle public oracle;

    // 链下资产价值（由预言机/管理员上报）
    uint256 public offChainAssets;

    // 每用户 pending/claimable
    mapping(address => uint256) public pendingDeposits;    // USDC 待处理
    mapping(address => uint256) public claimableShares;    // shares 可领取
    mapping(address => uint256) public pendingRedeems;     // shares 待赎回
    mapping(address => uint256) public claimableAssets;    // USDC 可领取

    function totalAssets() public view override returns (uint256) {
        // 链上 USDC 余额 + 链下资产价值
        return want.balanceOf(address(this)) + offChainAssets;
    }

    // 管理员取出 USDC 去买美债
    function withdrawToOperator(uint256 amount) external onlyOperator {
        want.safeTransfer(msg.sender, amount);
        offChainAssets += amount;  // 记为链下资产
    }

    // 管理员上报美债价值（通过预言机）
    function reportNAV(uint256 nav) external onlyOperator {
        offChainAssets = nav;
    }

    // 管理员完成 deposit 处理
    function fulfillDeposit(address depositor, uint256 shares) external onlyOperator {
        pendingDeposits[depositor] = 0;
        claimableShares[depositor] += shares;
    }

    // 管理员完成 redeem 处理（需先把 USDC 转回）
    function fulfillRedeem(address redeemer, uint256 assets) external onlyOperator {
        pendingRedeems[redeemer] = 0;
        claimableAssets[redeemer] += assets;
    }
}
```

---

## 8. 前端变化总结

| 现有组件 | 变化 |
|----------|------|
| VaultInfoLive | 增加显示 Sync/Async 比例 |
| VaultActions (deposit/withdraw) | deposit 后显示 "40 shares minted + 60 USDC pending" |
| StrategyCard | 增加 Sync/Async 标签，Async 卡片显示 pending 队列 |
| UserPositionLive | 增加 Pending Deposits / Claimable Shares 区域 |
| **新增** AsyncClaimPanel | Claim Shares / Claim Assets 按钮 |
| **新增** OperatorPanel | 取出 USDC / 报告 NAV / Fulfill Deposit / Fulfill Redeem |
| Fee Settings tab | 复用，无需改动 |

---

## 9. 叙事要点（README/演示用）

1. **Hybrid Vault Protocol** — 业界首个在单一 Vault 中同时支持 ERC4626（同步）和 ERC7540（异步）策略的协议
2. **统一 Share Token** — 无论资金流向 DeFi 还是 RWA，用户持有同一种 ERC20 share，可在其他 DeFi 协议中使用
3. **可组合性** — 策略只需实现 ISyncStrategy 或 IAsyncStrategy 即可接入；Vault 本身的 share 也是 ERC20，理论上可作为另一个 Vault 的策略（Vault 套 Vault）
4. **透明度** — 预言机实时上报链下资产价值，用户可在链上验证 RWA 资产状态
