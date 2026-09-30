# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 固化基线与改善目标
  - 在 `1435c77570080f0d497d22e0934eee90a2ad6e95` 完成两个入口各一次预热、
    五次样本，均退出 0。日常/全量中位数为 20,631/130,765 ms；
    实施前目标固定为 10,315.5/65,382.5 ms。完整数据见同世界证据。
  - 测量后 primary 移至 `9fbce63cf348d079d4728afcaefba929da040b39`，
    已 fast-forward 并重新观察 implementing；保留并发历史，未修改其他 idea。
- [x] **I-S02:** 按真实成本拆分并守恒测试
  - 35 个原测试 body 保持，17 个 runtime 测试仍进入 unit 原平台矩阵；
    dialogue 的真实 Git 测试进入 integration。最终完整计数 237 -> 248。
- [x] **I-S03:** 实现场景调度与快照边界
  - sanity/commit/release 复用 runner；check/quick 兼容语义保留；技能拆分。
    真实部分暂存 fixture 验证警告、候选差异、失败传播及 index/worktree 不变。
- [x] **I-S04:** 保守升级 CI 与对齐发布
  - 仅 idea metadata-only 跳过 package/E2E；未知或无 baseline 均升级。
    core 矩阵不筛选，发布静态检查补齐，权限及实际产物路径未变。
- [x] **I-S05:** 对齐贡献者与 Agent 指令
  - AGENTS、maintaining、repository-tasks、npm-package-releases 对齐，
    明确部分暂存边界、外部工具和无隐式 npm 发布。
- [x] **I-S06:** 验证并发布实现证据
  - 契约先发布于 `547f7dff32dde01f59e9dc4898184dfe5e300e6f`；
    实现和同世界证据发布于 `9e41052f05a9dbe8fb1ce16f61545ec9a74dffe0`，
    已刷新 primary 并验证可达，当时观察 implementation revision
    `48b8a37df2ebaec17a37b1f1eaea893e370046e4`。
  - 最终候选 `pnpm check` 退出 0：247 项、245 pass、2 原有 skip；
    CHECK_TOTAL 132,563 ms。lint/quick/integration/pack/E2E/skills
    分别为 3,223/28,345/111,936/8,740/132,505/15,549 ms。
    `PACK_OK`（49 文件）、`PACK_SMOKE_OK`、外部 discovery 均通过。
  - worktree/staged Silvermoon 校验、`git diff --check`、
    `git diff --cached --check` 均退出 0；提交前 index 与 worktree 无差异。
  - 托管 CI [36668763265](https://github.com/shazhou-ww/silvermoon/actions/runs/36668763265)
    的六个 unit/runtime 矩阵、contract、integration、risk 全部成功，但新增
    package job 的 E2E 失败：Linux 经 pnpm 启动时沿用了 Windows 的 npm-cli
    相对路径，找不到 `/opt/hostedtoolcache/node/24.21.0/x64/bin/node_modules/npm/bin/npm-cli.js`。
    该失败由新增普通 CI 门禁暴露，不跳过或改用另一候选掩盖。
  - 已将 package build/check/E2E 的 npm 调用收敛到同一平台 helper：
    POSIX 用 PATH 的 npm，Windows 保留 shell-free npm-cli。新增跨平台
    确定性测试，窄测 6/6、本地完整 `pnpm check` 退出 0（248 项、2 原有
    skip）。
  - 修复 commit `50c3d698b566b4bc16f08f575370531b6e53a77e` 已普通 push、
    刷新确认可达；[CI 36669180127](https://github.com/shazhou-ww/silvermoon/actions/runs/36669180127)
    10/10 jobs 成功，包括实际 package/E2E 和全部三平台双 Node 矩阵。
    最新 full 248 项、246 pass、2 原有 skip，CHECK_TOTAL 133,239 ms。
- [x] **I-S07:** 修复部署发现的测试归属与 CI 入口缺口
  - 用户明确同意修订实现并修复，旧验收事实保持；修订契约后重新观察
    implementing，再修复真实 Git 测试归属及矩阵 sanity 步骤。
    I-S02/I-S04/I-S05/I-S06、I-AC01/I-AC02/I-AC05/I-AC06/I-AC07
    曾因新候选需重新证明而重置；下列历史结果不删除，也不冒充新候选证据。
  - 契约修订 `65d533ab86315ddf3ebc8d2451327957787f965c` 先同步并观察
    implementing；修复 `7b1bf4b97437578a8a6b30b9f3405bb995ce5c00`
    后同步主线。两段原测试 body/语料精确一致，只移动真实 Git 测试到 runtime。
  - 窄测 5/5，sanity 93/93，commit exit 0，full 260 项（258 pass、
    2 原有 skip）；快照和 diff 检查通过。维护文档与 workflow 契约对齐。
    负向测试拒绝移除、替换、跳过、忽略错误和错序六种 sanity 门禁变体。
  - [CI 36672310740](https://github.com/shazhou-ww/silvermoon/actions/runs/36672310740)
    对修复 SHA 的 10/10 jobs 成功；六个矩阵 job 的 `Run sanity checks`
    步骤均实际 success，随后完整 unit/runtime 成功，package/E2E 实际成功。
    完整细节见同世界 validation-evidence 的“部署回归后的实施修复”。

### Implementation acceptance criteria

- [x] **I-AC01:** 性能目标与边界可复现
  - POSIX 修复后的最终一次预热加五次测量全部通过，中位数 sanity 3,360 ms、
    commit 9,800 ms；比对应基线下降 83.71%/92.51%，达到预先 50% 目标。
  - 本次依 I-S07 保留上述固定候选历史样本、不新做性能比较；
    新候选的 guard 边界由本地 93/93 和六个平台 CI sanity 成功重新证明。
- [x] **I-AC02:** 覆盖与平台守恒
  - 最终完整 248 项包含新增 11 项，仅原 Windows 2 项 skip；迁移 body、
    测试归属和 unit/runtime 平台矩阵保持，托管矩阵也已通过，详见同世界证据。
  - 修复候选 260 项，两个 branch 测试 body/语料保持，仅新增 1 个
    CI contract；其余数量增长来自并发主线，2 项原有 skip 不变。
- [x] **I-AC03:** 场景与失败行为确定
  - runner 精确集合、空/未知参数、启动/退出失败、等待汇总定向测试通过。
- [x] **I-AC04:** 暂存与工作区不混淆
  - fixture 证明暂存 status 无效而 worktree 有效仍失败，候选不被改写；
    未承诺隔离的暂存代码测试，入口始终打印范围。
- [x] **I-AC05:** 风险升级与发布保障完整
  - 风险单元/真实 Git 与 CI/release workflow 契约全部通过；未执行 npm 发布。
- [x] **I-AC06:** 指令一致且全量验收通过
  - 窄测试、三轮本地 full、最终性能样本、Markdown 链接/格式、package/E2E、
    技能本地/外部和精确快照检查全部通过；托管 CI 失败及修复实证保留于 I-S06。
- [x] **I-AC07:** 普通 Git 发布与决定隔离
  - 契约先于实现发布，普通非强制 push 到刷新后的 origin/main；未修改
    本 idea 的 Ideal/status、其他 idea 或 npm 版本，未记录新的人工决定。
- [x] **I-AC08:** 部署回归已修复且 CI 检查真实 sanity
  - 本地三种入口和精确 SHA 的实际六平台 sanity 均通过；实现修订先发布，
    没有写入新的接受决定，等待用户对新 implementationRevision 明确验收。

## Deployment

### Deployment steps

- [x] **D-S01:** 发布契约并固定主线候选
  - 修复后用户明确验收 `c5264f272e1ef724686d9a2b0b5364b6b4ca4201`；
    status-only commit `89cea38179fc42bbd05503b7b250b4abea3528b6` 已同步。
    先 fast-forward 保留主线 `cdaccfccb3f5a24a3d6deaaffd721e97c35205f3`
    的 MIT 许可证、包测试及另一 idea 历史，重新观察相同实施 revision 后记录决定。
    当前部署契约更新为新验收身份。
  - 修订部署契约先同步于 `8ff32647427edeccf6ee15125b45a92341c1aad4`，
    刷新 primary 确认可达，重新观察 deploying 与 deploymentRevision
    `6aba0d52227026d225d1481a5d6874578b8c5a5c`，再开始验证。
    下述本次 clone、普通 push、手动 full 全部使用同一候选 SHA。
    以下首次尝试的契约、失败和 CI 证据作为历史保留，不视为新候选证明。
  - 2026-09-30，刷新并 fast-forward 到 `27867cfe132017fe5b14e6846f649e37cd1b688f`，
    保留并发历史；实施验收仍为 `66f8f63c4574ac59655ab65836836a13b1f80963`。
  - 部署契约先同步于 `1505e2918321f4b46a0bdb18f0a62ff50efa436d`，
    刷新确认 primary 可达，再观察 deploymentRevision
    `59645981ed071aff98900b354c8caafae4803cbd`。仅首次尝试固定在此候选。
- [x] **D-S02:** 在全新 checkout 验证使用路径
  - **本次成功**：从远端新建会话所属 `deployment-repaired-clone`，
    detached checkout `8ff32647427edeccf6ee15125b45a92341c1aad4`。
    Windows / Node.js v24.11.1 / pnpm 11.22.0；sanity 初次执行自动按
    现有锁文件恢复 218 个依赖（lockfile up to date），未修改依赖声明或锁文件。
    未声称手动执行 frozen install，不计自动准备时间为性能收益。
  - 顺序执行一次 `pnpm check:sanity`、`pnpm check:commit`、
    `pnpm check:release`，均退出 0：
    sanity 93/93；commit 的 93 sanity、26 contract、10 smoke 全通过，
    七门禁全部成功；release 共 260 项（258 pass、2 原有 Windows skip），
    包括 103 unit/runtime、26 contract、130 integration、1 E2E。
  - release 的六门禁全部实际执行：Markdown、quick、integration、pack、
    E2E、skills；`PACK_OK silvermoon@0.2.2 files=52`、`PACK_SMOKE_OK`、
    `SKILLS_CHECK_OK files=2`、外部 discovery 发现 2 skills。
    包文件数从修复候选的 51 增至 52，来自保留的并发主线 MIT LICENSE，
    本次安装包 E2E 已同时覆盖此变化。
  - 日志包含 `COMMIT_SCOPE`：worktree 测试不证明暂存代码，
    staged 检查只验证 Silvermoon 元数据。clone 验证前后 `git status --short`
    均为空，结束时 worktree/index diff 均无差异；
    候选自身 `node bin/silvermoon.js check --commit HEAD --audience agent` 成功。
  - 原始日志位于会话 artifacts 的 `redeployment-sanity.log`、
    `redeployment-commit.log`、`redeployment-release.log`；
    未做新基线/重复性能采样。只删除明确归属本次操作的 clone，
    验证其路径已不存在，日志保留在 clone 外。
  - **首次尝试失败（历史）**：从远端新建会话所属 clone，detached checkout 精确候选，
    Windows / Node.js v24.11.1 / pnpm 11.22.0。运行前后 Git status 为空。
    pnpm 初次执行自动按现有锁文件恢复 218 个依赖，随后实际运行 sanity；
    没有修改 manifest/lockfile，也没有把自动安装时间作为性能样本。
  - `pnpm check:sanity` 退出 1：94 tests、93 pass、1 fail、0 skip；
    `check:syntax` 成功，`test:sanity` 失败。完整 stdout/stderr 保留在会话
    `deployment-sanity-initial.log`，UTF-8 转码副本为 `deployment-sanity.log`。
  - 失败测试：`test/unit/repository.test.js:55` 的
    `branch validation preserves Git check-ref-format semantics`；
    第 57 行调用真实 `spawnSync("git", ["check-ref-format", "--branch", value])`，
    被 guard 拒绝：`Error: SANITY_IO_FORBIDDEN: child_process.spawnSync`。
    文件由并发主线 commit `e3438d2946ae8af2aa07d13e0936512121d97e25`
    （Optimize Silvermoon CLI command performance）加入，不在本 idea 最初
    验收的实施测试集合中。
  - 按部署契约停止本地后续 commit/release 检查，不关闭 guard、不删断言、
    不扩大 skip、不在部署阶段移动测试。恢复条件：实现侧保留真实 Git 断言并
    修正其 runtime 归属，重新发布并确认适用候选后重跑 D-S02。
- [x] **D-S03:** 验证实际托管 CI 与使用说明
  - **本次成功**：普通 push
    [36673292405](https://github.com/shazhou-ww/silvermoon/actions/runs/36673292405)
    与手动 workflow_dispatch
    [36673319084](https://github.com/shazhou-ww/silvermoon/actions/runs/36673319084)
    均 completed/success，head SHA 均为
    `8ff32647427edeccf6ee15125b45a92341c1aad4`，不存在跨候选混用。
    本次只触发一次普通 CI 手动 full，未触发 publish-npm。
  - 普通 push：9 jobs success，仅 Package contents and installed CLI skipped；
    手动 full：10/10 jobs success，Verify package contents 和
    Test installed package 均实际 success。两条 run 的 Ubuntu/Windows/macOS
    × Node 22/24 全六组合均先 `Run sanity checks` success，
    再 `Run unit tests` success；contract、integration、risk 均 success。
  - 读取固定候选的 maintaining、repository-tasks、AGENTS、
    npm-package-releases、package scripts、runner、CI/publish workflow：
    check 与 check:release 共用 CHECK_SCRIPTS 六门禁，quick 未缩水；
    文档的暂存边界、sanity/runtime 归属、保守 package 风险及显式 full 一致。
    release 中的全部 contract 测试通过，包括 CI 与发布契约。
  - 发布 workflow 的主线 ancestry、不可变 tag 约束、npm environment、
    OIDC 权限、实际 tarball 验证和发布后校验均保留。
    本次无 npm 发布、tag 创建或 registry/provenance/CDN 验证成果声明。
  - **首次尝试（历史）**：普通 push run
    [36671536066](https://github.com/shazhou-ww/silvermoon/actions/runs/36671536066)
    和唯一一次手动 full run
    [36671553805](https://github.com/shazhou-ww/silvermoon/actions/runs/36671553805)
    均指向 `1505e2918321f4b46a0bdb18f0a62ff50efa436d`；未触发 publish-npm。
  - 最新外部结果：两条 run 均 completed/success；普通 push 的 package job
    按 metadata-only 规则 skipped，手动 full 的 package job 实际执行成功。
    CI 的完整 unit 路径不带 sanity guard，不能用其绿色结果替代 D-S02。
- [x] **D-S04:** 同步证据并请求精确部署验收
  - 首次尝试已同步失败和未执行事项；当前修复实施已重新验收，
    等待新候选部署实证。只改本 idea 的 Deployment/ledger，
    不改变内层世界或其他 idea；部署决定仍须用户明确验收。
  - 本次所有部署实证已齐，无剩余技术 blocker。证据仅更新本 ledger，
    不改变已发布的 deploymentRevision；按 worktree/staged、commit 门禁及
    普通非强制 Git 同步后，重新观察精确部署 revision 并请求人工验收。
    implementationAcceptedRevision 保持用户新决定，部署接受事实仍空缺。

### Deployment acceptance criteria

- [x] **D-AC01:** 发布候选与验收身份准确
  - 新契约先发布、新验收身份与精确候选/revision 见 D-S01；旧证据保留。
- [x] **D-AC02:** 全新环境的分层入口可用
  - D-S02 的三个入口成功、260 项覆盖及包/技能通过，前后快照干净。
- [x] **D-AC03:** 托管路由符合风险契约
  - D-S03 两条真实 CI 对同一 SHA 的 metadata-only/full 路由符合契约。
- [x] **D-AC04:** 指令与发布边界没有漂移
  - 固定候选文档/脚本/工作流核对及 contract 通过；无隐式 npm 发布。
- [x] **D-AC05:** 可审阅证据已同步且等待明确决定
  - 证据与候选按 D-S04 校验同步；没有写入 deploymentAcceptedRevision，
    下一步仅等待用户对精确部署 revision 的决定。
