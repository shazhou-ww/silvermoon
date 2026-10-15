# Deployment

## Steps

### D-S01: 验证递进 lookup 命令

以本 checkout 链接的设备级全局运行时执行代表性 Device 报告，不指定 Objective 调用 Reference lookup，并验证显式 namespace 可读取单页、无 namespace 搜索可处理唯一和多个结果。

### D-S02: 完成发布级仓库验证

运行仓库要求的完整 release-grade 检查，并确认候选通过普通非强制 Git 流程同步到 primary。

## Acceptance criteria

### D-AC01: 真实命令递归可用

全局 `silvermoon` 的代表性 en-US/zh-CN Device 输出遵循默认选择；不指定 Objective 的显式 namespace lookup 可递归打开对应的 level/check/problem 页面，无 namespace lookup 在唯一命中时自动打开并在多命中时返回列表；以实际 CLI 输出证明。

### D-AC02: 发布门禁通过

完整仓库验证无失败，且承载候选的提交可从刷新后的 `origin/main` 到达；以命令结果和 Git 提交证明。
