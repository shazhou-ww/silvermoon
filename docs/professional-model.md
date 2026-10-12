# 专业能力 module

本仓库内的 [module](../src/professional-model/index.ts) 提供能力定义及
`assembleProfessionalModel`，暂不作为独立 npm 包或公共 package export。
它只组织判据与指导，不执行 skill、不代替 Agent 解题，也不产生人工决定。
本次仅验证 Silvermoon 场景，不据此宣称跨行业普适性。

## 公共契约

- `Target = Readonly<Record<string, unknown>>`，不暴露泛型。YAML 的 `target`
  声明字段类型：`string`、有限 `number`、`boolean` 及其 `optional-` 形式。
  必需字段须是对象自身字段；未声明字段允许保留。目标不是完整世界状态。
  目标非 key-value 对象或字段类型错误抛出 `TargetError`，不作为业务未达成。
- `observe(target)` 返回 `{ level, problems }`。层级为从 0 开始的连续非负整数，
  非空且最高层唯一；问题包含非空 `code` 与 `description`。
- `guide(code)` 统一返回注册的惰性 **skill 内容字符串**，内容可引用文档。
  未知 code 返回显式提示知识缺口的内容，不自动解析文档引用或执行指导。
- `describe()` 返回不可变的有序层级说明；无问题不等于一定处于最高层。

## 声明与执行

YAML 必须包含且仅包含 `target`、`levels`、`checks`、`skills`、`guidance`
和 `unknown`。`skills` 注册名称到内容字符串，`guidance` 将 problem code
映射到注册名称，`unknown` 指定兜底 skill；失效引用是配置错误。
严格 YAML 解析拒绝重复 key、脚本外的未知配置字段、tag、alias 等。

`checks` 为二维检查名称数组，位置 0 表示 0→1，位置 1 表示 1→2，
组数必须等于层级数减一。每次 `observe` 调用 registry factory，先验证
所有检查引用，再从 0 顺序执行。层内首失败停止，全部通过才升级；
空组自然通过，只有 0 层的定义也有效。

Registry factory 仅创建本次观察的闭包与检查，不应在注册时执行采样。
原子检查接收 Target 并异步返回 `{ passed: true }` 或
`{ passed: false, problems: [problem, ...] }`；非法返回值抛出程序错误。
检查可通过同一 factory 的闭包共享一次观察内的采样；顺序或并发的新观察
均创建新闭包，不能缓存上次通过结论。程序异常原样传播，不统一 catch。
预期不可用应由领域检查明确返回 problem。

观察是采样过程，不保证瞬时一致快照；时效与精确版本判据仍由领域负责。

## Silvermoon 接入边界

[导航定义](../src/business/whats-next-model.ts) 使用内嵌 YAML，避免增加独立
配置文件的构建复制和安装路径。它不是项目可覆盖的配置，也不执行脚本。
[whats-next](../src/business/whats-next.ts) 注册 project、repository、
selection、guidance、ideal、inner、outer 原子检查，由 module 的运行器
决定顺序、升级与停止。层级为：

| level | 含义 |
| --- | --- |
| 0 | 项目观察或整备尚不可用 |
| 1 | 项目整备完成 |
| 2 | 仓库同步完成，尚未完成显式对象选取或 guidance |
| 3 | Idea 已选取且 guidance 有效，理想尚未接受或已废弃 |
| 4 | 精确理想已接受，实现阶段尚未接受 |
| 5 | 精确实现已接受，部署阶段尚未接受 |
| 6 | 精确部署已接受，Idea completed |

层级仅为内部组织，不增加第五个 CLI 投影或更改报告 shape。现有 snapshot、
repository readiness、对象选取与 lifecycle 投影仍提供唯一领域事实；
接受检查只消费已有生命周期状态，不另行比较 revision 或推断人工接受。
领域动态 nextSteps、review、localization、控制权、phase guidance、
Git/schema 整备及提交同步继续使用原有实现。设备 advisory 不进入硬门槛。
裸导航和未知对象在 selection 停止，不擅自选择 Idea。

专项证据见 [module 测试](../test/unit/professional-model.test.ts) 与
[导航接入测试](../test/unit/whats-next-model.test.ts)；现有真实 Git/CLI、
guidance、控制权及精确 revision 测试作为外部兼容证据。
