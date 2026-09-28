# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 建立可重复的耗时基线
- [x] **I-S02:** 并行执行独立发布门禁
- [x] **I-S03:** 保持失败可诊断性与隔离
- [x] **I-S04:** 固化快速反馈与回归测量

### Implementation acceptance criteria

- [x] **I-AC01:** 完整检查中位耗时至少降低 30%
- [x] **I-AC02:** 所有正确性门禁保持通过
- [x] **I-AC03:** 测试保持隔离且无顺序依赖
- [x] **I-AC04:** 分层反馈路径清晰可用

### Implementation notes

- 基线环境为 Node.js 24.12.0、pnpm 11.22.0、commit `6437b5b`。预热后五次 `pnpm test` 为 3,253、3,204、3,150、3,201、3,221ms，中位数 3,204ms；`pnpm test:integration` 为 33,776、31,919、31,498、32,337、32,975ms，中位数 32,337ms；`pnpm test:e2e` 为 13,565、14,283、14,527、14,929、15,249ms，中位数 14,527ms；`pnpm check` 为 98,795、52,402、58,048、54,546、54,585ms，中位数 54,585ms。
- 优化后预热并通过完整检查，五次 `pnpm check` 为 34,620、43,753、32,773、32,358、32,397ms，中位数 32,773ms，相对基线降低 40.0%。
- 完整检查保留六个既有发布门禁；integration 仍运行 75 个测试（73 通过、2 个平台条件跳过），e2e 仍运行已安装包测试，新增调度器单元测试与 CI contract 均通过。
- 调度器相关测试以 `--test-concurrency=1`、反向文件顺序和正常 `pnpm test` 三种方式通过；运行后 Git 配置与引用未被测试修改，工作区仅包含本 idea 的预期文件。
- 从临时干净 clone 精确检出发布的 `9877b10`，按维护文档完成 `pnpm install --frozen-lockfile`、`pnpm test` 和 `pnpm check`；全部通过且运行后 checkout 保持干净，临时 clone 已删除。

## Deployment

### Deployment steps

- [x] **D-S01:** 在 CI 环境验证完整检查
- [x] **D-S02:** 合并后观察反馈稳定性

### Deployment acceptance criteria

- [x] **D-AC01:** 候选 CI 保持全绿且无明显性能退化
- [x] **D-AC02:** 主分支优化稳定生效

### Deployment notes

- 针对稳定 deployment revision `098a8829` 对应提交 `f978cce` 的三次 CI 均首尾完成且全绿：[feature attempt 1](https://github.com/shazhou-ww/silvermoon/actions/runs/36449835320/attempts/1) 最长 job 25s、总墙钟 29s；[main attempt 1](https://github.com/shazhou-ww/silvermoon/actions/runs/36449877313/attempts/1) 最长 job 35s、总墙钟 68s；[主动 rerun attempt 2](https://github.com/shazhou-ww/silvermoon/actions/runs/36449835320/attempts/2) 最长 job 31s、总墙钟 35s。
- 紧邻实现基线 [9877b10](https://github.com/shazhou-ww/silvermoon/actions/runs/36448862620/attempts/1)、[aaff86d](https://github.com/shazhou-ww/silvermoon/actions/runs/36449135176/attempts/1)、[62605c6](https://github.com/shazhou-ww/silvermoon/actions/runs/36449296748/attempts/1) 的最长 job 分别为 32、30、51s，中位数 32s；候选为 25、35、31s，中位数 31s，改善 3.1%。总墙钟中位数从 54s 降至 35s，单次 68s 显示的排队噪声未影响 job 执行门槛。
- 实现进入 main 后的前三次 CI 均在首次 attempt 成功，没有重试掩盖的失败；上述 attempt 2 是 deployment contract 发布后主动补充的同 revision 验证。所有矩阵 job 均成功，未发现临时目录、Git 资源泄漏或平台特有警告。
