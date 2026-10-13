# Implementation

## Steps

### I-S01: 演进 ObjectiveGuide 基础契约

以现有 ProfessionalModel 为兼容基线，在独立 module 中落实 ObjectiveLoader、语言中立 ObjectiveGuide、subject/language-bound ObjectiveGuideInstance、ObjectiveObservation、ObjectiveLevelDescription、ReferencePage、可序列化 ObjectiveGuideManifest 与装载 bindings 类型。Loader 以 canonical Manifest URI 作为 Objective 身份并只按 URI 缓存 Guide；Manifest 内不重复声明身份字段。Guide 用受限 Draft 2020-12 `domainSchema` 验证 JSON object subject，并以同步 discriminated result 区分根 subject 无效、prerequisite chain 的投影 subject 无效和 chain 中 language 不受支持；成功时为确定的 subject 与 resolved language 创建不可变 instance，不用 Promise rejection 表达预期构建失败。后续 Objective API 不重复接收 subject，也不保留通用 runtime context，执行依赖由 bindings 注入。每个 level description 引用实际负责的 instance，并把单段损益直接保存为 `advancementOutcome`，不增加单字段 advancement 对象；公共契约只使用有序、可读且稳定的 level ID，不保存 numeric level/index。每个 observed problem 直接携带入口 page ID，instance 提供 `readPage` 与 `searchPages`；ReferencePage 不单列 links、tags 或 unknown-problem 布尔值，内部链接直接留在正文，缺页返回 locale bundle 指定的普通 `notFoundPageId` 页面。语言无关的本地 levels 以稳定 ID 关联完整 locale content 和 References，全部 advancement 通过后合成唯一 terminal。单个 optional `prerequisite` 以 Manifest URI 引用目标，`subject` 直接用受限 JSONata 投影当前定义域；Loader 解析成 Guide 对象，instance 再以同一 language 和投影 subject 创建 prerequisite instance，未 terminal 时直接返回其 observation。

### I-S02: 隔离调节与调度扩展

把 ObjectiveRegulator 与 Objective Portfolio Supervisor 分别保留在独立 Ideal World 扩展文档，明确它们依赖 Guide 核心但不属于当前 Silvermoon source/runtime 交付。核心 module 不导出 OR/OPS 类型，不引入自动复归、Agent 自主循环、portfolio registration、资源调度或 threshold policy。

### I-S03: 保持现有导航兼容

增加 Guide 核心类型、Manifest 绑定和兼容映射测试，更新直接相关文档；保留 `whats-next` 的四投影、优先级、控制权、语言、Git/schema 整备、非阻塞设备 advisory 与精确 revision 语义。记录本次只交付 Guide 核心，不把 OR/OPS 扩展文档误报为 source/runtime 能力。

## Acceptance criteria

### I-AC01: OG 传输与运行时边界可验证

公共类型和专项测试证明 Loader 规范化相对/绝对 Manifest URI，相同 canonical URI 返回同一语言中立 Guide 对象，并按 URI 拒绝无法解析、self/cyclic prerequisite；Guide 为不同 subject/language 创建不同 instance，且 Loader 不按任意 JSON subject 建 identity map。Manifest 的 `domainSchema` 是有效 Draft 2020-12 object schema，只解析本地 `$ref`，不做 coercion、default mutation 或远端访问；`createInstance` 不返回 Promise，并以带直接 Guide 对象 chain 的 typed result 分别报告 `invalid-subject`、`invalid-prerequisite-subject` 和 `unsupported-language`，其中 prerequisite 失败区分 projection 与 schema validation，language 失败给出请求值和支持列表。ObjectiveGuideInstance 与 checks 不接受通用 runtime bag，环境依赖通过有类型的 bindings 提供。Manifest 不重复保存 Objective 身份、numeric level/index 或语言文本，本地 levels 非空、ID 唯一且每项 advancement checks 可执行；每个 localization 精确覆盖相同 level IDs、page IDs 和 `notFoundPageId`，显式请求不支持的 language 时失败，省略时才使用 `defaultLanguage`，不做字段级 fallback。`prerequisite.subject` JSONata 只读取当前 instance subject，按固定受限 profile 编译执行并生成通过前置 Schema 的 JSON object；拒绝表达式错误、非确定性能力和非 JSON 输出。前置未 terminal 时本地 checks 不运行，组合 instance 直接复用 prerequisite instance 的 level descriptions，并返回其 observation；`describeLevels` 按 prerequisite 前缀、本地显式层和唯一 terminal 的顺序直接返回 `advancementOutcome`，terminal 值为 `null`，Manifest 不序列化 terminal，并拒绝 `advancement: null`。Reference pages 验证路径与身份分离、共享页面、允许的正文链接环、必有且有效的 not-found page、悬空内部链接和空页面，并证明返回类型不单列 links/tags/fallback 布尔值、缺失 page ID 返回配置的 404-like page、Agent 可从 observed problem 直接调用对应 instance 的 `readPage`。

专项测试覆盖省略 `notFoundPageId` 时使用 References 根目录的 `404.md`
（`id: "404"`），以及显式覆盖目标。默认文件缺失、ID 不匹配或覆盖目标不存在
必须导致装载失败；只有请求 page ID 不存在才返回 not-found page，不掩盖权限、
IO 或解析错误，搜索无匹配仍返回空列表。

### I-AC02: 扩展契约不进入核心运行时

源码、导出与依赖检查证明 Silvermoon 当前只消费 ObjectiveLoader、ObjectiveGuide 与 ObjectiveGuideInstance；ObjectiveRegulator 和 Objective Portfolio Supervisor 仅存在于相互独立、链接核心契约的 Ideal World 文档。Guide module 不导出或依赖 OR/OPS 类型，`whats-next` 不创建 regulator、registration、portfolio plan 或调度 policy。

### I-AC03: 仓库验证通过

通过 `pnpm check:sanity`、变更专项测试、交付前 `pnpm check` 与提交前 `pnpm check:commit`，记录精确命令与结果；现有真实导航兼容测试继续通过。经全局运行时的 worktree/staged 元数据检查后普通提交及非强制同步，再对准确 implementationRevision 记录 submitInner，不进入部署或推断 acceptInner。
