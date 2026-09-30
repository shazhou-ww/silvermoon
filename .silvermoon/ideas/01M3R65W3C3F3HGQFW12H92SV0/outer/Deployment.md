# Deployment

## Steps

### D-S01: 发布契约并固定主线候选

本次部署是仓库验证策略的实际启用，不是 npm 版本发布。保留已验收的
implementation revision `c5264f272e1ef724686d9a2b0b5364b6b4ca4201` 和内层世界，
仅维护本 idea 的 Deployment/ledger。先将本契约与匹配 ledger 普通非强制
同步到主线，刷新确认可达并重新观察稳定 deploymentRevision，再执行以下验证。
记录契约 commit、候选 SHA、Node.js/pnpm 版本；不沿用全局安装 CLI 的状态，
使用候选的 `node bin/silvermoon.js` 检查。

首次部署在旧候选发现 sanity 回归后停止；经用户同意修订实施、修复并重新验收，
本次重新固定包含修复及并发主线更新的候选，重跑以下部署验证。旧失败与旧 CI
证据保留在 ledger，不能代替本次结果；旧实施验收事实仍可从 Git 历史复查。

### D-S02: 在全新 checkout 验证使用路径

在会话所属的独立临时 clone 中检出已发布候选，按锁文件准备依赖；
顺序运行一次 `pnpm check:sanity`、`pnpm check:commit` 和 `pnpm check:release`，
确认 `pnpm check` 与 release 使用同一完整门禁集合。记录精确退出码、测试数量、
skip、包检查/installed-package 与技能本地/外部发现结果；保留完整失败诊断。
验证前后 Git index/worktree 干净，commit 入口明确区分工作区测试与暂存元数据。

这不是新的比较基线，不执行预热加五次样本，不把共享机器单次耗时解释为性能收益。
仅删除本次操作创建且路径已明确的临时 clone，不改变用户或其他会话文件。

### D-S03: 验证实际托管 CI 与使用说明

查询本契约 commit 的普通 push CI，确认六个平台/Node unit-runtime job、
contract、integration、risk 正常运行，metadata-only 仅跳过 package/E2E。
在主线触发一次普通 CI 的 workflow_dispatch（不是 publish-npm），记录其实际
head SHA，并确认显式 full 路径和 package contents/installed CLI job 成功。
若并发主线移动，精确记录两次候选差异，重新观察；不把不同候选的结果混用。

读取发布候选的维护文档、Agent 指令和脚本/工作流契约，确认 sanity/commit/
release 的使用边界、部分暂存警告、保守升级和无隐式发布说明一致。保留
已有发布 workflow 的不可变 tag、受保护环境、实际 tarball 和发布后验证；
本次不触发真实 npm 发布，不以未执行的 registry/provenance/CDN 检查冒充成果。

### D-S04: 同步证据并请求精确部署验收

将命令、SHA、CI 链接、成功或阻塞证据记录到本 idea ledger；不以旧实施证据
代替本次部署执行。验证 worktree/staged、普通提交并同步证据，刷新 primary、
检查可达性和 deploymentRevision 后提供简短的本地/固定远端审阅索引。
只有用户明确验收该精确部署 revision，才另行写入 deploymentAcceptedRevision。
如验证失败，停止于真实 blocker；不在 deploying 阶段修改仓库实现或削弱门禁。

## Acceptance criteria

### D-AC01: 发布候选与验收身份准确

契约先于验证到达 refreshed primary，ledger 记录精确契约 commit、
deploymentRevision 和实施验收事实；内层世界、其他 idea、npm 版本保持不变。
通过 Git 可达性和重新观察结果证明，不推断新的人工决定。

### D-AC02: 全新环境的分层入口可用

独立 clone 中 sanity、commit、release 均退出 0，完整门禁包括包内容、
installed-package、技能本地一致性/外部发现；没有新增 skip 或空集合成功。
运行前后干净，commit 范围警告可见。若失败则保留日志且此项不勾选。

### D-AC03: 托管路由符合风险契约

普通 metadata-only push 的完整核心 job 成功且仅 package/E2E 被跳过；
手动 full CI 的全部十个 job 成功且 package/E2E 实际执行。证据提供
run URL、event、head SHA、job 结果；若候选不相同则解释其可比边界。

### D-AC04: 指令与发布边界没有漂移

已发布候选的文档、脚本和 workflow 契约一致，用户可找到日常/提交/交付入口，
工作区与暂存边界明确。发布流程的安全与实际产物校验保留，但本次没有
npm 发布、tag 创建或虚构发布后证据。以候选文件与定向契约检查结果证明。

### D-AC05: 可审阅证据已同步且等待明确决定

全部部署证据经快照校验并普通同步到 primary；最新 deploymentRevision 和
固定 commit 审阅链接可复查，worktree 干净，无未知改动丢失。部署验收状态
在用户明确决定前保持空缺；阻塞和未执行事项显式列出。
