# Implementation

## Steps

### I-S01: 演进 ObjectiveGuide 基础契约

以现有 ProfessionalModel 为兼容基线，在独立 module 中落实 ObjectiveGuide、ObjectiveObservation、ObjectiveReferences、ObjectiveOutcomeAssessment、可序列化 ObjectiveGuideManifest 与装载 bindings 类型。Manifest 由数组下标定义 level，并用非空 tuple 保证每个非最高层都声明 advancement、唯一最高层省略该字段；每个 advancement 聚合进阶到下一层的 checks 与单段 outcome prompt。Manifest 只声明 Markdown reference pages 的位置。平级页面通过 frontmatter 声明稳定 ID、问题入口、开放 tags 和唯一未知问题兜底，通过内部 reference links 构图。Agent 通过运行时 `ObjectiveReferences` 主动打开问题、读取页面和搜索，不让 OR/OPS 依赖传输结构。

### I-S02: 建立 OR 与 OPS 类型边界

定义 ObjectiveRegulator、Agent 单步 action、受控调节状态、阈值注册、portfolio observation、调度 directive、policy 与 Objective Portfolio Supervisor 公共类型。类型必须表达仅探测与激活调节的差异、非原子多目标观测以及防御/进取任务；本候选不实现生产循环、Agent 自主循环或具体资源调度算法。

### I-S03: 保持现有导航兼容

增加类型、Manifest 绑定和兼容映射测试，更新直接相关文档；保留 `whats-next` 的四投影、优先级、控制权、语言、Git/schema 整备、非阻塞设备 advisory 与精确 revision 语义。记录本次只交付契约和 OG 演进，不把 OR/OPS 类型存在误报为运行能力。

## Acceptance criteria

### I-AC01: OG 传输与运行时边界可验证

公共类型和专项测试证明 Manifest 不重复保存 level 数字，0 层 advancement checks 可执行，`levels[i].advancement` 只描述 i→i+1；非空 tuple 和 Loader 验证共同保证所有非最高层都存在 advancement、唯一最高层省略该字段，并拒绝 `advancement: null`。Checks 与非空单段 outcome prompt 不再分散，outcome 不被强制拆字段或解析。Manifest 只含可序列化声明和单一 references 位置，load bindings 提供检查代码，OR/OPS 不接触路径、Manifest 或资源布局。验证平级页面、路径与身份分离、开放 tags、共享页面、允许的环、重复页面 ID 或问题入口、唯一未知问题兜底、悬空内部链接和空页面，并证明 Agent 可按问题主动 open/read/search；动态 assessor 与手写 OG 仍通过同一运行时接口。

### I-AC02: OR 与 OPS 契约无职责泄漏

类型检查证明 OR 只持有一个 OG 并接收单步 action executor，调节状态可判定且异常不伪装成成功；OPS 只通过注册、portfolio observation、plan 和 directive 调度多个 OR，跨目标策略不进入 OG，也不比较或求和不同 Objective 的 level。

### I-AC03: 仓库验证通过

通过 `pnpm check:sanity`、变更专项测试、交付前 `pnpm check` 与提交前 `pnpm check:commit`，记录精确命令与结果；现有真实导航兼容测试继续通过。经全局运行时的 worktree/staged 元数据检查后普通提交及非强制同步，再对准确 implementationRevision 记录 submitInner，不进入部署或推断 acceptInner。
