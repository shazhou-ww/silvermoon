# Implementation

## Steps

### I-S01: 定义 Reference CLI 契约

定义 `reference page|search` 命令的 Objective selector、稳定 Reference ID、
search query、locale、Markdown/JSON 输出与退出码；命令不接受 repository root，
避免暗示查询依赖项目状态。

### I-S02: 实现只读 page/search 用例

直接复用 bundled Objective loader 的 `readPage`/`searchPages`，不建立第二索引；
缺失 ID 保留 `system/404`，配置与 locale 错误显式失败，并把内部链接渲染为
可复制的 `silvermoon reference page` 命令。

### I-S03: 接入 CLI 与验证

接入 Device、Project、Idea 命令解析和公开文档；用双语 unit/integration
测试及 packed-runtime e2e 证明资源随安装产物可读，且查询不改变 Git 状态。

## Acceptance criteria

### I-AC01: Page 查询准确

unit 与 CLI 测试证明三种 Objective、双 locale、稳定 namespace、404、
unsupported locale 和空 ID 保持 Guide 语义。

### I-AC02: Search 与链接可导航

测试证明 `searchPages` 结果与页面内部链接使用稳定 ID，生成的下一条
`reference page` 命令可准确打开页面。

### I-AC03: 查询保持只读

integration 测试比较命令前后 Git 快照，packed-runtime e2e 从安装产物读取
bundled resources；实现没有 check、remediation、配置或 lifecycle 写入口。
