# Implementation

## Steps

### I-S01: 建立严格 TypeScript 工程边界

增加覆盖 `src/`、`bin/` 与 `test/` 的共享严格编译配置，并按运行时代码、仓库工具和
测试划分可组合的项目配置。启用 `strict`、`noUncheckedIndexedAccess`、
`exactOptionalPropertyTypes`、`useUnknownInCatchVariables`、
`noImplicitOverride` 与 `noFallthroughCasesInSwitch`，统一 Node.js ESM 模块解析，
并提供独立的类型检查和可复现构建命令。生成目录不得成为源码事实来源或提交到仓库。

### I-S02: 迁移领域、基础设施与业务模块

按 foundation、business、公开入口的依赖方向将 `src/` 下实现迁移为 `.ts`。为配置、
Idea 状态、事件记录、报告投影、Git 与文件系统结果建立共享类型；所有 JSON、YAML、
进程输出和第三方数据先作为未信任输入验证后再收窄。使用判别联合和穷尽检查表达状态
转换，消除无约束 `any`、宽泛断言、`@ts-ignore` 及独立手写声明文件。

### I-S03: 迁移 CLI 与仓库维护工具

将 CLI 入口及 `bin/` 下构建、检查、发布准备和 skill 同步工具迁移为 TypeScript。
构建流程生成可由 Node.js `>=22` 直接执行的 ESM JavaScript，并保留 CLI shebang、
参数、退出码、错误输出和本地 `node bin/silvermoon.js` 开发入口。仓库校验命令必须
先构建或使用明确的 TypeScript 执行器，不能依赖陈旧产物。

### I-S04: 迁移测试与测试辅助代码

将 `test/` 下单元、运行时、契约、集成、端到端测试及 helpers 全部迁移为
TypeScript。测试应直接覆盖当前 TypeScript 源码或由同一候选生成的构建产物，并继续
验证真实文件系统、Git、安装包和 CLI 行为。为公开 API 声明和关键未信任输入边界补充
编译期或运行时测试。

### I-S05: 对齐包导出、CI、发布与文档

更新 `package.json` 的 bin、exports、files 和 scripts，使开发、测试、打包及 npm
发布均消费同一构建结果；从 TypeScript 生成公开声明和 source map。同步 CI、发布
工作流、README、维护文档与 Silvermoon skill 中受影响的命令或路径，并保持现有包
子路径、Schema、事件格式和用户可见行为兼容。

### I-S06: 完成分层验证并清理迁移残留

依次执行类型检查、sanity、commit、单元、契约、运行时、集成、端到端、安装包和
release 级验证。确认受维护目录不存在 JavaScript/MJS 源文件、手写 `.d.ts`、
未解释的类型逃逸或提交的临时构建目录；将证明结果落实到测试、契约与 ledger 后同步
到 primary。

## Acceptance criteria

### I-AC01: 受维护代码全部由 TypeScript 表达

`src/`、`bin/` 和 `test/` 中不存在 `.js`、`.mjs`、`.cjs` 或 `.jsx` 源文件，也不再
保留独立手写 `.d.ts`；仓库测试通过文件清单断言证明该结果，并允许构建输出目录中存在
生成的 JavaScript 和声明文件。

### I-AC02: 严格类型检查无逃逸通过

完整 TypeScript 项目在约定的严格选项下零错误通过。自动化检查拒绝新增显式 `any`、
`@ts-ignore`、`@ts-nocheck` 或未说明的 `@ts-expect-error`；外部输入边界有运行时
验证，关键状态联合具备穷尽检查。

### I-AC03: CLI 与运行时行为保持兼容

现有 sanity、unit、runtime、contract 和 smoke 测试全部通过，且测试证明 CLI 的帮助、
命令、退出码、输出 audience、追踪、Idea 生命周期和事件协议未因迁移改变。

### I-AC04: 公开包声明由实现生成且可消费

npm 打包检查证明根导出、`silvermoon/agents/copilot`、
`silvermoon/agents/project-runtime` 与 CLI 均可从安装包运行；TypeScript 消费者可在
严格模式下导入公开 API，声明文件来自本次构建且不存在旧的手写声明副本。

### I-AC05: 仓库与发布流程使用可复现构建

CI、`pnpm check:sanity`、`pnpm check:commit` 和 `pnpm check` 均包含适当的构建或
类型门禁并通过；从干净候选生成的 npm tarball 只包含预期运行产物、声明、source map
和现有文档资源，不依赖工作树中的历史编译文件。

### I-AC06: 完整行为验证通过

`pnpm test`、`pnpm test:integration`、`pnpm test:e2e`、`pnpm pack:check` 与
Silvermoon worktree/staged 校验在同一候选上通过，`git diff --check` 无错误，工作树
不包含临时文件或未跟踪构建产物。
