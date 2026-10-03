# CLI adaptation

Adapt Commander arguments, input files, trace options, output selection and
command-specific exit codes. [index.js](./index.js) exports the CLI adapter.

Call application entrypoints; keep lifecycle rules out of the adapter.
Human/agent/JSON and dual-TTY behavior are preserved.

Load the TUI entrypoint only after selecting TUI output. This directory does not
own repository synchronization or business authorization.
