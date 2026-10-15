# Reference 命令结构设计

## 目标

让单页 Reference lookup 不再要求调用方知道页面属于 Device、Project
还是 Idea，也不强制调用方提供页面类型。运行时从完整 Objective
prerequisite 链构建候选集合：显式 namespace 用于精确读取单页；没有
namespace 时执行 Reference 搜索，唯一命中自动打开，多命中返回列表。

新入口复用现有 `reference search` 的索引与匹配语义，但把搜索扩展到
完整 Objective 链并移除调用方提供 Objective 的要求。

## Before

当前语法把读取动作、页面 owner 和页面 ID 拆成三个位置参数：

```text
silvermoon reference page <objective> <reference-id> [options]
```

例如：

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

这要求报告和 Agent 预先知道 owner 与页面类型。Objective 在 Idea、
Project、Device 之间递进时，命令也随 owner 改变。

## After

推荐语法只接收一个 lookup，namespace 使用冒号明确表达且可以省略：

```text
silvermoon reference [<namespace>:]<reference> [options]
```

其中：

```text
<namespace> ::= level | check | problem | page | system
<reference> ::= <stable-id-or-free-query>
```

显式 namespace 的报告命令为：

```text
silvermoon reference level:repository-unready --language zh-CN
silvermoon reference check:repository-upstream-matches --language zh-CN
silvermoon reference problem:repository --language zh-CN
```

搜索可以省略 namespace：

```text
silvermoon reference repository-upstream-matches --language zh-CN
silvermoon reference repository --language zh-CN
```

变化总结：

| Before | After |
| --- | --- |
| `reference page project problems/repository` | `reference problem:repository` |
| `page` 是独立子命令 | 单页读取由 `reference` 隐含 |
| 调用方指定 `device/project/idea` | 运行时递归收集并解析 owner |
| 页面类型是必填路径段 | namespace 是可选冒号前缀 |
| 未知完整 ID 返回该 owner 的 404 | 无 namespace 时跨 Objective 与类型搜索 |

## 候选集合

运行时加载最外层 bundled Idea Objective，并沿 prerequisite 递归到
Project、Device，以 `idea -> project -> device` 的稳定顺序收集全部
Reference 页面。调用方不传 target；实际 owner 只作为解析结果返回。

页面的规范身份仍由 owner 与完整稳定 ID 共同构成，例如：

```text
project + problems/repository
```

CLI lookup 是面向人的短寻址，不替代规范身份。

## 解析规则

### 显式 namespace

以 `silvermoon reference problem:repository` 为例：

1. 将 `problem` 映射到现有稳定 ID 前缀 `problems/`。
2. 在完整候选集合中匹配 `problems/repository`。
3. 唯一命中时返回页面及实际 owner。
4. 多个 Objective 含有同一完整稳定 ID 时返回歧义结果及候选 owner，
   不按遍历顺序静默选择。
5. 没有命中时返回一次 lookup 失败，并列出同 namespace 的近似候选。

namespace 使用面向命令的单数名称，稳定 ID 继续使用现有复数目录，
避免改变 packaged Objective Guide 资源。

### 省略 namespace

以 `silvermoon reference repository` 为例，运行时在 Idea、Project、
Device 的 Reference 索引中执行现有标题、描述与正文搜索。唯一命中时
直接打开该页面；多个命中时返回搜索结果列表。

每个结果包含 namespace、稳定 ID、owner、标题和可复制的显式读取命令：

```text
problem:repository
  owner: project
  silvermoon reference problem:repository --language zh-CN
```

结果以 Objective 链顺序和各 Guide 的稳定搜索顺序合并；规范身份
`owner + referenceId` 相同的结果去重。零结果是成功的空搜索结果，不
转换为 `system/404`。多个结果时，调用方从列表中选择显式 namespace
命令读取单页。

## 参数与结果结构

CLI 接收一个位置参数 `lookup`：

```json
{
  "lookup": "problem:repository",
  "language": "zh-CN",
  "audience": "agent"
}
```

业务层将它规范化为：

```json
{
  "namespace": "problem",
  "query": "repository",
  "language": "zh-CN"
}
```

省略 namespace 时规范化为搜索请求：

```json
{
  "operation": "search",
  "namespace": null,
  "query": "repository",
  "language": "zh-CN"
}
```

显式 namespace 的单页结果保留实际 owner 与规范身份：

```json
{
  "lookup": "problem:repository",
  "namespace": "problem",
  "query": "repository",
  "owner": "project",
  "referenceId": "problems/repository",
  "language": "zh-CN",
  "page": {
    "id": "problems/repository"
  }
}
```

无 namespace 的多命中结构化结果是搜索结果集：

```json
{
  "lookup": "repository",
  "operation": "search",
  "query": "repository",
  "results": [
    {
      "namespace": "problem",
      "owner": "project",
      "referenceId": "problems/repository",
      "title": "Repository 尚未满足安全工作条件",
      "command": "silvermoon reference problem:repository --language zh-CN"
    }
  ]
}
```

无 namespace 的唯一命中返回与显式 namespace 相同的单页结果，并额外
保留原始 `lookup` 与 `operation: "search"`，使程序能够识别其解析来源。
零命中返回 `results: []`。

`whats-next` 已知页面的规范身份，因此始终生成显式 namespace 命令，
不依赖无 namespace 搜索：

```json
{
  "kind": "problem",
  "id": "problems/repository",
  "owner": "project",
  "lookup": "problem:repository",
  "command": "silvermoon reference problem:repository --language zh-CN"
}
```

`kind` 与 `id` 继续保留，供程序消费和渲染；`lookup` 是规范化的 CLI
寻址值；`command` 仍是可复制执行的完整命令。多命中搜索结果使用同一
套 namespace 命令下钻。非 References 的报告字段和语义不变。

## 输入校验

- `lookup` 必须非空；至多包含一个 namespace 分隔冒号。
- 显式 namespace 只接受 `level`、`check`、`problem`、`page`、
  `system`，不接受 Objective 名称。
- 冒号前缀存在时，namespace 和 query 都不得为空。
- Reference 稳定 ID 不翻译；namespace 只负责映射既有类型前缀。
- 不接受 `.`、`..`、反斜杠或控制字符；无 namespace 的自由文本允许
  普通空格。
- `--language`、`--audience` 和 `--json` 保持现有互斥与默认规则。

## 默认 References

非 terminal 的 `whats-next` 只生成当前失败位置有直接诊断价值的
References：

- failing check 页面；
- 每个 Problem 页面；
- 仅当 level 页面提供上述页面没有覆盖的推进语义时，才包含 level 页面。

Device level 页面不再仅因当前 owner 是 Device 而默认出现。terminal
报告仍可保留 terminal 页面，因为此时没有 check/problem 可供下钻。
报告生成器已知页面类型，所以输出显式 namespace；无 namespace 搜索
服务于调用方不知道页面类型或稳定 ID 的发现过程。

## 兼容与迁移

实现阶段先让旧语法
`silvermoon reference page <objective> <reference-id>` 与新 lookup 语法
解析到同一个业务函数，保证已有脚本可继续工作；所有新生成的报告、
页面内链和文档只输出新语法。旧语法的移除需要独立的弃用决定，不在
本 Idea 的验收范围内。

旧 `reference search <objective> <query>` 先作为兼容入口保留，并与
新的无 namespace `reference <query>` 复用搜索业务函数。旧入口只搜索
指定 Objective；新入口递归搜索完整 Objective 链。旧搜索语法的移除
需要独立的弃用决定，不在本 Idea 的验收范围内。
