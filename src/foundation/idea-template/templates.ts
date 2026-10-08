export const IDEA_TEMPLATE = `# Replace with a concise action-oriented title

<!--
Keep this direction card brief: aim for 200-400 words.
Link existing detail instead of copying it. Add detail only when a concrete
decision, risk, or disagreement requires it.
-->

## Problem

<!-- State the current problem in one or two sentences. -->

## Outcome

<!-- State the externally meaningful change in one or two sentences. -->

## Boundaries

<!-- List one to three material constraints or explicit exclusions. -->

## Acceptance criteria

<!-- List no more than three observable outcomes. Do not describe implementation steps. -->

## Next step

<!-- Keep only the highest-priority preparation action or decision. Remove it before approval. -->
`;

export const IMPLEMENTATION_TEMPLATE = `# Implementation

## Steps

<!--
Give every step a stable I-Sxx identifier and a level-three heading.
Start with no more than three steps. Add another only for independently
necessary work. Describe what changes now and its material boundaries without
repeating the idea or anticipating deployment.
Do not use task-list checkboxes in this document.
-->

### I-S01: Step title

<!-- Describe this implementation step. -->

## Acceptance criteria

<!--
Give every criterion a stable I-ACxx identifier and a level-three heading.
Start with no more than three criteria. Add another only when it requires
independent proof.
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
Start with no more than three steps. Add another only for independently
necessary external work. Describe deployment or external-world verification
without recapping implementation.
Do not use task-list checkboxes in this document.
-->

### D-S01: Step title

<!-- Describe this deployment or external-verification step. -->

## Acceptance criteria

<!--
Give every criterion a stable D-ACxx identifier and a level-three heading.
Start with no more than three criteria. Add another only when it requires
independent external proof.
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

const CHINESE_IDEA_TEMPLATE = `# 将标题替换为简洁的“动作 + 目标”

<!--
把本文档保持为轻量方向卡，默认控制在 200-400 字。
已有细节用链接引用，不要复制。只有真实出现的决策、风险或分歧才值得增加内容。
-->

## 问题

<!-- 用一两句话说明当前问题。 -->

## 结果

<!-- 用一两句话说明应当实现的、对外有意义的变化。 -->

## 边界

<!-- 列出一至三条重要约束或明确排除项。 -->

## 验收标准

<!-- 最多列出三条可观察结果，不要描述实现步骤。 -->

## 下一步

<!-- 只保留当前最高优先级的准备动作或决定；批准前删除本节。 -->
`;

const CHINESE_IMPLEMENTATION_TEMPLATE = `# Implementation

## Steps

<!--
为每个步骤分配稳定的 I-Sxx 标识符和三级标题。
先写不超过三个步骤；只有存在必须独立完成的工作时才增加。
说明当前修改及其重要边界，不要复述 idea，也不要提前描述部署。
不要在本文档中使用任务列表复选框。
-->

### I-S01: 步骤标题

<!-- 描述该实施步骤。 -->

## Acceptance criteria

<!--
为每项标准分配稳定的 I-ACxx 标识符和三级标题。
先写不超过三项标准；只有需要独立证明时才增加。
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
先写不超过三个步骤；只有存在必须独立完成的外部工作时才增加。
描述部署或现实世界验证，不要复述实现过程。
不要在本文档中使用任务列表复选框。
-->

### D-S01: 步骤标题

<!-- 描述该部署或外部验证步骤。 -->

## Acceptance criteria

<!--
为每项标准分配稳定的 D-ACxx 标识符和三级标题。
先写不超过三项标准；只有需要独立的外部证明时才增加。
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
export function ideaTemplates(contentLanguage: string) {
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
