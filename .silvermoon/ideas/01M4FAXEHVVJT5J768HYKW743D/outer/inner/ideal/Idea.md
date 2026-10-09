# 统一 Silvermoon 运行时版本与 Schema 演进契约

## 问题

如果项目各自固化 Silvermoon 版本，运行时会逐渐碎片化，项目也难以及时获得修复与演进能力。项目真正需要长期依赖的是元数据 schema 契约，而不是某个 Silvermoon 二进制版本。

## 结果

`0.4.0` 作为切换边界，所有项目只使用设备或宿主的唯一 Silvermoon runtime，并在
runtime 不是最新版本时得到明确升级提示。项目只声明各文件的 schema 契约；
`whats-next` 在项目准备阶段逐文件校验，并在声明版本不属于当前 runtime 的目标
schema 集合时汇总提示升级。Coding Agent 从个人级 skill discovery 目录直接加载
全局 runtime 提供的 canonical skill，普通项目不再保存 Silvermoon skill 副本。
当项目 schema 高于当前 runtime 的支持范围时，项目准备会立即刷新 runtime 的
最新版本状态，再给出可升级、最新但仍不支持或暂时无法确认的准确结论。
具体影响面、兼容术语与既有契约冲突见
[全局运行时与 Schema 演进影响面调研](./RuntimeSchemaImpact.md)。

## 边界

- 不再支持项目固定、解析或回退到项目专属的 Silvermoon 版本。
- 全局 skill 属于执行环境而不是项目元数据；Silvermoon 源码 checkout 可为开发
  未发布版本保留 workspace skill，但不得把它传播到其他项目。
- 设备整备的例行 latest 查询共享 24 小时缓存；高于 runtime capability 的 schema
  是要求立即刷新该状态的独立触发条件。
- schema 有效性与当前 runtime readiness 分开判断；升级提示不等于静默迁移。
- 兼容承诺仅覆盖有效的已声明 schema，不猜测或静默修复损坏、未知的数据。

## 验收标准

- `0.4.0` 不再执行任何项目级 runtime dependency、安装来源、版本匹配或
  repository skill 一致性检查；所有入口使用唯一 runtime，个人级 skill 链接解析到
  同一全局安装的 canonical skill；设备 latest 检查在缓存满 24 小时前不重复请求。
- `whats-next` 在进入 repository 与 idea 路由前检查所有 schema-bearing 文件，一次
  报告路径、声明版本和当前目标版本；有效但过期的 schema 进入项目升级准备，高于
  runtime 支持范围的 schema 强制刷新 latest 状态并区分可升级、已是 latest 和查询
  不可用。
- 每个目标 schema 都有从受支持历史版本到当前版本的确定性迁移路径；迁移显式执行、结果可校验且不静默丢失语义。
