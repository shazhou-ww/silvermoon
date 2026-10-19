---
title: "Silvermoon 项目 metadata 结构"
description: "项目内 `.silvermoon/` 的最小结构、固定职责和安全创建方式。"
---

## 最小结构

```text
.silvermoon/
├── config.yaml
├── guidance/                 # 可选
│   ├── preparing.md
│   ├── implementing.md
│   └── deploying.md
└── ideas/
    └── <ULID>/               # 由 silvermoon create-idea 创建
        ├── events.jsonl
        ├── ledger.md
        └── outer/
            ├── Deployment.md
            └── inner/
                ├── Implementation.md
                └── ideal/
                    └── Idea.md
```

v1 历史项目的 idea state 文件可能是 `status.yaml`；不要仅通过改版本字段把 v1
手工伪装成 v2。

## Project config

`.silvermoon/config.yaml` 定义共享 primary 和项目内容语言：

```yaml
version: 2
primaryRepository: https://github.com/example/repository.git
primaryBranch: main
preferredLanguage: zh-CN
```

- `primaryRepository` 使用不含凭据的 canonical repository URL。
- `primaryBranch` 是共享 primary branch。
- `preferredLanguage` 可选，使用 canonical BCP 47 tag。
- remote 名称、凭据和 URL rewrite 属于本地 Git 配置，不写入 project config。

## 创建顺序

1. 保留 repository 中已有的未知内容，不覆盖现有 `.silvermoon/`。
2. 创建符合当前 contract 的 `.silvermoon/config.yaml` 和 `ideas/`。
3. 仅在项目确有额外 phase policy 时创建固定 `guidance/` 文件。
4. 使用 `silvermoon create-idea` 创建 idea scaffold；不要手工编造 ULID 或 event
   history。
5. 使用 `silvermoon check --worktree --format markdown` 验证完整候选。
