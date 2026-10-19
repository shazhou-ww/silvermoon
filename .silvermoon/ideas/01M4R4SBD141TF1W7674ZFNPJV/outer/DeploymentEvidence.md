# Objective Guidance 部署证据

本页记录已接受实现的外部运行结果，不复述实现设计，也不代表 npm 发布。

## D-AC01

`pnpm setup:dev` 通过，重新构建并链接当前 checkout。设备级命令与链接解析结果：

- `silvermoon` 命令来自 `C:\Program Files\nodejs\silvermoon.ps1`；
- `C:\Program Files\nodejs\node_modules\silvermoon` 是 junction，最终指向
  `D:\Code\silvermoon.worktrees\objective-guidance-continuation`；
- personal discovery 的 `C:\Users\Wei\.agents\skills\silvermoon` 经过设备全局
  runtime junction，最终解析到当前 checkout 的 canonical `skills/silvermoon`。

未运行 npm publish，未创建发布 tag，也未把 OR/OPS 文档宣称为运行能力。

## D-AC02

通过全局 `silvermoon` 执行以下现实验证：

| 命令 | 结果 |
| --- | --- |
| `silvermoon check --remote --audience agent` | 通过；fetched primary snapshot 与 v2 history 有效 |
| `silvermoon list-ideas --query objective-guidance --audience agent` | 返回唯一 deploying idea |
| `silvermoon whats-next selector-that-does-not-exist --audience agent` | 正确报告未知 selector、列出 active ideas 并给出显式选择指导 |
| `silvermoon whats-next objective-guidance --audience agent` | 仍为 deploying、downstream、`acceptInner#29`，未创建或推断新决定 |

未知 selector 观测之后重新查询当前 idea，event digest 仍为
`93a344cf0e9183aaadc1d05daa08001603aef64a`，证明只读导航未改变生命周期事实。
全局 runtime 能读取完整内置 Guide packages 并执行实际 check entries；人工或
外部等待仍由报告交接，没有启动 OR/OPS 调度。
