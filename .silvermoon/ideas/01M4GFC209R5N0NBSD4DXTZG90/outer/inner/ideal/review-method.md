# Template review method

每次只处理 `review-status.md` 中的一个 template ID，并同时检查对应的 en-US 与
zh-CN 文件。

## Agent 准备

在请求人工 comment 前，Agent 必须先给出：

1. template ID 和两种 locale 的文件路径；
2. 该 template 在什么 observation、repository 或 lifecycle 场景下被选择；
3. routing 和参数来源，包括哪些值是机器字段、路径、revision 或完整命令；
4. 最终输出形状，例如 string、`summary + nextSteps` 或其他结构化对象；
5. 每一种实际分支的 sample output。

如果模板没有分支，给出一组有代表性的 en-US 和 zh-CN sample。若模板有多个
case，按 case 分组，分别列出触发条件、输入参数和两种 locale 的完整 sample
output。sample 应展示最终渲染结果，不以源码片段代替。

## 人工 comment

维护者针对当前 template 的场景、措辞、参数边界、输出形状或 sample 提出
comment。没有明确 comment 时，Agent 不主动扩展修改范围，也不推断该 template
已经通过 review。

## Agent 修改

Agent 只实现当前 template 的明确 comment，并同步：

- en-US 与 zh-CN 模板；
- 直接相关的 contract、routing、renderer 或 export；
- 精确输出断言和必要的 report 测试。

修改后，Agent 运行最小相关验证，重新给出受影响 case 的最终 sample output，
供维护者继续 comment。

## 完成条件

只有维护者明确表示当前 template review 完成，Agent 才能把
`review-status.md` 中对应状态从 `pending` 改为 `reviewed`。实现完成、测试通过、
无进一步 comment 或进入下一个文件都不构成隐含完成。
