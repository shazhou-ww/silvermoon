# 实现证据

## 范围与设计结论

2026-10-12 在独立 worktree 中新观察确认 `implementing / downstream`；
接受的 ideal `8a691b33778f` 保持不变，初始 primary 为 `8f0da7bd6baf`。
本次只完成主体世界候选，不记录 acceptInner，不进入部署，也不发布 npm。
首版曾以 `implementationRevision=711cb8db6d71` 提交到 primary `36025a705c6e`。
用户随后要求独立 YAML 文件及注入式 useState；这是修订请求，不是 acceptInner。
下述结论和验证已更新为该修订候选，原 submitInner 记录保留，不重放或接受旧版本。

- [独立 module](../../../../../src/professional-model/README.md) 实现固定
  Target、Problem、Observation、能力与拼装函数。YAML 注册层级、检查顺序、
  skill 内容和 code 映射；目标字段运行时验证。guide 统一返回惰性 skill
  内容字符串，未知 code 明确暴露指导缺口，不执行内容或其文档引用。
- [导航定义](../../../../../src/business/whats-next-model.yaml) 是独立文件，
  [读取函数](../../../../../src/business/whats-next-model.ts) 使用 module 相对 URL；
  构建复制同一资源到 dist，包白名单及安装包测试验证内容与源文件一致。
  读取/解析错误明确传播，没有内嵌 fallback。[真实导航](../../../../../src/business/whats-next.ts)
  的 project、repository、selection、guidance 与接受检查由运行器有序执行，
  不只是新增未使用的类型。领域报告保持四投影；原有生命周期投影仍负责
  精确 revision、submission 和 control 的事实，抽象不另造接受逻辑。
- 运行器每次 observe 向 factory 注入 useState，注册 `[getState, setState]`
  句柄；getter 在 await 后仍读最新值，setter 立即存储直接值，不解释函数为
  updater/initializer，不模拟 React 的重渲染。不同句柄独立，注册结束不能
  新建状态。导航五份跨 check 状态（snapshot、repository、selected、
  selectedIdea、outcome）全部实际经过该机制。
  首失败停止、整组通过才升级。新观察重新注册状态，包括失败后的下一次及
  并发观察；无隐式全局上下文或 React 依赖。观察仍是采样过程，不保证瞬时快照。
  配置、目标和程序错误明确传播；metadata 检查仅将预期读文件不可用映射为
  problem，解析或适配缺陷不被 broad catch 吞成正常阻塞。
- [说明文档](../../../../../docs/professional-model.md) 明确通用执行机制与
  Silvermoon 领域判据的边界。单场景证据仅证明适配可用，不证明跨行业普适性。
  package export、schema 与 canonical skill 内容/结构均未扩展。
  包白名单纳入新编译模块；`check:staged` 改用已链接的全局 Silvermoon。

## 可复查验证

在本次代码候选上执行，以下命令均 exit 0：

| 命令 | 结果与证据 |
| --- | --- |
| `pnpm setup:dev` | 构建及链接成功；全局 runtime 与个人 canonical skill link 均指向本 worktree，而非发布包或其他 checkout |
| `pnpm check:sanity` | typecheck、build（包含 YAML 复制）、syntax、pure 与 185 项 sanity 测试通过 |
| `node --test test\unit\professional-model.test.ts test\unit\whats-next-model.test.ts test\integration\whatsnext-smoke.test.ts test\integration\whatsnext-readiness.test.ts test\integration\whatsnext-guidance.test.ts test\integration-extended\whatsnext-setup.test.ts` | 52 项通过，无失败或跳过 |
| `node --test test\contract\functional-boundaries.test.ts` | 9 项通过，公共入口、无循环依赖和既有三层边界成立 |
| `pnpm pack:check:built`（由 `pnpm check` 调用） | PACK_OK，835 项制品；独立 YAML、module 和文档在精确包白名单中 |
| `pnpm check` | 完整 release gate 重跑通过：219 项 unit/runtime、57 项 contract、156 项 integration、1 项已安装包 e2e（含独立 YAML 内容一致性及实际导航）；integration 另有 2 项现有 Windows symlink 权限条件跳过，其余 gate 均通过 |
| `pnpm check:skills`（由 `pnpm check` 调用） | canonical skill discovery 通过，未新增 repository-local skill |
| `silvermoon check --worktree --audience agent` | worktree 元数据及事件历史验证通过 |
| `silvermoon check --staged --audience agent` | index 元数据及事件历史验证通过 |
| `pnpm check:commit` | sanity、57 项 contract、5 项 smoke、Markdown、staged 元数据与 diff gate 通过；测试针对 worktree，不将元数据检查误称 staged-code 测试 |

第一次 release 检查暴露了新 module 直接导入 schema 私有文件的错误，已改为
公共入口，并为新 module 加入 README/export-only index 契约检查。首次
`npm pack` 另有 Windows 进程异常；独立重试暴露新增制品未列入白名单，
修正白名单后独立 pack 与完整 release 重跑均通过。未忽略失败或绕过 gate。
本次修订专项测试先发现 Windows CRLF 导致测试过度限定 LF，已修正断言，
YAML 解析仍接受两者。修订第一次 release 中一个现有 scaffold 测试 worker
报告整体失败但未提供具体断言；`node --test test\integration\create-idea-scaffold.test.ts`
独立重跑 9 项通过，随后原样完整 `pnpm check` 重跑通过。未改动无关 scaffold 代码
或将失败静默视为成功。

## 验收标准对应

- **I-AC01:** [module 测试](../../../../../test/unit/professional-model.test.ts)
  覆盖顺序、首失败、整组升级、空组、全部通过、唯一 0 层、非空问题、多个问题、
  未知 code、无效配置/引用/目标/返回值、多个 useState 句柄独立、异步最新值、
  注册时机约束、失败后新观察、跨观察及并发隔离，并验证程序异常原样传播。
- **I-AC02:** [接入测试](../../../../../test/unit/whats-next-model.test.ts)
  捕获实际运行器经过的检查及内部层级，证明 project/repository 阻塞后不运行
  后续检查，显式选取与 guidance 失败按序停止，接受层级只消费已有生命周期；
  捕获实际五份 state 注册，并发用例不混淆报告。独立 YAML 读取/解析错误
  在运行检查前明确失败，安装包资源内容与源定义一致。
  原有真实 Git/CLI 和完整 release 测试覆盖 language、schema 整备、
  非阻塞 device advisory、exact revision、提交、人工控制权及同步语义。
- **I-AC03:** 上述精确命令及结果构成仓库验证证据。代码与实现契约对齐；
  ledger 仅镜像稳定 ID，Deployment 条目保持未勾选。
