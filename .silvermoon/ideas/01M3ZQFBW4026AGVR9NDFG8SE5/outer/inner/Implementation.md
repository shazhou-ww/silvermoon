# Implementation

## Steps

理想契约：[CLI 职责边界与模块化重构](./ideal/Idea.md)。
函数级目标：[函数式职责与关键函数设计](./ideal/FunctionalDesign.md)。
本阶段保持已批准理想世界不变；以 primary 提交
`8ecc40b040d48d9b78ee33a401b140cc2d4d9770` 已验收实现的代码行为为本轮目录
组织基线。保留既有包公共 API、Agent 子路径与源码 CLI 入口，内部按职责模块
目录组织。具体接口以行为等价和依赖检查为准，不照搬草案中的每个函数名。
职责映射、验证结果与限制见 [实施验证证据](./ImplementationEvidence.md)。
目录组织的当前验证见 [模块目录验证证据](./ModuleOrganizationEvidence.md)。
目录调整是在现有 idea 中追加的实施要求，保留先前 acceptInner 事实；更改本契约
会产生新的 implementationRevision，需要重新验证和准确版本验收，不清除旧决定。

### I-S01: 明确职责与兼容边界

列出公共入口与内部职责对应关系，保留五个命令、Agent 子路径、四投影、
内容与输出语言、TTY/TUI、快照、联网和退出码区别。维护同世界验证证据，
不在 ledger 中存放说明。

### I-S02: 分离用例与共享 readiness

公共包入口只导出；检查、查询、导航、创建和事件编排具有独立应用归属。
共享 readiness 不属于导航命令。拆分纯 readiness 判断与事实获取，创建只使用
本地前置条件，查询和本地 check 不引入 fetch 或导航限制。

共享观察实现为 `src/business/shared/observe-device.js`、
`observe-project.js` 和 `observe-idea.js`。三层结果依次显式传递，不共享可变
Context 或重复读取下层。device 当前只接入 `installation` 与 `device-config`
基础模块，报告全局安装／配置事实；不实现或预留 daemon 探测行为。

### I-S03: 分离纯规则与命令运行时及展示

消息 reducer 与报告投影不依赖 trace 或真实 I/O。内部命令运行时采用函数式
闭包组装，保留既有 CommandRun 公共兼容表面、嵌套 action 配对与消息顺序。
结构化 response 与 Markdown 渲染分离；显式时间输入的渲染核心与默认时钟
兼容包装分离。

### I-S04: 分离事件策略规划与仓库写入

事件请求解析、人工 gate 与增量追加规划为纯规则；历史读取、快照验证与追加
写入各有独立归属。移除 revise／recover 命令及专用业务编排；异常历史由维护者
直接编辑完整 `events/` folder，再通过 Git review 与校验确认。创建脚手架规划
与所有权保护写入分离。
保留分段、游标、认证缓存、增量预算及事务前后精确验证，不引入普通写入捷径。

### I-S05: 标注并自动检查纯度与依赖

使用 JSDoc `@pure`，保持业务命名与公共 API。通过现有 TypeScript AST 能力检查
纯规则依赖、外部状态、未确认调用和可识别输入修改；加入正反例及模块依赖测试。
明确静态检查局限，不宣称证明全部动态行为，不添加通用框架或新运行时依赖。

### I-S07: 按模块组织目录与职责 README

将源码收敛为 CLI、应用、idea、命令、持久事件、project、repository、response、
presentation 和既有 Agent 模块。每个源码目录包含简短 README，说明主要职责、
公开入口、允许的依赖和不承担的职责。保持文档与实际目录对应，不另建通用 utils。
根源码索引按唯一进程入口逐行列出应用，逐项说明接收与发出的进程边界消息及
职责限制；不把多个入口合并为一行，不把一个入口拆成多行，不列事件修订／恢复
脚本，并明确这些消息是适配契约而非新增 schema 或进程间消息总线。
保留外部 v1→v2 迁移兼容入口；删除已完成的本仓库内部事件格式与分段格式迁移
入口、实现、运行时测试、包排除项和 skill 操作指引。

基础层按 FunctionalDesign 的英文目标模块命名落地。每个模块 README 声明当前
迁移来源、唯一职责、允许依赖和明确不承担的能力。拆分当前过宽的 repository、
events、project、command／response 与 presentation；不以 facade、共享 Context
或 utils 重新隐藏 Git／snapshot、事件五类规则与存储、两种写入、消息／report、
renderer／terminal／TUI、trace／process 的边界。

应用层整体迁入 `bin/`，每个进程入口只保留一个文件，更新 package scripts、CI、
文档和源码调用方，不保留同入口 launcher。业务层迁入 `src/business/`，每个业务
入口函数一个文件；至少两个入口实际复用的函数才进入 `src/business/shared/`，
且每个共享函数一个文件。基础层每个英文模块独占 `src/foundation/<module>/`，
包含代码、export-only index 和职责 README；README 逐项解释关键公开函数。

每个模块使用仅含显式 export 的 index.js。同目录内部引用具体实现，不绕回
自己的 index；跨模块使用公开入口。混合纯规则与副作用的模块提供独立规则
子入口，避免纯规则经外层 barrel 加载运行时／I/O；TUI 保留惰性加载。
使用模块和入口依赖测试阻止跨模块访问私有实现及循环依赖。

同步调整相对 import、包资源定位、认证缓存源码身份、源码工具、Agent 声明、
严格打包白名单、文档链接和测试。只为模块化修改必要调用路径，不新增产品能力。

### I-S06: 验证同步并准备准确版本验收

逐批运行 sanity 和变更相关测试，最终运行完整 `pnpm check`、worktree 与 staged
元数据检查、`pnpm check:commit`。将准确命令结果和边界证据写入主体世界辅助
文件，通过普通非强制 Git 同步 primary，重新观察准确 implementationRevision
后请求明确人工验收，不自动写入 acceptInner。

## Acceptance criteria

### I-AC01: 职责隔离与函数式核心可检查

公共入口不含用例实现；应用不依赖 CLI/展示/公共入口；纯规则不反向依赖
应用、运行时或真实 I/O。通过 AST 与依赖测试验证，纯规则可在 sanity I/O
隔离中独立测试；@pure 检查有可观察的正反例。

### I-AC02: 命令与调用方行为等价

通过现有完整 unit/runtime、contract、integration 和安装态 E2E 验证公共 API、
Agent 子路径、联网与退出码区别、四投影、language、TTY/TUI 与快照语义。
不修改 schema 或新增功能，保留已批准的全部兼容约束。

### I-AC03: 事件增量与并发写入保护不退化

通过现有分段、游标、认证投影、状态事务和创建竞争测试，保留每段 1000 条、
folder Git digest、准确前缀、离线交互和并发冲突保护。验证 revise／recover
命令及专用编排已移除，直接编辑的异常历史会由 snapshot／event history 校验
接受或明确拒绝。保留已有可测读取预算与冷路径验证，不削弱测试断言。

### I-AC04: 候选证据与准确版本可复核

完整 release-grade check、提交前检查及候选元数据检查通过，证据记录准确命令、
结果与局限，ledger 与稳定 ID 对齐。候选通过普通 Git 同步至 primary 且可达；
重新观察准确版本后停在人工验收门。

### I-AC05: 模块入口与目录职责可复核

每个源码目录有职责 README 和 export-only index，公开符号显式列出。架构测试
验证完整目录覆盖、入口纯度／惰性加载边界、跨模块入口使用和无依赖环。
通过打包及安装态验证确认 README、源码和公共／Agent 入口完整且可用；
纯度与增量 I/O 预算不因目录搬迁失效。结构测试另外验证每个应用入口一个文件、
每个业务入口函数一个文件、shared 中每个共享函数一个文件，以及每个基础模块
独占目录并具有与关键 exports 对齐的 README。
