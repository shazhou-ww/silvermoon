# 建立 Objective Guidance 类型体系

## 问题

现有专业能力 module 已验证单一目标维度的观察、问题与指导可以驱动
`whats-next`，但 Objective 定义仍把可执行 checks 绑定到宿主 JavaScript，
把本地化内容分散在 locale 配置、check 结果和 References 中；各语言独立的
目录树也不能从结构上保证同一 wiki。

## 结果

形成可复用的 ObjectiveLoader、语言中立 ObjectiveGuide 和
subject/language-bound ObjectiveGuideInstance 核心契约。Manifest 以稳定
level、check 与 problem ID 描述目标，checks 是遵循固定 JSON 协议的独立
可执行程序；全部面向人的本地化内容进入一棵语言无关的 References wiki，
每个 Reference 节点在最内层提供完整语言文件。Silvermoon 设备、项目、Idea
三个作用域的判据与路由继续建立在该核心上。类型见
[核心契约](./objective-guidance.md)，领域判据见
[Silvermoon 领域契约](./silvermoon-objectives.md)。

## 边界

- 公开接口不使用势场、势能等物理隐喻；内部理论仍可追溯离散单洼地标量势场。
- 本轮只把 Guide 核心落入 Silvermoon 实现范围；OR 与 OPS 保留为独立扩展
  文档，不进入当前 source/runtime 依赖。References 只规定
  `system/404`、`levels/<id>`、`checks/<id>`、`problems/<id>` 和
  `pages/<id>` 两层身份结构，不扩展为任意知识分类平台。
- Check runtime 不假设 JavaScript module；每个 check 由 Manifest 声明为
  当前平台可执行入口。进程启动成本可接受，但必须有明确的协议、超时、输出和
  信任边界，不经 shell 执行，也不把业务失败伪装成运行错误。
- Prerequisite 可以声明 immediate prerequisite 必须达到的最低 level；达到该
  level 或其后续 level 即可解锁当前 Guide，省略时仍要求 `terminal`。最低层
  只引用 immediate prerequisite 的本地 level，不跨 Guide 猜测同名 ID。
- 层级只由单目标内有序、可读且稳定的 level ID 表达并允许中间稳态；公共契约不暴露 numeric level/index。观察不是原子快照，任何 Agent 行动都须重新观测，人工决定不得自动替代。

## 验收标准

- [核心契约](./objective-guidance.md)明确 URI 身份、Guide/Instance 边界、
  typed creation failures、定义域与 prerequisite projection、可执行 check
  协议、prerequisite 最低层语义、稳定 Problem ID，以及按 Reference ID 组织且
  语言位于最内层的完整 locale 投影；不重复暴露 numeric index 或通用 runtime
  context。
- [领域契约](./silvermoon-objectives.md)明确三个作用域的 level、check 与
  problem vocabulary、非阻塞 Device、Project→Idea 前置、项目级 guidance、
  selector 路由和精确 submit/accept 分层；配置、装载、check 执行和 instance
  创建错误不混淆。
- 映射现有 ProfessionalModel 基线，保留导航的四投影、语言、控制权与精确 revision；项目 guidance 校验范围扩展明确标出并验证，OR/OPS 不进入当前 source/runtime。设计只定义在 Ideal World 辅助文件，实现契约仅列 Steps 与可验证 AC。
