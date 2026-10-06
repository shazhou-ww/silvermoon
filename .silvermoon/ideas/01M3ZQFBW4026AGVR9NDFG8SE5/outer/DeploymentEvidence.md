# 部署验证证据

本文件服务于 [Deployment](./Deployment.md)，记录现实世界验证结果，不构成新的
部署契约，不授权 npm 发布。

## 候选与环境

- Deployment contract revision:
  `3df5f49a1bc98c235ed0f340ecc209526c7d3c26`
- Source commit: `114f63cbdb00db29149b103c746ea60bad0dc639`
- Platform: Windows
- Node: `v24.12.0`
- pnpm: `11.22.0`
- npm: `11.6.2`

Deployment 契约已先同步 primary，再执行下列现实世界检查。所有 Silvermoon 命令
使用本 checkout 的 `node bin/silvermoon.js`；没有安装本项目自己的发布包作为源码
runtime，没有发布 npm、创建 release tag 或调用 registry publish。

## 制品与安装

准确构建命令：

```text
node bin/build-npm-tarball.mjs --package-directory . \
  --output-directory <session>/deployment-artifacts \
  --git-head 114f63cbdb00db29149b103c746ea60bad0dc639
```

结果：

- Tarball: `silvermoon-0.3.0.tgz`
- Size: `203143` bytes
- SHA-256: `6e72cbf7b01389b92d174a9aa0e26028f92c1caab3c2cf63e10fc17a73c3c0d1`
- npm shasum: `18eacab3302b62c3ea86071df9f21d0f115a5665`
- Integrity:
  `sha512-+F/rMSrcvpWpP0sWX+kSJjpkXJXUHzQAQfN3wxGcQ7KcKIrvC6D4Hl7g0IX8aB+ftwsuK6l2UzNFunmFucVivQ==`
- Git HEAD: `114f63cbdb00db29149b103c746ea60bad0dc639`

`pnpm pack:check` 通过，严格清单为 177 个文件，directory dry-run integrity 与
tarball 一致。tarball 内 `bin/migrate-v1-to-v2.js` 恰好 1 个；
`migrate-internal-events` 和 `migrate-segmented-events` 均为 0。

## 真实 CLI 与调用方

`pnpm test:e2e` 通过。测试从本地 tarball 安装到新临时 npm 项目，验证 package
metadata、`silvermoon` bin、根 API、`silvermoon/agents/copilot`、
`silvermoon/agents/project-runtime`、外部 v1→v2 迁移及 package resources。

安装态测试通过真实 `npm exec -- silvermoon` 分别运行 `list-ideas` 与
`whats-next`，两者均产生结构化 JSON 报告。安装态 `bin/silvermoon.js` 执行前后
字节完全一致；源码入口为 `i/lf w/lf attr/text eol=lf`。

`node --test test/integration/cli-v1.test.js` 7 项全部通过。trace 包含
`device.observe`、`project.observe`、`idea-layout.inspect`，证明
device→project→idea 观察链；device 实现不包含 daemon 探测。

`event revise` 与 `event recover` 均退出 `2`，并输出：

```text
ERROR usage: Use event replay|append <idea>; append requires --input.
```

## 完整验证结果

| 实际命令 | 结果 |
| --- | --- |
| `pnpm pack:check` | 通过，177 个准确文件 |
| `pnpm test:integration` | 通过，152 项中 147 项通过，5 个真实 Copilot 用例按条件跳过 |
| `pnpm test:e2e` | 通过，隔离 tarball 安装烟测 1 项通过 |
| `node --test test/integration/cli-v1.test.js` | 通过，7 项全部通过 |
| `pnpm check` | 通过，全部 7 个 release-grade gate 完成 |

完整 check 中 unit/runtime 176 项、contract 44 项全部通过；pure check 覆盖
145 个纯函数和 15 个规则模块；skill canonical/registered discovery 通过。

## 限制

本部署只验证本地构建制品和真实安装态行为。没有发布 npm、创建 release tag、
查询或修改 registry、生成 registry provenance，也没有声明生产环境已更新。
5 个真实 Copilot 用例因缺少外部运行条件按既有条件跳过；其本地 adapter 与
project runtime 集成测试已通过。
