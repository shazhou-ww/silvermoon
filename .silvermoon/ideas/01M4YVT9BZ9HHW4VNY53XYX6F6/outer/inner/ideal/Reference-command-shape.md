# Reference 命令结构设计

## 目标

让 `whats-next` 生成的 Reference 命令始终从用户请求的最外层
Objective 出发，由 Objective prerequisite 链递归定位实际拥有页面的
Objective。Agent 不再需要先判断当前 owner，也不再把 `page` 作为独立
子命令传入。

本设计只改变 `whats-next` 使用的单页 lookup。`reference search` 的搜索
语义与参数暂不改变。

## Before

当前语法把读取动作、页面 owner 和页面 ID 拆成三个位置参数：

```text
silvermoon reference page <objective> <reference-id> [options]
```

例如，一个以 Idea 为目标、但当前被 Project prerequisite 阻塞的报告会
生成：

```text
silvermoon reference page project levels/repository-unready --language zh-CN
silvermoon reference page project checks/repository-upstream-matches --language zh-CN
silvermoon reference page project problems/repository --language zh-CN
```

当前参数结构为：

| 参数 | 示例 | 含义 |
| --- | --- | --- |
| operation | `page` | 执行单页读取 |
| objective | `project` | 页面实际 owner |
| reference-id | `problems/repository` | 页面类型与稳定 ID |
| language | `zh-CN` | 输出语言 |

这要求报告和 Agent 都知道当前 owner。Objective 从 Idea 递进到 Project
或 Device 时，命令的 objective 参数也随 owner 改变，外层请求上下文
没有保留在 lookup 中。

## After

推荐语法把最外层 Objective 与完整 Reference ID 合成一个 lookup 路径：

```text
silvermoon reference <objective>/<reference-id> [options]
```

其中：

```text
<objective>    ::= device | project | idea
<reference-id> ::= <page-kind>/<stable-id>
<page-kind>    ::= levels | checks | problems | pages | system
```

前述 Idea 报告改为：

```text
silvermoon reference idea/levels/repository-unready --language zh-CN
silvermoon reference idea/checks/repository-upstream-matches --language zh-CN
silvermoon reference idea/problems/repository --language zh-CN
```

变化总结：

| Before | After |
| --- | --- |
| `reference page project problems/repository` | `reference idea/problems/repository` |
| `page` 是独立子命令 | 单页读取由 lookup 路径隐含 |
| objective 是实际页面 owner | objective 是用户请求的最外层 target |
| owner 由调用方提前选择 | owner 由 prerequisite 链递归解析 |
| 页面类型位于单独的 page ID 参数 | 页面类型是 lookup 路径的一部分 |

## 递归解析

以 `silvermoon reference idea/problems/repository` 为例：

1. 加载 `idea` Objective，并以 Reference reader 的占位 subject 创建实例。
2. 在 `idea` 实例读取 `problems/repository`。
3. 如果返回精确页面，立即结束；如果返回 `system/404`，把同一个
   Reference ID 委派给 `idea.prerequisite`。
4. 按 `idea -> project -> device` 顺序重复，直到找到精确页面或链结束。
5. 找到页面时返回实际 owner；链结束仍未找到时，返回一次包含完整查找
   链的 `system/404`，不静默选择其他页面。

查找采用“由外向内、首个精确匹配”规则。这样同一个稳定 ID 在外层
Objective 中可以有意覆盖 prerequisite 页面，同时每次 lookup 的解析
顺序确定。结构化结果必须暴露实际 owner，避免把相对 lookup 误认为
页面的全局身份。

## 参数与结果结构

CLI 只接收一个新的位置参数 `lookup`：

```json
{
  "lookup": "idea/problems/repository",
  "language": "zh-CN",
  "audience": "agent"
}
```

业务层在读取前将它规范化为：

```json
{
  "target": "idea",
  "referenceId": "problems/repository",
  "language": "zh-CN"
}
```

读取结果保留目标、实际 owner 和遍历路径：

```json
{
  "target": "idea",
  "owner": "project",
  "lookup": "idea/problems/repository",
  "referenceId": "problems/repository",
  "traversedObjectives": ["idea", "project"],
  "language": "zh-CN",
  "page": {
    "id": "problems/repository"
  }
}
```

`whats-next` 的结构化 Reference projection 相应区分：

```json
{
  "kind": "problem",
  "id": "problems/repository",
  "target": "idea",
  "owner": "project",
  "lookup": "idea/problems/repository",
  "command": "silvermoon reference idea/problems/repository --language zh-CN"
}
```

`kind` 与 `id` 继续保留，供程序消费和渲染；`lookup` 是规范化的 CLI
寻址值；`command` 仍是可复制执行的完整命令。非 References 的报告字段
和语义不变。

## 输入校验

- `lookup` 必须以已知最外层 Objective 开头，且必须包含非空
  Reference ID。
- Reference ID 保留现有稳定 ID，不翻译、不自动改写单复数。
- 不接受 `.`、`..`、空路径段或反斜杠；连续 `/` 不做静默归一化。
- 未知页面类型交给现有 Reference reader 处理并最终产生
  `system/404`，CLI 不维护第二份页面类型注册表。
- `--language`、`--audience` 和 `--json` 保持现有互斥与默认规则。

## 默认 References

非 terminal 的 `whats-next` 只生成当前失败位置有直接诊断价值的
References：

- failing check 页面；
- 每个 Problem 页面；
- 仅当 level 页面提供上述页面没有覆盖的推进语义时，才包含 level 页面。

Device level 页面不再仅因当前 owner 是 Device 而默认出现。terminal
报告仍可保留最外层 Objective 的 terminal 页面，因为此时没有
check/problem 可供下钻。

## 兼容与迁移

实现阶段先让旧语法
`silvermoon reference page <objective> <reference-id>` 与新 lookup 语法
解析到同一个业务函数，保证已有脚本可继续工作；所有新生成的报告、
页面内链和文档只输出新语法。旧语法的移除需要独立的弃用决定，不在
本 Idea 的验收范围内。

`reference search <objective> <query>` 保持不变。搜索是否改为路径语法
需要单独处理自由文本的 quoting、斜杠和编码规则，不与单页 lookup
绑定交付。
