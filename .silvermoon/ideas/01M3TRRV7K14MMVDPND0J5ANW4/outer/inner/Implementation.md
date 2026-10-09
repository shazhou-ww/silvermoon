# Implementation

## Steps

### I-S01: 升级 Commander 并锁定 CLI 兼容行为

将 `commander` 升级到 v15，并把项目 Node.js 引擎下限与其
`>=22.12.0` 要求对齐。补充 CLI 回归场景，覆盖 options 绑定、冲突选项、
无效参数、过量位置参数及源码与安装包入口，保持既有退出码和错误输出契约。

### I-S02: 固化 OpenTUI peer 依赖边界

保留 `react-devtools-core` 与 `ws` 为直接 runtime 依赖，不脱离
`@opentui/react` 的 peer 范围升级。增加依赖契约测试，证明项目声明允许的
版本集合是锁文件所记录上游 peer 范围的子集，并保持安装产物具备运行所需依赖。

### I-S03: 评估并决定终端宽度实现

用覆盖 ASCII、CJK、ANSI、emoji、组合字符和制表符的同一语料比较
`string-width` 与 `fast-string-width` 的语义和性能。将方法、数据、来源与
决策记录在同世界辅助证据中；只有语义兼容且收益对实际表格路径有意义时才替换，
否则保留 `string-width` 并加强关键对齐回归。

## Acceptance criteria

### I-AC01: Commander v15 在支持的运行时保持 CLI 契约

`package.json` 与锁文件解析到 Commander v15，项目引擎不允许低于
Node.js 22.12；定向 CLI 测试证明正常 options 绑定和各类 usage error
仍返回预期结果，源码与打包安装入口均通过。

### I-AC02: OpenTUI peers 始终落在上游支持范围内

依赖契约测试从项目 manifest 与锁文件读取实际范围，并证明
`react-devtools-core`、`ws` 的直接声明均为 `@opentui/react` peer 范围的
子集；冻结锁文件安装与发布级检查证明依赖图可复现。

### I-AC03: 宽度库决策同时具备语义与性能证据

同世界证据文件保留可复核的版本、环境、语料、基准样本和决策；终端表格测试
证明所选实现对 CJK、ANSI、emoji、组合字符及制表符保持稳定宽度，
`pnpm check` 全部通过。
