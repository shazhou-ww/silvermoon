# Functional Objective Pilot runtime

Silvermoon exports the functional Objective Pilot API from its package root. It
uses exact published RCs:

- `@potential-guide/objective-pilot@0.1.0-rc.0`
- `@potential-guide/effects@0.1.0-rc.0`

The runtime observes one ordered Objective. It does not execute repairs,
autonomous loops, or portfolio scheduling.

## Loading and identity

`loadPilotSpec(uri, resources)` returns a serializable `PilotSpec`, not a
stateful Guide instance. The stable Objective identity is a credential-free
`git+` URI with a repository-relative manifest fragment:

```text
git+https://github.com/owner/repository.git#objectives/project/manifest.yaml
```

Its `version` is separate and must be the exact 40- or 64-character commit
whose resources are read. A resolver spanning repositories implements
`versionFor(objectiveId)` so each prerequisite receives its own source commit.
Never label dirty resources as HEAD or copy a root repository version onto
another source.

Static `fileResources` can load and validate working-tree definitions, but
`observe` rejects them. Production observations require stable Git identity and
exact commit provenance.

## One observation

```ts
import {
  loadPilotSpec,
  observe,
  startEffect,
} from "silvermoon";

const spec = await loadPilotSpec(objectiveUri, resources);
const running = startEffect(observe(
  {
    spec,
    subject: { root: "/workspace" },
    language: "en-US",
  },
  {
    resolveCheck: (ref) => probes.get(JSON.stringify(ref)),
  },
), signal);

const envelope = await running.await();
if (envelope.status !== 200 || envelope.payload === null) {
  throw new Error(envelope.message);
}
const observation = envelope.payload;
```

Constructing `observe(...)` does not run a check. `startEffect` starts it.
`RunningEffect.cancel()` requests interruption; `await()` and `exit()` wait for
final completion and cleanup. A cancelled parent signal does not run user
computation. Cancellation is not a business outcome.

`PilotObservation` contains:

- `current: { objectiveId, levelId }`
- fully scoped Problems with Objective, level, check, and Problem IDs
- `gapSummary` and `observedAt`
- a per-Objective source-version map

Business success is represented by check results, not a top-level observation
`ok` flag. An invocation fault has no trusted current level.

## Documentation

Documentation access is stateless:

```ts
const levels = describeLevels(spec);
const page = readPage(spec, "problems/project-invalid", "en-US");
const results = searchPages(spec, "repair", "en-US");
```

Each Reference page has `id`, `title`, `description`, `references`, and
`content`. Missing IDs return `system/404`. Unsupported languages, malformed
resources, and I/O failures remain explicit errors.

Silvermoon retains its existing localized `outcome` and `instruction`
frontmatter as an internal resource interpretation for command rendering. The
public Pilot page model remains the upstream functional model.

## CheckProbe protocol

Use `createMemoryCheckProbe`, `createHttpCheckProbe`, or
`createProcessCheckProbe`, or implement `CheckProbe` directly. All transports
use the same envelope.

Passed business check:

```json
{"status":200,"payload":{"ok":true,"problems":[]},"message":""}
```

Detected business problem:

```json
{"status":200,"payload":{"ok":false,"problems":[{"id":"project-invalid","parameters":{}}]},"message":""}
```

Invocation fault:

```json
{"status":502,"payload":null,"message":"transport: offline"}
```

Process stdin is the subject JSON itself. Stdout contains exactly one envelope;
stderr is the logging side channel. A business problem exits zero. Process
probes own their `.cache/pguide-probes` workspace, timeout, termination, and
cleanup. HTTP cancellation abandons local waiting but does not promise remote
rollback.

## Bundled Silvermoon Objectives

Device, Project, and Idea manifests and localized References remain packaged
assets. Their identities are stable URIs in the Silvermoon repository, while
their version is the exact commit from which those definitions are loaded.
Executable checks are not part of `PilotSpec`; Silvermoon binds current
business observations with memory CheckProbes.

The adapter converts Pilot Problems back into Silvermoon's existing report
projection without dropping owner, level, check, or Problem provenance.
Invocation failures throw explicitly instead of becoming a low-level or empty
successful observation.

## Public API change

The removed stateful surface is not compatibility-wrapped:

- `createObjectiveLoader` and Guide instances are replaced by
  `loadPilotSpec` and `observe`.
- instance documentation methods are replaced by `readPage`, `searchPages`,
  and `describeLevels`.
- the old check runner request and `{ pass }` result are replaced by
  CheckProbe subject stdin and `{ status, payload, message }`.
- Effect construction and execution are separate; cancellation belongs to
  `RunningEffect`.

Consumers should migrate to these functions rather than retaining stateful
instances.
