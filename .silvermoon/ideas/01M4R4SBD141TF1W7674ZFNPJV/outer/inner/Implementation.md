# Implementation

## Steps

### I-S01: 演进 ObjectiveGuide 基础契约

以现有 ProfessionalModel 为兼容基线，在独立 module 中落实 ObjectiveGuide、ObjectiveObservation、ObjectiveGuidance、Reference Wiki、ObjectiveReferenceGraph、ObjectiveOutcomeAssessment、可序列化 ObjectiveGuideManifest 与装载 bindings 类型。Manifest 只声明 Wiki 来源与遍历限制；平级页面通过 frontmatter 声明稳定 ID、问题入口、开放 tags 和唯一未知问题兜底，通过内部 Wiki link 构图。Loader 解析 Wiki 并只产出运行时 OG，默认 resolver 返回有限闭合子图，不让 OR/OPS 依赖传输结构。

### I-S02: 建立 OR 与 OPS 类型边界

定义 ObjectiveRegulator、Agent 单步 action、受控调节状态、阈值注册、portfolio observation、调度 directive、policy 与 Objective Portfolio Supervisor 公共类型。类型必须表达仅探测与激活调节的差异、非原子多目标观测以及防御/进取任务；本候选不实现生产循环、Agent 自主循环或具体资源调度算法。

### I-S03: 保持现有导航兼容

增加类型、Manifest 绑定和兼容映射测试，更新直接相关文档；保留 `whats-next` 的四投影、优先级、控制权、语言、Git/schema 整备、非阻塞设备 advisory 与精确 revision 语义。记录本次只交付契约和 OG 演进，不把 OR/OPS 类型存在误报为运行能力。

## Acceptance criteria

### I-AC01: OG 传输与运行时边界可验证

公共类型和专项测试证明 Manifest 只含可序列化声明、Wiki 来源和遍历限制，load bindings 提供代码，loader 只产出 ObjectiveGuide，OR/OPS 不接触路径、Manifest、完整 Wiki 或资源布局。验证平级页面、路径与身份分离、开放 tags、共享页面、允许的环、重复页面 ID 或问题入口、唯一未知问题兜底、悬空内部链接、空页面与非法深度/页面上限，以及默认和动态 resolver 返回的入口存在、链接端点闭合并遵守上限；动态 assessor 与手写 OG 仍通过同一运行时接口。

### I-AC02: OR 与 OPS 契约无职责泄漏

类型检查证明 OR 只持有一个 OG 并接收单步 action executor，调节状态可判定且异常不伪装成成功；OPS 只通过注册、portfolio observation、plan 和 directive 调度多个 OR，跨目标策略不进入 OG，也不比较或求和不同 Objective 的 level。

### I-AC03: 仓库验证通过

通过 `pnpm check:sanity`、变更专项测试、交付前 `pnpm check` 与提交前 `pnpm check:commit`，记录精确命令与结果；现有真实导航兼容测试继续通过。经全局运行时的 worktree/staged 元数据检查后普通提交及非强制同步，再对准确 implementationRevision 记录 submitInner，不进入部署或推断 acceptInner。
