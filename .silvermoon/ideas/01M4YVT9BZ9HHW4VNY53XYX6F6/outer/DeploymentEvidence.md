# Deployment evidence

## 全局 CLI

设备级全局链接解析到本 checkout：

```text
D:\Code\silvermoon.worktrees\simplify-reference-command-idea
```

通过全局 `silvermoon` 在独立 PowerShell 进程中验证：

- en-US 显式 `check:` namespace 精确打开 Project 页面；
- zh-CN 无 namespace 唯一搜索结果自动打开同一页面；
- 多结果搜索返回包含 namespace、owner、稳定 ID 和可复制命令的
  human-readable 列表；
- 零结果搜索返回 human-readable 空结果；
- 仅显式 `--json` 返回包含 `operation`、`owner`、`referenceId` 和
  `page` 的结构化结果；
- 旧 `reference page project ...` 入口仍可读取相同页面。

## 仓库门禁

- `pnpm check:skills` 通过。
- targeted Reference business/CLI tests 通过，共 20 项。
- `silvermoon check --worktree --audience agent` 通过。
- `silvermoon check --staged --audience agent` 通过。
- `pnpm check:commit` 通过。
- 完整 `pnpm check` 通过。为稳定测试夹具对 `example.test` 的预期失败
  文本，本次仅为该测试 URL 配置 malformed proxy；产品代码、真实
  repository remote 和断言未修改。

实现提交 `a5220213403ddcb4d56d0973f3c97f56a8828dff` 已同步到
`origin/main`，后续 submitInner 与 acceptInner 事件也已通过普通
非强制 Git 流程同步。
