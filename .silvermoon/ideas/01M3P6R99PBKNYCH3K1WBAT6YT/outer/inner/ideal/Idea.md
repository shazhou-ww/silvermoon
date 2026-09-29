# Simplify README setup around Agent navigation readiness

## Intent

让 README 的安装与整备指引简洁地委托给项目 Agent：按照
`npx silvermoon whats-next` 的提示完成整备，直到项目状态明确显示为
`navigation-ready`。

## Context

当前中英文 README 快速开始部分包含较多针对 npm 与非 npm 仓库的依赖、
skill 注册和 snapshot 检查说明。这些具体步骤会随项目状态和 package
manager 而异，Silvermoon 的 `whats-next` 已能根据实际观察提供下一步指引。

`navigation-ready` 已存在于 `whats-next` 的结构化 observation 中，但默认
标准输出没有明确显示该状态。Agent 或用户因此无法仅根据终端提示确认何时
完成整备。

## Desired outcome

- 中英文 README 的安装与整备说明聚焦于让项目 Agent 运行
  `npx silvermoon whats-next`，遵循每次报告的提示并在需要时重复运行，
  直至状态明确为 `navigation-ready`。
- 默认人类可读的 `whats-next` 标准输出明确展示当前状态；项目就绪时显示
  可直接识别的 `navigation-ready`，与结构化 observation 一致。
- 上述标准输出问题有一个关联本 idea 的 GitHub issue，用于共同跟踪和讨论。

## Scope

### In scope

- 简化 `README.md` 和 `README.zh-CN.md` 中的安装、首次整备指引，同时保留
  使用者开始整备所需的必要前提。
- 明确规定普通 `whats-next` 文本输出展示其当前 observation 状态，至少覆盖
  `navigation-ready`，且不与 JSON 输出中的状态不一致。
- 在实施该输出改动时创建并关联一个 GitHub issue，记录终端状态提示缺失的问题。

### Out of scope

- 改变 Silvermoon 的项目就绪、repository 同步或 idea 导航判定逻辑。
- 改变 `whats-next` 的 JSON 数据结构或其他命令的输出契约。
- 为 README 快速开始增加自动安装、依赖修改或 skill 注册副作用。

## Constraints

- 使用已有的 `whats-next` 状态和报告，不另造与结构化 observation 不同的 ready
  判定。
- README 必须让 Agent 遵循当前报告的提示；报告被阻塞或尚未就绪时，不得声称
  已达到 `navigation-ready`。
- GitHub issue 应在进入实施阶段时创建，并引用本 idea，避免 preparing 阶段执行
  尚未获批准的实施工作。
