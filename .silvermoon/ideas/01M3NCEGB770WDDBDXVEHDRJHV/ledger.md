# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 识别根级 npm 项目
- [x] **I-S02:** 强制运行时对齐的 devDependency
- [x] **I-S03:** 生成包管理器感知的修复指令
  - Evidence: The revised Yarn workspace remediation writes `^0.2.1` with `npm pkg set`, then updates the lockfile and installs with `yarn install`.
- [x] **I-S04:** 对齐 skill 注册与 snapshot 行为
- [x] **I-S05:** 更新公共契约与回归覆盖

### Implementation acceptance criteria

- [x] **I-AC01:** npm 项目分类只取决于根 manifest
- [x] **I-AC02:** devDependency 契约阻止未整备 npm 项目
- [x] **I-AC03:** remediation 与项目包管理器和 workspace 一致
  - Evidence: Unit coverage checks all manager command sequences; a real Yarn 1.22.22 workspace produced `devDependencies.silvermoon: "^0.2.1"`, a caret-keyed `yarn.lock`, registered the local skill, and passed installed CLI readiness.
- [x] **I-AC04:** npm skill 来源可复现且诊断保持只读
- [x] **I-AC05:** snapshot 与跨生态行为不回归
- [x] **I-AC06:** 完整候选通过发布级验证
  - Evidence: `pnpm check`, packaged-skill synchronization, package contents, installed-package E2E, Markdown lint, `check --worktree`, `check --staged`, and `git diff --check` passed; two Windows symlink tests were skipped because the environment lacks symlink privileges.

## Deployment

### Deployment steps

- [x] **D-S01:** 发布明确授权的 Silvermoon 版本
  - Evidence: `npm/silvermoon/v0.2.1` points to the published primary release commit; GitHub Actions run `36537400522` succeeded and npm `latest` resolves to `0.2.1`.
- [ ] **D-S02:** 在干净消费者仓库验证 npm 整备
  - Evidence: npm and pnpm workspaces passed. Published `0.2.1` with Yarn 1.22.22 saved exact `0.2.1` instead of `^0.2.1`; the corrected local candidate passed a real Yarn workspace. Bun 1.3.10 passed a non-workspace install/CLI with a fresh cache; its default workspace linker still fails with `ENOENT` on a transitive package, while explicit `--linker=hoisted` passes. The published default workspace command remains unverified.
- [x] **D-S03:** 验证非 npm 与自举场景
  - Evidence: Published `silvermoon@0.2.1` reached `project-ready` in a no-manifest/no-lockfile/no-node_modules Git fixture; a clean source clone at the release commit passed frozen install, `whats-next`, temporary `create-idea`, and `check --worktree`.

### Deployment acceptance criteria

- [ ] **D-AC01:** 已发布 npm 项目获得阻塞且可执行的版本对齐指令
- [ ] **D-AC02:** 安装来源、skill 与运行版本保持一致
- [x] **D-AC03:** 非 npm 项目不承担 npm 整备成本
  - Evidence: Published `silvermoon@0.2.1` returned `project-ready` for an isolated non-npm Git fixture with canonical config and skill, and no root `package.json`, `node_modules`, or lockfile.
- [x] **D-AC04:** Silvermoon source checkout 保持可开发
  - Evidence: Release source checkout has no `devDependencies.silvermoon`; from a clean clone, `pnpm install --frozen-lockfile`, `whats-next`, `create-idea`, and `check --worktree` succeeded.
