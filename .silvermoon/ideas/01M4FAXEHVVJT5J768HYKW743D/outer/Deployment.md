# Deployment

## Steps

### D-S01: 准备不可变 0.4.0 发布候选

在 `origin/main` 上确认 release-grade checks、package 内容和 changelog，创建指向
准确提交的不可变 `npm/silvermoon/v0.4.0` tag。

### D-S02: 通过受控工作流发布

仅通过 `.github/workflows/publish-npm.yml` 发布 tag 对应的 npm package，保存
workflow、registry 版本与 provenance 结果。

### D-S03: 验证全新执行环境

在隔离的本地执行环境完成全局安装、personal skill discovery 和不同 schema
项目的 smoke test；对 remote/cloud Agent 单独验证执行环境 provisioning 或记录
明确边界。

## Acceptance criteria

### D-AC01: Registry 与 Git 身份一致

公开 registry 的 `silvermoon@0.4.0`、不可变 tag、workflow provenance 和
`origin/main` 提交完全对应，并以外部查询和 workflow 记录证明。

### D-AC02: 普通项目无需本地 Silvermoon

全新环境中的示例项目不声明 Silvermoon dependency、不包含 repository skill，
仍可由全局 runtime 与 personal skill 完成项目准备；以安装和命令 transcript
证明。

### D-AC03: 已发布兼容承诺成立

发布包能够验证 current 与受支持历史 schema、生成并应用迁移，同时对 future
schema 给出准确 runtime freshness 诊断；以冻结 fixture 的 package-level smoke
结果证明。
