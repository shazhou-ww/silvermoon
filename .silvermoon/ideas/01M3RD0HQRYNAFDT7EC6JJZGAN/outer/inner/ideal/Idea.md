# 完善 Silvermoon 的开源项目治理与发布契约

## 意图

在已经具备 MIT 许可、基础社区文件、跨平台 CI 与可信 npm 发布链路的基础上，
补齐面向外部贡献者和使用者仍然缺失的治理、安全、兼容性与发布承诺，使
Silvermoon 能够作为一个边界清晰、可验证、可持续维护的开源项目对外发布。

## 背景

提交 `177c89ba0bab7f2d18e94e936208703cc34d4fb8` 已经增加最小版
`CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`SECURITY.md`、`SUPPORT.md`、
`CHANGELOG.md`、Issue/PR 模板，并从 npm tarball 中排除 repository artwork。
这些已经完成的 baseline 不需要在本 idea 中重复实现。

剩余差距主要位于 repository 文件之外或跨越多个发布表面：

- GitHub private vulnerability reporting、Dependabot security updates 与
  CodeQL 尚未启用；
- `main` 还没有防止删除、force push 或未经验证变更的 branch ruleset；
- GitHub Actions 依赖仍使用 movable version tag，缺少自动更新约定；
- npm package 的 homepage、bugs、维护者信息与公开 JavaScript API 稳定性承诺
  仍依赖推断或没有明确说明；
- `0.3.0` 需要完整 changelog、GitHub Release、MIT package metadata 与发布后
  证据，当前 npm `0.2.2` 的历史 metadata 不回写；
- 已提交的 community files 仍需在 GitHub 公共表面确认被正确识别。

## 期望结果

Silvermoon 的 repository、npm package 与 GitHub 公共表面共同表达一套一致的
开源项目契约：

- 外部贡献者能找到贡献、安全、支持、行为准则、变更记录和发布说明；
- 未公开漏洞有可用的私密报告入口，依赖漏洞和代码扫描有持续自动化；
- primary branch 与 npm release tag 都有与现有协作方式兼容的防误操作保护；
- workflow dependencies 使用不可变引用，并由受控自动化提出升级；
- npm metadata 明确指向项目主页、问题入口和维护主体；
- 当前公开 JavaScript API 在 `1.0` 前被明确标记为 experimental，不让用户误以为
  已有未声明的长期兼容承诺；正式类型与稳定 API 留待后续独立设计；
- `0.3.0` 通过现有 trusted-publishing workflow 发布，npm 与 GitHub Release
  展示一致版本、MIT 许可、完整 release notes、provenance 和不可变源码身份；
- 所有 repository settings 与发布结果都有可复核的 durable evidence。

## 范围

### 范围内

- 启用并验证 GitHub private vulnerability reporting、Dependabot security
  updates 与 CodeQL default setup。
- 增加最小 Dependabot 配置，覆盖 npm dependencies 与 GitHub Actions。
- 为 `main` 配置 branch ruleset，至少禁止删除和 force push，并让必需 CI、
  maintainer bypass 与现有非 force synchronization 路径保持一致。
- 将 GitHub Actions dependencies 固定到完整 commit SHA，并保留可读版本说明。
- 在 `package.json` 中显式维护 homepage、bugs 与 contributors/maintainer
  metadata。
- 在 reader documentation 中说明根 package export 的 pre-1.0 experimental
  状态与兼容性边界。
- 补全 `0.3.0` changelog 和 GitHub Release；通过既有 npm workflow 发布并验证
  MIT metadata、provenance、README 与 registry identity。
- 核验 GitHub Community Profile、issue chooser、安全入口、branch/tag ruleset、
  code scanning、Dependabot、GitHub Release 与 npm package 的公开呈现。

### 范围外

- 重做提交 `177c89ba0bab7f2d18e94e936208703cc34d4fb8` 已完成的基础社区文件、
  templates 或 npm artwork 排除。
- 追溯修改或重新发布 npm `0.2.2` 及更早版本。
- 删除、替换或重新授权 repository 中的 Silvermoon artwork；图片继续只服务于
  repository 与 commit-pinned online documentation，不进入 npm tarball。
- 在本 idea 中承诺稳定的 `1.0` JavaScript API、设计完整 TypeScript declarations
  或进行大规模 API 重构。
- 引入 CLA、复杂多维护者治理、赞助、CITATION、Wiki、Discussions 或 roadmap。
- 本地执行 `npm publish`、保存 npm token，或绕过现有 trusted-publishing
  workflow。

## 约束

- 保持现有 CLI、schema、Agent Skill、Git 协作语义和 Node.js 22+ 支持不变。
- repository settings 变更必须记录变更前后事实、最终配置和可复核链接或输出；
  不以文档声明代替实际启用。
- `main` 保护不得锁死维护者恢复路径，也不得要求 force push 或重写并发历史。
- Actions SHA pinning 必须保留来源 action 与人类可读版本，升级由 PR 审查。
- `0.3.0` 发布只能使用
  `.github/workflows/publish-npm.yml`、受保护的
  `npm/silvermoon/v0.3.0` immutable tag 和 ordinary non-force Git；实际发布需要
  用户在部署阶段明确授权。
- release notes 必须基于 `0.2.2..0.3.0` 的实际变化，不编造历史记录。
- security、release 和 branch protection 的外部验证失败必须显式阻塞 acceptance，
  不使用成功形状的 fallback。
