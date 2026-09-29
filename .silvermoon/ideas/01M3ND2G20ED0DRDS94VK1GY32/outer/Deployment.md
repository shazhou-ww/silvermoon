# Deployment

## Steps

### D-S01: 发布明确授权的 Silvermoon 版本

在实现获得验收且用户明确授权版本后，通过 `origin/main` 可达提交上的不可变
npm tag 和受保护 GitHub Actions trusted-publishing workflow 发布新 CLI。

### D-S02: 从已发布包验证双语 override

在干净消费者仓库安装目标 npm 版本，分别对 `whats-next` 和全部 `check` target
运行 `--language en-US`、`--language zh-CN` 及 `--json` 组合。覆盖配置就绪、
项目整备阻塞、repository 同步、idea selection、有效检查与 unavailable 检查。

### D-S03: 验证持久化与错误边界

在带 project/idea preferred language 的消费者中证明临时 override 不修改文件或
revision，并确认下一次无 override 调用恢复原继承语言。对不支持和非法 tag
执行真实 CLI，保存退出码、stderr 及运行前后文件/Git 状态。

## Acceptance criteria

### D-AC01: 已发布命令可稳定选择英文或中文输出

注册表安装的 `whats-next` 与 `check` 对 canonical 或可规范化的
`en-US`/`zh-CN` override 产生对应语言的 Silvermoon-owned Markdown 和 JSON
文本，覆盖 readiness、lifecycle 与 check target 矩阵。通过真实命令输出和
预期短语断言证明。

### D-AC02: override 不改变项目或 lifecycle 状态

带相反 project/idea language 的 fixture 使用临时 override 后，status、config、
world revision、Git worktree 与 lifecycle state 均不变化；随后的无 override
调用恢复持久化语言。通过文件 hash、`git status` 和连续两次 observation 证明。

### D-AC03: unsupported language 快速且安全地失败

已发布 CLI 对 `fr-FR`、`en`、非法 tag 和空参数返回 usage exit `2`，不读取或
fetch repository、不创建 trace/idea 文件，也不修改工作区。通过隔离 fixture、
command spy 或 trace absence 和前后文件树证明。

### D-AC04: create-idea 的既有多语言能力不回归

同一已发布版本仍接受 `create-idea --language fr-FR`，把 canonical tag 写入新
status；未传参数时不持久化继承值。通过干净 fixture 中的实际 scaffold 内容、
status 与 CLI 输出证明。
