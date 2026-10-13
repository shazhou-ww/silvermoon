# Objective Guide 实现与验证证据

本页为 [Implementation](./Implementation.md) 的实现证据，不修改已接受的
Ideal 契约，也不记录人工接受或现实部署结论。

## I-AC01

公共核心已改为自洽的 Manifest、References 与 executable check 协议：

- Manifest 只声明 domain、languages、有序 levels/check IDs 和可选 prerequisite；
  `minimumLevelId` 默认 `terminal`，也可在 immediate prerequisite 达到中间层后
  解锁当前 Guide。
- References 固定使用 `system/{overview,404}`、`levels/<id>`、
  `checks/<id>`、`problems/<id>` 和 `pages/<id>`；每个节点的语言文件位于叶子，
  Loader 强制完整语言集合、frontmatter profile、内部链接和固定 system 节点。
- File runner 从 `checks/<id>/` 发现唯一 `run`/`run.*`。Native entry 直接启动，
  script 使用受限 `#!/usr/bin/env <interpreter>`；Windows 不依赖 `PATHEXT`、
  文件关联或 shell command。
- 每次根 `probe()` 创建 `probe.tempDirectory`，同一 prerequisite chain 与本地
  checks 共享，结束后回收。Runtime 不提供 `useState`、`useMemo` 或语言专用
  helper，checks 只通过约定相对路径和格式复用本轮临时文件。
- Check stdin/stdout 使用版本化 JSON；failed result 返回稳定 Problem ID 和 JSON
  parameters。未知 ID、非零退出、超时、畸形或过大输出均显式失败。

主要证据：
[核心运行时](../../../../../src/objective-guide/guide.ts)、
[进程 runner](../../../../../src/objective-guide/runner.ts)、
[References loader](../../../../../src/objective-guide/resources.ts)、
[核心单测](../../../../../test/unit/objective-guide.test.ts)、
[文件集成测试](../../../../../test/integration/objective-guide.test.ts)和
[公共说明](../../../../../docs/objective-guidance.md)。

## I-AC02

Device、Project 与 Idea Guide 已迁移为完整真实 package tree：YAML Manifest、
双语 Markdown References 和每个 Check ID 的 `checks/<id>/run.js`。构建将完整
目录原样复制到 dist 与 npm 包；Loader 从文件读取 Manifest/References，普通
file runner 预检并启动真实 entry。Silvermoon 应用 adapter 只把既有业务采样
结果原子写入 probe workspace，entry 再按标准 stdin/stdout 协议返回；Manifest
不再由 TypeScript 合成，也不保存 JS module 路径或 locale content。Idea 仍
直接组合缓存的 Project Guide，当前保持默认 terminal barrier；核心
minimum-level 能力由独立专项测试覆盖。

旧 professional-model 源码、注入式 `useState`、YAML、单测、文档与打包条目已
删除。`whats-next` 仅保留其实际需要的本地 gate result，不再依赖旧 module。

`whats-next` 保留四投影、诊断优先级、设备 advisory、selector、guidance、
精确 revision、submission/acceptance 与 upstream/downstream control。三作用域
逐 check 测试、导航并发/生命周期测试和真实 guidance integration 均通过。

主要证据：
[内置 Guides](../../../../../src/business/objective-guides.ts)、
[导航接入](../../../../../src/business/whats-next.ts)、
[逐项 check 测试](../../../../../test/unit/silvermoon-objectives.test.ts)和
[导航兼容测试](../../../../../test/unit/whats-next-model.test.ts)。

## I-AC03

以下结果来自当前候选 worktree；staged metadata 检查不作为 staged code 测试：

| 命令 | 结果 |
| --- | --- |
| `pnpm setup:dev` | 通过；全局 runtime 与 personal canonical skill 指向本 checkout |
| `pnpm typecheck` | 通过 |
| `node --test test\unit\objective-guide.test.ts test\unit\silvermoon-objectives.test.ts test\unit\whats-next-model.test.ts test\integration\objective-guide.test.ts` | 通过，23 tests |
| `pnpm check:sanity` | 通过；typecheck、build、syntax、pure 与 sanity tests |
| `pnpm check` | 通过；unit/runtime 219、contract 58、integration 159 passed / 2 skipped、installed-package e2e 1 |
| `npm pack --dry-run`（由 `pnpm check` 执行） | 通过，1056 files；完整内置 Guide packages 与 runner 已进入校验清单 |
| `silvermoon check --worktree --audience agent` | 通过；candidate snapshot 与 v2 event history 有效 |
| `silvermoon check --staged --audience agent` | 通过；验证准确 index metadata |
| `pnpm check:commit` | 通过；worktree tests、contract、smoke、Markdown、diff 与 staged metadata gates |

两项 integration 跳过是既有 Windows symlink privilege 条件，不作为已验证平台
能力。Installed-package e2e 直接使用发布入口装载新 Manifest/References 与
CheckRunner 形状。提交门测试 worktree；staged Silvermoon check 验证 index
metadata，不替代源码测试。
