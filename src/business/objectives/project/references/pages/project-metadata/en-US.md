---
title: "Silvermoon project metadata structure"
description: "The minimum `.silvermoon/` layout, fixed responsibilities, and safe creation procedure."
---

## Minimum layout

```text
.silvermoon/
├── config.yaml
├── guidance/                 # optional
│   ├── preparing.md
│   ├── implementing.md
│   └── deploying.md
└── ideas/
    └── <ULID>/               # created by silvermoon create-idea
        ├── events.jsonl
        ├── ledger.md
        └── outer/
            ├── Deployment.md
            └── inner/
                ├── Implementation.md
                └── ideal/
                    └── Idea.md
```

A historical v1 project may use `status.yaml` for idea state. Do not disguise
v1 as v2 by editing only version fields.

## Project config

`.silvermoon/config.yaml` defines the shared primary and project content
language:

```yaml
version: 2
primaryRepository: https://github.com/example/repository.git
primaryBranch: main
preferredLanguage: en-US
```

- `primaryRepository` is a credential-free canonical repository URL.
- `primaryBranch` is the shared primary branch.
- `preferredLanguage` is optional and uses a canonical BCP 47 tag.
- Remote names, credentials, and URL rewrites remain local Git configuration.

## Creation order

1. Preserve unknown repository content and do not overwrite an existing
   `.silvermoon/`.
2. Create a current-contract `.silvermoon/config.yaml` and `ideas/`.
3. Create fixed `guidance/` files only for actual additional phase policy.
4. Use `silvermoon create-idea` for idea scaffolds; do not invent ULIDs or event
   history manually.
5. Validate the complete candidate with
   `silvermoon check --worktree --format markdown`.
