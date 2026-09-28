# Deployment

## Steps

### D-S01: Establish the exact primary deployment

通过普通 non-force Git 将本 Outer World contract 发布到 configured primary，
重新观测稳定的 deployment revision，并在远端 tip 上证明 performance
implementation 与 implementation acceptance commits 都是 ancestors。

### D-S02: Verify optimized behavior from a clean clone

在独立 clean clone 中 checkout 精确 deployment commit，以 lockfile 安装依赖，
运行 performance-focused integration tests 与 `silvermoon check --remote`。再用
未带 suffix 的 `--trace deployment-proof` 执行真实 `whats-next`，解析生成的
`deployment-proof.trace.jsonl`，验证 layout Git command budget、单次 network
fetch、ignore 状态与无 worktree 污染。

本部署只把 source behavior 集成到 primary；不改变 package version，不创建
`npm/silvermoon/v*` tag，也不触发 npm publish workflow。

## Acceptance criteria

### D-AC01: Primary contains the accepted performance implementation

Configured primary 的精确 tip 必须包含 implementation commit 与 acceptance status
commit。通过 `git ls-remote` 读取远端 tip，并在 clean clone 中使用
`git merge-base --is-ancestor` 对两个 commit 作证明。

### D-AC02: Published source reproduces the optimized observation

Clean clone 必须通过 focused integration tests 和 `check --remote`；真实 trace 中
`idea-layout.inspect` 的 Git command 不超过四个，network Git command 恰好一个
`fetch` 且没有 `ls-remote`。未带 suffix 的 trace 参数必须生成 ignored 的
`.trace.jsonl` 文件，命令后 `git status --porcelain` 仍为空。任何 fetch、安装、
测试、command-budget、命名或 hygiene failure 都阻塞 deployment acceptance。
