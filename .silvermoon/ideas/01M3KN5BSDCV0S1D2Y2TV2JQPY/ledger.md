# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 拆分就绪后的对话 observation
- [x] **I-S02:** 按结果视图渲染简洁文本
- [x] **I-S03:** 同步公开契约与验证

### Implementation acceptance criteria

- [x] **I-AC01:** 四种意图各有可靠 observation
- [x] **I-AC02:** 简洁文本不损失关键事实
- [x] **I-AC03:** 发布候选完整可验证

本次实现验证：`pnpm check` 通过（unit、contract、integration 71/71，
另有 2 个 Windows symlink 权限条件跳过、installed-package e2e 1/1；
package contents、skill 同步与 Markdown lint 通过）。
`test/contract/dialogue-output.test.mjs`、`test/integration/whatsnext.test.js`、
`test/integration/create-idea.test.js`、`test/unit/cli-v1.test.js` 和
`test/e2e/installed-package.test.js` 覆盖各结果形状、终态、空候选、
未找到、创建成功/失败、fetch JSON 与文本分离。
`git diff --check`、`silvermoon check --worktree --json` 和
`silvermoon check --staged --json` 均通过，检查结果为 `project-ready`
且 `problems: []`。发布时再次核对 primary tip；验收仍需用户针对
发布后的精确 implementation revision 明确确认。

## Deployment

### Deployment steps

- [ ] **D-S01:** 发布稳定的验真契约
- [ ] **D-S02:** 验证 primary 与安装包消费者

### Deployment acceptance criteria

- [ ] **D-AC01:** primary 可验证
- [ ] **D-AC02:** 已安装消费者遵守输出契约
