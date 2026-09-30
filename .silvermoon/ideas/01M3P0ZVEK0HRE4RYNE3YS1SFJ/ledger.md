# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** Model audience and output routing
- [x] **I-S02:** Provide the bundled human TUI renderer
- [x] **I-S03:** Cover and document every output mode
- [x] **I-S04:** 修复 Windows TTY 的 Unicode 输出
- [x] **I-S05:** 支持 TUI 选区复制
- [x] **I-S06:** 指引 Agent 显式选择原始 Markdown
- [x] **I-S07:** 统一文本报告的列表、问题和时间
- [x] **I-S08:** 让宽终端中的表格使用可用宽度

### Implementation acceptance criteria

- [x] **I-AC01:** Audience options have one consistent CLI contract
- [x] **I-AC02:** Rendering follows the complete audience and TTY matrix
- [x] **I-AC03:** The renderer ships with Silvermoon and fails explicitly
- [x] **I-AC04:** Documentation and repository validation pass
- [x] **I-AC05:** Windows human TTY 正确显示 Unicode
- [x] **I-AC06:** 鼠标选区可显式复制
- [x] **I-AC07:** Skill 默认指引 Agent 避开交互式 UI
- [x] **I-AC08:** 文本报告呈现一致且保留机器事实
- [x] **I-AC09:** 宽终端表格不受固定列数截断

## Deployment

### Deployment steps

- [x] **D-S01:** 发布并锁定验收候选
- [x] **D-S02:** 检查非交互输出和机器报告
- [ ] **D-S03:** 在真实 Windows 终端核对交互体验

### Deployment acceptance criteria

- [x] **D-AC01:** 受检候选来自已发布 primary
- [x] **D-AC02:** 管道、Agent 和 JSON 输出保持可靠
- [ ] **D-AC03:** 真实 human TTY 体验由使用者确认

### Deployment evidence

- `deploymentRevision=e8ff557c5be3c5008b1d62ed94c874fc4e0cfe24` 的契约
  已发布至 `origin/main`，候选 commit
  `f0d56424092908c3c091ccc0e935686320fc5ad4`。
  `node bin\silvermoon.js check --remote --audience agent` 对该 commit 返回
  有效，远端 tip 相同且可从 primary 到达；未进行 npm 发版。
- 对相同实现候选独立重跑 `pnpm check`：Markdown、quick
  单元／契约、integration、installed-package e2e、pack 和 skills
  均通过。第一次并行探测期间 Windows Git 返回 `C000012D`
  且 TUI 定时测试受资源竞争影响；单独重试失败项通过，
  随后不并行进行额外探测时完整 `pnpm check` 通过。
- 仓库候选的 `list-ideas --audience agent`、非 TTY human `list-ideas`
  和 `whats-next --audience agent` 均返回无 ANSI 的原始 Markdown，
  列表含 `Alias / ID`、标题及相对时间；`list-ideas --json`
  返回四投影及原始 UTC `createdAt`。`--json --audience agent`
  退出码为 2；无效 commit 的 `check --audience agent`
  退出码为 1，problems 使用 Markdown 表格。
- D-S03 / D-AC03 仍等待使用者在真实 Windows PowerShell 终端
  完成宽窄屏、复制和提示栏验证；模拟的 native TUI 测试不替代此项。
