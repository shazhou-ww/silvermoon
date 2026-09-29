# 面向 npm 项目的版本对齐整备

## 意图

让 Silvermoon 在保持跨生态可用的同时，对仓库根目录存在 `package.json` 的 npm
生态项目执行更完整的项目整备：要求项目将当前运行时版本对应的
`^<version>` 声明在 `devDependencies.silvermoon`，并提供符合项目包管理器和
workspace 形态的安全修复指令。

## 背景

当前项目整备刻意不检查 `package.json`、package manager、Silvermoon dependency
或 `node_modules`。这纠正了旧 onboarding 把 npm 分发方式错误投射到所有目标
仓库的问题，使 Python、Rust、Go、文档及其他非 Node 项目无需引入 npm 元数据。

但当仓库本身已经是 npm 生态项目时，完全忽略其顶层 manifest 也失去了可复现
工具链的机会。团队可能通过临时 `npx`、全局安装或不同版本运行 Silvermoon，
而仓库只保存一份由某个运行时生成的 canonical skill；新 clone、CI 和其他
Agent 无法从项目依赖中恢复同一工具版本。当前 skill 修复指令还总是引用本次
运行实例的绝对 packaged-skill 路径，没有利用 npm 项目稳定的 project-local
安装位置。

此前的严格 npm onboarding 同时要求 manifest、已安装 `node_modules`、精确
installed version 和 execution source，导致 snapshot 检查与非 npm 项目都受
分发生态约束。本 idea 只恢复 tracked manifest 层面的 npm 专属契约，不恢复
`node_modules` 或调用来源要求。

## 期望结果

Silvermoon 仅以仓库根目录是否存在 `package.json` 判定 npm 生态项目；不扫描
嵌套 workspace package，也不因 lockfile 或 `node_modules` 单独存在而分类。
对这类项目，顶层 manifest 必须可解析，且
`devDependencies.silvermoon` 必须逐字等于当前运行版本对应的
`^<version>`。缺失、位于错误 dependency section 或值不匹配都属于阻塞性的
`project-setup-required` 问题，必须解决后才能导航或创建 idea。

整备报告一次列出所有可独立观察的问题，并根据顶层 `packageManager`、明确且
不冲突的根级 lockfile 及 workspace 形态生成可复制的安装或更新命令。npm 项目
安装后从 `./node_modules/silvermoon/skills` 注册 canonical skill，使依赖声明、
CLI 和 skill 来源形成一条可复现路径；Silvermoon 仍只诊断和指导，不自动修改
manifest、lockfile、skill 或 Git 状态。

没有顶层 `package.json` 的仓库继续无需 package manager、Silvermoon dependency
或 `node_modules`。Silvermoon 源码仓库从当前 checkout 运行时作为明确的自举
例外，不要求软件包依赖自身。所有 snapshot 检查只读取目标快照中的 tracked
文件，不要求临时 worktree 或 clean clone 已安装依赖。

## 范围

### 范围内

- 以仓库顶层 `package.json` 的存在性确定 npm 生态项目；不存在表示非 npm
  项目，存在时显式处理无法读取、非普通文件和无效 JSON。
- 对 npm 项目要求 `devDependencies.silvermoon` 精确写为
  `^<当前运行时版本>`；识别缺失、错误 section、重复声明和版本值不匹配。
- 将 npm 专属 manifest 问题纳入项目整备的完整 problem/instruction 顺序，
  并在未修复时阻止 `whats-next` 与 `create-idea` 进入仓库和 lifecycle 层。
- 优先读取合法的顶层 `packageManager`，其次使用唯一且不冲突的根级 lockfile
  推断 npm、pnpm、Yarn 或 Bun；为普通包和 workspace root 生成适用的
  devDependency 安装/更新指令。
- npm 项目在依赖整备后优先从
  `./node_modules/silvermoon/skills` 注册或更新 canonical skill；非 npm 项目
  继续使用当前运行实例随附的 skill。
- 保持 `check` 的 HEAD、staged、worktree、commit 与 remote snapshot 语义，
  并使诊断内容遵循目标快照而非调用者未跟踪的本机状态。
- 更新 CLI 输出、本地化、canonical skill、adoption/getting-started 文档和
  unit、integration、contract、installed-package E2E 覆盖。

### 范围外

- 要求非 npm 仓库创建 `package.json`、安装 Silvermoon 或拥有 `node_modules`。
- 扫描或修改嵌套 workspace package 的 manifest；项目分类与依赖契约只属于
  repository root。
- 把 `dependencies`、`peerDependencies`、`optionalDependencies`、任意
  SemVer range、workspace/file/git specifier 或仅 lockfile 记录视为满足要求。
- 将 `node_modules`、实际解析版本、execution source 或 lockfile 内容完整性
  作为 snapshot readiness 的硬性要求。
- 自动运行 package manager、编辑 manifest/lockfile、执行 skill 注册、提交或
  推送修复。
- 对 Silvermoon 之外的依赖、package scripts、Node engines、漏洞、license 或
  通用 npm package 健康状况进行检查。
- 新增 `init`、`setup`、`install` 或其他会修改项目的 Silvermoon 命令。

## 约束

- npm 项目分类只由目标 snapshot 根目录的 `package.json` 决定；嵌套 manifest、
  lockfile、当前工作目录之外的文件和本机 `node_modules` 不得改变分类。
- 期望声明由当前运行包的规范 SemVer 确定，格式严格为
  `^<当前运行时版本>` 的实际展开值；错误或无法支持的运行版本必须显式失败，
  不得生成无效依赖 specifier。
- Silvermoon 源码 checkout 自举例外必须通过可靠的 repository/package 身份
  判断，不得仅凭 package 名称放过其他项目。
- 包管理器检测只服务于 remediation。合法 `packageManager` 优先于 lockfile；
  多个冲突 lockfile、未知 manager 或 workspace 语义不明确时不得猜测会改错
  manifest 的命令，应给出明确的人工恢复条件。
- package manager 指令必须将依赖写入 repository-root `devDependencies`，
  处理 workspace-root 所需参数，并显示目标 `^<version>`；不得建议 global
  install、普通 runtime dependency 或不固定运行时基线的 `latest`。
- manifest 要求是 blocking project contract；`node_modules` 和 lockfile
  materialization 不是 snapshot contract。因而 clean clone 和临时 snapshot
  不会仅因未安装依赖而失败。
- 项目整备继续一次报告全部独立 problems，并保持 Git、配置、npm manifest、
  canonical skill 的确定优先级；修复后才重新观察，不隐藏解析、I/O 或命令
  推导错误。
- 所有诊断保持只读；Silvermoon 不因检测到 npm 项目而修改文件、安装包或运行
  package manager。
