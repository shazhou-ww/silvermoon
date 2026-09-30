# Implementation

## Steps

<!--
为每个步骤分配稳定的 I-Sxx 标识符和三级标题。
说明修改内容、边界和重要设计细节。
不要在本文档中使用任务列表复选框。
-->

### I-S01: 落实开源治理与发布契约

在 ideal approval 后，根据批准的范围细化并执行 repository 文件、workflow、
metadata 与兼容性文档变更；外部 GitHub settings 和实际发布留在 Deployment。

## Acceptance criteria

<!--
为每项标准分配稳定的 I-ACxx 标识符和三级标题。
同时说明可观察结果及其证明方法。
不要创建单独的验证章节，也不要使用任务列表复选框。
-->

### I-AC01: Repository candidate 满足批准契约

实现候选覆盖批准的 repository-owned requirements，通过相关定向测试、
`pnpm check` 与 Silvermoon snapshot validation，并保留可供 implementation
acceptance 复核的证据。
