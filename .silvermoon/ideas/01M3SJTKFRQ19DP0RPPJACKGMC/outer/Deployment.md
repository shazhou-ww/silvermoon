# Deployment

## Steps

<!--
为每个步骤分配稳定的 D-Sxx 标识符和三级标题。
描述部署或现实世界验证工作。
不要在本文档中使用任务列表复选框。
-->

### D-S01: 固定部署候选与隔离边界

使用已验收的 implementation revision
`0dbc1f0cc26965ce613fbf28d8dad624f3cdc767`，
交付源码提交 `211fc313d741ff77500f3634d07efac291bf02de`。
先将本部署契约及 ledger 同步 primary，重新观察准确 deployment revision，
再执行以下验证；将候选 commit、环境、命令及结果记入 ledger。
不修改已验收的内层世界或生产交付。

用户已明确授权将本仓库全部 idea 从 status.yaml 迁移到 events.jsonl，
切换为 schema v2，并纳入本次部署。部署包含隔离消费验证与本项目实际采用，
不等于 npm 上线。消费环境和 bare primary 由现有测试创建并清理；
实际升级仅操作当前独立 worktree，再通过普通 Git 同步 primary，
不访问主 checkout，不触发其他前置项的实现或生命周期决定。
包版本仍为 `0.3.0` 的未发布候选，不宣称 `0.4.0` 已发布。

### D-S02: 验证可安装交付与独立迁移

运行 `node --test test/e2e/installed-package.test.js`，
从当前 checkout 生成真实 tarball 并安装到隔离消费环境。
用包内独立入口生成迁移计划、按摘要 apply、验证完整候选，
将迁移边界同步到隔离 primary，再通过安装包 CLI replay 和 append。
该路径不依赖全局 Silvermoon 或已发布包处理源码仓库。

### D-S03: 复验状态、恢复与历史规则并交付证据

运行 `node --test test/runtime/event-state.test.js`，在真实文件系统、
Git 仓库和子进程夹具中复验准确世界门槛、只读观察、重复输入、
并发写入、迁移/写入中断恢复，以及健康前缀保护、失败基线修复后
恢复保护、格式和缺历史失败关闭。该套件含库入口及 CLI 进程，
不得将全部场景描述为安装包黑盒验证。

运行 `node bin/silvermoon.js check --remote --audience agent`，
核实同步候选在配置的真实 primary 可读，并检查迁移前本仓库为 v1、
内层世界与生产代码未变。仅在全部证据记录并同步后请求准确
deployment revision 验收；不自行写入 deployment acceptance。

### D-S04: 显式迁移本仓库全部 idea 并集成边界

在干净且已同步的来源 commit 保存全部 idea 的 v1 事实与 inventory，
运行本 checkout 的 `node bin/migrate-v1-to-v2.js` 只读计划，
记录完整 idea 清单及摘要，再以 `--apply --expected-digest <digest>`
执行一次项目级事务。保留来源 commit 作为可核对的原始事实，
中断时只按原恢复计划处理，不手改 JSONL、不覆盖未知修改。

比较每个日志回放与来源 status 的全部字段，确认无遗漏、无新增决定；
比较迁移前后身份、alias、语言、生命周期与世界 revision。
全部 status.yaml 移除，每个 idea 恰有一个 events.jsonl，
config.version 为 2，所有世界树不变，无事务残留。
再次执行独立入口须返回 `already-v2` 且字节不变。
先验证 worktree/index，再将迁移边界单独提交；集成前验证 commit，
以未变化的来源 primary 为基线普通 push，随后 remote check 必须通过，
并重新观察 event-state-model 仍为 deploying。
迁移边界集成前不追加新事件；之后的人类决定必须使用受控事件命令。

## Acceptance criteria

<!--
为每项标准分配稳定的 D-ACxx 标识符和三级标题。
同时说明可观察的外部结果及其证明方法。
不要创建单独的验证章节，也不要使用任务列表复选框。
-->

### D-AC01: 安装包在隔离消费环境完成升级和受控写入

D-S02 命令退出 0，输出 `PACK_SMOKE_OK`，包内迁移入口可执行，
迁移后 check 通过、迁移边界已进入隔离 primary、受控追加返回
`candidate-written` 且回放内容符合断言。以该次执行日志与对应
固定版本测试源码证明，不以源码库可导入替代可安装交付。

### D-AC02: 故障与并发边界可复现

D-S03 的 event-state 套件全部通过且无跳过；记录实际场景数。
健康基线不可改写，明确归约失败基线可修复并再次受保护；
竞争与中断不丢失已接受事实，未知字节保留且报告失败。
以该次运行结果及固定版本的断言证明。
Windows 只证明进程中断恢复，不保证硬件断电；恢复进程自身中断后
仍需人工核验并清理其互斥文件，不将此边界写成自动恢复成功。

### D-AC03: 证据同步且发布边界保持

ledger 记录部署候选 commit、准确 deployment revision、运行环境、
命令结果和证据索引，随普通提交同步真实 primary。
remote check 通过；已验收内层树不变，生产代码无部署期修改、
无自依赖或 npm 发布。仅按 D-S04 的明确授权进行本仓库迁移；
操作文档按实际格式区分 v1/v2，不再声称本仓库固定为 v1。
证据更新只在 ledger，不为记录结果改动已执行的部署契约 revision。

### D-AC04: 全量事实无损迁移且真实 primary 采用 v2

记录完整 idea 清单和迁移 plan digest；逐项证明来源 v1 字段与事件投影
完全相等，inventory 的身份、alias、语言、生命周期和世界 revision 不变。
每个 idea 仅有 events.jsonl 权威，重复入口无写入，事务文件无残留。
worktree、staged、commit、remote 检查全部通过；真实 primary 可达
准确迁移 commit，历史检查识别 migration 边界并保护新事件前缀。
在迁移后的源码 checkout 运行 `pnpm check`，证明本项目采用 v2 后
发布级检查仍通过。本项不替代最终准确 deployment revision 的人工验收。
