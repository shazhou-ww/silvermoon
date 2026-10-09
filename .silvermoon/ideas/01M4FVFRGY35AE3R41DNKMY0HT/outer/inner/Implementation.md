# Implementation

## Steps

### I-S01: 建立模板清单与类型契约

盘点 `what's next` 的用户可见文案，为每个逻辑模板分配稳定标识、类型化参数契约和统一的多语言目录结构。

目标文件结构如下；两种语言使用完全相同的模板文件名，实际清单以盘点结果为准：

```text
src/foundation/report/templates/whats-next/
├── index.ts
├── contract.ts
├── registry.ts
├── en-US/
│   ├── project-setup-required.ts
│   ├── phase-guidance-invalid.ts
│   ├── idea-metadata-unavailable.ts
│   ├── worktree-conflicts.ts
│   ├── worktree-changes.ts
│   ├── detached-head.ts
│   ├── primary-upstream-mismatch.ts
│   ├── primary-fetch-failed.ts
│   ├── primary-history-incomplete.ts
│   ├── primary-behind.ts
│   ├── primary-ahead.ts
│   ├── primary-diverged.ts
│   ├── navigation-ready.ts
│   ├── idea-not-found.ts
│   ├── lifecycle-preparing.ts
│   ├── lifecycle-implementing.ts
│   ├── lifecycle-deploying.ts
│   └── lifecycle-inactive.ts
└── zh-CN/
    └── 与 en-US 相同的文件集合

test/
├── unit/whats-next-templates.test.ts
└── contract/whats-next-template-catalog.test.ts
```

`contract.ts` 定义模板标识与参数类型，`registry.ts` 只负责完整注册和语言集合对称性，语言文件各自只导出一个纯模板函数；业务编排继续留在现有业务文件中。

### I-S02: 拆分并接入语言模板

把英文与中文模板分别迁移到一个模板一个文件的语言目录，并让现有业务编排通过模板入口生成文案。

每个模板文件必须以头部注释说明稳定模板标识、进入条件和所属场景。自然语言说明使用该文件对应的语言，机器条件标识在各语言中保持一致；注释只服务审阅，不参与运行时路由。例如：

```ts
/**
 * @template primary-behind
 * @when repository.primaryRelation=behind
 * 已观察 primary，且本地 HEAD 落后于 primary 时使用。
 */
```

### I-S03: 验证覆盖与输出等价

增加模板集合对称性检查和代表性场景回归测试，确认迁移没有改变报告行为或语言选择。

## Acceptance criteria

### I-AC01: 模板集中且职责单一

源码检查证明 `what's next` 的目标文案均位于统一目录，每个文件只实现一个语言下的一个逻辑模板，并具有包含稳定标识和进入条件的头部注释。

### I-AC02: 语言集合保持对称

自动检查证明英文与中文具有相同模板标识和兼容参数接口，删除或遗漏任一实现都会失败。

### I-AC03: 既有输出保持兼容

现有测试与新增场景证明完整命令报告、下一步指示和语言选择在迁移前后保持等价。
