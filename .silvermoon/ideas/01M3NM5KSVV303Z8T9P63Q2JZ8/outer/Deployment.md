# Deployment

## Steps

### D-S01: 确认 RC 发布前提与显式授权

重新查询 npm versions/dist-tags、Git release tags、`origin/main` 和 package
manifest，确认 `0.2.0-rc.1` 尚未占用、candidate 已通过实现验收且当前 idea
确实处于 deploying。进入部署阶段本身不授权发布；等待用户显式调用
`/publish silvermoon 0.2.0-rc.1`，并严格遵循 repository publish skill。

### D-S02: 发布不可变的 0.2.0 RC

通过 main-reachable `npm/silvermoon/v0.2.0-rc.1` tag 触发受保护 GitHub
Actions trusted-publishing workflow。确认发布的是唯一验证过的 tarball，npm
dist-tag 为 `rc` 而不是 `latest`，并保存 workflow run、registry integrity、
provenance、gitHead、README 与 CDN 验证证据。

### D-S03: 在真实消费者中验证 RC

分别通过精确版本和 `@rc` 安装 published package，覆盖 `whats-next`、
`create-idea`、`check` 及已发布的 `list-ideas`。验证四 projection JSON、
response-only Markdown、空 stderr、expected failures、phase guidance、trace
domain/telemetry channels、action/span correlation、性能数据和敏感内容
redaction。

### D-S04: 处理 RC 缺陷或确认稳定候选

若 RC 暴露缺陷，停止稳定发布，回到 implementing 修复并使用新的
`0.2.0-rc.N`、新 main commit、新 tag 和新 implementation acceptance 重复验证，
绝不移动或覆盖旧版本。RC 全部通过后，将证据记录到 Deployment ledger，并明确
返回 implementing 准备稳定 manifest `0.2.0`；不得在 deploying 中直接修改
repository deliverables。

### D-S05: 重新验收 0.2.0 stable implementation

稳定版本准备必须只包含已经由 RC 验证的功能、必要修复和 release metadata。
发布到 primary 并完成全部检查后，对新的 exact implementation revision 请求
第二次人类验收；只有状态再次进入 deploying，且用户另行显式授权 stable
`/publish`，才继续。

### D-S06: 发布并验证稳定 0.2.0

通过不可变 `npm/silvermoon/v0.2.0` tag 发布到 npm `latest`，重新执行完整
workflow 与 registry verification。随后从全新消费者分别通过 exact version
和默认安装验证 0.2.0，不把 RC 的成功证据当作稳定 tarball 的替代证明。

### D-S07: 请求最终 deployment acceptance

汇总 RC 与 stable 的版本、commit、tag、workflow URL/database ID、registry
integrity、provenance、dist-tag、installed-package 和 trace 证据。确认 0.2.0
为 `latest`、RC 仍不可变且无未解释偏差后，才请求用户验收精确 deployment
revision。

## Acceptance criteria

### D-AC01: RC 在 stable 之前发布且不影响 latest

`silvermoon@0.2.0-rc.1` 或经缺陷循环产生的更高 `rc.N` 由对应不可变 Git tag
发布，npm `rc` 指向已验证 RC，`latest` 在 stable gate 前保持原版本。通过 npm
metadata、Git tag、workflow run 和 registry verification evidence 证明。

### D-AC02: RC 真实验证新的 command runtime

registry 安装的 RC 对全部 public commands 输出统一四 projection JSON，默认
Markdown 只呈现 response，正常路径 stderr 为空。Domain-safe trace events 与
perf spans 在同一有序 JSONL 中可关联，trace on/off 不改变 report。通过 clean
consumer matrix、exact output assertions、trace replay/projection checks 和
performance comparison 证明。

### D-AC03: Phase guidance 与既有安全边界不回归

RC 中 phase guidance、language override、repository readiness、snapshot
validation、create cleanup 和 npm packaging 行为与各自已批准合同一致；custom
content 不覆盖核心协议且不泄露到 trace。通过 hostile guidance、blocked
repository、SHA-1/SHA-256 和 installed-package fixtures 证明。

### D-AC04: RC 失败只产生新的不可变候选

任何 source、manifest、contract、performance 或 external verification defect
都阻止 stable，并通过 main 上的新修复、新 `0.2.0-rc.N` version/tag 和新的
implementation acceptance 处理。既有 npm version、Git tag 和 provenance
从不移动、覆盖或复用。通过版本历史、tag target 和 workflow records 证明。

### D-AC05: Stable candidate 经第二次 implementation gate

RC 验证完成后，manifest 与版本引用更新为 `0.2.0` 的工作发生在重新进入的
implementing 阶段；新 candidate 完成全套 repository validation、发布到 primary
并获得 exact implementation revision 的明确验收。通过 Silvermoon lifecycle
observation、status fact、commit ancestry 和 package metadata 证明。

### D-AC06: Stable 0.2.0 独立发布并完整验证

在显式 stable 发布授权后，`npm/silvermoon/v0.2.0` 从 `origin/main` 可达提交
触发唯一 tarball 发布，npm `latest` 指向 `0.2.0`。Workflow 对 exact tarball、
gitHead、integrity、provenance、README、CDN 和 installed consumer 全部验证
成功；不得只提升 RC dist-tag 或复用 RC 验证结论。

### D-AC07: 最终验收证据完整可追溯

Deployment ledger 包含 RC 与 stable 各自的 immutable identity、workflow 与
registry 证据，以及真实 command/report/trace 验证结果。只有 stable 0.2.0 的
全部条件成立后才请求 deployment acceptance；任一外部等待或授权 gate 均明确
暂停而不伪装完成。
