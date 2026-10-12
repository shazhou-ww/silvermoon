import type { CheckResult } from "../professional-model/index.ts";

export const WHATS_NEXT_MODEL = `
target:
  root: string
  idea: optional-string
levels:
  - level: 0
    description: Project observation unavailable
  - level: 1
    description: Project ready
  - level: 2
    description: Repository synchronized
  - level: 3
    description: Idea selected with valid phase guidance
  - level: 4
    description: Exact ideal accepted
  - level: 5
    description: Exact implementation accepted
  - level: 6
    description: Exact deployment accepted
checks:
  - [project]
  - [repository]
  - [selection, guidance]
  - [ideal]
  - [inner]
  - [outer]
skills:
  preparation: "Follow skills/silvermoon/SKILL.md#follow-one-report; address reported preparation problems in priority order."
  navigation: "Follow skills/silvermoon/SKILL.md#continue-a-selected-idea; use the exact selected phase and preserve its boundaries."
  acceptance: "Follow skills/silvermoon/SKILL.md#request-focused-review-and-record-decisions; never infer acceptance or reuse a stale revision."
  unknown: "Unknown problem code: inspect the observation and extend the professional guidance before acting."
guidance:
  project: preparation
  repository: preparation
  selection: navigation
  guidance: navigation
  ideal: acceptance
  inner: acceptance
  outer: acceptance
unknown: unknown
`;

export const CHECK_PASSED: CheckResult = Object.freeze({ passed: true });

export function pending(code: string, description: string): CheckResult {
  return { passed: false, problems: [{ code, description }] };
}
