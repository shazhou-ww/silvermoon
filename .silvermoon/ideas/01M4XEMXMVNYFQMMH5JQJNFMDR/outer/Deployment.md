# Deployment

## Steps

### D-S01: 采集完整 Objective corpus

在隔离环境按 en-US/zh-CN 重跑 Device、Project、Idea 的 blocked、terminal、
prerequisite owner 与特殊交互场景；临时输出不提交，覆盖矩阵记录在
[DeploymentEvidence.md](./DeploymentEvidence.md)。

### D-S02: 发布统一报告语义

验证 packed/install CLI、公开 schema/reference 文档与 skill 共同发布位置、
静态 guidance、动态上下文、详情查询和空 required actions 语义；不发布 npm。

## Acceptance criteria

### D-AC01: 双语报告完成评审

最终 corpus 的两种 locale 均覆盖 blocked/terminal、三种 Objective、
prerequisite owner、静态 guidance/详情命令、空 required actions 和特殊组件；
以 Deployment evidence 的矩阵与 contract/integration 结果证明。

### D-AC02: Release-grade 检查通过

packed/install CLI、schema、contract、integration、skills 与完整 release 检查
全部通过，结果记录在 Deployment evidence。
