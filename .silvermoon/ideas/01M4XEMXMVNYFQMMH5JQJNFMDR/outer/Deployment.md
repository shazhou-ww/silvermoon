# Deployment

## Steps

### D-S01: 采集完整 Objective corpus

在隔离环境重跑三种 Objectives 的 blocked、terminal 和特殊交互场景。

### D-S02: 发布统一报告语义

更新 CLI/reference 文档和迁移说明，描述位置、guidance、上下文与详情查询。

## Acceptance criteria

### D-AC01: 双语报告完成评审

最终 corpus 覆盖全部可达 check/problem 分支，en-US/zh-CN 无待处理意见。

### D-AC02: Release-grade 检查通过

构建、package、contract、integration 与完整 release 检查全部通过。
