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
- `pnpm check:sanity`：一次通过；后续重跑仅被既有 `objective-guide` 并发顺序测试阻断，串行运行同一 sanity 测试集通过，204 tests。
- `pnpm check:skills`：通过，发现 canonical `silvermoon` 与 `publish` skills。
- `silvermoon check --worktree --audience agent`：通过，完整候选有效。
- `pnpm check`：类型、构建、pure、package、integration 等阶段通过；Markdown 问题修复后单独校验通过，剩余阻塞为 Windows 原生 TUI 测试进程访问冲突 `3221225477`，单独重跑仍可复现。
- `pnpm check:commit`：通过。
