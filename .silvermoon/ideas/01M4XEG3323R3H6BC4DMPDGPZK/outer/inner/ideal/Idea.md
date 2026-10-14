# 从 CLI 查看 Objective Reference Pages

## 问题

Objective Guide 已提供 `readPage` 与 `searchPages` 库 API，但 CLI 无法按需查看 problem、
check、level 或知识页面；`whats-next` 只能内嵌全部说明，Agent 也没有进一步查询入口。

## 结果

提供只读的 Objective Reference Page CLI，可选择 bundled Objective、语言和稳定
Reference ID 查看页面，并搜索可用知识；输出中的内部链接给出可继续执行的 CLI 命令。

## 边界

- page/search 不执行 checks、remediation 或 lifecycle mutation，也不制造动态授权。
- 缺失 ID 使用 Guide 的 `system/404` 语义；资源损坏、权限和配置错误仍显式失败。
- Reference identity 与 locale 由 Guide contract 决定，不建立第二套文档索引。

## 验收标准

- 用户可用 CLI 查看 Device、Project、Idea 的 level/check/problem/page 双语内容。
- search 返回稳定 Reference IDs，内部链接可继续导航到准确页面。
- package/install 场景证明命令读取 bundled resources，且不会改变 repository 或事件历史。
