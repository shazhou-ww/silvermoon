# Implementation Evidence

## 行为矩阵

| 场景 | 可观察结果 |
| --- | --- |
| 无 `setGateMode` 的历史 | 三层均为 `explicit`，既有验收与生命周期不变 |
| `inner: waived` 后提交精确 revision | 记录独立 waived revision，进入 deploying，不生成 `acceptInner` |
| 精确提交后迟设 `inner: waived` | 仅该 submitted revision 通过，control 回到 downstream |
| 通过前恢复 `inner: explicit` | 后续提交仍停在 implementing，等待 `acceptInner` |
| 通过后恢复 `inner: explicit` | 已通过 revision 不回退；Inner World 改变后旧证据变 stale |
| 请求 `ideal: waived` 或 `outer: waived` | reduction 与业务校验失败关闭 |

## 持久证明

- `test/unit/idea-events.test.ts` 覆盖 codec、重放、权限声明、前置/迟设/恢复与陈旧 revision。
- `test/unit/whats-next-model.test.ts` 证明 `waived` 投影通过 inner Objective 并进入 deployment。
- `test/runtime/event-state.test.ts` 通过真实临时 Git repository 证明授权、精确 primary revision、无 `acceptInner` 和 worktree 检查。
- `test/contract/schema-v2.test.ts` 证明十三事件 schema 与 runtime validator 一致。

## 校验

- `node --test test/unit/idea-events.test.ts test/unit/whats-next-model.test.ts test/contract/schema-v2.test.ts test/runtime/event-state.test.ts`：通过，43 tests。
- `pnpm check:sanity`：最终回归通过，207 tests；Windows 验证采用下述限定环境。
- `pnpm check:skills`：通过，发现 canonical `silvermoon` 与 `publish` skills。
- `silvermoon check --worktree --audience agent`：通过，完整候选有效。
- `pnpm check`：fork 接入初版在限定环境下整体通过。合并 primary 并追加旧验收回归后，两次最终候选运行均完成 243 unit/runtime、63 contract、package 与干净 npm 安装测试；首轮 integration 160 通过、两项跳过，但 lint 扫描已删除 scratch 文件失败；次轮 lint 通过，integration 仅一项网络诊断全文比较失败。最终针对性重跑该 integration 文件 10/10、lint 404 文件零问题。最终候选未取得单轮 full 全绿，不将分轮结果描述为单轮通过。
- `pnpm check:commit`：通过。

Windows 原生 TUI 阻塞由 Koffi 2.16.3 修复，干净 npm 安装后的四项原生 TUI 回归全部通过。完整校验使用短物理临时目录、进程级 Git 长路径设置与 `UV_THREADPOOL_SIZE=1`；后者规避既有 Objective 并发顺序测试，不代表修复该独立问题。具体环境、fork 来源、上游 PR 和安装证明见 [runtime-dependencies.md](../../../../../docs/runtime-dependencies.md)。

合并后曾有 `npm pack` 和仅导入 TUI 的测试进程间歇性异常退出；独立对照中串行、八并发分别执行 80 个纯 Node、40 个 core 导入及 12 个不加载原生库的 npm pack，全部成功，两次最终 full 未再复现。根因未确定，不宣称已修复该间歇问题。当前 revision 的免验收可覆盖陈旧真实验收而不改写历史，新增独立回归证明新旧证据比较仍绑定 exact revision。
