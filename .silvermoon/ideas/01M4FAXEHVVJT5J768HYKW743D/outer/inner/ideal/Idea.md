# 统一 Silvermoon 运行时版本与 Schema 演进契约

## 问题

如果项目各自固化 Silvermoon 版本，运行时会逐渐碎片化，项目也难以及时获得修复与演进能力。项目真正需要长期依赖的是元数据 schema 契约，而不是某个 Silvermoon 二进制版本。

## 结果

`0.4.0` 作为切换边界，所有项目只使用设备或宿主的唯一 Silvermoon runtime，并在
runtime 不是最新版本时得到明确升级提示。项目只声明各文件的 schema 契约；
`whats-next` 在项目准备阶段逐文件校验，并在声明版本不属于当前 runtime 的目标
schema 集合时汇总提示升级。
具体影响面、兼容术语与既有契约冲突见
[全局运行时与 Schema 演进影响面调研](./RuntimeSchemaImpact.md)。

## 边界

- 不再支持项目固定、解析或回退到项目专属的 Silvermoon 版本。
- schema 有效性与当前 runtime readiness 分开判断；升级提示不等于静默迁移。
- 兼容承诺仅覆盖有效的已声明 schema，不猜测或静默修复损坏、未知的数据。

## 验收标准

- `0.4.0` 不再执行任何项目级 runtime dependency、安装来源或版本匹配检查；所有入口使用唯一 runtime。
- `whats-next` 在进入 repository 与 idea 路由前检查所有 schema-bearing 文件，一次报告路径、声明版本和当前目标版本；任一有效但过期的 schema 都进入明确的项目升级准备。
- 每个目标 schema 都有从受支持历史版本到当前版本的确定性迁移路径；迁移显式执行、结果可校验且不静默丢失语义。
