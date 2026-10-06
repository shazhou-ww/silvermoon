# Deployment

## Steps

理想契约：[CLI 职责边界与模块化重构](./inner/ideal/Idea.md)。
实施契约：[Implementation](./inner/Implementation.md)。
以下为现实世界验证占位，不授权发布 npm 包。

### D-S01: 固定部署候选与验证边界

以已同步 primary 的准确实施验收候选为唯一源码。构建本地 npm tarball 并记录
文件清单、SHA-256、integrity 和 Git HEAD；不发布 npm、不创建 release tag，
不把本地安装验证描述为 registry 发布或生产部署。

### D-S02: 验证隔离安装与公开入口

在新临时目录中使用真实 npm 安装 tarball，验证 package metadata、严格文件清单、
`silvermoon` bin、根公共 API、`silvermoon/agents/copilot` 与
`silvermoon/agents/project-runtime` 子路径可加载。验证外部 v1→v2 迁移入口仍随包
提供，已删除的 source-only 迁移不在制品中。

### D-S03: 验证真实 CLI 与 Windows npm shim

通过安装后真实 `npm exec -- silvermoon`（Windows 上经过 npm/npx shim）运行
`list-ideas`、`whats-next`、`check`、`event replay` 的代表性路径，验证 stdout、
stderr、退出码与四投影 shape。针对 `list-ideas` 和 `whats-next` 明确验证有输出，
并比较执行前后的安装态 `bin/silvermoon.js` 字节完全一致、保持 LF。

### D-S04: 验证现有调用方与三层观察

运行完整 integration 与安装态 E2E，验证项目 runtime、Copilot adapter、公共
Agent 子路径和 source-checkout runtime 拒绝路径。通过 trace 证明命令经过
device→project→idea 观察；device 只报告运行来源、全局安装和全局配置，不探测
daemon。确认 event CLI 只公开 replay／append，revise／recover 返回 usage error。

### D-S05: 记录证据并准备准确版本验收

将环境、准确命令、结果、制品身份、限制和未执行项写入
[部署验证证据](./DeploymentEvidence.md)。同步 Deployment World 与 ledger 到
primary，重新观察准确 deploymentRevision 后请求明确 `acceptOuter`，不自动记录
部署验收。

## Acceptance criteria

### D-AC01: 安装制品完整且入口可用

本地 tarball 的严格文件清单、hash、integrity 与 Git HEAD 可复核；隔离安装后
bin、根 API、两个 Agent 子路径和外部 v1→v2 迁移入口可用，已删除的内部迁移缺席。
以 `pnpm pack:check`、tarball 构建输出和安装态 E2E 证明。

### D-AC02: 真实 CLI 与 Windows shim 行为可复核

安装后的真实 npm exec/npx shim 能运行代表性命令；`list-ideas` 与 `whats-next`
均产生结构化输出，入口文件执行前后字节不变且为 LF。通过安装态 E2E 输出、
文件 hash 对比和退出码断言证明。

### D-AC03: 调用方兼容和观察边界成立

完整 integration、unit/runtime、contract 与 release-grade gates 通过；Agent
子路径、project runtime、source-checkout runtime 保护、四投影和 trace 均保持
兼容。trace 显示 device→project→idea，且无 daemon 探测。event CLI 不再暴露
revise／recover。通过 `pnpm check` 与针对性测试证明。

### D-AC04: 部署证据与准确版本可验收

DeploymentEvidence 记录准确环境、命令、制品身份、结果和限制，ledger 与 D-S／
D-AC 稳定 ID 对齐。部署候选通过普通 Git 同步 primary 且可达，重新观察准确
deploymentRevision 后停在人工 `acceptOuter` 门；不发布 npm。
