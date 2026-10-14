# Implementation

## Steps

### I-S01: 建立 check/problem 状态图

将每个 check 的唯一通过出口串成主链，并为失败时可能产生的不同 problems 标注
报告阶段、状态变更、下游去向及回归路径，详见
[scenario-graph.md](./scenario-graph.md)。

### I-S02: 准备脚本与 Docker 语料场景

在本 idea 的 `scenario-lab/` 中准备状态转移和采集脚本。Docker 从空设备开始，只
初始化一次；按状态图依序构造通过状态与失败 problems，使用当前 checkout 链接的
全局 `silvermoon` 收集双语完整输出。生成的临时语料留在 idea 目录，不放到其他
项目目录。

### I-S03: 集中 review 并修正

向维护者呈现整套输出语料，只实现明确 comment，重新采集受影响输出，并依据明确
结论更新 [review-status.md](./review-status.md)。

## Acceptance criteria

### I-AC01: check 与 problem 分支完整

状态图证明每个 check 的通过边唯一，且各失败 Problem 集和报告阶段都有状态转移场景；
失败分支可修复回归主链或记录独立分支理由。

### I-AC02: 语料可复现

全新 Docker 环境可从空设备按状态图构造通过与失败状态，并生成带 check、problem、
阶段、locale 与 source revision 的完整输出语料，文件留在 idea 的 `scenario-lab/`。

### I-AC03: Review 结论可追溯

review 状态和修正均可追溯到维护者对语料的明确 comment，且验证证明未破坏输出契约。
