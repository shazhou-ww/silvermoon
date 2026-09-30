# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 固化基线与改善目标
  - 在 `1435c77570080f0d497d22e0934eee90a2ad6e95` 完成两个入口各一次预热、
    五次样本，均退出 0。日常/全量中位数为 20,631/130,765 ms；
    实施前目标固定为 10,315.5/65,382.5 ms。完整数据见同世界证据。
  - 测量后 primary 移至 `9fbce63cf348d079d4728afcaefba929da040b39`，
    已 fast-forward 并重新观察 implementing；保留并发历史，未修改其他 idea。
- [ ] **I-S02:** 按真实成本拆分并守恒测试
  - 35 个原测试 body 保持，17 个 runtime 测试仍进入 unit 原平台矩阵；
    dialogue 的真实 Git 测试进入 integration。最终完整计数 237 -> 248。
- [x] **I-S03:** 实现场景调度与快照边界
  - sanity/commit/release 复用 runner；check/quick 兼容语义保留；技能拆分。
    真实部分暂存 fixture 验证警告、候选差异、失败传播及 index/worktree 不变。
- [ ] **I-S04:** 保守升级 CI 与对齐发布
  - 仅 idea metadata-only 跳过 package/E2E；未知或无 baseline 均升级。
    core 矩阵不筛选，发布静态检查补齐，权限及实际产物路径未变。
- [ ] **I-S05:** 对齐贡献者与 Agent 指令
  - AGENTS、maintaining、repository-tasks、npm-package-releases 对齐，
    明确部分暂存边界、外部工具和无隐式 npm 发布。
- [ ] **I-S06:** 验证并发布实现证据
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
- [ ] **I-S07:** 修复部署发现的测试归属与 CI 入口缺口
  - 用户明确同意修订实现并修复，旧验收事实保持；修订契约后重新观察
    implementing，再修复真实 Git 测试归属及矩阵 sanity 步骤。
    I-S02/I-S04/I-S05/I-S06、I-AC01/I-AC02/I-AC05/I-AC06/I-AC07
    因新候选需重新证明而重置；下列历史结果不删除，也不冒充新候选证据。

### Implementation acceptance criteria

- [ ] **I-AC01:** 性能目标与边界可复现
  - POSIX 修复后的最终一次预热加五次测量全部通过，中位数 sanity 3,360 ms、
    commit 9,800 ms；比对应基线下降 83.71%/92.51%，达到预先 50% 目标。
- [ ] **I-AC02:** 覆盖与平台守恒
  - 最终完整 248 项包含新增 11 项，仅原 Windows 2 项 skip；迁移 body、
    测试归属和 unit/runtime 平台矩阵保持，托管矩阵也已通过，详见同世界证据。
- [x] **I-AC03:** 场景与失败行为确定
  - runner 精确集合、空/未知参数、启动/退出失败、等待汇总定向测试通过。
- [x] **I-AC04:** 暂存与工作区不混淆
  - fixture 证明暂存 status 无效而 worktree 有效仍失败，候选不被改写；
    未承诺隔离的暂存代码测试，入口始终打印范围。
- [ ] **I-AC05:** 风险升级与发布保障完整
  - 风险单元/真实 Git 与 CI/release workflow 契约全部通过；未执行 npm 发布。
- [ ] **I-AC06:** 指令一致且全量验收通过
  - 窄测试、三轮本地 full、最终性能样本、Markdown 链接/格式、package/E2E、
    技能本地/外部和精确快照检查全部通过；托管 CI 失败及修复实证保留于 I-S06。
- [ ] **I-AC07:** 普通 Git 发布与决定隔离
  - 契约先于实现发布，普通非强制 push 到刷新后的 origin/main；未修改
    本 idea 的 Ideal/status、其他 idea 或 npm 版本，未记录新的人工决定。
- [ ] **I-AC08:** 部署回归已修复且 CI 检查真实 sanity

## Deployment

### Deployment steps

- [x] **D-S01:** 发布契约并固定主线候选
  - 2026-09-30，刷新并 fast-forward 到 `27867cfe132017fe5b14e6846f649e37cd1b688f`，
    保留并发历史；实施验收仍为 `66f8f63c4574ac59655ab65836836a13b1f80963`。
  - 部署契约先同步于 `1505e2918321f4b46a0bdb18f0a62ff50efa436d`，
    刷新确认 primary 可达，再观察 deploymentRevision
    `59645981ed071aff98900b354c8caafae4803cbd`。以下验证固定在此候选。
- [ ] **D-S02:** 在全新 checkout 验证使用路径
  - **阻塞**：从远端新建会话所属 clone，detached checkout 精确候选，
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
- [ ] **D-S03:** 验证实际托管 CI 与使用说明
  - 普通 push run
    [36671536066](https://github.com/shazhou-ww/silvermoon/actions/runs/36671536066)
    和唯一一次手动 full run
    [36671553805](https://github.com/shazhou-ww/silvermoon/actions/runs/36671553805)
    均指向 `1505e2918321f4b46a0bdb18f0a62ff50efa436d`；未触发 publish-npm。
  - 最新外部结果：两条 run 均 completed/success；普通 push 的 package job
    按 metadata-only 规则 skipped，手动 full 的 package job 实际执行成功。
    CI 的完整 unit 路径不带 sanity guard，不能用其绿色结果替代 D-S02。
- [ ] **D-S04:** 同步证据并请求精确部署验收
  - 先同步本次失败和未执行事项；部署未完成，不请求部署验收。
    只改本 idea 的 Deployment/ledger，不改变内层世界、status 或其他 idea。

### Deployment acceptance criteria

- [x] **D-AC01:** 发布候选与验收身份准确
  - 契约先发布、精确候选和 deploymentRevision 已记录于 D-S01。
- [ ] **D-AC02:** 全新环境的分层入口可用
- [ ] **D-AC03:** 托管路由符合风险契约
- [ ] **D-AC04:** 指令与发布边界没有漂移
- [ ] **D-AC05:** 可审阅证据已同步且等待明确决定
