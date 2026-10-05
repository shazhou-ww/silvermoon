# 模块目录组织验证证据

本文件服务于 [Implementation](./Implementation.md)，不构成新的理想契约或验收。
本轮以 `8ecc40b040d48d9b78ee33a401b140cc2d4d9770` 的已验收代码行为为基线；
保留已批准 idealRevision `7352fc3a3a42640ed873d0f22e75cc4e3450be14` 和旧
acceptInner 事实。目录组织要求通过修改实施契约使现有 idea 回到 implementing，
没有创建新 idea、清除决定、修改 Ideal World 或发起 deployment。

## 目录与职责入口

完整入口：[源码模块索引](../../../../../src/README.md)。
源码共有 23 个目录，每个目录均包含简短职责 README 和显式 export-only index。

| 模块 | 职责文档 |
| --- | --- |
| CLI | [cli](../../../../../src/cli/README.md) |
| 应用用例与子模块 | [application](../../../../../src/application/README.md) |
| idea 模型与规则 | [idea](../../../../../src/idea/README.md) |
| 命令运行时、规则与 trace | [command](../../../../../src/command/README.md) |
| 持久事件与规则 | [events](../../../../../src/events/README.md) |
| project 读取与纯解析 | [project](../../../../../src/project/README.md) |
| Git、快照、事务与缓存 | [repository](../../../../../src/repository/README.md) |
| 纯响应组织 | [response](../../../../../src/response/README.md) |
| 展示与惰性 TUI | [presentation](../../../../../src/presentation/README.md) |
| 既有 Agent 适配 | [agents](../../../../../src/agents/README.md) |

同目录使用具体 sibling 文件，跨目录使用公开 index。纯调用方使用独立规则
入口，避免经混合 facade 加载 reader、runtime 或 TUI。index 不含初始化、
组装或业务代码，不使用 export *。

保留包根公共 API 与两个既有 Agent 子路径，根入口不引入 Copilot SDK。
源码 bin 使用模块公开入口；两个既有 source-only migration bin 保留明确的
私有工具入口，不将其导出到安装态 facade 或 npm 包。

## 路径敏感表面

- AST 重写 import、re-export、惰性 import 和包资源 URL，保持源码 runtime 检测。
- 查询的默认枚举包装单独放在 idea 模块；纯核心保留显式枚举事实，公开可变
  数组与默认行为不变。
- 认证投影的源码身份覆盖搬迁后的实现与相关公开规则 facade；Git native source
  记录继续绑定当前实现，不沿用旧路径或弱化缓存验证。
- 严格包白名单逐项列出 134 个文件，包括全部 README、模块 index 和声明；
  没有使用运行时目录扫描或通配白名单放宽检查。
- TUI 有独立惰性入口，presentation 与 CLI 的静态依赖闭包不加载 TUI/SDK。
- 保留五个 CLI 命令、四投影、语言、退出码、快照、联网、1000 条分段、游标、
  认证增量 I/O、并发和恢复语义；不新增产品能力或 npm 发布。

## 验证结果

环境：macOS，Node v22.22.2，pnpm 11.22.0。所有 Silvermoon 命令使用当前
checkout 的源码入口；未安装自身发布包，没有新依赖或版本变化。

| 实际命令 | 结果 |
| --- | --- |
| `pnpm check:sanity` | 通过，142 项全部通过；144 个纯函数、14 个规则模块 |
| `node --test test/contract/functional-boundaries.test.js test/runtime/adoption.test.js test/runtime/cursor-events.test.js test/integration/whatsnext-readiness.test.js` | 通过，31 项全部通过；涵盖 23 个目录、公开入口、完整依赖图、资源与游标 |
| `pnpm test:e2e` | 通过，隔离打包安装烟测成功，含公开 TUI 模块入口及公共／Agent 子路径 |
| `pnpm check` | 通过，全部 7 个 release-grade gate 完成 |
| `node bin/silvermoon.js check --worktree --audience agent` | 通过，当前候选元数据有效且 source runtime 资源定位正确 |
| `pnpm check:commit` | 通过，worktree 测试、契约、烟测、纯度、文档、skill、差异和准确 staged 元数据检查均通过 |
| `git diff --check` | 通过 |
| `git diff --quiet` | 通过，提交前 worktree 与 index 对齐 |
| `git diff --cached --check` | 通过 |

完整检查中，unit/runtime 195 项：191 通过、4 个 Windows TUI 用例按原条件
跳过；contract 42 项全部通过；integration 152 项：149 通过、3 个真实 Copilot
用例按原条件跳过。pack:check 确认 134 个准确文件，E2E 安装态通过，
Markdown、纯度和本地／外部 skill discovery 均通过，无失败或取消。

未在本机执行 Windows、Node 24 或真实 Copilot 的跳过场景，原 CI matrix 与
测试断言保留，没有将这些场景描述为已执行。安装态验证不构成 npm 发布。
首轮 E2E 的 eval 字符串仍指向旧 TUI 私有文件，修正为新公开入口后，单独
重跑 E2E 及完整检查通过。未搬迁资源的 URL 原始写法保持不变，避免夹带
无关路径规范化。

## 提交与同步

目录与 README 代码候选
[`76166abb0a2a4813fce95d13f7c87db231623eb2`](https://github.com/shazhou-ww/silvermoon/commit/76166abb0a2a4813fce95d13f7c87db231623eb2)
已通过普通非强制 push 同步 primary。刷新 origin/main 后确认可达，重新观察
仍为 implementing，内容语言为 zh-CN，已批准 idealRevision 未变化。

提交前已对齐 worktree 与 index，worktree、提交前检查及准确 staged 元数据
检查均通过；metadata gate 不冒充暂存代码测试。本证据收尾和 ledger 只修改
idea 文档，不改变已验证的源码、README、测试、包清单或维护文档。
最终准确 implementationRevision 以收尾同步后的最新 whats-next 为准。

本轮目录候选尚未获得准确版本验收，旧 acceptInner 事实仍然保留。
后续 review 修改了 Ideal World，idea 应先返回 preparing；未进入 deployment。

## Review 补充：应用入口消息

根据实现验收 review，[源码模块索引](../../../../../src/README.md) 的应用层改为
每行一个唯一进程入口，不把多个入口合并，也不把一个入口拆成多行。每项明确接收
与发出的进程边界消息和职责限制；消息名称不构成新增 schema 或进程间消息总线。

review 明确否定事件修订／恢复脚本：异常历史应由维护者直接编辑完整 `events/`
folder，再通过 Git review 和 snapshot／event history 校验确认。该决定改变了已
批准的 Ideal World，因此已同步修改 Idea 与 FunctionalDesign，并将相关实施及
验收 ledger 项恢复为未完成。CLI revise／recover 的实际移除须等新 idealRevision
获得明确批准后实施；当前文档只定义目标，不冒充代码已完成。

后续 review 逐项核对三个迁移入口。本仓库全部 42 个 idea 均使用分段 `events/`
folder，没有 `status.yaml`；历史 idea 证据记录内部事件格式迁移及 41 个既有流的
分段迁移已成功完成。`migrate-internal-events` 与 `migrate-segmented-events`
只服务本仓库且不在发布包内，已删除入口、实现、运行时测试、包排除项和 skill
操作指引。`migrate-v1-to-v2` 仍随发布包服务外部 v1 项目，并有运行时、安装态、
打包白名单与参考文档调用方，因此保留。

基础层 review 进一步发现原“Git 与快照”“事件协议与存储”“命令消息与报告”
“输出与终端”“观测与进程 I/O”等能力桶仍有多个变化原因。[源码模块索引]
(../../../../../src/README.md) 现为每个目标基础模块提供英文项目名、当前迁移
来源、单一职责能力边界和明确排除项；FunctionalDesign 固化同一组 29 个目标名，
并明确原 A–L 只组织接口讨论，不是宽泛物理模块。该部分仍是待批准和实施的目标，
不声明当前目录已经完成拆分。

后续 review 固定三层物理结构：应用层统一为 `bin/` 且每入口一个完整文件；
业务层统一为 `src/business/` 且每业务入口函数一个文件，共享函数进入
`src/business/shared/` 后仍一函数一文件；基础层每模块独占
`src/foundation/<module>/`。基础模块 README 除职责和依赖边界外，还必须逐项解释
公开 index 的关键函数。现有 `scripts/`、`src/application/` 和顶层基础目录是待
迁移来源，不被目标文档描述为已经完成。

观察 review 将共享观察固定为 `observeDevice` → `observeProject` → `observeIdea`。
device 当前只包含运行来源、全局安装及全局配置的存在／有效性；源码 checkout
不需要伪装成全局安装。project 和 idea 显式消费下一层结果，不通过 Context 重读。
基础层相应增加单一职责的 `installation` 与 `device-config`，替换含义过窄的
`preferences`。daemon 进程与通信事实明确留待 daemon 模式的独立契约。

根 README 因承担详细架构索引而不再沿用普通模块 README 的 100 行上限；普通模块
仍保持 45 行限制，根索引保留 180 行明确上限。以下针对性验证已通过：

| 实际命令 | 结果 |
| --- | --- |
| `pnpm lint:markdown src/README.md` | 通过，Markdown 无问题 |
| `node --test --test-name-pattern "every source directory has a concise responsibility README|target architecture diagram" test/contract/functional-boundaries.test.js` | 通过，2 项均通过；覆盖三层目录、一入口／函数一文件、基础模块 README 关键 export 说明，以及 device→project→idea 观察顺序和 daemon 范围边界 |
| `git diff --check` | 通过 |
| `node bin/silvermoon.js check --worktree --audience agent` | 通过，本次候选元数据有效 |
| 初次 `pnpm check:sanity` | 未通过；Windows source key 与相对 import 使用不同分隔符，导致 2 个 pure-check fixture 无法识别已标注 helper，并将 `projectActions` 的局部 record 误判为外部 mutation |
| `node --test test/unit/pure-check.test.mjs` | 修复路径规范化后通过，8 项全部通过；新增 Windows source path 回归用例 |
| `pnpm check:pure` | 通过，144 个纯函数、14 个规则模块 |
| `node --test test/contract/functional-boundaries.test.js` | 通过，8 项全部通过 |
| `node --test test/runtime/event-state.test.js test/runtime/cursor-events.test.js test/runtime/event-v2-interaction.test.js test/contract/functional-boundaries.test.js` | 外部 v1→v2 迁移相关用例全部通过；其中旧 pure-check 误报已由上述路径规范化修复 |
| `pnpm check:skills:local` | 通过，canonical 与 registered skill 的 3 个文件一致 |
| `pnpm pack:check` | 通过，发布包 134 个准确文件，外部 v1→v2 入口仍在 |
| 初次 `pnpm check` | 未通过；Markdown、pack 和完整 skill discovery gate 通过。pure-check 的 Windows 路径问题随后已修复；integration 另有 1 个 worktree-root 断言和 2 个 Windows symlink `EPERM`；安装态 E2E 在 npm install 处 `ETIMEDOUT`。这些失败均未指向已删除的 source-only 迁移；外部 v1→v2 针对性运行时用例及 package dry-run 已单独通过 |

先验证、同步并请求新 idealRevision 审批；获批后才可继续实现和重新运行完整
release-grade check、提交前检查及准确候选元数据检查。此前记录的完整检查只证明
上一候选，不冒充本次 review 修改后的准确版本证据。
