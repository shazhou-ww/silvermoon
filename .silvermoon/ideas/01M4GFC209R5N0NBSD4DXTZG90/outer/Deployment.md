# Deployment

## Steps

### D-S01: 运行完整场景集

在全新 Docker 环境针对最终 revision 重跑主链与全部支链，并执行 release-grade
检查。

### D-S02: 交付最终 review 结果

向维护者提供完整双语输出语料、无 pending 的 review 状态、已确认修正摘要和验证
结果，供最终发布判断。

## Acceptance criteria

### D-AC01: 最终语料完整

最终 revision 的场景运行证明全部输出可从全新环境重现，覆盖检查无缺口。

### D-AC02: Release 检查通过

最终 `review-status.md` 无 pending 项，且 `pnpm check` 通过发布级检查。
