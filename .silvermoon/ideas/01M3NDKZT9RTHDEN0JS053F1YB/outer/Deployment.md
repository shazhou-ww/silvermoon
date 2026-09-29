# Deployment

## Steps

### D-S01: 发布明确授权的 Silvermoon 版本

在实现获得验收且用户明确授权版本后，从 `origin/main` 可达提交通过不可变 npm
tag 和受保护 GitHub Actions trusted-publishing workflow 发布包含
`list-ideas` 的 Silvermoon 版本。

### D-S02: 在真实消费者仓库验证 inventory 查询

从 npm registry 安装目标版本，在包含五种 lifecycle state、带/不带 alias 与
标题的消费者仓库中运行默认列表及 state、all、query、时间、排序和 limit
组合，对比 Markdown 与 JSON 的结果、数量和顺序。

### D-S03: 验证离线与非整备 repository 边界

在 dirty、非 primary/detached、无 upstream、ahead/behind/diverged 的消费者
worktree 中禁用网络并运行已发布命令，记录输出、退出码、Git 状态和 remote
访问证据；另对无效配置/layout 与无效参数验证明确失败。

## Acceptance criteria

### D-AC01: npm 安装包公开可用 list-ideas

新消费者从 registry 安装的 CLI help 包含 `list-ideas` 及约定 options，默认
Markdown 与 `--json` 均能形成可信 inventory。通过 registry tarball integrity、
真实安装命令、help snapshot 和 smoke output 证明。

### D-AC02: 已发布查询符合默认与组合语义

五态 fixture 的无参数调用只列 active ideas；state/all/query/time/sort/limit
组合产生与预期完全一致的 matched、returned、truncated、counts 和 item order，
空结果仍退出 `0`。通过真实 CLI matrix 与 JSON assertions 证明。

### D-AC03: repository 未整备不阻止本地 inventory

dirty、任意或 detached branch、无 upstream、本地与 primary 不一致及离线条件
都不改变同一有效 worktree snapshot 的查询结果；命令没有 fetch/network
尝试或 Git/file mutation。通过封锁网络、Git 前后快照和命令审计证明。

### D-AC04: 无效输入与不可信数据不会伪装成功

无效 option 以 exit `2` 在 repository/trace 访问前失败；缺失项目基础或
malformed layout 以 exit `1` 报告准确 problems 且不返回部分 inventory。
无关 conflict 仍可查询，只有冲突内容使 Silvermoon 输入无效时才按对应 problem
失败。通过真实进程的 stdout、stderr、退出码、trace absence 和文件树前后对比
证明。

### D-AC05: 既有工作流在已发布版本中不回归

同一 registry 版本的 `whats-next`、`create-idea` 和各 `check` target 仍通过
installed-package smoke，canonical skill 对 inventory 与 navigation 的使用
边界和实际 CLI 一致。通过消费者 E2E 和 packaged skill 内容校验证明。
