# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 完成公开 v2 单词事件与完整投影
- [x] **I-S02:** 完成本仓库一次性内部格式迁移
- [x] **I-S03:** 对接本地交互 CLI 和导航
- [x] **I-S04:** 验证修订契约并交付

### Implementation acceptance criteria

- [x] **I-AC01:** 最终 v2 只暴露九种事件
- [x] **I-AC02:** 内部迁移等价且边界可恢复
- [x] **I-AC03:** 本地消息不受 Git 故障锁死
- [x] **I-AC04:** 修订实现通过仓库验证

## Deployment

### Deployment steps

- [ ] **D-S01:** 固定已验收候选和验证边界
- [ ] **D-S02:** 验证隔离消费与交互边界
- [ ] **D-S03:** 验证真实 primary 与提交证据

### Deployment acceptance criteria

- [ ] **D-AC01:** 隔离消费与协议故障边界通过
- [ ] **D-AC02:** 真实 primary 保持可验证
- [ ] **D-AC03:** 证据同步且发布边界不变
