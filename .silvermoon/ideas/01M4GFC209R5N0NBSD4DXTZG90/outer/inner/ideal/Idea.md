# 基于真实输出 review 全部 whats-next 场景

## 问题

仅对照 whats-next 模板源码逐项 review，难以看清设备、repository 和 lifecycle
状态组合后的完整输出，也容易遗漏 routing 分支或对实际文本作出错误推断。

## 结果

设计一条从空设备开始、按序推进 Device、Project、Idea checks 的主链：每个 check
通过时唯一前进到下一个 check；未通过时按可能的 problems 分叉，进入不同报告阶段
并生成语料。实现层再用状态转移脚本和 Docker 场景完整模拟这些边，供维护者集中
review 真实的全量输出。

## 边界

- 场景必须通过隔离环境中的真实 CLI 和项目状态产生，不直接调用模板或伪造输出。
- 每个 check 的通过只有一个前进出口；失败可能产生不同 problems，须覆盖其报告阶段。
- Ideal 只描述状态图设计；状态转移脚本、Docker 推进和语料收集属于 Implementation。
- 主链从空设备初始化一次；失败分支从最近 checkpoint 派生，并在可行时修复后回归主链。

## 验收标准

- 覆盖图逐一列出所有 checks 的唯一通过出口，以及失败时可能产生的 problems、报告
  阶段和回归/推进路径。
- 全新 Docker 环境可从设备整备开始完成全部链路，并产出可追溯的双语完整输出。
- 维护者完成整套语料 review 后无待处理项，相关修正通过 report 与 release 级验证。
