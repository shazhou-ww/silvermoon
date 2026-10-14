# Implementation

## Steps

### I-S01: 设计场景链路

从三个 objective manifest 的有序 check 建立场景矩阵，以一条设备整备到 lifecycle
推进的线性主链覆盖可逐步修复的 instruction case。只有 case 互斥、不可逆或会
污染后续 checkpoint 时，才从最近可复用状态开支链并记录原因。

### I-S02: 构建并采集语料

在 Docker 中只初始化主链一次；每个 checkpoint 先通过当前 checkout 链接的全局
`silvermoon` 执行双语 whats-next 并保存完整输出，再修复该 case、推进到后续状态。
支链从最近可复用 checkpoint 派生，避免重做设备整备。

### I-S03: 集中 review 并修正

向维护者呈现整套输出语料，只实现明确 comment，重新采集受影响输出，并依据明确
结论收敛 `review-status.md`。

## Acceptance criteria

### I-AC01: 场景覆盖完整

自动化检查证明 Device、Project、Idea 的每个 instruction case 都有 checkpoint，两种
locale 和无 check 的补充输出也被覆盖；每条支链均有不能在线性主链继续的原因，且
没有可由主链推进覆盖却重复初始化的 case。

### I-AC02: 语料可复现

全新 Docker 环境可从设备整备开始执行全部链路，并生成带场景与 revision 来源的
完整输出语料。

### I-AC03: Review 结论可追溯

review 状态和修正均可追溯到维护者对语料的明确 comment，且验证证明未破坏输出契约。
