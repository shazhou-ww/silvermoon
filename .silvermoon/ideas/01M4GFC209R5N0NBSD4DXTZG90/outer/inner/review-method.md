# Template review method

review 以 Docker 场景集生成的完整输出语料为对象，而不是从模板源码推测最终文本。
场景集包含少量可连续推进的链路。每条链路只做一次基础初始化，在状态 checkpoint
之间复用设备与项目；只有互斥、不可逆或会污染后续 checkpoint 的状态才另开支链。

## Agent 采集

在请求人工 comment 前，Agent 必须从全新环境执行场景集，并为每个输出保留：

1. 链路 ID、checkpoint ID、前置 checkpoint 和本次状态变更；
2. checkout revision、全局 Silvermoon 版本和项目 revision；
3. 实际执行的完整命令与 locale；
4. routing 覆盖标识及最终完整输出。

覆盖检查必须从 Device、Project、Idea manifest 读取有序 check，并把每个 check
恰好映射到一个 checkpoint。模板 ID 只用于解释输出实现；无 check 的 navigation
和 terminal 输出另列补充场景。任何未覆盖项都不能用源码片段或手写 sample 补齐。

## 人工 comment

维护者集中查看完整语料，针对场景、措辞、参数边界、输出形状或 locale 一致性提出
comment。没有明确 comment 时，Agent 不主动扩展修改范围，也不推断对应输出已经
通过 review。

## Agent 修改

Agent 只实现明确 comment，并同步：

- en-US 与 zh-CN 模板；
- 直接相关的 contract、routing、renderer 或 export；
- 精确输出断言和必要的 report 测试。

修改后，Agent 运行最小相关验证并在相同场景中重新采集受影响输出，供维护者继续
comment。

## 完成条件

只有维护者明确表示对应 check case 的语料 review 完成，Agent 才能把
`review-status.md` 中对应状态从 `pending` 改为 `reviewed`。实现完成、测试通过或
无进一步 comment 都不构成隐含完成。
