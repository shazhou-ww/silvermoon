<!-- markdownlint-disable-file MD041 -->

<p align="center">
  <!-- markdownlint-disable-next-line MD013 -->
  <img src="./assets/silvermoon.svg" width="960" alt="Silvermoon，项目的器灵">
</p>

<p align="center">
  <a href="./README.md">English</a> | 简体中文
</p>

# Silvermoon（银月）

> 道友也不想自己的本命项目没有器灵吧？

## 快速开始

### Setup

Silvermoon 需要 Node.js 22 或更高版本，并且能够通过 Git 访问仓库的 primary branch。
将下面的提示词发送给项目中的 coding agent：

```text
请在本项目中运行 `npx silvermoon whats-next --audience agent`，遵循最高优先级指示并保留已有工作；每次产生可观察变更后重新运行，直到报告显示 `navigation-ready`。
```

### Talk to Silvermoon

在 coding agent 中使用 Silvermoon skill：

```text
/silvermoon
这个项目接下来应该做什么？
```

或者直接继续推进一个 idea：

```text
/silvermoon
请继续推进这个项目中的 `<idea-alias>`，遵循 `whats-next` 的指引持续工作，直到需要我做决定时再停下来。
```

或者提出一个新想法：

```text
/silvermoon
我有个想法：增加一个独立于语言选择的修仙风格文案开关。
```

也可以在终端直接运行 Silvermoon：

```sh
npx silvermoon whats-next
npx silvermoon whats-next <ULID-or-alias>
npx silvermoon create-idea
npx silvermoon list-ideas
```

> **备注：**建议使用 `npx silvermoon`，而不是全局安装。这样无需单独维护全局版本；
> 在 Node.js 项目中，lock file 会固定项目使用的版本。

工作流见 [Operating Silvermoon](./docs/operations.md)，命令详情见
[Technical Reference](./docs/reference.md)。

## 为什么需要 Silvermoon

长期运行的 Agent 工作往往让人背负太多不可见状态：有人必须记住原本想做什么、代码是否
仍与任务一致，以及最新事实究竟留在哪次对话或哪台机器上。Silvermoon 把这些问题变成
项目自身的一部分。

它让人不必持续看守，只在真正属于人的决策点回来：批准目标、验收实现，以及确认结果在
现世成立。在这些边界之间，Agent 可以检查仓库事实，并继续最高优先级的安全行动。

它也不允许一张脱离代码的任务卡自行宣告成功。当前产物与明确决定共同派生状态，因此目标
或实现一旦改变，依赖旧 revision 的结论自然失效。事实保存在 Git 中，工作便能跨设备、
跨 session、跨 Agent、跨托管平台延续。

## 项目的器灵

<table>
  <tr>
    <td width="160" align="center" valign="top">
      <!-- markdownlint-disable-next-line MD013 -->
      <img src="./assets/silvermoon-mascot.png" width="160" alt="项目器灵银月的全身立绘">
    </td>
    <td valign="top">
      Silvermoon 得名于《凡人修仙传》中的银月。她来自灵界的银月狼族，是玲珑公主分裂出的
      两道元神之一。她在人界失去部分记忆后成为器灵，先后寄居于狼首玉如意和韩立的
      青竹蜂云剑。
      <br><br>
      这个意象与项目相合：Silvermoon 不属于某位操作者或某次对话。它与项目产物共存，
      理解它们的状态，并帮助每位同行者判断下一步。人物小传只是灵感来源，不是使用工具的
      知识门槛。
    </td>
  </tr>
</table>

观看《凡人修仙传》：

<!-- markdownlint-disable-next-line MD013 -->
- YouTube：[第 150 话：外海风云 26](https://www.youtube.com/watch?v=GJgezoCBIHM "《凡人修仙传》第 150 话：外海风云 26")
<!-- markdownlint-disable-next-line MD013 -->
- 哔哩哔哩：[第 150 话：外海风云 26](https://www.bilibili.com/bangumi/play/ep1231558 "《凡人修仙传》第 150 话：外海风云 26")

## 从理想到现实

项目不只是一张任务列表，也不是一份对话记录。它是理想经过三个嵌套世界逐渐进入现实的
过程。

**Ideal World（道心）**确定值得追求的结果，**Inner World（内景）**让意图在仓库产物中
成形，**Outer World（现世）**则验证这些产物在真正需要运行的地方是否成立。

> 道心立意，内景成形，现世验真。

三个世界由内向外层层包含：实现包含它所服务的理想，部署又包含二者。这不只是比喻，也是
工程关系。内层变化时，外层旧结论便失去原有依据，必须重新证明。

人负责 approval 与 acceptance，Agent 负责 continuation：读取 contract、ledger 与 Git
事实，保留并发工作，执行一个安全行动，并只在发生变化后重新观察。上下文属于项目，而不
属于转瞬即逝的某次对话。

## 延伸阅读

- [Getting Started](./docs/getting-started.md) — 安装、配置与第一个 idea。
- [Core Concepts](./docs/core-concepts.md) — 项目归属、三重世界、revision 与决策边界。
- [Operating Silvermoon](./docs/operations.md) — 导航、创建、发布、仓库卫生与持续推进。
- [Technical Reference](./docs/reference.md) — 存储、派生状态、CLI report、验证 target 与 schema。
- [Maintaining Silvermoon](./docs/maintaining.md) — 开发检查、文档职责与发布指南。
