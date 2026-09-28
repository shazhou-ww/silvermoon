# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 拆分 create-idea readiness
- [x] **I-S02:** 建立 create 专属报告与渲染
- [x] **I-S03:** 同步公开契约与回归验证

### Implementation acceptance criteria

- [x] **I-AC01:** create 仅检查必要的本地安全条件
- [x] **I-AC02:** 三类用户路径简洁且意图一致
- [x] **I-AC03:** 成功和失败结果均可可靠行动
- [x] **I-AC04:** 发布候选完整一致

实现证据：`create-idea` 使用 create 专属本地 preflight，要求 configured
primary branch/upstream 与 clean worktree，不调用 fetch/ls-remote，也不以
ahead、behind 或 diverged 阻塞 scaffold。项目未整备和本地仓库未整备报告
不携带 idea inventory；创建成功报告 canonical idea path，精简 outcome，
并以解析后的交互语言引导下一步。失败清理继续保护并发修改。

目标测试通过 43/43。`pnpm check` 通过：unit 47/47、contract 23/23、
integration 73 passed 且 2 条 Windows symlink 权限条件跳过、package
contents 检查通过、installed-package e2e 1/1、Markdown lint 与 canonical
skill 同步检查通过。另修复 README `--out` integration test 在并行测试时
短暂污染真实 worktree 的既有竞态，改为使用系统临时目录。

## Deployment

### Deployment steps

- [x] **D-S01:** 发布稳定的 create-idea 契约
- [ ] **D-S02:** 验证安装包的三类输出路径

### Deployment acceptance criteria

- [ ] **D-AC01:** primary 上的候选可验证
- [ ] **D-AC02:** 安装后的 create-idea 遵守收紧契约
- [ ] **D-AC03:** whats-next 行为没有回归

发布证据：configured primary `origin/main` 已发布 commit
`2f3d4cde6fa960d7f41a18f868e6552c27189d28`，对应稳定 deployment
revision `60657f64def499931c96079cf0bf23266c5c5c95`。`silvermoon check
--remote --json` 对该 commit 返回 `project-ready` 且 `problems` 为空；
指定本 idea 的 `whats-next --json` 返回 `deploying` 和上述 revision。
