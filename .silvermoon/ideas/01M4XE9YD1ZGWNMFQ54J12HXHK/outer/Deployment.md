# Deployment

## Steps

### D-S01: 验证公开 Objective API

运行 contract、package tarball 与 installed-package 场景，确认外部消费者可从公开入口读取
Objective position，并由 bundled Guide 得到相同契约。

### D-S02: 发布迁移说明

确认 `docs/objective-guidance.md` 记录旧 observation 字段到位置契约的映射，以及
Problem parameters 仅承载稳定结构化 facts、report prose 独立保留的约束。

## Acceptance criteria

### D-AC01: Package contract 稳定

[`evidence.md`](./evidence.md) 中的 package、contract、installed-package 与
release-grade 检查结果证明导出类型、构建产物和 bundled resources 一致。

### D-AC02: 消费方迁移可验证

[`docs/objective-guidance.md`](../../../../docs/objective-guidance.md) 与测试样例展示
blocked、terminal、prerequisite 和多 Problem 的完整结果；证据索引记录对应验证结果。
