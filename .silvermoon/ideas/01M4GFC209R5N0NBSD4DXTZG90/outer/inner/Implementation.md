# Implementation

## Steps

### I-S01: 建立 check 与 problem 状态图

将每个 check 的唯一通过出口串成主链，并为失败时可能产生的不同 problems 标注
报告阶段、状态变更、下游去向及回归路径，详见
[scenario-graph.md](./scenario-graph.md)。

### I-S02: 编写状态转移脚本与 Docker 场景

从 Docker 内空设备开始，脚本依序构造每个 check 的通过状态及失败 problems；Docker
按图推进主链和失败分支，通过当前 checkout 链接的全局 `silvermoon whats-next`
收集双语完整输出。准备脚本、场景和语料均保存在本 idea 目录内。

### I-S03: 集中 review 并修正

向维护者呈现整套输出语料，只实现明确 comment，重新采集受影响输出，并依据明确
结论收敛 `review-status.md`。

## Acceptance criteria

### I-AC01: check 与 problem 分支完整

状态图证明每个 check 的通过边唯一，且各失败 Problem 集和报告阶段都有状态转移场景；
失败分支可修复回归主链或记录独立分支理由。

自动化检查证明 Device、Project、Idea 的每个 instruction case 都有 checkpoint，两种
locale 和无 check 的补充输出也被覆盖；每条支链均有不能在线性主链继续的原因，且
没有可由主链推进覆盖却重复初始化的 case。

### I-AC02: 语料可复现

从 Docker 空设备可依状态图构造通过与失败状态，并记录 check、problem、阶段、
locale 和 revision。

全新 Docker 环境可从设备整备开始执行全部链路，并生成带场景与 revision 来源的
完整输出语料。

### I-AC03: Review 结论可追溯

review 状态和修正均可追溯到维护者对语料的明确 comment，且验证证明未破坏输出契约。
