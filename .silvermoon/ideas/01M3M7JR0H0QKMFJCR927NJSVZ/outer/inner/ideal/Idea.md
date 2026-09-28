# 将仙侠别名限定在 README

## Intent

保留 Silvermoon 在项目介绍中的仙侠风格和品牌趣味，同时让正式文档、CLI
输出及其他操作界面不再使用需要仙侠文化背景才能理解的别名。Ideal World
（理想世界）、Inner World（主体世界）、Outer World（现实世界）以及三重
世界仍是 Silvermoon 的正式设计哲学。

## Context

Silvermoon 的名称和形象来自《凡人修仙传》，这种背景适合在
`README.md` 和 `README.zh-CN.md` 中介绍项目个性。目前，“道心”“内景”
“现世”等仙侠别名也被用作正式的生命周期术语，并出现在文档、skill、CLI
指导文本、源代码中的用户可见元数据及对应测试中。不熟悉作品或仙侠文化的
用户必须先理解这些别名，才能理解 idea 定义、实现和部署三个阶段，增加了
学习和翻译成本，也降低了错误信息与帮助文本的可搜索性。

仙侠表达应当是 Silvermoon 的展示层，而不是它的领域模型。正式界面应直接
使用理想世界、主体世界和现实世界，并通过理想契约、主体实现契约和现实部署
契约描述三份入口文档的工程职责；README 仍可使用仙侠叙事解释品牌来源，
并在需要时把它与正式概念对应起来。

## Desired outcome

除 `README.md` 和 `README.zh-CN.md` 外，仓库维护的当前规范、skill、CLI
人类可读输出及用户可见元数据不再使用“道心”“内景”“现世”等仙侠别名。
这些界面统一使用 Ideal World（理想世界）、Inner World（主体世界）和
Outer World（现实世界）描述三重世界，使用理想契约、主体实现契约和现实
部署契约指代三份入口文档。两份 README 可以继续保留角色背景、仙侠用语和
品牌化文案，但不能成为正式术语定义的唯一来源。

## Scope

### In scope

需要重命名或移除的仙侠术语如下：

| 当前仙侠术语 | 正式替代术语 | 适用说明 |
|---|---|---|
| “道心” | `Ideal World` / “理想世界” | 指 `outer/inner/ideal/` 所代表的最内层世界 |
| “内景” | `Inner World` / “主体世界” | 指 `outer/inner/` 所代表的实现所在世界 |
| “现世” | `Outer World` / “现实世界” | 指 `outer/` 所代表的部署与外部验证所在世界 |
| “道心立意，内景成形，现世验真” | 从正式界面移除 | 仅允许保留在两份 README 的品牌介绍中 |

三份规范入口文档使用以下正式名称：

| 文档 | 正式中文名称 | 职责 |
|---|---|---|
| `Idea.md` | 理想契约 | 定义值得追求的结果、边界和意图 |
| `Implementation.md` | 主体实现契约 | 定义实现步骤、仓库产物和验收条件 |
| `Deployment.md` | 现实部署契约 | 定义部署、外部验证步骤和验收条件 |

`Ideal World` / 理想世界、`Inner World` / 主体世界、`Outer World` /
现实世界，以及 `Three Worlds` / 三重世界、嵌套世界、world revision 等
表达属于 Silvermoon 的设计哲学和生命周期模型，不在重命名范围内。

重命名覆盖当前仍对用户或 Agent 构成规范的界面：

- `docs/` 下的正式概念、操作、参考、维护和仓库工作流文档；
- `skills/silvermoon/` 与 `.agents/skills/silvermoon/` 中的 skill 指令及参考资料；
- CLI 的帮助、导航、创建流程、状态指导、错误和其他人类可读输出；
- 面向用户或 Agent 的 schema description、布局元数据和生成模板；
- 对上述正式术语和输出建立断言的单元、contract、integration 与 e2e 测试。

两份 README 中可以继续使用包括“道心”“内景”“现世”“法宝器灵”和
“道友”在内的仙侠表达，也可以保留三重世界的品牌化叙事。README
首次把这些表达与产品行为关联时，应同时给出清晰的正式概念，使比喻始终是
可选背景而不是使用前提。

### Out of scope

- 不移除或弱化 Silvermoon 的名称、角色形象、出处说明、插图或 README
  中的仙侠风格。
- 不移除或改名 Ideal World（理想世界）、Inner World（主体世界）、
  Outer World（现实世界）和三重世界；它们是设计哲学而非仙侠术语。
- 不改写已完成或已放弃 idea 的历史契约、ledger 和状态记录；历史内容保持
  当时决策的可审计性。
- 不仅为术语变化而重命名稳定路径段 `ideal/`、`inner/`、`outer/`，也不
  重命名 `idealRevision`、`implementationRevision`、
  `deploymentRevision` 等机器可读字段。它们是兼容性接口且本身不要求
  仙侠背景。
- 不改变三层嵌套目录、revision 级联、approval、acceptance 或 lifecycle
  的行为语义。
- 不借术语清理重新设计 CLI 命令、idea schema 或状态机。

## Constraints

- README 之外的正式文本必须能由不了解《凡人修仙传》和仙侠文化的用户直接
  理解，并优先使用可搜索的通用软件工程词汇。
- 世界名称和入口文档名称在英文与中文正式界面中必须保持一一对应，不得引入
  多个竞争译名。
- 术语迁移不得改变现有文件布局、revision 计算、状态派生或公开机器接口。
- canonical skill 与 `.agents` 安装副本必须保持同步，相关术语测试应验证
  正式界面与 README 例外边界。
- README 中的品牌文案可以独立演进，但删除其中所有仙侠比喻后，正式文档和
  CLI 仍必须完整说明产品如何工作。
