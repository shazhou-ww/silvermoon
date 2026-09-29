# 增加独立且可查询的 idea 列表命令

## 意图

提供 `silvermoon list-ideas`，让明确想查看 idea inventory 的用户直接查询
当前本地项目，而不必借用负责判断下一步的 `whats-next`，也不因 worktree、
branch、upstream、网络或 primary 同步状态而被阻塞。

## 背景

裸 `whats-next` 会在导航报告中列出最小化的 active idea references，但它的
首要职责是指南针：先检查项目与 repository readiness，fetch primary，再根据
同步事实引导下一项安全行动。这个行为适合继续工作，却不适合纯粹查看 inventory：

- dirty worktree、任意非 primary branch、缺失或错误 upstream、离线以及本地与
  primary 不一致都会在看到完整查询结果前阻塞；
- 默认 observation 只携带 active idea 的 ID、可选 alias 和 lifecycle state，
  不能按状态、标题或创建时间筛选，也不能有意查看 completed/abandoned idea；
- `check` 虽然报告各状态数量，但它验证 snapshot，不提供可查询的逐项结果；
- 如果持续把 inventory 功能堆进 `whats-next`，会让事实查询、repository
  synchronization 和 lifecycle routing 的意图边界重新混在一起。

用户有时已经明确知道自己只想回答“现在有哪些 idea”，此时不应被迫接受下一步
建议或先整理与查询无关的本地 Git 状态。

## 期望结果

### 独立的纯查询命令

`silvermoon list-ideas` 是只读 inventory query，不选择 idea、不推导 lifecycle
下一步，也不创建、批准、验收或修改任何项目事实。默认读取调用位置所属
repository 的当前 worktree snapshot；从嵌套目录调用时仍解析到 repository root。

命令仍要求可信的 Silvermoon 项目基础：Git repository、兼容的项目配置、
canonical skill 和完整有效的 idea layout。它不执行或要求 repository hygiene
与同步：conflict、staged/unstaged/untracked change、detached HEAD、任意 branch、
无 upstream、ahead/behind/diverged 和离线均不阻止查询；命令不得 fetch、比较
primary ancestry 或访问网络。

除调用者显式请求的 trace 文件外，命令不写文件、不改 index、worktree、refs、
配置或 lifecycle status。查询结果来自同一个 worktree snapshot，包含本次尚未
提交但可形成有效 snapshot 的 idea 变化。

### 默认集合与状态过滤

无过滤参数时，命令默认返回全部 active ideas，即状态为 `preparing`、
`implementing` 或 `deploying` 的项目；零项也是成功结果。

可重复的 `--state <state>` 接受五个 canonical lifecycle states
`preparing`、`implementing`、`deploying`、`completed`、`abandoned`，以及展开为
前三者的便利值 `active`。多个值取并集并去重。`--all` 是选择全部五种状态的
明确快捷方式，并与 `--state` 互斥，避免产生两套含糊的优先级。

### 可组合的实用查询条件

状态集合确定后，可继续组合以下过滤和结果控制：

- `--query <text>` 对 idea 的 canonical ULID、alias 和 `Idea.md` 第一个一级标题
  执行不区分大小写的 literal substring match；不启用正则、glob、模糊匹配或
  world 正文全文检索。缺失 alias 或可提取标题时，该字段不参与匹配，不伪造值。
- `--created-since <RFC3339>` 使用包含下界，
  `--created-before <RFC3339>` 使用不包含上界；创建时间直接从 canonical ULID
  的 timestamp 部分派生并以 UTC ISO 8601 呈现，不依赖文件时间或 Git commit
  时间。
- `--sort newest|oldest` 按创建时间排序，默认 `newest`。相同毫秒的结果继续按
  完整 ULID 排序，使文本与 JSON 在相同 snapshot 和参数下稳定。
- `--limit <positive-integer>` 在全部过滤和排序完成后限制返回项数。报告同时
  给出过滤后总匹配数、实际返回数和是否截断，不能让受限列表看起来像完整结果。

不同类别的过滤条件取交集；重复 state 内部取并集。空 query、无时区或无效的
RFC 3339 时间、反向或空时间区间、未知 state/sort 值以及非正整数 limit 都是
usage error，在读取 repository 或创建 trace 前退出 `2`。

### 查询专用输出

默认文本只呈现有效筛选摘要、匹配/返回/截断数量和逐项结果，不生成
`whats-next` 风格的“下一步建议”、候选选择或 lifecycle instructions。每项始终
显示 ID、state 和 UTC `createdAt`，并只在值存在时显示 alias 与标题；空结果被
明确显示，而不是伪装成 setup failure。

`--json` 返回且只返回：

```json
{
  "intention": {
    "command": "list-ideas",
    "args": {
      "states": ["preparing", "implementing", "deploying"],
      "query": null,
      "createdSince": null,
      "createdBefore": null,
      "sort": "newest",
      "limit": null
    }
  },
  "observation": {
    "state": "ideas-listed",
    "root": "<repository-root>",
    "version": { "type": "worktree" },
    "configuration": {},
    "problems": [],
    "summary": {
      "matched": 0,
      "returned": 0,
      "truncated": false,
      "counts": {}
    },
    "ideas": []
  }
}
```

`intention.args` 始终呈现规范化后的有效业务参数，而不是 Commander 的别名或
重复输入。`summary.counts` 对 limit 之前的匹配集合按五种 canonical state
给出数量；`ideas` 是 limit 之后的有序结果。报告没有 `outcomes` 或
`instructions`，JSON key、state 和枚举不本地化；文本标签与诊断使用现有
preferred language 解析。

项目基础或 idea layout 不可信时，命令返回明确的 unavailable/setup
observation、完整已知 problems 和退出码 `1`，不返回可能遗漏无效条目的部分
inventory。成功形成可信查询时退出 `0`，即使结果为空；CLI usage error 退出
`2`。

## 范围

### 范围内

- 新增 `list-ideas` CLI command、直接 command API 和查询专用 renderer。
- 默认 active state 集合，以及可重复 `--state`、`--all`、`--query`、
  `--created-since`、`--created-before`、`--sort`、`--limit`。
- 从 ULID 派生稳定创建时间，从 `Idea.md` 第一个一级标题提取可选标题。
- 在同一个本地 worktree snapshot 上完成项目检查、idea 读取、过滤、排序和
  limit，同时完全绕过 Git hygiene、upstream 与 remote synchronization。
- 为成功、空结果、setup/layout failure 和 usage failure 定义文本、JSON
  shape 与退出码。
- 更新 CLI help、README、operations/reference/getting-started、canonical
  Silvermoon skill 与生成副本，并覆盖 unit、contract、integration 和
  installed-package E2E。

### 范围外

- 改变裸或带 selector 的 `whats-next` 候选、同步、选择或 lifecycle 指令。
- 让 `list-ideas` 自动选择、继续、创建、批准、验收、放弃、删除或修改 idea。
- 默认或通过选项 fetch primary、查询远端、选择 HEAD/commit/index snapshot，
  或比较本地与 primary ancestry。
- 正则、glob、模糊搜索、world 正文全文检索、按 Git author/commit time 查询，
  或可扩展查询 DSL。
- cursor/offset pagination、交互式选择器、watch mode 或跨 repository 聚合。
- 新增持久化 created-at 字段，或把文件系统 mtime、ctime 当作项目事实。
- 在本 idea 中为 `list-ideas` 新增临时 `--language` override；文本沿用届时
  已存在的 preferred/output language 基础。

## 约束

- 默认 active 集合必须集中复用 lifecycle state 定义，不能与
  `whats-next` 的 active 语义分别维护后逐渐漂移。
- 完整 layout validation 必须先于过滤；筛选条件不能隐藏 malformed idea，
  也不能通过静默跳过错误条目制造成功形状。
- 标题提取必须基于 Markdown 结构并保持可选；不得用文件名、alias 或模板文本
  冒充缺失标题，也不得为查询而改变既有 idea schema。
- ULID timestamp 解码和 RFC 3339 边界必须独立校验、可测试且不受本地时区影响。
  所有时间比较使用同一 UTC instant，范围采用 `[createdSince, createdBefore)`。
- 参数必须先完成规范化与互斥/范围校验，再触碰 repository 或 trace；CLI parser
  与直接 API 均不能绕过同一业务校验。
- `--limit` 只影响返回数组，不影响 `matched`、`counts` 或排序；默认不设隐式
  上限。
- dirty worktree 和与 Silvermoon 输入无关的 conflict 不得阻塞查询；若 conflict
  内容使配置、skill 或 idea layout 本身无效，则按实际 validation problem
  显式失败。命令不得通过回退到 HEAD 隐藏本地事实。
- 除显式 trace 外，成功和失败路径都不得 fetch、联网或改变 worktree、index、
  refs、status/config 内容。错误不得被空列表、默认值或成功退出码吞掉。
- 新命令的纯查询 report 与 `whats-next` dialogue envelope 有意不同；公共文档、
  CLI contract tests 和 package E2E 必须明确这种差异。
