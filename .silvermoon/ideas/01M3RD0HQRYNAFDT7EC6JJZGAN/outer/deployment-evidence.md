# Deployment evidence

本文档服务于 `Deployment.md`，记录 GitHub 与 npm 外部结果。它不是第四份 world
contract，也不代表未执行动作已经完成。

## Deployment identity

- Idea: `open-source-readiness`
- ULID: `01M3RD0HQRYNAFDT7EC6JJZGAN`
- Accepted implementation revision:
  `276b88c0c55afa47717991105f67bc768f4aeb38`
- Implementation acceptance commit:
  `794a386f2d3d194bba20a73704a0b3c58d880310`
- Deployment contract commit: 待同步后记录
- Deployment revision: 由同步后的 `whats-next` report 提供；world tree 不记录自己
  的 revision，避免内容寻址自引用

## Active release hold

2026-09-30T14:18:06+08:00，用户明确要求继续非发布 deployment，并说明 README 文案
仍在调整，`0.3.0` 应在该工作完成后一起发布。当前没有
`/publish silvermoon 0.3.0` 授权。

因此在收到后续明确授权前：

- 不创建或推送 `npm/silvermoon/v0.3.0`；
- 不创建 GitHub Release；
- 不触发或绕过 npm trusted-publishing workflow；
- 不本地运行 `npm publish`；
- README 或其他 primary 变更发生后，旧 release preflight 一律失效并重新执行。

此 hold 不阻止已批准的 GitHub security settings、CodeQL、ruleset 与公共表面验证。

## Stable-ID evidence

| Stable ID | 外部结果 | 证明 | 状态 |
| --- | --- | --- | --- |
| `D-AC01` | 外层契约同步且 revision 稳定 | primary commit、Silvermoon checks | 待验证 |
| `D-AC02` | Private reporting 与 Dependabot enabled | GitHub API、advisory/config links | 待部署 |
| `D-AC03` | CodeQL configured 且 analysis 成功 | default-setup API、analysis/run URL | 待部署 |
| `D-AC04` | main/tag rulesets active 且普通同步可用 | ruleset API、push/ancestry | 待部署 |
| `D-AC05` | Community Profile 与入口一致 | Community Profile API、公开 URL | 待验证 |
| `D-AC06` | README/authorization gate 未被绕过 | absence observation、后续授权/preflight | hold 生效 |
| `D-AC07` | `0.3.0` 不可变发布身份一致 | workflow、registry、release、provenance | 等待授权 |
| `D-AC08` | 最终公共开源契约完整 | 本文件、ledger、final diff/checks | 等待前置项 |

## External observations

每次写入遵循“先读、判断、单次写入、立即读回、记录响应”。只保留验证所需字段，不持久化
credential、header 或 token。

### GitHub security and analysis

待外层契约同步后重新观察并记录。

### Repository rulesets

待外层契约同步后重新观察并记录。

### Community surfaces

待外层契约同步后重新观察并记录。

### Release surfaces

当前只验证 absence；实际 release evidence 等待 README 完成和明确授权。

## Failures and recovery

权限不足、API schema 变化、重复同名 ruleset、CodeQL analysis 失败、public surface
不一致或 release identity 不一致都必须在本节记录，并保持对应 ledger item 未完成。
只在根因修复并重新验证后更新状态，不删除历史失败，也不以推断代替外部结果。
