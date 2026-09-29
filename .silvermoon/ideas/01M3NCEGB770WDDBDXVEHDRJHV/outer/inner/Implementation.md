# Implementation

## Steps

### I-S01: 识别根级 npm 项目

扩展 adoption inspection，只从目标 snapshot 的 repository-root
`package.json` 建立 npm 项目事实。区分不存在、有效 manifest、读取失败、
非普通文件与 JSON 无效，并为 Silvermoon 当前 source checkout 建立可靠自举
例外；不扫描嵌套 workspace package 或本机 `node_modules`。

### I-S02: 强制运行时对齐的 devDependency

从当前 Silvermoon package version 生成规范的 `^<version>`，检查根 manifest
中 `devDependencies.silvermoon` 的 section 和逐字值。将缺失、错放、重复或
不匹配诊断为 blocking project findings，并与 Git、配置和 skill findings
按稳定优先级合并；非 npm 项目和 source checkout 不产生该要求。

### I-S03: 生成包管理器感知的修复指令

实现只用于 remediation 的 package manager 解析：合法顶层 `packageManager`
优先，其次为唯一根级 lockfile，再在没有矛盾证据时回退 npm。为 npm、pnpm、
Yarn、Bun 及 workspace root 生成将 `silvermoon@^<version>` 写入顶层
devDependencies 的命令；冲突或未知情况提供人工指令而不猜测。

### I-S04: 对齐 skill 注册与 snapshot 行为

当 npm manifest 未就绪时，先指导依赖修复，再从
`./node_modules/silvermoon/skills` 注册 canonical skill；已就绪 npm 项目也
使用该可复现来源，并在本机依赖尚未 materialize 时把 package manager install
列为注册前置动作而非 readiness finding。非 npm 项目保留当前 packaged-skill
指令。确保 `check` 的所有 target 在没有 `node_modules` 时仍只依据目标
snapshot 的 manifest 和 tracked skill 得出结果。

### I-S05: 更新公共契约与回归覆盖

更新 dialogue、本地化、canonical skill、adoption 与 getting-started 文档，
说明条件式 npm 要求、自举例外、命令优先级和只读边界。增加 unit、integration、
contract 与 installed-package E2E fixtures，覆盖 npm/pnpm/Yarn/Bun、workspace、
manifest 错误、dependency section、版本漂移、非 npm 项目和 source checkout，
并运行完整 release-grade 验证。

## Acceptance criteria

### I-AC01: npm 项目分类只取决于根 manifest

同一目标 snapshot 中，根级 `package.json` 存在时进入 npm 专属诊断，不存在时
保持生态中立；嵌套 manifest、lockfile 或 `node_modules` 单独存在都不改变
分类。通过 unit 与 integration fixture 覆盖普通仓库、monorepo、非 npm 仓库、
非普通 manifest 和读取失败。

### I-AC02: devDependency 契约阻止未整备 npm 项目

除可靠识别的 Silvermoon source checkout 外，npm 项目只有在
`devDependencies.silvermoon` 逐字等于当前运行时的 `^<version>` 时才通过该
整备项。缺失、位于其他 dependency section、重复或值不匹配时，
`whats-next` 和 `create-idea` 返回 `project-setup-required` 并停止后续层；
通过表驱动 unit tests 和 CLI integration tests 证明。

### I-AC03: remediation 与项目包管理器和 workspace 一致

合法 `packageManager`、唯一 lockfile 与无提示回退分别生成正确的 npm、pnpm、
Yarn 或 Bun devDependency 命令，目标始终为
`silvermoon@^<运行时版本>` 和 repository root；workspace root 使用必要参数。
冲突 lockfile、未知 manager 或无法安全判断时不输出猜测命令。通过命令
executable/args 的结构化断言和 Windows/Unix 渲染测试证明。

### I-AC04: npm skill 来源可复现且诊断保持只读

npm 项目的有序指令先修复 devDependency，再从
`./node_modules/silvermoon/skills` 注册 canonical skill；非 npm 项目继续引用
当前运行实例随附 skill。执行 `whats-next`、`create-idea` 的阻塞路径和所有
`check` target 不修改 manifest、lockfile、skill、Git 状态或 refs；通过前后
文件/Git 快照与 installed-package E2E 证明。

### I-AC05: snapshot 与跨生态行为不回归

HEAD、staged、worktree、commit 和 remote 检查读取各自目标 snapshot 的根
manifest，即使没有 `node_modules` 也能通过已满足的项目；非 npm Git 仓库仍
无需 package manager、Silvermoon dependency 或 `node_modules`。通过 snapshot
integration matrix、非 Node installed-package fixture 和 source dogfooding
测试证明。

### I-AC06: 完整候选通过发布级验证

实现候选通过 `pnpm check`、`pnpm check:skills`、package contents、
installed-package E2E、Markdown links、`git diff --check`、
`silvermoon check --worktree` 与 `silvermoon check --staged`，且公开文档与
skill 不再声称所有目标项目都无条件免除 Silvermoon dependency。
