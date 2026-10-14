# Implementation

## Steps

### I-S01: 定义 Reference CLI 契约

确定 Objective selector、Reference ID、search query、language 与 Agent/Human 输出形状。

### I-S02: 实现只读 page/search 用例

复用 Objective loader/resources 读取 bundled Guides，并把内部链接渲染为可导航命令。

### I-S03: 接入 CLI 与验证

增加命令解析、错误映射、双语 contract 测试和 packed-runtime 场景。

## Acceptance criteria

### I-AC01: Page 查询准确

CLI 测试证明每种 namespace、locale、404 和资源错误保持 Guide 语义。

### I-AC02: Search 与链接可导航

测试证明搜索结果和页面内部链接使用稳定 ID，可由下一条命令打开。

### I-AC03: 查询保持只读

Git 与事件快照证明 page/search 不修改 worktree、refs、配置或 lifecycle。
