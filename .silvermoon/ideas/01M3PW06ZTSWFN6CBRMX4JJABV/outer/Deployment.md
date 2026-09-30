# Deployment

## Steps

### D-S01: 发布并锁定实际采用的 primary 候选

本 idea 的交付对象是仓库开发与验证流程，不是 npm 新版本。先发布本部署契约，
重新观察 `pnpm-check-regression` 的精确 deployment revision，锁定包含该契约与
已验收实现的 primary commit。验证实现验收事实仍为
`986e6a54fe4bf853b1431fbadd06a0a3ddebc03f`，其实现、支持文件和理想世界不变。
记录 commit、primary 可达性及贡献者文档的固定链接。

### D-S02: 在干净消费者 checkout 验证完整开发检查

从配置的 primary repository 获取独立、干净的 checkout，固定到 D-S01 的 commit；
记录 Windows、Node.js、pnpm 版本并使用 frozen lockfile 安装依赖。先运行 fixture
隔离与调度器回归的定向测试，再按 `docs/maintaining.md` 运行一次 `pnpm check`。
记录六个门禁的结果、耗时输出、测试数量与既有 Windows 跳过原因，确认执行前后
tracked 文件不变，操作创建的临时 checkout 最终清理。

本阶段证明他处 checkout 可直接采用已发布实现，不重新定义或替代已验收的五次
性能基线。单次部署 smoke 的墙钟只作诊断，不宣称新的提升百分比；不与其他会话
的性能测量争用资源，也不修改仓库交付代码来修补部署中发现的问题。

### D-S03: 核实托管 CI 并发布外部证据

通过 GitHub Actions 查询 D-S01 commit 的真实 CI run，确认现有三个操作系统与
Node.js 22/24 的 unit 矩阵，以及 contract、integration job 均成功。记录 run
链接、head SHA 和各 job 结论，不把本地通过等同于托管 CI 通过。

将 primary 可达性、消费者验证与托管 CI 结果写入 ledger 后正常提交并发布。重新
观察最新部署 revision，提供固定契约链接并请求明确部署验收；不自行写入
`deploymentAcceptedRevision`。新 idea `test-validation-tiers` 的策略实现在独立
session/worktree 推进，不属于本部署验收，也不能覆盖本次固定候选的证据。

## Acceptance criteria

### D-AC01: 已验收实现与操作说明在 primary 可获取

记录的部署候选及证据提交均可从刷新后的配置 primary 到达；固定候选包含已验收的
inner tree `986e6a54fe4bf853b1431fbadd06a0a3ddebc03f`。贡献者文档保留快速、
完整检查入口以及一次预热和五次样本的方法。通过 Git ancestry/tree 检查、固定
文档链接与 `silvermoon check` 证明；本部署不产生 npm release。

### D-AC02: 干净 checkout 可运行完整检查且诊断完整

独立 checkout 上的定向回归与 `pnpm check` 均退出码 0；完整检查仍运行六个门禁，
每个门禁有非负 `CHECK_DURATION`，整次有 `CHECK_TOTAL`，无新增跳过项或测试
覆盖因部署而减少。ledger 记录实际测试数、环境和耗时；Git 状态与临时路径清理
证明该消费者验证未修改交付内容、未遗留操作拥有的 checkout。

### D-AC03: 固定候选的远端 CI 通过且证据可审阅

GitHub Actions 的 CI run head SHA 与固定候选一致，六个 unit 矩阵 job 和
contract、integration job 全部为 success。ledger 提供固定 run URL 与结论，
并随部署契约正常发布；最终请求验收的 deployment revision 来自最新成功报告，
而不是历史记忆或 ledger 复选框。
