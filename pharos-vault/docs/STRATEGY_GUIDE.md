# 策略开发详解

本文档详细解释了策略的工作原理和开发流程。

## 🏗 策略架构

```
          ┌─────────────────────────────────────┐
          │           PharosVault               │
          │  (ERC4626 保险库)                    │
          └─────────────┬───────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌───────────────────┐          ┌───────────────────┐
│  RWA Strategy     │          │  Lending Strategy │
│  (美债/RWA收益)   │          │  (借贷利息)       │
└───────┬───────────┘          └────────┬──────────┘
        │                               │
        ▼                               ▼
┌───────────────────┐          ┌───────────────────┐
│  外部协议          │          │  外部协议          │
│  (Ondo/Backed)    │          │  (Aave/Compound)  │
└───────────────────┘          └───────────────────┘
```

## 📝 策略生命周期

### 1. 初始化
```solidity
constructor(
    address _vault,      // 关联的 Vault
    address _asset,      // 底层资产 (如 USDC)
    string memory _name  // 策略名称
) BaseStrategy(_vault, _asset, _name)
```

### 2. 投资 (Invest)
当 Vault 分配资金到策略时调用：
```solidity
function invest() external onlyVault {
    uint256 balance = want.balanceOf(address(this));
    _invest(balance);  // 子类实现具体投资逻辑
}
```

### 3. 收获 (Harvest)
Keeper 或管理员定期调用以收割收益：
```solidity
function harvest() external onlyKeeper returns (uint256 profit) {
    profit = _harvest();  // 子类实现收获逻辑
    totalProfit += profit;
    return profit;
}
```

### 4. 提取 (Withdraw)
用户提现时，Vault 从策略中提取资金：
```solidity
function withdraw(uint256 amount) external onlyVault returns (uint256) {
    uint256 withdrawn = _withdraw(amount);
    want.safeTransfer(vault, withdrawn);
    return withdrawn;
}
```

### 5. 紧急撤回 (Emergency Withdraw)
紧急情况下无条件撤回所有资金：
```solidity
function emergencyWithdraw() external onlyVault {
    _emergencyWithdraw();
    want.safeTransfer(vault, want.balanceOf(address(this)));
}
```

## 🔧 实现新策略

### 步骤 1: 继承 BaseStrategy
```solidity
contract MyStrategy is BaseStrategy {
    constructor(
        address _vault,
        address _asset
    ) BaseStrategy(_vault, _asset, "My Strategy") {}
}
```

### 步骤 2: 实现 totalAssets()
返回策略管理的总资产（本金 + 收益）：
```solidity
function totalAssets() public view override returns (uint256) {
    return principal + pendingYield;
}
```

### 步骤 3: 实现 _invest()
将资金投入目标协议：
```solidity
function _invest(uint256 _amount) internal override {
    // 批准目标协议
    IERC20(asset).approve(targetProtocol, _amount);
    // 存入协议
    IProtocol(targetProtocol).deposit(_amount);
    // 更新内部状态
    principal += _amount;
}
```

### 步骤 4: 实现 _harvest()
收获收益并复投：
```solidity
function _harvest() internal override returns (uint256 profit) {
    // 从协议获取收益
    profit = IProtocol(targetProtocol).claimRewards();
    
    // 复投收益
    if (profit > 0) {
        IProtocol(targetProtocol).deposit(profit);
        principal += profit;
    }
    
    return profit;
}
```

### 步骤 5: 实现 _withdraw()
从协议提取资金：
```solidity
function _withdraw(uint256 _amount) internal override returns (uint256) {
    uint256 available = IProtocol(targetProtocol).balanceOf(address(this));
    uint256 toWithdraw = _amount > available ? available : _amount;
    
    IProtocol(targetProtocol).withdraw(toWithdraw);
    principal -= toWithdraw;
    
    return toWithdraw;
}
```

### 步骤 6: 实现 _emergencyWithdraw()
紧急撤回所有资金：
```solidity
function _emergencyWithdraw() internal override returns (uint256) {
    uint256 total = IProtocol(targetProtocol).withdrawAll();
    principal = 0;
    pendingYield = 0;
    return total;
}
```

## 📊 示例：集成 Aave V3

```solidity
contract AaveV3Strategy is BaseStrategy {
    IPool public aavePool;
    IERC20 public aToken;
    
    constructor(
        address _vault,
        address _asset,
        address _aavePool,
        address _aToken
    ) BaseStrategy(_vault, _asset, "Aave V3 Strategy") {
        aavePool = IPool(_aavePool);
        aToken = IERC20(_aToken);
    }
    
    function totalAssets() public view override returns (uint256) {
        return aToken.balanceOf(address(this));
    }
    
    function _invest(uint256 _amount) internal override {
        want.approve(address(aavePool), _amount);
        aavePool.supply(address(want), _amount, address(this), 0);
    }
    
    function _harvest() internal override returns (uint256) {
        // Aave 利息自动累积在 aToken 中
        // 无需额外操作
        return 0;
    }
    
    function _withdraw(uint256 _amount) internal override returns (uint256) {
        return aavePool.withdraw(address(want), _amount, address(this));
    }
    
    function _emergencyWithdraw() internal override returns (uint256) {
        uint256 balance = aToken.balanceOf(address(this));
        return aavePool.withdraw(address(want), balance, address(this));
    }
}
```

## 🛡 安全注意事项

1. **权限控制**: 只有 Vault 可以调用 invest/withdraw/emergencyWithdraw
2. **重入保护**: 使用 ReentrancyGuard
3. **滑点检查**: 验证实际提取金额
4. **授权管理**: 定期检查和撤销不必要的授权
5. **紧急模式**: 实现可靠的紧急撤回逻辑

## 📈 最佳实践

1. **准确报告资产**: `totalAssets()` 必须准确反映实际管理的资产
2. **处理边界情况**: 考虑零金额、最大金额等边界情况
3. **Gas 效率**: 优化合约以减少 Gas 消耗
4. **事件日志**: 记录重要操作以便追踪
5. **测试覆盖**: 编写全面的单元测试和集成测试
