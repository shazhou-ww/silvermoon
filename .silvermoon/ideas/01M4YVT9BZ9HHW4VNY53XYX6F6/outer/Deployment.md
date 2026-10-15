# Deployment

## Steps

### D-S01: 验证全局运行时输出

以本 checkout 链接的设备级全局运行时执行代表性 Device 报告和其中的紧凑 Reference 命令。

### D-S02: 完成发布级仓库验证

运行仓库要求的完整 release-grade 检查，并确认候选通过普通非强制 Git 流程同步到 primary。

## Acceptance criteria

### D-AC01: 真实命令可用

全局 `silvermoon` 的代表性 en-US/zh-CN Device 输出使用预期默认集合与紧凑形态，复制执行其中命令可成功打开对应页面；以实际 CLI 输出证明。

### D-AC02: 发布门禁通过

完整仓库验证无失败，且承载候选的提交可从刷新后的 `origin/main` 到达；以命令结果和 Git 提交证明。
