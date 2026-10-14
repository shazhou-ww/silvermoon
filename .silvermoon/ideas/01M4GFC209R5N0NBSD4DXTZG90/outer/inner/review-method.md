# Template review method

review 以 Docker 场景集生成的完整输出语料为对象，而不是从模板源码推测最终文本。
状态图将所有 check 的唯一通过出口连成主链；每个 check 的失败按可能的不同 problems
分支到对应报告阶段。失败支路修复后回归主链，只有互斥或不可逆状态才从最近
checkpoint 派生独立场景。

## Agent 采集

在请求人工 comment 前，Agent 必须从 Docker 空设备执行全部状态转移，并为每个输出
保留：

1. check ID、通过/失败边、触发的 problems、报告阶段和状态变更；
2. 失败分支如何修复并回到主链，或为何需要独立场景；
3. checkout revision、全局 Silvermoon 版本、项目 revision、实际命令与 locale；
4. routing 覆盖标识及 whats-next 的完整输出。

覆盖检查必须从 Device、Project、Idea manifest 读取有序 check，并验证每个 check
恰有一个通过后继，失败边覆盖其所有可达 problem/阶段结果。失败结果可包含多个
problems；同一 check 也可能因状态不同返回不同 problem 集。必须采集每个不同的实际
语料，而不能只按模板 ID 或通用 Problem ID 计数。模板 ID 仅作输出追踪；无 check 的
navigation 和 terminal 输出另列补充场景。任何未覆盖项都不能用源码片段或手写 sample
补齐。

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
