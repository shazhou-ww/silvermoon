# Implementation

## Steps

<!--
Give every step a stable I-Sxx identifier and a level-three heading.
Describe what will change, its boundaries, and important design details.
Do not use task-list checkboxes in this document.
-->

### I-S01: Render Active ideas using the list-ideas table style

Update the human-readable `whats-next` renderer to show available active idea
fields in an ID/Alias/State Markdown table following `list-ideas` conventions.
Reuse the shared cell escaping behavior for backslashes, pipes, and line breaks,
and retain an explicit empty-list message under the Active ideas heading.
Preserve summary, counts, selection behavior, next steps, and the existing JSON
report. Add focused regression tests for populated and empty lists, escaped
cells, and unchanged `list-ideas` rendering.

## Acceptance criteria

<!--
Give every criterion a stable I-ACxx identifier and a level-three heading.
Describe both the observable outcome and the method that proves it.
Do not create a separate validation section or use task-list checkboxes.
-->

### I-AC01: Keep navigation output readable and backward compatible

Targeted navigation, response contract, and `list-ideas` integration tests prove
that human-readable Active ideas uses an ID/Alias/State table, handles empty
results and Markdown-special cell content, and retains summary, counts,
selection guidance, next steps, JSON shape, and existing `list-ideas` output.
