# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 明确职责与兼容边界
- [x] **I-S02:** 分离用例与共享 readiness
- [x] **I-S03:** 分离纯规则与命令运行时及展示
- [x] **I-S04:** 分离事件策略规划与仓库写入
- [x] **I-S05:** 标注并自动检查纯度与依赖
- [x] **I-S07:** 按模块组织目录与职责 README
- [x] **I-S06:** 验证同步并准备准确版本验收

### Implementation acceptance criteria

- [x] **I-AC01:** 职责隔离与函数式核心可检查
- [x] **I-AC02:** 命令与调用方行为等价
- [x] **I-AC03:** 事件增量与并发写入保护不退化
- [x] **I-AC04:** 候选证据与准确版本可复核
- [x] **I-AC05:** 模块入口与目录职责可复核

## Deployment

### Deployment steps

- [ ] **D-S01:** 固定部署候选与验证边界
- [ ] **D-S02:** 验证隔离安装与公开入口
- [ ] **D-S03:** 验证真实 CLI 与 Windows npm shim
- [ ] **D-S04:** 验证现有调用方与三层观察
- [ ] **D-S05:** 记录证据并准备准确版本验收

### Deployment acceptance criteria

- [ ] **D-AC01:** 安装制品完整且入口可用
- [ ] **D-AC02:** 真实 CLI 与 Windows shim 行为可复核
- [ ] **D-AC03:** 调用方兼容和观察边界成立
- [ ] **D-AC04:** 部署证据与准确版本可验收
