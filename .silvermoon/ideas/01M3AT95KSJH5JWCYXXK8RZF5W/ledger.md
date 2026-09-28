# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 建立统一对话报告模型
- [x] **I-S02:** 重构生态无关的项目整备诊断
- [x] **I-S03:** 规范仓库整备推演
- [x] **I-S04:** 规范任务导航与 lifecycle instructions
- [x] **I-S05:** 区分 create-idea 对话与 check 验证
- [x] **I-S06:** 迁移 skill 与文档契约
- [x] **I-S07:** 更新测试并完成 release-grade 验证

### Implementation acceptance criteria

- [x] **I-AC01:** 对话命令共享模型，检查器独立
- [x] **I-AC02:** 项目整备不依赖目标项目技术栈
- [x] **I-AC03:** 仓库整备安全、确定且有界
- [x] **I-AC04:** 任务导航不替用户选择
- [x] **I-AC05:** 副作用和退出码忠实表达各命令结果
- [x] **I-AC06:** 对话与检查的 Observation 各有字段保证
- [x] **I-AC07:** 文档、skill、package 与实现一致
- [x] **I-AC08:** 检查器只放行经过验证的目标快照
- [x] **I-AC09:** 默认文本保持分层轻量 Markdown 对话

历史验证记录（修订前，不能证明本次未勾选条目）：`pnpm check` 通过；
其中 unit 39/39、contract 22/22、
integration 60/60（另有 2 项 Windows symlink 权限条件跳过）、installed-package
e2e 1/1，且 package contents 与 skill 同步检查均通过。

本次验证记录：`pnpm check` 通过（unit 41/41、contract 23/23、
integration 63/63，另有 2 项 Windows symlink 权限条件跳过，installed-package
e2e 1/1；package contents、skill 同步及 Markdown lint 通过）。新增的
`test/contract/dialogue-output.test.mjs` 检查共享字段与独立检查结果；
installed-package e2e 覆盖两种文本格式；远端配置定位 integration 和 Markdown
单元测试覆盖失败/省略分支。
`check --worktree --json` 返回 `project-ready`；`git diff --check` 通过。

双语标题打磨复验：`pnpm check` 通过（unit 41/41、contract 23/23、
integration 63/63，另有 2 项 Windows symlink 权限条件跳过、installed-package
e2e 1/1；package contents、skill 同步及 Markdown lint 通过）。
`test/unit/cli-v1.test.js` 断言英中标题、非空问题小节和空操作段；
`test/e2e/installed-package.test.js` 断言安装后文本标题；
`check --worktree --json` 返回 `project-ready`。

后续文案复验：精简单个请求的意图说明；项目或仓库整备只有一条建议时
不添加序号，多条仍按优先级编号；对话标题更新为「本次指示 / 项目现状 /
下一步建议」及对应英文。`test/unit/cli-v1.test.js` 校验双语标题与请求文案，
`test/integration/whatsnext.test.js` 校验单条与多条整备建议；
`test/e2e/installed-package.test.js` 校验安装包标题。
`pnpm check` 通过（unit、contract、integration、installed-package e2e、
package contents、skill 同步及 Markdown lint）。

工具无关检查复验：仓库整备分别要求检查所有冲突路径及内容、全部 staged /
unstaged / untracked 路径及修改，不再指定逐条 Git 查看命令；大型集合仍保留
counts、样例和 omitted 数。`test/integration/whatsnext.test.js` 验证单条、
多条、冲突及有界样例的指引；`pnpm check` 通过（unit、contract、
integration、installed-package e2e、package contents、skill 同步及
Markdown lint），`check --worktree --json` 返回 `project-ready`。

## Deployment

### Deployment steps

- [x] **D-S01:** 发布部署契约
- [x] **D-S02:** 验证精确 primary commit 的托管 CI
- [x] **D-S03:** 复核发布后的 Silvermoon 导航

### Deployment acceptance criteria

- [x] **D-AC01:** 已验收实现与部署契约存在于 configured primary
- [x] **D-AC02:** 精确部署候选的 GitHub Actions CI 成功
- [x] **D-AC03:** 发布后导航与部署 revision 一致

部署验证记录：configured primary tip 为
`396013cd7f75e626f530c613d6e1d66bda7f4cf8`，且 implementation commit
`940b31dfae211a003aa13e6a36355abf03b52464` 与 acceptance commit
`db5cfe026cf8e3d3a8b294c125bad0a773635464` 均为其祖先。GitHub Actions
[CI run 36386282856](https://github.com/shazhou-ww/silvermoon/actions/runs/36386282856)
在该 tip 上以 `completed/success` 结束，8 个 jobs 全部成功。发布后
`whats-next` 返回 `task-pending`、空 problems、成功的 `fetch-primary` outcome，
并要求验收 deployment revision
`b4841f50189b761ee2afddae1d21c680b353e29e`。

双语标题部署复验：configured primary tip 为
`f57048a7ca65d8fd23636d1dd1bfab67f5fb29ec`，包含实现 commit
`da1acf681a0115450829d0c16cef7b0ecea6eb7e` 及验收 commit
`f57048a7ca65d8fd23636d1dd1bfab67f5fb29ec`。
GitHub Actions [CI run 36393042364](https://github.com/shazhou-ww/silvermoon/actions/runs/36393042364)
在该精确 tip 上以 `completed/success` 结束，8 个 jobs 全部成功。
发布后 `whats-next` 返回 `task-pending`、空 problems、成功的
`fetch-primary` outcome，并要求验收 deployment revision
`0017fb2214f96f5a73523780c56d34cc101efba6`。

工具无关检查部署复验：configured primary tip 为
`0a4b480b7da2fa6dd2137d5c952ff9470ce8b1d0`，包含实现 commit
`79b97a1fd6a9cc0e70731791d0d1bccae698f0ff` 和 implementation
acceptance commit `0a4b480b7da2fa6dd2137d5c952ff9470ce8b1d0`。
GitHub Actions [CI run 36401383016](https://github.com/shazhou-ww/silvermoon/actions/runs/36401383016)
在该精确 tip 上以 `completed/success` 结束，8 个 jobs 全部成功。
clean checkout 的 `whats-next` 返回 `task-pending`、空 problems、成功的
`fetch-primary` outcome，并要求验收 deployment revision
`79b67ed13e5fc0fbfd03896a9bb2f8ed3ad2a96a`。
