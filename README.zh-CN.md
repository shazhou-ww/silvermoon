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

Silvermoon 需要 Node.js 22 或更高版本，并且能通过 Git 访问仓库的 primary branch。

在项目目录下，把这段提示词发给你的 coding agent：

```text
请在本项目中运行：
`silvermoon whats-next --audience agent`

遵循最高优先级指示并保留已有工作。
每次产生可观察变更后重新运行，直到报告显示：
`navigation-ready`
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
请继续推进这个项目中的 `<idea-alias>`。
遵循 `whats-next` 的指引持续工作。
直到需要我做决定时再停下来。
```

或者提出一个新想法：

```text
/silvermoon
我有个想法：
增加一个独立于语言选择的修仙风格文案开关。
```

也可以直接在终端运行 Silvermoon：

```sh
silvermoon whats-next
silvermoon whats-next <ULID-or-alias>
silvermoon create-idea
silvermoon list-ideas
```

> **备注**：每台设备或 Agent host 只安装并更新一个全局 Silvermoon runtime。
> 目标项目不固定 Silvermoon 版本，也不保存它的 skill。

工作流见 [Operating Silvermoon](./docs/operations.md)，
命令详情见 [Technical Reference](./docs/reference.md)。

## 为什么需要 Silvermoon

长期运行的 Agent 工作，往往让人背负太多看不见的状态：总得有人记住最初想做什么、
代码是否仍与任务一致，以及最新的事实究竟留在哪次对话、哪台机器上。
Silvermoon 把这些变成项目自身的一部分。

它让人不必时刻盯守，只在真正属于人的决策点回来：批准目标、验收实现，
以及确认结果在现世成立。在这些边界之间，Agent 可以查阅仓库事实，
推进优先级最高的安全行动。

它也不允许一张脱离代码的任务卡自行宣告成功。状态由当前产物与明确决定共同派生，
因此目标或实现一旦改变，依赖旧 revision 的结论自然失效。
这些事实存在 Git 里，工作便能跨设备、跨 session、跨 Agent、跨托管平台延续下去。

## 项目的器灵

<table>
  <tr>
    <td width="160" align="center" valign="top">
      <!-- markdownlint-disable-next-line MD013 -->
      <img src="./assets/silvermoon-mascot.png" width="160" alt="项目器灵银月的全身立绘">
    </td>
    <td valign="top">
      Silvermoon 得名于《凡人修仙传》中的银月。
      她是灵界银月狼族玲珑公主分裂出的两道元神之一；流落人界后成为狼首玉如意的器灵，
      又在漫长的岁月里失去部分记忆，从此自称银月，后来才成为韩立青竹蜂云剑的器灵。
      <br><br>
      这个意象与本项目相合：Silvermoon 不属于某位操作者，也不属于某次对话。
      它与项目产物共存，理解它们的状态，并帮每位同行者看清下一步。
      人物小传只是灵感来源，不是使用这道工具的门槛。
    </td>
  </tr>
</table>

观看《凡人修仙传》：

<!-- markdownlint-disable-next-line MD013 -->
- YouTube：[第 150 话：外海风云 26](https://www.youtube.com/watch?v=GJgezoCBIHM "《凡人修仙传》第 150 话：外海风云 26")
<!-- markdownlint-disable-next-line MD013 -->
- 哔哩哔哩：[第 150 话：外海风云 26](https://www.bilibili.com/bangumi/play/ep1231558 "《凡人修仙传》第 150 话：外海风云 26")

## 从理想到现实

项目不只是一张任务列表，也不是一份对话记录。
它是理想穿过三个嵌套世界、逐渐落进现实的过程。

**Ideal World（道心）**——理想世界，**Inner World（内景）**——主体世界，
**Outer World（现世）**——现实世界。

> 道心立志，内景化形，现世求真。

三个世界由内向外层层包含：主体世界包含它所服务的理想世界，又是现实世界的一部分。
正如人会有理想，却又必须活在现实之中。

先在理想世界里把理想讨论清楚，再在主体世界中让它成形，
最后部署到现实世界去——这正是意识反作用于物质的过程。

人负责 approval 与 acceptance，Agent 负责 continuation：
读取 contract、ledger 与 Git 事实，保留并发工作，执行一个安全行动，
并且只在发生变化之后重新观察。上下文属于项目，而不属于某次转瞬即逝的对话。

## 延伸阅读

- [Getting Started](./docs/getting-started.md) — 安装、配置与第一个 idea。
- [Core Concepts](./docs/core-concepts.md) — 项目归属、三重世界、revision 与决策边界。
- [Operating Silvermoon](./docs/operations.md) — 导航、创建、发布、仓库卫生与持续推进。
- [Technical Reference](./docs/reference.md) — 存储、派生状态、CLI report、验证 target 与 schema。
- [Maintaining Silvermoon](./docs/maintaining.md) — 开发检查、文档职责与发布指南。

## 社区

- [贡献指南](./CONTRIBUTING.md)
- [行为准则](./CODE_OF_CONDUCT.md)
- [安全策略](./SECURITY.md)
- [支持说明](./SUPPORT.md)
- [变更记录](./CHANGELOG.md)
- [MIT License](./LICENSE)

## 图片版权声明

本项目使用的银月（Silvermoon）形象，均为基于《凡人修仙传》动画二次生成的 AI 图片。
原角色与动画的相关权利归各自版权方所有，这些图片不在本项目 [MIT License](./LICENSE) 的授权范围内。
若版权方认为其中任何图片构成侵权，请联系作者，作者会替换相关图片。
