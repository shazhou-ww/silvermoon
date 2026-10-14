# Whats-next objective check review status

三个 bundled objective manifest 中的 check 是 instruction case 的 canonical review
单位。场景集一次性采集完整语料；只有人工明确完成对应 check case 的 review 后，
才能把状态从 `pending` 改为 `reviewed`。review 使用
[review-method.md](./review-method.md) 中定义的真实链路采集、集中 comment、精确
修改和重新采集流程。主链、失败边和报告阶段映射见
[scenario-graph.md](./scenario-graph.md)。

## Device objective

| Check ID | Status |
| --- | --- |
| `device-config-valid` | pending |
| `device-runtime-linked` | pending |
| `device-skill-discoverable` | pending |
| `device-update-current` | pending |

## Project objective

| Check ID | Status |
| --- | --- |
| `project-config-valid` | pending |
| `project-user-config-valid` | pending |
| `project-layout-valid` | pending |
| `project-adopted` | pending |
| `project-schema-ready` | pending |
| `project-guidance-valid` | pending |
| `repository-worktree-clean` | pending |
| `repository-head-present` | pending |
| `repository-upstream-matches` | pending |
| `repository-primary-fetched` | pending |
| `repository-primary-aligned` | pending |
| `repository-event-history-valid` | pending |
| `project-primary-guidance-valid` | pending |

## Idea objective

| Check ID | Status |
| --- | --- |
| `idea-metadata-valid` | pending |
| `idea-contracts-valid` | pending |
| `idea-ideal-submitted` | pending |
| `idea-ideal-accepted` | pending |
| `idea-inner-submitted` | pending |
| `idea-inner-accepted` | pending |
| `idea-outer-submitted` | pending |
| `idea-outer-accepted` | pending |

## 已有模板级 review 事实

以下明确结论属于旧的模板级清单，不自动将任何 objective check 标记为 reviewed：

- `content-language`
- `detached-head`
- `event-history-invalid`
- `head-missing`
- `idea-metadata-unavailable`
