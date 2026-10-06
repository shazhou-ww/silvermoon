# process

Execute controlled subprocesses and return stdout, stderr, and exit facts.

## Capability boundary

- Allowed dependencies: trace.
- Does not own: Git semantics, error swallowing, and business policy.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `runSubprocess`: executes one process using explicit command, args, cwd, and input.
- `npmCommand`: resolves the platform-specific npm executable and arguments.
