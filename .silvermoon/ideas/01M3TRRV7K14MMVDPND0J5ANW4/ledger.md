# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 升级 Commander 并锁定 CLI 兼容行为
- [x] **I-S02:** 固化 OpenTUI peer 依赖边界
- [x] **I-S03:** 评估并决定终端宽度实现

### Implementation acceptance criteria

- [x] **I-AC01:** Commander v15 在支持的运行时保持 CLI 契约
- [x] **I-AC02:** OpenTUI peers 始终落在上游支持范围内
- [x] **I-AC03:** 宽度库决策同时具备语义与性能证据

## Deployment

### Deployment steps

- [x] **D-S01:** 固定 primary 部署对象
- [x] **D-S02:** 执行托管 CI 验证
- [x] **D-S03:** 固化外部结果

### Deployment acceptance criteria

- [x] **D-AC01:** 部署对象已进入 primary
- [x] **D-AC02:** 托管 CI 对部署对象全部通过
- [x] **D-AC03:** 部署证据完整且未越过发布边界
