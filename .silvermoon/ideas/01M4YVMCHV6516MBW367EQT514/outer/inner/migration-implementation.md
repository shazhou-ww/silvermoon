# Objective Guide 包迁移实施

## 兼容边界

准确锁定 `@potential-guide/objective-guide` `0.1.0`，仅使用 package root 的公开 API。
不引入 regulator 或 portfolio，也不依赖发布的 Silvermoon。
Node 最低版本随该包提高到 `22.13.0`。

通用 Manifest、domain schema、JSONata prerequisite projection、Reference 解析、
check protocol、调度与 probe workspace 生命周期完全交由发布包。
删除本地 guide、projection、resources、runner、validation 实现；
保留 `src/objective-guide` 的导出与类型兼容表面，不是第二套执行核心。

薄适配层保持 `position.owner/level/failingCheck/problems`、Guide/instance identity、
prerequisite ownership 和 creation error 内的 Guide identity。通过每个公开 probe
独立的异步上下文记录 runner 的首次失败，避免从 Problem ID 猜测 check 来源，
也避免同时 probe 同一 instance 时串线。Reference 的 `outcome/instruction`
经过运行时类型守卫后保留，不能从未公开的 package 子路径导入内部类型。

## 串行与聚合

显式调度策略恒为 `1`，同一 probe 同时最多一个 check 执行。
业务失败不会取消同层后续 checks：Problems 按声明顺序聚合，
`failingCheck` 仍指向该层第一个失败的 check，不运行更高层。
执行或协议错误仍拒绝 probe、停止排队 peers 并清理 workspace。

Project 与 primary guidance checks 不再假定同层 peers 已全部通过。
前置 Project/Repository observation 未就绪时，返回带状态、问题类型及
prerequisite 标识的明确失败事实，不调用需要 readiness 的 guidance 采样；
也不回退成功、不隐藏异常、不替换原先的阻塞报告。

## 依赖与验证

`jsonata` 仅由发布核心间接依赖；`ajv` 在 Silvermoon 中仅供 schema tests
直接使用，因此移入 devDependencies。`yaml` 仍服务现有运行时，保留直接依赖。
锁文件与完整打包白名单同步更新，不允许把已删除核心的编译产物留在制品中。

Projection 测试改为通过公开 prerequisite API 验证，而不是导入已删除的内部 compiler。
新增测试精确断言最大活跃 check 数为 `1`、同层失败顺序、后续 level 不执行、
同时 probe 同一 instance 的来源隔离，以及 runner 异常后的队列停止和 workspace 清理。
导航测试覆盖未就绪 peers 的显式失败，同时保持原有报告、Reference 和四投影合同。

## 验证证据

- `pnpm check:sanity`：通过，包含 typecheck、build、syntax、pure 与 197 项 sanity tests。
- `node --test test\unit\objective-guide.test.ts test\unit\silvermoon-objectives.test.ts test\unit\whats-next-model.test.ts test\integration\objective-guide.test.ts test\integration\silvermoon-objectives.test.ts test\contract\dependency-policy.test.ts`：最终 31/31 通过。
- `pnpm check`：最终完整执行通过，包含 typecheck、build、Markdown lint、
  pure、232 项 unit/runtime tests、60 项 contract tests、pack whitelist、
  安装后 CLI/API smoke、skill checks，以及 160 项通过、2 项按 Windows 条件
  跳过的 integration tests，无失败项。
- `pnpm check:commit`：通过；提交前再次检查当前 worktree，不以 staged metadata
  验证代替代码测试。

安装后 smoke 从 Silvermoon 自身制品消费 package root API，
证明已安装环境不依赖工作区私有源码且旧 observation 合同仍成立。
完整检查同时证明已删除核心的编译产物不在打包白名单内。
环境配置和临时日志只留在 session，不属于此 Idea 的合同或交付内容。
