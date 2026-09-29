# Implementation

## Steps

<!--
Give every step a stable I-Sxx identifier and a level-three heading.
Describe what will change, its boundaries, and important design details.
Do not use task-list checkboxes in this document.
-->

### I-S01: Render Active ideas using the list-ideas table style

Update the human-readable `whats-next` renderer to show available active idea
fields in a Markdown table following `list-ideas` conventions. Preserve summary,
counts, empty-list guidance, selection behavior, and the existing JSON report.
Add focused regression tests for populated and empty lists and escaped cells.

## Acceptance criteria

<!--
Give every criterion a stable I-ACxx identifier and a level-three heading.
Describe both the observable outcome and the method that proves it.
Do not create a separate validation section or use task-list checkboxes.
-->

### I-AC01: Keep navigation output readable and backward compatible

Tests prove that human-readable Active ideas uses an ID/Alias/State table,
handles empty results and Markdown-special cell content, and retains summary,
counts, selection guidance, and JSON shape.
