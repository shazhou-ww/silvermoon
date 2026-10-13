# Implementation

## Steps

### I-S01: 演进 ObjectiveGuide 基础契约

以现有 ProfessionalModel 为兼容基线，在独立 module 中落实 ObjectiveLoader、ObjectiveGuide、ObjectiveObservation、ObjectiveLevelDescription、ReferencePage、可序列化 ObjectiveGuideManifest 与装载 bindings 类型。Loader 以 canonical Manifest URI 作为 Objective 身份，并按 URI 与 resolved language 缓存 Guide；Manifest 内不重复声明身份字段。Manifest 用受限 Draft 2020-12 `domainSchema` 描述 JSON object subject；公共 Objective API 只接收 subject，不保留通用 runtime context，执行依赖由 bindings 注入。每个 level description 引用实际负责的 Guide，并静态携带 advancement outcome；每个 observed problem 直接携带入口 page ID，Guide 只需提供 `readPage` 与 `searchPages`。语言无关的本地 levels 以稳定 ID 关联完整 locale content 和 References，全部 advancement 通过后合成唯一 terminal。装载后的 Guide 绑定一种 language，不做字段级混合 fallback。单个 optional `prerequisite` 以 Manifest URI 引用目标，`subject` 直接用受限 JSONata 投影当前定义域；Loader 递归解析成同语言 Guide 对象，未 terminal 时直接返回其 observation。

### I-S02: 建立 OR 与 OPS 类型边界

定义 ObjectiveRegulator、Agent 单步 action、受控调节状态、subject-bound registration、portfolio observation、调度 directive、policy 与 Objective Portfolio Supervisor 公共类型。同一 OG 可绑定多个 subject；OPS 只调度组合后的 OG，不把 Project→Idea 语义前缀重复建模为 portfolio prerequisite。类型还须表达仅探测与激活调节的差异、非原子多目标观测以及防御/进取任务；本候选不实现生产循环、Agent 自主循环或具体资源调度算法。

### I-S03: 保持现有导航兼容

增加类型、Manifest 绑定和兼容映射测试，更新直接相关文档；保留 `whats-next` 的四投影、优先级、控制权、语言、Git/schema 整备、非阻塞设备 advisory 与精确 revision 语义。记录本次只交付契约和 OG 演进，不把 OR/OPS 类型存在误报为运行能力。

## Acceptance criteria

### I-AC01: OG 传输与运行时边界可验证

公共类型和专项测试证明 Loader 规范化相对/绝对 Manifest URI，相同 URI 与 resolved language 返回同一 Guide 对象，并按 canonical URI 拒绝无法解析、self/cyclic prerequisite；不同 language 实例共享同一 Objective 身份。Manifest 的 `domainSchema` 是有效 Draft 2020-12 object schema，只解析本地 `$ref`，不做 coercion、default mutation 或远端访问；非法 subject 在观测前明确失败，Objective API、checks、OR 和 OPS 均不接受通用 runtime bag，环境依赖通过有类型的 bindings 或 policy 构造依赖提供。Manifest 不重复保存 Objective 身份、level 数字或语言文本，本地 levels 非空、ID 唯一且每项 advancement checks 可执行；每个 localization 精确覆盖相同 level IDs 和 Reference graph，缺少显式请求 language 时失败，未请求 language 时才使用 `defaultLanguage`，不做字段级 fallback。`prerequisite.subject` JSONata 只读取当前 subject，按固定受限 profile 编译执行并生成通过前置 Schema 的 JSON object；拒绝表达式错误、非确定性能力和非 JSON 输出。前置未 terminal 时本地 checks 不运行，组合 Guide 直接复用其 level descriptions 并返回带实际 Guide 与投影 subject 的 observation；组合 terminal level 等于递归前置显式层数加本地层数，Manifest 不序列化 terminal，并拒绝 `advancement: null`。`describeLevels` 完整返回静态 outcome；Reference pages 验证路径与身份分离、开放 tags、共享页面、允许的环、唯一未知问题兜底、悬空链接和空页面，并证明 Agent 可用 observed problem 的 page ID 直接调用对应 Guide 的 `readPage`。

### I-AC02: OR 与 OPS 契约无职责泄漏

类型检查证明 OR 只持有一个已组合 OG 并接收单步 action executor，调节状态可判定且异常不伪装成成功；OPS 以 registration ID 区分同一 OG 的不同 subject，只通过 portfolio observation、plan 与 directive 调度 OR，并从 observation 当前 level description 读取静态 outcome，窗口与预算由 policy 自身有类型的依赖取得。跨目标策略不进入 OG，不比较或求和不同 Objective 的 level，也不改写 `prerequisite`。

### I-AC03: 仓库验证通过

通过 `pnpm check:sanity`、变更专项测试、交付前 `pnpm check` 与提交前 `pnpm check:commit`，记录精确命令与结果；现有真实导航兼容测试继续通过。经全局运行时的 worktree/staged 元数据检查后普通提交及非强制同步，再对准确 implementationRevision 记录 submitInner，不进入部署或推断 acceptInner。
