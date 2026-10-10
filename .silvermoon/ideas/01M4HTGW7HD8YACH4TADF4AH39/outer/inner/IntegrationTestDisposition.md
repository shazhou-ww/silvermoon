# Integration test 分层清单

## 入口

| 层 | 入口 | 用途 |
| --- | --- | --- |
| Fast | `pnpm test:integration` | 本地默认与 pull request 的真实 filesystem、Git、CLI 回归 |
| Extended | `pnpm test:integration:extended` | 压力规模、完整 snapshot 组合和高成本跨进程路径 |
| Complete | `pnpm test:integration:all` | Fast 加 extended，供 release 与 publish |
| Platform smoke | `pnpm test:integration:platform` | OS/Node matrix 的原生文件身份与小规模真实 CLI |
| Live external | `pnpm test:integration:live` | 显式 opt-in 的真实 Copilot 服务验证 |

## 文件处置

| 原文件 | 处置 | 覆盖归属与理由 |
| --- | --- | --- |
| `build-npm-tarball.test.ts` | 保留 | Fast；真实 tarball 构建边界 |
| `check-v1-outcomes.test.ts` | 保留 | Fast；check 的失败与结果路径 |
| `check-v1-snapshots.test.ts` | 迁移 | Extended；五类 snapshot、SHA-256 与正交属性完整组合 |
| `cli-v1.test.ts` | 保留 | Fast；真实 CLI、trace 与 telemetry |
| `config-v1.test.ts` | 保留 | Fast；轻量配置 filesystem 边界 |
| `copilot-runtime-live.test.ts` | 迁移 | Live external；需要显式凭据与外部服务 |
| `create-idea-scaffold.test.ts` | 保留 | Fast；创建结果和路径边界 |
| `create-idea-transactions.test.ts` | 保留 | Fast；事务失败与并发保护 |
| `dialogue-output.test.ts` | 删除 | 四投影、语言和呈现已由 unit、contract 及各 command integration 覆盖 |
| `event-stream-digest.test.ts` | 保留 | Fast；Git digest 交叉验证 |
| `generate-npm-readme.test.ts` | 保留 | Fast；生成器 filesystem 边界 |
| `git.test.ts` | 保留 | Fast；完整 Git snapshot 行为；其中三项组成 platform smoke |
| `guidance.test.ts` | 保留 | Fast；guidance Git snapshot 与安全边界 |
| `idea-layout.test.ts` | 保留 | Fast；nested world revision 与 layout |
| `incremental-append.test.ts` | 迁移 | Extended；1,001 至 10,001 条事件和完整历史组合；小样本供 platform smoke |
| `list-ideas.test.ts` | 保留 | Fast；local inventory 与预算行为 |
| `prepare-npm-release.test.ts` | 保留 | Fast；release Git 选择逻辑 |
| `project-registry.test.ts` | 保留 | Fast；registry filesystem 行为 |
| `project-runtime.test.ts` | 迁移 | Extended；多次真实子进程与完整 interaction 往返 |
| `repository-fixtures.test.ts` | 保留 | Fast；V1/V2 不可变模板和 remote 隔离 |
| `schema-readiness.test.ts` | 保留 | Fast；schema/runtime readiness |
| `user-config.test.ts` | 保留 | Fast；用户配置 filesystem 行为 |
| `validation-tiers.test.ts` | 保留 | Fast；真实 Git index 与 runner 边界 |
| `verify-npm-release.test.ts` | 保留 | Fast；发布校验边界 |
| `whatsnext-guidance.test.ts` | 保留 | Fast；phase guidance 路由 |
| `whatsnext-readiness.test.ts` | 保留 | Fast；repository readiness 与拓扑 |
| `whatsnext-setup.test.ts` | 迁移并保留 smoke | Extended；完整生命周期、语言与 gate 组合；Fast 以真实 selected-idea smoke 覆盖主路径 |

## 夹具处置

默认 V1 和 V2 fixture 均从各自不可变种子复制。种子的 local worktree 与
bare remote 先通过 Git transport 从初始化仓固化，避免复制仍可能执行
maintenance 的 live object store。每次调用仍获得独立 worktree 和 bare
remote，特殊 idea 集合、preferred language 与 object format 继续显式建仓，
避免模板键掩盖测试输入。

## 覆盖约束

- Fast 不承载大规模压力证明，但必须保留真实 filesystem、Git 与 CLI。
- Extended 不替代 Fast；complete 必须显式执行两层。
- Platform smoke 只从已有真实测试选择代表路径，不复制断言。
- Live external 不属于无凭据 release 门禁。
