# 建立 Objective Guidance 类型体系

## 问题

现有专业能力 module 已验证单一目标维度的观察、问题与指导可以驱动
`whats-next`，但 Objective 定义仍把可执行 checks 绑定到宿主 JavaScript，
把本地化内容分散在 locale 配置、check 结果和 References 中；各语言独立的
目录树也不能从结构上保证同一 wiki。

## 结果

形成以稳定 level、check 与 problem ID 描述目标的 Objective Guide 核心：
Manifest 只引用 checks，runtime 按 ID 发现 executable 并把返回的 Problem ID
映射到统一 References wiki；全部语言文件位于 Reference 叶子。Prerequisite
可以声明最低可接受层。Silvermoon 三个作用域继续建立在
[核心契约](./objective-guidance.md)和[领域契约](./silvermoon-objectives.md)上。

## 边界

- 本轮只实现 Guide 核心；公开接口不使用物理隐喻，OR/OPS 不进入 runtime。
  References 只规定 `system/404`、`levels/<id>`、`checks/<id>`、
  `problems/<id>` 和 `pages/<id>`，不扩展为任意知识分类平台。
- Check runtime 不假设 JavaScript module；每个 advancement `CheckId` 按约定
  解析同名可执行入口。进程启动成本可接受，但必须有明确的协议、超时、输出和
  信任边界，不经 shell 执行，也不把业务失败伪装成运行错误。
- Prerequisite 可以声明 immediate prerequisite 必须达到的最低 level；达到该
  level 或其后续 level 即可解锁当前 Guide，省略时仍要求 `terminal`。最低层
  只引用 immediate prerequisite 的本地 level，不跨 Guide 猜测同名 ID。

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
