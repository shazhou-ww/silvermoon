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

Silvermoon 需要 Node.js 22 或更高版本，并且能够通过 Git 访问仓库的 primary branch。

复制下面的提示词，并在项目中发送给 coding agent：

```text
请运行 `npx silvermoon whats-next`，遵循报告的最高优先级指示，保留已有工作，并在每次产生可观察变更后重新运行，直到默认输出明确显示 `navigation-ready`。
```

只有默认输出明确显示 `当前状态：navigation-ready` 时才算整备完成；受阻报告或
任何其他状态都不表示已就绪。项目特定的整备方式应以当前报告为准，而不是依赖
README 中固定的命令清单。

navigation 就绪后，继续让 Agent 推进：

```sh
npx silvermoon create-idea
npx silvermoon whats-next <idea>
```

在生成的 `Idea.md` 中描述想要抵达的世界，审阅并批准这个精确 revision。此后，
Silvermoon 会让目标、实现、仓库状态与现实结果始终相连。完整工作流见英文
[Getting Started](./docs/getting-started.md)；命令、验证、JSON、语言、guidance、
audience 与 trace 细节见 [Technical Reference](./docs/reference.md)。
每个命令都处理一条有序且带版本的 domain-message stream。默认 `human` audience
会在 stdin 与 stdout 都连接 TTY 时使用 Silvermoon 内置的 `tui-md` 视图渲染
response；使用 `q`、`Esc` 或 `Ctrl+C` 退出。human 输出被重定向或进入管道时仍是
原始 Markdown。Agent 与自动化调用方可用 `--audience agent` 在任何终端状态下
获取稳定的原始 response Markdown，或使用 `--json` 获取四个确定性 projection：
`intention`、`observation`、`actions` 与 `response`。显式 `--audience` 与
`--json` 互斥。`actions` 只记录已经尝试的副作用，未来工作只位于
`response.nextSteps`。提交前使用 `silvermoon check --staged` 验证 index；无参数
`check` 只验证已提交的 `HEAD`，不能替代提交前检查。只有项目快照有效时检查才以
退出码 `0` 放行，详见英文 [Technical Reference](./docs/reference.md)。

Windows TTY 的 TUI 帧经 Node 终端流输出 UTF-8，不要求手动切换终端代码页；
这不影响管道中的原始 Markdown 或 JSON。

任何命令都可以添加 `--trace <file.trace.jsonl>`，写出一条 schema-versioned
JSONL timeline。`domain` channel 保存经过 allowlist 的 message 摘要，
`telemetry` channel 保存成对 performance span；两者共享同一个 trace ID 和全局
sequence。Trace 不记录 guidance/文件正文、Git 参数或输出、环境数据或
credential。参数若没有以精确的小写 `.trace.jsonl` 结尾，Silvermoon 会自动追加；
repository 内的 `*.trace.jsonl` 会被忽略。trace 文件采用缓冲写入，只在命令工作
完成后创建，并且绝不覆盖已有文件。

项目可按需添加 `.silvermoon/guidance/preparing.md`、`implementing.md` 与
`deploying.md`。Silvermoon 只会在 `response.guidance` 中返回当前可行动阶段里
与 snapshot 绑定的 repository-owned Markdown；`observation.guidance` 仅保留
provenance。`create-idea` 可返回 preparing guidance。这些 guidance 只能追加
约束，不是第四份 contract 或 decision fact；`check` 会验证完整的固定目录。详见英文
[Core Concepts](./docs/core-concepts.md)。

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
