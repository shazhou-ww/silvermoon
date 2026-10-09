# Deployment

## Steps

### D-S01: 验证完整 catalog

运行 release-grade 检查，确认所有 reviewed 模板、索引、renderers、exports 和测试在
发布候选中一致。

### D-S02: 形成最终 review 结果

向维护者提供无 pending 的清单、已确认修正摘要和验证结果，供最终发布判断。

## Acceptance criteria

### D-AC01: Release 检查通过

`pnpm check` 证明完整模板 catalog 可构建、测试、打包并通过发布级检查。

### D-AC02: Review 清单关闭

最终 `review-status.md` 无 pending 项，并可追溯到全部 32 个 template ID。
