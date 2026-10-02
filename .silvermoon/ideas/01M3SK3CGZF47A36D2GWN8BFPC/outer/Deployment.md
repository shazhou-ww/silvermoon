# Deployment

## Steps

### D-S01: 固定已验收候选与部署边界

确认 `project-agent-runtime` 的准确 Implementation revision 已获验收，
其提交可从刷新后的 primary 访问，工作区无未知修改。从这个固定提交制作
本地 npm tarball，记录提交、包版本和 tarball 摘要。本 idea 是 `0.4.0`
的前置项；此阶段仅验证可交付候选，不创建 `npm/` 标签、不发布 npm，
也不将未发布的候选称作已向公众部署。

### D-S02: 从独立调用方安装并验证项目版本边界

在仓库之外的一次性隔离目录中安装候选 tarball（不链接源 checkout）。
验证包子路径导出、类型声明与项目自身 CLI 发现；让两种受控项目 schema
各自交给安装的项目版本解释。对缺失能力、运行时故障和不确定事件结果
要求显式报告；检查运行时未回退到本源仓库 CLI，也不自行解释项目生命周期。
仅记录非敏感的命令、结果摘要和候选标识，完成后清除一次性目录。

### D-S03: 验证独立调用方的真实 Copilot 交互与恢复边界

用同一已安装候选，在一次性 Git 项目中以明确权限运行受控 Copilot：
注册项目 URL，创建 idea worktree，按项目事件日志准确前态发送与追加
`ping/pong`，重新连接原 session 并验证回传。若认证、模型输出、
工具权限或连接条件不具备，记录实际阻塞，不以本 checkout 的 mock
或旧实施阶段在线结果替代。不会运行真实客户仓库的工具、保存完整对话
或发布新包。

### D-S04: 核对证据、限制和恢复指引

把上述外部验证的确切命令、版本、摘要、通过/失败状态及可复现边界写在
本契约的对应标准下；保持 `ledger.md` 的同 ID 勾选与事实相符。
确认权限配置、日志前态冲突、缺失旧 session、断线不确定结果的处理
符合已交付的文档。不承诺断线期间完整输出回放、任意工具副作用去重，
也不把 npm 发布或未来 daemon 的成功作为本 idea 的已验证结果。

## Acceptance criteria

### D-AC01: 固定候选可由独立调用方安装和导入

给出 primary 中准确 Implementation acceptance 与候选提交、包版本、
tarball SHA-256；在 checkout 外安装该 tarball 后，调用方从两个 Agent
子路径导入实际运行对象并读取类型声明。用安装命令和导入检查结果证明，
明确候选尚未在 npm 发布。

验证结果（本地候选，非 npm 发布）：

- 已验收 Implementation revision `b08731b1d755dee0eada050de29f9467cfe7891e`
  由 primary 提交 `cad9e727afa4e323a8be1aff23da0531e8009ce0`
  中的 `acceptInner` 事件确认；打包提交
  `623164320913c08226a82d34bf196f8ba5c2d2f9` 已在 primary。
  包版本 `0.3.0`；`silvermoon-0.3.0.tgz` 的 SHA-256 为
  `8674bcdb4cae788ec08767fb23dcd645e555ab95a22e33f346963e06c50cabe1`。
- `npm pack --json --pack-destination /tmp/silvermoon-deploy-6231643`
  和 `npm install --prefix /tmp/silvermoon-deploy-6231643/consumer
  --ignore-scripts --no-audit --no-fund
  /tmp/silvermoon-deploy-6231643/silvermoon-0.3.0.tgz
  @github/copilot-sdk@1.0.16` 均通过；调用方直接导入
  `silvermoon/agents/copilot`、`silvermoon/agents/project-runtime`
  的运行时导出，并读取已安装包内对应的两个 `.d.ts`，均通过。
- `SILVERMOON_TARBALL=/tmp/silvermoon-deploy-6231643/silvermoon-0.3.0.tgz
  node --test test/e2e/installed-package.test.js`：1/1 通过。
  这些操作没有创建 `npm/` 标签或触发发布。

### D-AC02: 安装后的项目版本保有解释权

在独立进程中由安装候选返回不同 schema 项目的结构化报告；不支持的
事件能力和 CLI 故障被明确拒绝，不从本源 checkout 静默兜底。用隔离项目
的项目版本 CLI 路径、报告命令/状态及失败状态证明。

验证结果：仓库外一次性 `v1`、`v2` Git 项目均安装上述 tarball，
各自的 `package.json` 固定 `devDependencies.silvermoon: ^0.3.0`
（`npm install` 从本地 tarball 后需恢复这一声明），并将各自的
`node_modules/silvermoon/bin/silvermoon.js` 作为项目 CLI；
项目 `whats-next <idea> --json` 和独立 `ProjectRuntime.next(route)`
均返回 `idea-selected`、退出码 0。`v1` 的 `event replay`
明确返回 `blocked`、退出码 1；`v2` 的精确前态 `ping`
返回 `candidate-written`，过期前态追加退出码 1。临时移走
`v1` 项目自己的 CLI 后，`runtime.next` 报 `runtime is missing`；
恢复后未改动源 checkout，证明没有回退到本源 CLI。

### D-AC03: 真实 Agent 的外部交互可安全复用

独立调用方以安装候选和真实 Copilot session 完成有序交互，断开后重新
关联同一 session；从项目版本事件回放证明 `ping/pong` 序列，没有未经
确认的重复投递。若外部服务不可用，则保留此项未完成并报告阻塞。
只用一次性无私有内容的 Git 项目及最小权限。

验证结果：仓库外调用方使用已安装的 Agent 子路径、
`@github/copilot-sdk@1.0.16` 和一次性 `v2` Git 项目；权限回调
一律拒绝工具。`node /tmp/silvermoon-deploy-6231643/consumer/probe.mjs`
退出码 0：第一次 `send` 观察为 `queued,unknown`，正式回复非空，
项目事件追加 `pong` 成功；`close()` 后以原 registry 和 route
重新建立适配器，第二次正式回复非空，回放的交互顺序为
`ping,pong,ping,pong`，末项为 `pong`。没有重投第一次不确定发送；
不以模型是否输出特定词作为投递证明。验证未使用真实客户项目，
也没有把完整对话写入本契约。

### D-AC04: 已验证结果与不确定性有清晰交付边界

证据明确区分本地候选安装、真实在线能力、未验证能力及未授权 npm 发布，
附实际命令和结果；公开文档和本契约对失败、旧 session、准确日志前态
及断线恢复限制一致。用本契约的结果和 `ledger.md` 镜像清单核对。

上述命令只验证本地 tarball 的隔离安装与有认证环境中的在线会话，
不证明公共 npm 安装、未来 daemon、断线期间完整事件回放、任意工具
副作用去重或实际生产 Git 修复。可复现在线检查需要已认证的 Copilot
CLI、`@github/copilot-sdk@1.0.16`、隔离项目及其真实远端；
一次性 probe 和项目在验证后删除。源仓库的可重复安装检查见
`test/e2e/installed-package.test.js`；源仓库的独立在线覆盖见
`test/integration/copilot-runtime-live.test.js`。对照
`docs/reference.md` 的 Agent runtime integration：权限须明确决定，
事件前态由项目 CLI 验证，旧 session 缺失需人工核查，未知投递不自动
重发；观察结果不能升级为送达保证。本 idea 未授权 npm 发布。
