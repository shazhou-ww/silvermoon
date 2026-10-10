# installation

Observe the current runtime identity, personal skill registration, and
latest-release status without inspecting a target project.

## Capability boundary

- Allowed dependencies: process, filesystem and clock primitives plus a
  bounded read from the public npm registry.
- Does not own: runtime installation or upgrades, daemon probing, and project
  inspection.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `inspectInstallation`: finds a global executable and reports runtime source, path, and version facts.
- `classifyRuntimeSource`: classifies an explicit entry path as global,
  source-checkout, or host-managed.
- `inspectPersonalSkill`: verifies personal discovery links against the
  running global package.
- `linkPersonalSkill`: links the installed canonical skill into the universal
  personal discovery path without overwriting a modified registration.
- `inspectRuntimeUpdate`: compares the running package with npm `latest` and
  reuses successful observations for less than 24 hours.
