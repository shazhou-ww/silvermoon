# skill-registration

Inspect project adoption and canonical versus registered skill state.

## Capability boundary

- Allowed dependencies: project-config, package-resource, git, and trace.
- Does not own: installing dependencies, synchronizing files, and lifecycle decisions.
- Cross-module callers use [index.js](./index.js); sibling implementations do not import their own index.

## Key exports

- `inspectAdoption`: collects repository setup and skill registration findings.
- `inspectNpmProject`: inspects package-manager and Silvermoon dependency facts.
- `dependencyInstallCommands`: derives explicit package-manager remediation commands.
