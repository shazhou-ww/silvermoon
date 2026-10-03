export const IDEA_TEMPLATE = `# Replace with a specific title for this idea

## Intent

<!-- State the desired outcome in one or two sentences. -->

## Context

<!-- Describe the current problem, situation, or opportunity. -->

## Desired outcome

<!-- Describe the externally meaningful state that should become true. -->

## Scope

### In scope

<!-- Describe what this idea includes. -->

### Out of scope

<!-- Describe adjacent work this idea intentionally excludes. -->

## Constraints

<!-- Record material product, repository, compatibility, or operational constraints. -->

## Open questions

<!-- Record unresolved decisions. Remove this section when none remain. -->
`;

export const IMPLEMENTATION_TEMPLATE = `# Implementation

## Steps

<!--
Give every step a stable I-Sxx identifier and a level-three heading.
Describe what will change, its boundaries, and important design details.
Do not use task-list checkboxes in this document.
-->

### I-S01: Step title

<!-- Describe this implementation step. -->

## Acceptance criteria

<!--
Give every criterion a stable I-ACxx identifier and a level-three heading.
Describe both the observable outcome and the method that proves it.
Do not create a separate validation section or use task-list checkboxes.
-->

### I-AC01: Criterion title

<!-- Describe the required outcome and how an Agent can prove it. -->
`;

export const DEPLOYMENT_TEMPLATE = `# Deployment

## Steps

<!--
Give every step a stable D-Sxx identifier and a level-three heading.
Describe deployment or external-world verification work.
Do not use task-list checkboxes in this document.
-->

### D-S01: Step title

<!-- Describe this deployment or external-verification step. -->

## Acceptance criteria

<!--
Give every criterion a stable D-ACxx identifier and a level-three heading.
Describe both the observable external outcome and the method that proves it.
Do not create a separate validation section or use task-list checkboxes.
-->

### D-AC01: Criterion title

<!-- Describe the required external outcome and how an Agent can prove it. -->
`;

export const LEDGER_TEMPLATE = `# Ledger

## Implementation

### Implementation steps

- [ ] **I-S01:** Step title

### Implementation acceptance criteria

- [ ] **I-AC01:** Criterion title

## Deployment

### Deployment steps

- [ ] **D-S01:** Step title

### Deployment acceptance criteria

- [ ] **D-AC01:** Criterion title
`;

const CHINESE_IDEA_TEMPLATE = `# 将标题替换为这个 idea 的具体名称

## 意图

<!-- 用一两句话说明期望结果。 -->

## 背景

<!-- 描述当前问题、情境或机会。 -->

## 期望结果

<!-- 描述应当实现的、对外有意义的状态。 -->

## 范围

### 范围内

<!-- 描述这个 idea 包含的内容。 -->

### 范围外

<!-- 描述这个 idea 有意排除的相邻工作。 -->

## 约束

<!-- 记录重要的产品、仓库、兼容性或操作约束。 -->

## 待解决问题

<!-- 记录尚未解决的决定；没有时删除本节。 -->
`;

const CHINESE_IMPLEMENTATION_TEMPLATE = `# Implementation

## Steps

<!--
为每个步骤分配稳定的 I-Sxx 标识符和三级标题。
说明修改内容、边界和重要设计细节。
不要在本文档中使用任务列表复选框。
-->

### I-S01: 步骤标题

<!-- 描述该实施步骤。 -->

## Acceptance criteria

<!--
为每项标准分配稳定的 I-ACxx 标识符和三级标题。
同时说明可观察结果及其证明方法。
不要创建单独的验证章节，也不要使用任务列表复选框。
-->

### I-AC01: 标准标题

<!-- 描述所需结果以及 Agent 如何证明该结果。 -->
`;

const CHINESE_DEPLOYMENT_TEMPLATE = `# Deployment

## Steps

<!--
为每个步骤分配稳定的 D-Sxx 标识符和三级标题。
描述部署或现实世界验证工作。
不要在本文档中使用任务列表复选框。
-->

### D-S01: 步骤标题

<!-- 描述该部署或外部验证步骤。 -->

## Acceptance criteria

<!--
为每项标准分配稳定的 D-ACxx 标识符和三级标题。
同时说明可观察的外部结果及其证明方法。
不要创建单独的验证章节，也不要使用任务列表复选框。
-->

### D-AC01: 标准标题

<!-- 描述所需外部结果以及 Agent 如何证明该结果。 -->
`;

const CHINESE_LEDGER_TEMPLATE = `# Ledger

## Implementation

### Implementation steps

- [ ] **I-S01:** 步骤标题

### Implementation acceptance criteria

- [ ] **I-AC01:** 标准标题

## Deployment

### Deployment steps

- [ ] **D-S01:** 步骤标题

### Deployment acceptance criteria

- [ ] **D-AC01:** 标准标题
`;

/** @pure */
export function ideaTemplates(contentLanguage) {
  const normalized = contentLanguage.toLowerCase();
  if (normalized === "zh" || normalized.startsWith("zh-")) {
    return {
      idea: CHINESE_IDEA_TEMPLATE,
      implementation: CHINESE_IMPLEMENTATION_TEMPLATE,
      deployment: CHINESE_DEPLOYMENT_TEMPLATE,
      ledger: CHINESE_LEDGER_TEMPLATE,
      localized: true,
      templateLanguage: "zh-CN",
    };
  }
  const localized = normalized === "en" || normalized.startsWith("en-");
  return {
    idea: IDEA_TEMPLATE,
    implementation: IMPLEMENTATION_TEMPLATE,
    deployment: DEPLOYMENT_TEMPLATE,
    ledger: LEDGER_TEMPLATE,
    localized,
    templateLanguage: "en-US",
  };
}
