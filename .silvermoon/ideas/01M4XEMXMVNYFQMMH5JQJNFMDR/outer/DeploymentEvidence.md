# Deployment evidence

## Objective corpus

- 实现来源：primary `b876ffaf86d0821ef8fe661aecd1d5909edfbd41`
- 隔离方式：从 primary 新建 clean clone，并仅用全局 `silvermoon` 采样。
- 临时 corpus：14 个 Markdown 输出（7 个场景 × `en-US`/`zh-CN`），未提交。
- manifest SHA-256：
  `101e82c1913901e7e5b163452135a2ab14cd3d2f323ae2a4621b2ccecb6ac9a7`

| 场景 | Target / owner | Terminal | 静态 guidance / 详情命令 | Required actions |
| --- | --- | --- | --- | --- |
| `device-blocked` | Device / Device | false | 有 | 有 |
| `device-terminal` | Device / Device | true | 有 | 空 |
| `project-terminal` | Project / Project | true | 有 | 空 |
| `idea-blocked` | Idea / Idea | false | 有 | 有 |
| `idea-terminal` | Idea / Idea | true | 有 | 空 |
| `prerequisite-owner-blocked` | Idea / Project | false | 有 | 有 |
| `idea-not-found` | special component | 不适用 | 不适用 | 空 |

两种 output locale 均完成上述场景。Reference guidance 的 locale 继续由有效
content language 决定；临时 output override 只改变 report chrome。Idea 的
`zh-CN` 样本直接呈现中文 description/content/instruction，内部 Reference
链接已转换为准确的 `silvermoon reference page` 命令。Problem parameters
只出现在“当前位置”，未插入静态 guidance。

Review gate 由 integration contract 和最终 `submitOuter` 后的真实 reobserve
共同验证；保留 `idea-not-found` 与 review template，不恢复 bare
`whats-next` inventory。

## Release validation

| 命令 | 结果 |
| --- | --- |
| `pnpm test:contract` | 60 passed |
| `pnpm test:integration:all` | 160 passed，2 skipped，0 failed |
| `pnpm test:e2e` | packed/install CLI 1 passed |
| `pnpm check` | release tier 全部通过 |
| `pnpm check:skills` | 由 `pnpm check` 执行并通过 |

`pnpm check` 同时通过 typecheck、build、Markdown、purity、unit/runtime、
contract、integration、package contents、packed/install CLI 和 skill
discovery。未发布 npm，也未提交临时 corpus 或隔离 clone。

## Residual risk

Reference content 按 inert Markdown 数据渲染；contract tests 证明 headings
被约束在 blockquote 内，内部链接只转换为复制型 CLI 命令。剩余风险主要是外部
JSON consumers 需读取扩展后的 Reference guidance 字段；schema 与 package
tests 已覆盖该公开形状。
