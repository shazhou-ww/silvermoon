# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 固化基线与改善目标
  - 在 `1435c77570080f0d497d22e0934eee90a2ad6e95` 完成两个入口各一次预热、
    五次样本，均退出 0。日常/全量中位数为 20,631/130,765 ms；
    实施前目标固定为 10,315.5/65,382.5 ms。完整数据见同世界证据。
  - 测量后 primary 移至 `9fbce63cf348d079d4728afcaefba929da040b39`，
    已 fast-forward 并重新观察 implementing；保留并发历史，未修改其他 idea。
- [x] **I-S02:** 按真实成本拆分并守恒测试
  - 35 个原测试 body 保持，17 个 runtime 测试仍进入 unit 原平台矩阵；
    dialogue 的真实 Git 测试进入 integration。完整计数 237 -> 247。
- [x] **I-S03:** 实现场景调度与快照边界
  - sanity/commit/release 复用 runner；check/quick 兼容语义保留；技能拆分。
    真实部分暂存 fixture 验证警告、候选差异、失败传播及 index/worktree 不变。
- [x] **I-S04:** 保守升级 CI 与对齐发布
  - 仅 idea metadata-only 跳过 package/E2E；未知或无 baseline 均升级。
    core 矩阵不筛选，发布静态检查补齐，权限及实际产物路径未变。
- [x] **I-S05:** 对齐贡献者与 Agent 指令
  - AGENTS、maintaining、repository-tasks、npm-package-releases 对齐，
    明确部分暂存边界、外部工具和无隐式 npm 发布。
- [ ] **I-S06:** 验证并发布实现证据

### Implementation acceptance criteria

- [x] **I-AC01:** 性能目标与边界可复现
  - 最终一次预热加五次测量全部通过，中位数 sanity 3,280 ms、commit
    10,103 ms；比对应基线下降 84.10%/92.27%，达到预先 50% 目标。
- [x] **I-AC02:** 覆盖与平台守恒
  - 完整 247 项包含新增 10 项，仅原 Windows 2 项 skip；迁移 body、
    测试归属和 unit/runtime 平台矩阵保持，详见同世界证据。
- [x] **I-AC03:** 场景与失败行为确定
  - runner 精确集合、空/未知参数、启动/退出失败、等待汇总定向测试通过。
- [x] **I-AC04:** 暂存与工作区不混淆
  - fixture 证明暂存 status 无效而 worktree 有效仍失败，候选不被改写；
    未承诺隔离的暂存代码测试，入口始终打印范围。
- [x] **I-AC05:** 风险升级与发布保障完整
  - 风险单元/真实 Git 与 CI/release workflow 契约全部通过；未执行 npm 发布。
- [ ] **I-AC06:** 指令一致且全量验收通过
- [ ] **I-AC07:** 普通 Git 发布与决定隔离

## Deployment

### Deployment steps

- [ ] **D-S01:** 步骤标题

### Deployment acceptance criteria

- [ ] **D-AC01:** 标准标题
