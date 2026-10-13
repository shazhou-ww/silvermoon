# Objective Guide 实现与验证证据

本页为 [Implementation](./Implementation.md) 的实现实证，不修改已接受的
Ideal 契约，不记录人工接受或现实部署结论。

## I-AC01

公共入口提供 URI-keyed `ObjectiveLoader`、语言中立 `ObjectiveGuide`、
subject/language-bound `ObjectiveGuideInstance` 和有类型的创建结果。
Loader 按 canonical Manifest URI 缓存 Guide，不缓存 instance；串行构建与
ancestor 检查避免并发 prerequisite deadlock 和循环依赖。

定义域使用 Ajv Draft 2020-12 严格校验，不做 coercion 或默认值修改，只允许
本地 `$defs` 引用。Subject 必须是 JSON object，拒绝 accessor、非枚举数据、
稀疏或带额外属性的 array、定制 array prototype、Proxy、循环和非有限数值；
不触发 getter 或 Proxy trap，成功绑定后复制并递归冻结。失败优先级为本地 subject、
prerequisite subject、language，失败链保留实际 Guide 引用。

JSONata 的通常 evaluator 是异步的，与同步 typed creation 不兼容。因此复用
JSONata parser，执行契约允许的同步 AST profile，而不开放普通 evaluator 的
函数、变量绑定、动态求值或外部能力。表达式 4096 bytes、AST 512 nodes /
depth 32、执行 25 ms 和 output 65536 bytes 的限制有专项测试；允许表达式的
sequence 与嵌套 array 语义同 JSONata evaluator 对照。

Locale 必须完整且共享 page ID 集合。References 以 frontmatter ID 查找，默认
根目录 `404.md` / `id: "404"`；显式覆盖不约束 filename。缺失 ID 返回 fallback，
读取、编码、解析和 check 执行错误不伪装成 404 或低 level。文件 References
根目录和递归页面拒绝 symlink，文件内容拒绝无效 UTF-8；内部 page links 可有
循环，但不可悬空。

主要证据：
[核心运行时](../../../../../src/objective-guide/index.ts)、
[核心单测](../../../../../test/unit/objective-guide.test.ts)、
[文件资源测试](../../../../../test/integration/objective-guide.test.ts)、
[公共使用说明](../../../../../docs/objective-guidance.md)。

## I-AC02

Device 独立采样并保留完整 advisory，不作为 Project 的强制 prerequisite。
Project→Idea 直接引用同一 Loader 创建的 Guide；Idea 只投影 `{ root, userHome }`。
每个本地 Guide 以 `configuration-invalid` 开始，所有 advancement checks 有
逐项定位测试；Idea 的三阶段分别区分 submit 与 accept。

`whats-next` 使用 Guide 驱动分层，但保留四投影、原有 aggregate diagnostics、
fetch actions、内容语言和精确 revision。Idea 在 Project readiness 后重新读取；
identity、world revision 或 event digest 改变会要求重新观测，不能形成 stale
review。v1 不伪造 submission；completed 到 Idea terminal，abandoned 在 Project
readiness 后独立停止，不误标配置非法或 completed。无 selector 不创建 Idea
instance，不自动选择唯一 Idea；错误 selector 保留明确诊断。

唯一预期的导航范围扩展是 Project 校验全部三份 guidance，包括未选中的阶段和
同步后的准确 primary snapshot。缺失仍正常；非法其他阶段也阻塞。实际内容仍只
在成功的 active selected route 读取当前阶段，并保留 snapshot blob provenance。
`list-ideas`、snapshot `check` 与 `create-idea` 没有接入完整 advancement 或新增
网络/设备门槛。旧 ProfessionalModel 保留为兼容资源，不再驱动导航；无 OR/OPS
运行时 API 或依赖。

主要证据：
[三级 Guide](../../../../../src/business/objective-guides.ts)、
[导航接入](../../../../../src/business/whats-next.ts)、
[逐项 check 测试](../../../../../test/unit/silvermoon-objectives.test.ts)、
[导航与并发测试](../../../../../test/unit/whats-next-model.test.ts)、
[真实 guidance CLI 测试](../../../../../test/integration/whatsnext-guidance.test.ts)、
[公共导出测试](../../../../../test/contract/package-api.test.ts)。

## I-AC03

以下结果来自本候选 worktree；未把 staged metadata 检查当成 staged code 测试。

| 命令 | 结果 |
| --- | --- |
| `pnpm setup:dev` | 通过；全局 runtime 与 personal canonical skill 链接到本 checkout |
| `node --test test\unit\objective-guide.test.ts test\unit\whats-next-model.test.ts test\integration\objective-guide.test.ts` | 通过，31 tests |
| `pnpm check:sanity` | 通过；typecheck、build、syntax、pure 与 209 tests |
| `pnpm check` | 通过；全部 release gates，459 tests 通过，0 failures，2 个既有 Windows symlink privilege 条件跳过 |
| `pnpm check:commit` | 通过；worktree sanity、contract、smoke、Markdown、diff 与 staged metadata gates |
| `silvermoon check --worktree --audience agent` | 通过；候选 snapshot 和 v2 event history 有效 |
| `silvermoon check --staged --audience agent` | 通过；由提交门运行，验证 index metadata，不替代源码测试 |

完整验证包含 unit/runtime 242 tests、contract 58 tests、integration/extended
158 passed / 2 skipped，以及 production installed-package e2e 1 test。安装包
实测 Loader、probe 和 References，验证 Ajv/JSONata production dependencies 与
打包产物。两项 Windows 跳过分别是 metadata/config 和 user config 的 symlink
创建测试，不作为已验证平台能力。

首轮 release 发现新 module/doc 未加入显式 package whitelist；修复后完整重跑
通过。专项测试曾发现 guidance validation 与 content delivery 混用；拆成全量
结构校验与选中阶段读取后，真实 CLI 兼容和 snapshot provenance 测试通过。

提交门及 exact worktree/staged metadata 检查在同步候选前执行；准确
`implementationRevision` 的 `submitInner` 由同步后的 fresh report 驱动。
没有记录 `acceptInner`、`acceptOuter`，没有执行 npm 发布。
