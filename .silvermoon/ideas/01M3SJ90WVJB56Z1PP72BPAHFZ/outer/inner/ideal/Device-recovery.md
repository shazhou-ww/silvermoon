# 设备 HEADQUARTER remote 与灾难恢复

## 定位

每个逻辑设备默认拥有一个独立 private `device-hq` remote repository。它是设备
治理契约、维护实现和恢复描述的可移植来源，不是物理设备磁盘、daemon root 或
运行内存的镜像。Git revision 只证明恢复候选的内容，不证明 Outer World 已恢复。

逻辑设备身份可以由新物理设备显式接管，但任一时刻只能有一个 active daemon
owner。接管前须 fence 旧 owner，避免两个 daemon 同时调度相同项目和 session。

## Remote 中的可移植事实

private remote 可以保存：

- device-hq 的 Ideal、Implementation、Deployment、idea events 和 ledger；
- 经审阅的设备维护脚本、检查程序、恢复步骤和接入政策；
- 期望的 Silvermoon binary 与 canonical skill release/digest；
- daemon、Agent、Git、目录布局、资源限制和健康检查的期望能力；
- credential-free managed project URL、稳定 projectKey 和恢复核验约束；
- schema capability、兼容范围与显式迁移政策。

remote 不保存或间接泄露：

- upstream、Git、Agent、API 或系统凭据及 private keys；
- Agent SDK session、完整 transcript 或执行日志；
- request receipt、cursor、lock、PID、socket、消费位置或在途状态；
- cache、依赖目录、managed checkout、idea worktree 或本机临时文件；
- 不能跨设备成立的绝对路径和机器生成秘密。

portable project manifest 用于重建 registry，不取代本机 registry。manifest 中的
projectUrl 不含凭据；projectKey 保持逻辑绑定。恢复后的绝对路径、session binding、
cursor 和 receipt 必须根据新设备真实状态重新建立。

## 可信恢复流程

1. 从可信分发渠道取得最小 Silvermoon bootstrap binary。
2. 通过 Git 之外的秘密恢复渠道取得 private remote 和后续服务的最小凭据。
3. clone 准确 device-hq repository，验证 remote identity、目标 revision 及适用的
   commit/signature policy。
4. 安装并验证契约声明的 HEADQUARTER binary 与 canonical skill release/digest。
5. 在 upstream 撤销或 fence 旧 owner；为新物理设备签发新的本机秘密，并显式接管
   同一逻辑 device identity。
6. 按 portable manifest clone managed repositories，核对 remote、primary、
   projectKey、schema 和权限；clone 不自动执行 repository hooks、脚本或 package
   installation。
7. 重建本机 registry、worktrees、Agent sessions、service configuration 和消费
   位置；不得从 Git 伪造旧 receipt 或 session 状态。
8. 重新观察每个项目的 authoritative facts。灾难发生时无法证明结果的操作保持
   `unknown`，不能假定未执行并盲目重放。
9. 运行设备与项目健康检查，验证下游 Agent 和 skill digest 后才恢复生产流量。

clone 成功不等于恢复成功。恢复证据必须覆盖真实 Outer World、唯一 owner、项目
身份、schema compatibility、下游可行性及未知操作协调。

## 初次创建、升级与演练

初次建设逻辑设备时，从最小 device-hq scaffold 创建 private remote；灾难恢复时
从既有 remote clone。两条路径都不克隆 Silvermoon 源码，也不允许 managed repo
提供自己的 Silvermoon executable 或覆盖 canonical skill。

HEADQUARTER binary 与 skill 作为同一 release 原子升级并可回滚。升级前检查全部
登记项目的 schema capability；普通 daemon 操作不静默迁移项目 schema。

private remote 是恢复来源而非完整备份。生产部署还须有独立 secret recovery、
可信 bootstrap、必要的 remote 镜像或离线恢复包，并定期执行完整恢复演练；只验证
repository 可 clone 不构成灾难恢复证据。
