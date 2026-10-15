# Deployment

## Steps

### D-S01: 验证递进 lookup 命令

以本 checkout 链接的设备级全局运行时执行代表性 Device 报告，从最外层 objective 调用 Reference lookup，并验证类型路径可打开目标页面。

### D-S02: 完成发布级仓库验证

运行仓库要求的完整 release-grade 检查，并确认候选通过普通非强制 Git 流程同步到 primary。

## Acceptance criteria

### D-AC01: 真实命令递归可用

全局 `silvermoon` 的代表性 en-US/zh-CN Device 输出遵循默认选择；从最外层 objective 发起的 lookup 可递归打开对应的 level/check/problem 页面；以实际 CLI 输出证明。

### D-AC02: 发布门禁通过

完整仓库验证无失败，且承载候选的提交可从刷新后的 `origin/main` 到达；以命令结果和 Git 提交证明。
