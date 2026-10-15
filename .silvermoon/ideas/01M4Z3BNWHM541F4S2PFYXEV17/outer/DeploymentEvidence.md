# Deployment Evidence

## 验证范围与来源

2026-10-15 在 Windows、Node v24.12.0 上，通过设备级全局 `silvermoon` 完成三个独立样例及一个全新 clone 的外部流程验证：247 条命令成功，15 次状态观察符合断言。验证前已将部署契约同步 primary；运行时代码候选为 `24d6e8a9e401`，被验证的部署契约 revision 为 `cc7793f46c80`。本文件仅追加执行后证据，不改变已验证契约或已接受实现。

- 全局命令解析：`C:\Program Files\nodejs\silvermoon.ps1`；每条 CLI 命令由新的 PowerShell 进程启动，不使用程序内部 API 或直接 Node 入口。
- 每条 CLI 命令前后均校验全局包 junction 的真实路径为 `D:\Code\silvermoon.worktrees\silvermoon-gate-mode-implementation`；命令后同时校验 personal canonical skill 的真实路径为该 checkout 的 `skills\silvermoon`。
- 隔离根：`D:\sm-d28cd133\deployment4`；三个样例分别使用自己的工作副本与 `explicit.git`、`waived.git`、`restore-before.git` bare primary。独立 observer 从 `waived.git` clone，不借用原样例内存。
- 样例配置的 `https://example.test/gate-mode/deployment.git` 仅通过样例本地 Git `url.*.insteadOf` 映射到各自 file URL；没有向外部示例地址发送请求。没有更改原始工作区、真实 idea 门禁模式或全局 Git 设置；没有发布 npm。
- 第一轮因共享全局 runtime 被并行会话切换而不作为最终来源证明；最终完整重跑加入逐命令真实路径断言并全部通过。

## 外部结果

样例初始 inner revision 为 `686599e8e7bf`，新增样例文件后的 inner revision 为 `63502f389053`。每次变更均执行 worktree/staged 检查、普通提交、非强制推送、fetch 与 primary 可达性校验，再以精确 digest、primary 和 world revision 追加事件。

| 样例动作 | 样例 primary | 实际结果 |
| --- | --- | --- |
| 默认模式精确 `submitInner` | `46bf08b14abc` | `implementing`，inner=`submitted`，control=`upstream` |
| 已提交后授权 inner `waived` | `28516e20a904` | `deploying`，inner=`waived`，control=`downstream` |
| 已通过后恢复 inner `explicit` | `4f0f36676c7f` | 已通过的 revision 保留 `waived`，不回退 |
| 先授权 inner `waived`，再精确提交 | `68c0fdaefe55` | 无 `acceptInner` 即进入 `deploying` |
| 精确 `submitOuter` | `2f2b00b5ebea` | outer=`submitted`，仍在 `deploying`，control=`upstream` |
| 新 clone 与全新 CLI 进程重新观察 | `2f2b00b5ebea` | 模式、waived revision、outer 提交及 upstream control 完整恢复 |
| 改变已通过的 inner 内容并同步 | `1a252fe82d27` | 返回 `implementing`，inner=`stale`，control=`downstream` |
| 为新 inner revision 重新精确提交 | `47ab5fff64e5` | 新 revision 为 `waived`，重新进入 `deploying` |
| 提交前先 waived 再恢复 explicit | `e8b04339d27b` | 精确提交仍停在 `implementing`，等待显式验收 |

所有观察中 outer 模式均为 `explicit`。独立 observer 读取原始事件，确认不存在 `acceptInner` 或 `acceptOuter`；样例中的 `acceptIdeal` 与 `setGateMode` 仅用于已明确授权的隔离验证，不构成真实项目验收。检查和同步没有被免验收策略跳过。

## 复现入口与留存

程序化验证仅消费全局 CLI 的四投影 JSON：`silvermoon whats-next <id> --json`、`silvermoon event replay <id> --json`、`silvermoon check --worktree --json`、`silvermoon check --staged --json`。写操作使用 `silvermoon event append <id> --input <request> --expected-digest <fresh digest> --expected-primary <fresh primary> --json`，样例的上游决定额外带 `--confirm-decision`；每一步重新获取精确引用，不回放陈旧决定。

完整驱动脚本、247 条命令收据、15 次观察的完整对象 ID 与三个样例 Git bundles 保存在本 session 的 `files/gate-mode-deployment.mjs` 与 `files/gate-mode-deployment4/`。这是本机取证材料，不是可公开访问的远程证据；本文件中的结果与引用是仓库持久证明。验证所需临时工作副本在留存 bundles 后可安全清理。既有实现与 Windows 安装后 TUI 检查见 [ImplementationEvidence.md](./inner/ImplementationEvidence.md)；本次部署不重新解释其历史间歇性故障根因。
