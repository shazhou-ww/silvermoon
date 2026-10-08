# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 收敛唯一单文件存储模型
- [x] **I-S02:** 改造读取、追加、cursor 与历史验证
- [x] **I-S03:** 提供一次性分段 V2 迁移
- [x] **I-S04:** 迁移本仓库并统一所有公开表面
- [x] **I-S05:** 重写分段专项测试并补齐回归矩阵
- [x] **I-S06:** 完成发布级验证与实施证据

### Implementation acceptance criteria

- [x] **I-AC01:** V2 当前布局只有 events.jsonl
- [x] **I-AC02:** 单文件操作保持既有事件正确性
- [x] **I-AC03:** 一次性迁移完整且不改变 schema 版本
- [x] **I-AC04:** 仓库、文档与分发内容一致
- [x] **I-AC05:** 发布级检查全部通过

## Deployment

### Deployment steps

- [ ] **D-S01:** 固化并同步部署验证契约
- [ ] **D-S02:** 审计准确 primary 的单文件权威
- [ ] **D-S03:** 验证 hosted CI 并同步部署证据

### Deployment acceptance criteria

- [ ] **D-AC01:** 已接受实现与部署契约存在于 primary
- [ ] **D-AC02:** 远端单文件布局与事件历史有效
- [ ] **D-AC03:** Hosted CI 完整通过且最终证据可审阅
