# Objective Guide Runtime

Silvermoon exports a URI-keyed Objective Guide compatibility facade from its
package root, backed by `@potential-guide/objective-guide` at `0.2.0-rc.1` (Node
`>=22.13.0`). The [module](../src/objective-guide/README.md) observes one ordered objective;
it does not execute repairs, autonomous loops or portfolio scheduling.

## Guide package

A file-based Guide is self-contained:

```text
my-guide/
├── manifest.yaml
├── checks/
│   └── project-valid/
│       └── run.js
└── references/
    ├── system/
    │   ├── overview/
    │   │   ├── en-US.md
    │   │   └── zh-CN.md
    │   └── 404/
    │       ├── en-US.md
    │       └── zh-CN.md
    ├── levels/
    │   ├── unready/
    │   │   ├── en-US.md
    │   │   └── zh-CN.md
    │   └── terminal/
    │       ├── en-US.md
    │       └── zh-CN.md
    ├── checks/
    ├── problems/
    └── pages/
```

The Manifest declares a Draft 2020-12 root-object domain, ordered levels,
canonical languages and an optional immediate prerequisite:

```yaml
schemaVersion: 1
domainSchema:
  type: object
  required: [root]
  properties:
    root:
      type: string
  additionalProperties: false
levels:
  - id: unready
    advancement:
      checks:
        - id: project-valid
          problems:
            - project-invalid
defaultLanguage: en-US
languages: [en-US, zh-CN]
```

Manifest, Reference and check IDs use lowercase kebab case. Each level owns its
declared checks, and each check owns the Problem IDs it may return. Check and
Problem IDs have exactly one parent in a Guide. A prerequisite
projects the current subject with the bounded JSONata profile. It normally
requires prerequisite `terminal`; `minimumLevelId` can instead unlock the
current Guide once the immediate prerequisite reaches that local level:

```yaml
prerequisite:
  manifestUri: ../project/manifest.yaml
  subject: '{"root": root}'
  minimumLevelId: repository-unready
```

Reaching a level means all earlier advancement passed; that level's own checks
need not pass. The composed description prefix includes only prerequisite
levels strictly before the configured minimum.

## References

Every Reference identity is `<namespace>/<id>` and every locale is a leaf
file at:

```text
references/<namespace>/<id>/<language>.md
```

Namespaces are:

- `system/overview` for Guide title, description and overview content;
- `system/404` for the fixed missing-page result;
- `levels/<id>` plus the synthesized `levels/terminal`;
- `checks/<check-id>`;
- `problems/<problem-id>`;
- flat general knowledge under `pages/<page-id>`.

Every declared level, check, and Problem must contain exactly the Manifest
language set. Undeclared pages in those namespaces are rejected, and a check
that returns a Problem outside its declared set fails explicitly. There is no
locale fallback and no Manifest override for the References root, overview,
terminal or 404 identities. Frontmatter carries localized properties, while
the path carries identity:

```markdown
---
title: Repository is not ready
description: The configured primary has not been confirmed.
instruction: Preserve local work and synchronize without rewriting history.
---

See [[pages/repository-synchronization]].
```

Level pages additionally require `outcome`. Problem `instruction` and ordinary
page `description` are optional. Internal links use full Reference IDs.
Missing IDs return `system/404`; malformed resources, dangling links, I/O and
permission errors remain explicit failures.

## Check protocol

Each advancement Check ID maps to:

```text
checks/<check-id>/
```

That directory contains exactly one `run` or `run.*` entry. Other private
resources may coexist. File extensions are informational and never select an
interpreter. Native executables run directly. Text scripts require the limited
portable shebang:

```text
#!/usr/bin/env <interpreter>
```

On POSIX the entry must be executable. On Windows Silvermoon resolves the
declared interpreter from its controlled environment and starts it directly;
it does not use `PATHEXT`, file associations, command strings, pipes or shell
expansion.

The runtime writes one JSON request to stdin:

```json
{
  "protocolVersion": 1,
  "subject": { "root": "/workspace" },
  "probe": { "tempDirectory": "/tmp/silvermoon-probe-..." }
}
```

The check writes exactly one JSON result to stdout:

```json
{
  "pass": false,
  "problems": [
    {
      "id": "project-invalid",
      "parameters": {
        "configurationPath": "/workspace/.silvermoon/config.yaml",
        "issueCodes": ["schema-version-unsupported"]
      }
    }
  ]
}
```

`pass: false` is a normal exit-zero result. Nonzero exit, timeout, invalid or
oversized output, unknown Problem ID and protocol violations are operation
errors. Checks do not receive language and do not return localized text.

## Probe workspace

One public `probe()` invocation creates one temporary workspace. The same
absolute directory is passed through its prerequisite chain and local ordered
checks. Concurrent or later probes receive different directories.

Checks may share expensive observations through agreed relative paths and
formats inside this directory. The runtime treats contents as opaque and
provides no `useState`, `useMemo` or language-specific cache helper. Producers
should write atomically; cache corruption or schema mismatch must fail
explicitly. Absolute paths, traversal and symlink/reparse-point escapes are
invalid. The runtime removes the workspace when probe succeeds, fails or is
cancelled.

## Instances and observations

`createInstance` synchronously validates and snapshots a JSON subject and
resolved language. Expected failures are typed as `invalid-subject`,
`invalid-prerequisite-subject` or `unsupported-language`. Manifest and resource
configuration errors reject `load`; check execution failures reject `probe`.

`describeLevels()` returns the prerequisite prefix, local explicit levels and
one synthesized terminal without exposing numeric indexes. `probe()` runs
checks serially in declaration order. It completes all checks in the current
level, aggregates their Problems in declaration order, and stops before the
next level if any check failed. Silvermoon's compatibility facade retains the
first failing check as `position.failingCheck`, recorded from runner results
within each probe rather than inferred from Problem IDs. Same-level checks
that cannot evaluate guidance because prerequisite observations failed return
an explicit prerequisite Problem; they do not turn missing readiness into
success or throw a navigation defect.
`observation.position` identifies the owning Objective instance, its level,
the failing check (or `null` at terminal), and the complete ordered Problem
list. A prerequisite failure therefore retains the prerequisite as its owner
instead of being relabeled as a local level.

Problems carry stable IDs and structured JSON facts such as paths, revisions,
states and diagnostic codes. Checks do not put localized report prose such as
descriptions, summaries, messages or remediation instructions in parameters.
Read a Problem's localized explanation with:

```ts
const page = await observation.position.owner.readPage(
  `problems/${observation.position.problems[0].id}`,
);
```

Every probe samples again. Observations and probe workspaces are not persistent
state or authorization.

Silvermoon's `whats-next` adapter projects this position without flattening
prerequisite ownership. The Markdown title names the requested target
Objective, and **Current status** states how it relates to the current owner.
**Problems** lists every ordered Problem with a short localized description
and labeled dynamic facts. Raw target/owner, level/check, Problem IDs, and
parameter objects remain in the structured response instead of appearing as
unexplained Markdown fields. **Next action** materializes the current
instruction and recheck command once. **References** then exposes compact,
copyable explicit namespace commands such as
`silvermoon reference check:repository-worktree-clean` for useful check and
Problem pages instead of embedding their full localized content. Nonterminal
Device positions do not include a level page solely because the level exists.
The structured response still retains each Reference projection for
programmatic consumers. Reference knowledge never substitutes for dynamic
Problem parameters. Paths, revisions, branches, and recovery commands remain
facts
from the current invocation. Terminal positions render only **Outcome** and
**References**.

## Loading

`createObjectiveLoader()` uses file resources and executable checks by default.
Canonical Manifest URI is the Guide identity, including concurrent loads;
instances are never cached by subject. Failed loads can be retried.

Applications with virtual URI schemes may explicitly supply both an
`ObjectiveResourceResolver` and `ObjectiveCheckRunner`. This is a transport
adapter boundary, not Manifest check binding: the Manifest still references
only stable Check IDs and keeps no JavaScript module paths.

## Silvermoon scopes

The bundled Device, Project and Idea definitions are complete Guide package
trees: real Manifest YAML, localized Markdown References and one `run.js` per
Check ID. Build and package copy these resources unchanged. Silvermoon's
application adapter prepares its existing business samples in the probe
workspace, then the normal file runner starts the real entry and validates its
JSON result. Device remains advisory; Idea directly composes the cached Project
Guide and currently keeps the default terminal prerequisite barrier. Existing
command reports, language, control and exact revision semantics remain
authoritative.
