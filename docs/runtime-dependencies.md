# OpenTUI Windows compatibility

Silvermoon uses the
[OpenTUI fork](https://github.com/shazhou-ww/opentui/tree/fork/distribution-koffi-2.16.3)
with Koffi 2.16.3, pending
[upstream PR #13](https://github.com/justjake/opentui/pull/13).
Koffi 2.15.6 crashes when OpenTUI attaches a native span feed callback under
Windows Node.js; Koffi 2.16.1 fixed Windows callback stack checking.

The two direct runtime dependencies are fixed-version GitHub release archives,
not root package-manager overrides. This also works for npm installation of the
published Silvermoon package. No dependencies are bundled and no fork npm
publication is required.

The fork repacks the integrity-verified, MIT-licensed
`@jitl/opentui-core@0.4.0` and `@jitl/opentui-react@0.4.0` build artifacts.
Core changes its Koffi pin and package identity, retaining all eight original
platform package dependencies at 0.4.0. React imports and requires a peer at the
same fork version of the canonical `@opentui/core` archive used by Silvermoon
and `tui-md`, avoiding multiple core/Yoga instances.

[Reproduction instructions](https://github.com/shazhou-ww/opentui/blob/07fb0414854bb9f47e944625401aa60bc69a7aab/FORK-DISTRIBUTION.md)
and [release checksums](https://github.com/shazhou-ww/opentui/releases/tag/opentui-0.4.0-koffi-2.16.3-1)
document the build inputs. The lockfile also pins archive integrity.
Do not move the release tag or replace its assets.

When upstream releases the fix, replace both dependencies together and rerun
the dependency policy, Windows TUI and clean npm installed-package tests.
Do not reintroduce a separate `@jitl/opentui-core` runtime instance.

## Windows validation evidence

Validated on Windows x64 with Node.js 24.12.0 and pnpm 11.22.0:

- `pnpm check:sanity`: passed, 204 tests.
- `node --test test\contract\dependency-policy.test.ts test\runtime\tui.test.ts`:
  passed, five tests including all four Windows native TUI regressions.
- `pnpm check`: passed all release checks, including 240 unit/runtime tests,
  60 contract tests, 160 integration tests (two platform skips), package
  verification and the clean npm installed-package test.
- The npm test installs the packed Silvermoon without root overrides, verifies
  one core instance for Silvermoon, React and `tui-md`, verifies Koffi 2.16.3,
  and reruns all four Windows TUI regressions against the installed package.

These are environment-qualified results, not a default-environment full pass.
Use a short **physical** scratch root inside this checkout (here `.g`), not
SUBST: realpath expands SUBST before creating deeply nested Git worktrees.
Git 2.46 on Windows also needs process-local long-path support.
The passing invocation used the following PowerShell environment:

```powershell
$probe = Join-Path (Get-Location) '.g'
$env:TEMP = $probe
$env:TMP = $probe
$env:GIT_CEILING_DIRECTORIES = $probe
$env:GIT_CONFIG_COUNT = '2'
$env:GIT_CONFIG_KEY_0 = 'core.longpaths'
$env:GIT_CONFIG_VALUE_0 = 'true'
$env:GIT_CONFIG_KEY_1 = 'core.excludesfile'
$env:GIT_CONFIG_VALUE_1 = Join-Path (Get-Location) 'node_modules\.validation-koffi\git-excludes'
$env:UV_THREADPOOL_SIZE = '1'
pnpm check:sanity
node --test test\contract\dependency-policy.test.ts test\runtime\tui.test.ts
pnpm check
```

Create `.g` only if absent and remove only that owned scratch directory afterward.
During this run it had a private package boundary without a `type` field and a
local Markdown lint exclusion; the process-local Git excludes file contained
`.g/`, keeping generated fixtures out of snapshots. No global Git configuration
was changed.

`UV_THREADPOOL_SIZE=1` is a diagnostic scheduling workaround for the pre-existing
`overlapping probes of one instance` test's assumed asynchronous completion
order. Without it, the short-root run passed every release component except
that unit test; all integration and installed-package tests already passed.
This dependency fix does not repair or claim to repair that unrelated test.
