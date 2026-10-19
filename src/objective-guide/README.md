# Objective Pilot exports

This module re-exports the functional Objective runtime from
`@potential-guide/objective-pilot` `0.1.0-rc.0` and the `startEffect` bridge
from `@potential-guide/effects` `0.1.0-rc.0`.

`loadPilotSpec(uri, resources)` loads immutable, serializable specification
data. `observe(input, runtime)` constructs one native Effect; it does not start
checks. Call `startEffect(effect, signal)` to obtain a `RunningEffect`, then
`await()` its envelope or use `cancel()`/`exit()` for interruption and cleanup.

Documentation is pure data access through `readPage`, `searchPages`, and
`describeLevels`. Check bindings are supplied separately through
`PilotRuntime.resolveCheck`; use memory, HTTP, or process CheckProbes. Every
probe returns `{ status, payload, message }`. Business problems use status 200
with `payload.ok === false`; invocation faults use a non-200 status and a null
payload.

Production observations require a stable `git+` Objective URI and an exact Git
commit version. Static file resources remain useful for validation but cannot
be observed. Silvermoon's bundled Objectives use stable repository URIs,
package-contained resources from one pinned source commit, and memory probes
bound to current business observations.
