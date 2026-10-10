# npm package releases

This repository publishes an allowlisted package through one trusted GitHub
Actions workflow. Stable, named prerelease, and daily canary publications all
use an immutable authorized tag under `npm/`. Daily automation creates its
canary tag only at the exact refreshed `origin/main` commit. The committed
package manifest remains authoritative for the package name and next stable
version line.

The current release mapping is:

| Release key | Package | Directory |
| --- | --- | --- |
| `silvermoon` | `silvermoon` | `.` |

The two routine channels are:

| Channel | Source | npm dist-tag | Version identity |
| --- | --- | --- | --- |
| Stable | Immutable `npm/silvermoon/v<version>` tag | `latest` | Committed manifest version |
| Canary | Automated immutable tag at exact protected `origin/main` head | `canary` | `<next-stable>-canary.<run-number>.g<12-hex-commit>` |

A named tagged prerelease such as `npm/silvermoon/v0.5.0-rc.1` still publishes
with the `rc` dist-tag. Numeric-only prerelease channels are intentionally
rejected. Preparing a candidate or changing the next stable manifest version
does not authorize a stable tag or publication.

## One-time configuration

### npm trusted publisher

In the npm package settings, add a GitHub Actions trusted publisher with these
exact values:

- Organization or user: `shazhou-ww`
- Repository: `silvermoon`
- Workflow filename: `publish-npm.yml`
- Environment: `npm`
- Allowed action: direct `npm publish`

The workflow filename is identity-sensitive on npm. If it changes, update the
npm trusted-publisher configuration before attempting another release. Do not
create an npm automation token or store `NPM_TOKEN` or `NODE_AUTH_TOKEN` in
GitHub secrets; the workflow uses GitHub OIDC with `id-token: write`.

### GitHub environment

Create an environment named `npm`. Its custom deployment policy must allow only
the protected `npm/*/*` tag pattern. Tags are the publication trust boundary
for every channel. Add required reviewers when the repository needs a manual
release approval. The environment does not contain an npm credential.

The npm trusted publisher and the workflow environment name must remain the
same. A mismatch prevents npm from accepting the OIDC identity.

The workflow uses a GitHub-hosted runner, `id-token: write`, Node 24,
`actions/setup-node` with `registry-url: https://registry.npmjs.org`, and a
pinned npm CLI version at or above `11.5.1`. These are source-controlled OIDC
preconditions; do not replace them with a write token.

### Canary tag deploy key

Personal-account repositories cannot grant the default GitHub Actions
integration a repository-ruleset bypass. Create one dedicated Ed25519 deploy
key for this repository, add its public key as a write-enabled repository
deploy key, and store its private key as the repository Actions secret
`NPM_RELEASE_DEPLOY_KEY`. Do not reuse the key in another repository or put it
in the `npm` environment.

Only the canary planning job receives this key, through the pinned
`actions/checkout` SSH configuration. Its only write is the exact derived tag
at the refreshed `origin/main` head. A new deploy-key tag push triggers the
tag-based publication run; if an immutable tag already exists at the expected
commit, the planner uses its ordinary `GITHUB_TOKEN` only to dispatch a
recovery run. Keep this as the repository's only write-enabled deploy key and
rotate it if its private material may have been exposed.

### Tag ruleset

Create an active GitHub tag ruleset targeting `npm/**`. Restrict tag creation,
update, and deletion to the release maintainer and deploy keys. The deploy-key
bypass is required only for the protected canary planner's tag creation;
`main` protection and the exact-head check constrain its source. Do not allow
release tags to be moved after creation. The workflow independently fetches
`origin/main` and rejects a tagged commit that is not reachable from that
refreshed branch. Keep the live ruleset synchronized with
`.github/rulesets/npm-release-tags.json`.

Tag protection is part of the trust boundary: GitHub loads a workflow from the
tagged commit, so only authorized maintainers should be able to create tags in
the release namespace.

## Publish a tagged version

1. Update the selected package's `version` in its committed `package.json`.
2. Run `pnpm install --frozen-lockfile` and `pnpm check` (or `pnpm check:release`).
   Neither validation command publishes a package. The complete check
   includes unit, contract, integration, package contents, installed-package
   E2E, and skill discovery.
3. Merge the version change to `main`; do not tag an unmerged branch or local
   working tree.
4. When the release is a deployment criterion of an active Silvermoon idea,
   record implementation acceptance for the approved current idea revision,
   publish that status-only commit, and require `silvermoon whats-next <idea>` to
   return `deploy-idea`. Never create the release tag while the idea still
   derives `implementing`.
5. Fetch the current primary branch and tags.
6. Create the package-specific tag at `origin/main` and push that exact tag.

For an explicitly authorized `silvermoon@0.2.0-rc.1` release:

```sh
git fetch origin main --tags
git tag npm/silvermoon/v0.2.0-rc.1 origin/main
git push origin refs/tags/npm/silvermoon/v0.2.0-rc.1
```

The tag version must exactly equal [`package.json`](../package.json). The
workflow never edits a manifest or chooses a version.

The [`publish-npm.yml`](../.github/workflows/publish-npm.yml) workflow then:

1. verifies the tagged commit is reachable from refreshed `origin/main`;
2. installs the frozen pnpm dependencies;
3. runs the allowlisted release planner and confirms the version is absent
   from npm, or records that an exact-version rerun must skip publication;
4. runs `pnpm test:unit`, `pnpm test:contract`, `pnpm test:integration:all`, and
   `pnpm check:skills`, Markdown/whitespace and checked-out Silvermoon snapshot
   validation, all unconditionally;
5. creates an isolated `git archive` staging tree and generates commit-pinned
   English and Chinese package READMEs without changing the tagged checkout;
   the repository READMEs use canonical `./assets/...` image paths so branch,
   pull-request, and local previews show the current checkout, while staging
   converts those images to release-commit-pinned jsDelivr URLs and converts
   ordinary relative document links to commit-pinned GitHub blob URLs;
   repository artwork remains available at those immutable URLs but is
   excluded from the npm tarball;
6. records the tagged commit as `gitHead` and the canonical `README.md` content
   in the isolated package manifest, creates one tarball, records its path,
   SHA-256, npm shasum, registry integrity, and complete file list, then passes
   that same file to `npm run pack:check` and `npm run test:e2e`; the
   pre-publication check requires the tarball manifest to contain that exact
   commit and README metadata and requires a fresh directory pack to be
   byte-identical;
7. publishes the unchanged staged directory with provenance and the derived npm
   dist-tag when the version was absent, allowing npm to include the
   package-level README metadata while the deterministic pack check and post-publication
   verifier guarantee the registry tarball matches the candidate bytes; and
8. runs `verify-npm-release.ts` until the registry is consistent or the
   bounded retry window expires.

The post-publication verifier requires the exact version and dist-tag, matching
tarball and registry `gitHead`, registry integrity and tarball bytes, both
tarball READMEs, MIT license, homepage, bugs and repository metadata, npm
publish and SLSA provenance attestations, tagged Git commit, and commit-pinned
jsDelivr SVG responses to match the candidate.
README generation rejects traversal, non-canonical paths, and relative resources
outside the approved `./assets/...` image namespace rather than guessing a
published destination.
Releases on the `latest` dist-tag additionally require npm's package-level
README to match the candidate; prerelease channels leave that `latest` package
page state unchanged. A successful run prints `VERIFY_NPM_RELEASE_OK` with the
verified identities.

Release runs are serialized within this repository. The registry preflight and
`npm publish` cannot form one cross-system transaction, so an external
publisher could still win that interval; npm then atomically rejects the
duplicate publication without replacing the existing version.

## Publish the canary channel

The same trusted workflow runs every day at `02:00 UTC` and supports manual
dispatch from `main`:

```sh
gh workflow run publish-npm.yml --ref main
```

Canary planning requires the scheduled or manually dispatched workflow commit
to equal the refreshed `origin/main` head. The committed manifest must contain
a stable canonical SemVer for the next intended stable line. For a `0.5.0`
manifest, workflow run `42` at commit `0123456789abcdef...` derives:

```text
silvermoon@0.5.0-canary.42.g0123456789ab
```

The planning job creates the immutable
`npm/silvermoon/v0.5.0-canary.42.g0123456789ab` tag at that exact commit and
its deploy-key push triggers the same workflow from the tag. If that exact tag
already exists after an interrupted run, the planner explicitly dispatches it
instead. The derived version is written only into the isolated package staging
tree. The workflow does not make a version commit, move `latest`, or create a
daily GitHub Release. It runs the same build, unit, contract, integration,
skill, tarball, installed-package, provenance, and post-publication
verification gates as a stable release.

If npm's current `canary` dist-tag already has the same `gitHead`, a later
scheduled or manual run records an unchanged canary and creates no tag.
Rerunning a workflow that already published its exact derived version reuses
the existing immutable tag, rebuilds, and verifies the same candidate without
publishing again. Once the stable base version itself exists on npm, canary
planning fails until the committed manifest advances to the next intended
stable line.

Canary use is explicit:

```sh
npm install --global silvermoon@canary
silvermoon-link-skill
```

Return to the stable channel with:

```sh
npm install --global silvermoon@latest
silvermoon-link-skill
```

An installed canary checks freshness against npm's `canary` dist-tag rather
than `latest`. Because a canary may contain schema behavior that an older
stable runtime does not understand, use it on development repositories unless
the project has explicitly accepted that compatibility boundary.

To promote a tested line, prepare release notes, run the complete release
gate, merge any release-only metadata to `main`, and create the ordinary
immutable stable tag. Publishing `0.5.0-canary.*` never authorizes or
automatically publishes `0.5.0` to `latest`.

### GitHub Release

Prepare release notes in the repository before creating the immutable tag.
After the trusted-publishing workflow succeeds and its verifier proves the npm
result, create the GitHub Release from the already-existing tag. For `0.4.0`:

```sh
gh release create npm/silvermoon/v0.4.0 \
  --verify-tag \
  --title "Silvermoon 0.4.0" \
  --notes-file .github/release-notes/0.4.0.md
```

Do not let a release command create, move, or replace the tag. The GitHub
Release, npm version, provenance, changelog, and release notes must resolve to
the same commit before deployment acceptance.

## Failure behavior

Publication stops before `npm publish` when the tag is malformed, the release
key is unknown, the package is private, the package name or version differs
from the mapping and tag, the npm publish configuration is not public npmjs,
the commit is outside `origin/main`, registry state cannot be observed, or
validation fails. If the exact version already exists during a workflow rerun,
the publish step is skipped and the verifier must prove that registry content
is byte-identical to the rebuilt candidate and carries the expected provenance.
The verifier allows roughly five minutes for registry metadata and both npm
attestations to propagate. Any mismatch after that window is a hard failure.

For a transient GitHub or registry failure before publication, rerun the same
workflow run. Do not move or recreate the tag. For a source, manifest, or
validation failure, make a new commit on `main`, choose a new version, and push
a new tag after the fix is merged. npm versions and release tags are immutable.
For a transient verification failure after publication, rerun only the failed
workflow job when GitHub offers that option; the planner recognizes the
existing version, skips `npm publish`, and performs the same complete
verification again.

### 0.4.0 one-time recovery

The immutable `npm/silvermoon/v0.4.0` tag remains the failed original release
instruction and must not be moved, deleted, or recreated. The only authorized
recovery source is the protected `npm/silvermoon-recovery/v0.4.0` tag. Its
commit must descend from the original release commit and be reachable from
`origin/main`.

The workflow maps the exact recovery tag to `npm/silvermoon/v0.4.0` only for
package selection and version validation. It builds and archives the recovery
commit itself; the tarball `gitHead`, generated README links, npm provenance
source, post-publication verifier, and GitHub Release all use the actual
recovery tag and commit. Do not override `GITHUB_REF`, `GITHUB_SHA`, or any
provenance environment value.

After the trusted-publishing workflow and verifier succeed, create the
`0.4.0` GitHub Release from the recovery tag:

```sh
gh release create npm/silvermoon-recovery/v0.4.0 \
  --verify-tag \
  --title "Silvermoon 0.4.0" \
  --notes-file .github/release-notes/0.4.0.md
```

This is a one-time recovery for an unpublished version, not a second general
release key. Future source, manifest, or validation failures still require a
new version.

## Add another package

1. Give the package a committed canonical `name`, SemVer `version`, and
   `publishConfig` with `access: public` and registry
   `https://registry.npmjs.org/`.
2. Add a fixed release-key entry to `RELEASE_PACKAGES` in
   [`prepare-npm-release.ts`](../bin/prepare-npm-release.ts). Never derive
   a filesystem path directly from tag text.
3. Extend the release tests with the package selection, identity, version, and
   dist-tag cases.
4. Add the same `publish-npm.yml` trusted publisher to that npm package, using
   the `npm` environment.
5. Keep its tags under the protected `npm/<release-key>/v<semver>` convention.

Run `node --test test/unit/prepare-npm-release.test.ts
test/integration/prepare-npm-release.test.ts
test/contract/npm-release.test.ts` for focused release validation and
`pnpm check` for the complete repository suite before merging the mapping
change.
