# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 固化基线与改善目标
  - 在 `1435c77570080f0d497d22e0934eee90a2ad6e95` 完成两个入口各一次预热、
    五次样本，均退出 0。日常/全量中位数为 20,631/130,765 ms；
    实施前目标固定为 10,315.5/65,382.5 ms。完整数据见同世界证据。
  - 测量后 primary 移至 `9fbce63cf348d079d4728afcaefba929da040b39`，
    已 fast-forward 并重新观察 implementing；保留并发历史，未修改其他 idea。
- [ ] **I-S02:** 按真实成本拆分并守恒测试
- [ ] **I-S03:** 实现场景调度与快照边界
- [ ] **I-S04:** 保守升级 CI 与对齐发布
- [ ] **I-S05:** 对齐贡献者与 Agent 指令
- [ ] **I-S06:** 验证并发布实现证据

### Implementation acceptance criteria

- [ ] **I-AC01:** 性能目标与边界可复现
- [ ] **I-AC02:** 覆盖与平台守恒
- [ ] **I-AC03:** 场景与失败行为确定
- [ ] **I-AC04:** 暂存与工作区不混淆
- [ ] **I-AC05:** 风险升级与发布保障完整
- [ ] **I-AC06:** 指令一致且全量验收通过
- [ ] **I-AC07:** 普通 Git 发布与决定隔离

## Deployment

### Deployment steps

- [ ] **D-S01:** 步骤标题

### Deployment acceptance criteria

- [ ] **D-AC01:** 标准标题
