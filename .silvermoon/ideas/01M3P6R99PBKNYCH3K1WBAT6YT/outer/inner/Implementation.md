# Implementation

## Steps

### I-S01: Replace fixed setup instructions with Agent navigation

Rewrite both README Quick Start sections around one project-Agent entry point:
`npx silvermoon whats-next`. Tell the Agent to follow the current report,
preserve existing work, and repeat after observable changes until the default
output reports `navigation-ready`. Remove fixed dependency, package-manager,
skill-registration, and snapshot-check setup recipes from those sections.

### I-S02: Expose navigation readiness in default output

Include the exact `navigation-ready` state in the localized response summary
for successful bare `whats-next` navigation. Keep the four-projection JSON
shape and the observation state unchanged; the human renderer continues to
render only the self-contained response.

### I-S03: Protect the workflow with regression coverage and issue traceability

Add English and Chinese regression assertions for the visible readiness state
and the Agent-guided Quick Start boundary. Keep the CLI-output problem linked
to [GitHub issue #1](https://github.com/shazhou-ww/silvermoon/issues/1).

## Acceptance criteria

### I-AC01: Quick Starts delegate setup to the project Agent

`README.md` and `README.zh-CN.md` use `npx silvermoon whats-next`, require the
exact visible `navigation-ready` state, and omit fixed install and registration
recipes. The documentation contract test proves the required phrases and
excluded details in both sections.

### I-AC02: Human-readable readiness matches the observation

For English and Chinese bare navigation, default output contains the exact
`navigation-ready` value while `observation.state` remains
`navigation-ready`. Unit and integration tests prove the localized rendered
text and the unchanged structured observation.

### I-AC03: The output gap remains jointly trackable

GitHub issue #1 remains linked from this implementation contract and describes
the missing human-readable readiness state. Its URL and open state can be
verified with the GitHub issue API or CLI.

### I-AC04: Repository validation passes

The complete `pnpm check` suite succeeds for the implementation candidate,
including unit, integration, contract, end-to-end, skill, Markdown, and package
checks.
