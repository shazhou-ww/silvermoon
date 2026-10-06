# Deployment

## Steps

### D-S01: 固化并同步部署验证契约

将本契约与 ledger 同步到 primary，确认 Silvermoon 报告稳定的 deployment revision，
并以该 revision 所在的准确主分支提交作为后续外部验证候选。部署验证不创建 npm release
tag、不发布新版本，也不修改已验收的仓库 deliverables。

### D-S02: 执行跨平台主分支 CI

针对准确候选提交手动触发仓库 `CI` workflow。要求 Node.js 22 与 24 上的 Linux、
Windows、macOS 单元和 sanity 验证，以及 contract、skill、Git integration、包内容和
安装后 CLI 测试全部完成。记录不可变 workflow run URL、候选提交和各 required job
结果。

### D-S03: 验证 primary 历史与远端 Silvermoon 状态

刷新 `origin/main`，确认 TypeScript implementation 与本部署契约提交均可从 primary
到达，并执行 `silvermoon check --remote --audience agent`。记录远端 snapshot、
V2 event history 与 repository configuration 的验证结果。

### D-S04: 汇总部署证据并同步

在 Outer World 的 `Deployment-evidence.md` 中记录命令、准确提交、CI run、外部结果和
未执行事项。完成 ledger 后校验、提交并同步证据到 primary，再重新观察稳定的
deployment revision 供人类验收。

## Acceptance criteria

### D-AC01: 主分支 CI 在全部目标环境通过

GitHub Actions 的 `Required checks` 成功，且其依赖的 package-risk、全部 Node/OS
unit matrix、contract、integration 与 package jobs 均为成功或契约允许的明确跳过。
以 commit-pinned workflow run URL 和 job 结果证明。

### D-AC02: 安装包可在真实隔离环境消费

CI package job 从候选构建 tarball，包内容检查和 installed-package E2E 均成功；
证明生成的 CLI、根导出、Agent 子路径和声明可由隔离消费者使用，而不是依赖工作树
源码或历史构建产物。

### D-AC03: Primary 候选与 Silvermoon 历史有效

远端检查证明准确候选可从 `origin/main` 到达，Silvermoon remote snapshot 与完整 V2
event history 有效，且本地分支同步后 ahead/behind 为 `0/0`。

### D-AC04: 部署边界无未授权发布

证据明确显示本阶段未创建或移动 `npm/silvermoon/*` tag、未运行 `npm publish`、未
修改 npm registry 状态；TypeScript 改造的 npm 正式发布仍遵循独立版本与人工授权流程。
