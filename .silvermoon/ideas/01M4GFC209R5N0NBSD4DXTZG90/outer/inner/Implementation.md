# Implementation

## Steps

### I-S01: 设计场景链路

从三个 objective manifest 的有序 check 建立场景矩阵，以一条设备整备到 lifecycle
推进的主链和少量支链复用连续状态。每条链路在多个 checkpoint 覆盖多个 check，
仅为互斥、不可逆或会污染后续 checkpoint 的状态另开链路。

### I-S02: 构建并采集语料

在 Docker 中用脚本初始化链路并依次推进 checkpoint，通过当前 checkout 链接的
全局 `silvermoon` 执行双语 whats-next，并保存完整输出、场景身份和来源 revision。

### I-S03: 集中 review 并修正

向维护者呈现整套输出语料，只实现明确 comment，重新采集受影响输出，并依据明确
结论收敛 `review-status.md`。

## Acceptance criteria

### I-AC01: 场景覆盖完整

自动化检查证明 Device、Project、Idea 的每个 check 都恰有对应 checkpoint，两种
locale 和无 check 的补充输出也被覆盖，且没有可由已有链路推进却重复初始化的 case。

### I-AC02: 语料可复现

全新 Docker 环境可从设备整备开始执行全部链路，并生成带场景与 revision 来源的
完整输出语料。

### I-AC03: Review 结论可追溯

review 状态和修正均可追溯到维护者对语料的明确 comment，且验证证明未破坏输出契约。
