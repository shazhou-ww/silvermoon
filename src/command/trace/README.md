# Command tracing

Publish command messages and timing spans through explicit trace sinks/files.
[index.js](./index.js) exposes the existing trace API.

This is an effect boundary used by runtime and repository adapters. Preserve
ordered messages, failure visibility and trace-file ownership.

Trace output is diagnostic, not persistent idea authority or decision evidence.
