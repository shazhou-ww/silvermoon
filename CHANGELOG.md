# Changelog

This changelog starts with the Silvermoon 0.3.0 release series. Earlier release
history remains available through npm and Git tags.

## [0.4.0]

### Global runtime boundary

- Uses one device- or host-owned Silvermoon runtime for every target
  repository. Project dependencies, project `node_modules`, and
  repository-local Silvermoon skills no longer select or pin the runtime.
- Reports runtime identity, personal skill-link health, and npm `latest`
  freshness as device advisories. Successful latest checks are cached for less
  than 24 hours, while a future project schema forces an immediate refresh.

### Schema compatibility and migration

- Packages a machine-readable capability manifest for every schema family and
  reports validity and write readiness for each discovered metadata file.
- Keeps valid historical schemas readable for deterministic checks and
  inventory queries, blocks lifecycle writes until migration, and distinguishes
  future-schema update, latest-unsupported, and registry-unavailable outcomes.
- Declares one continuous cross-family migration graph. The existing
  v1-to-v2 transaction is available from the global
  `silvermoon-migrate-v1-to-v2` executable and experimental package router,
  preserving read-only planning, exact digests, resume/rollback, idempotence,
  and semantic projection equivalence.

### Runtime compatibility and packaging

- New projects use project schema version 2. The `0.4.0` runtime continues to
  validate project and idea-state schema versions 1 and 2 and provides the
  explicit v1-to-v2 path without conflating schema versions with package
  SemVer or Git snapshot revisions.
- Keeps the root JavaScript package API experimental before `1.0.0`; consumers
  should pin an exact package version when importing migration discovery or
  dispatch APIs.
- Publishes only through the immutable `npm/silvermoon/v0.4.0` tag and the
  existing GitHub OIDC trusted-publishing workflow with provenance and
  post-publication verification.

## [0.3.0]

### Stable release

- Promotes the validated 0.3.0 release-candidate series to the stable npm
  `latest` channel.
- Adds audience-aware CLI output, independent content/output language
  contracts, localized idea navigation, and layered repository checks for
  coding-agent workflows.
- Publishes the MIT-licensed community, security, contribution, issue, and
  release contracts prepared for the public repository.

### Compatibility and packaging

- Requires Node.js 22 or newer and retains the documented CLI, schema, trace,
  and repository-file compatibility contracts.
- Keeps the root JavaScript package API experimental before `1.0.0`; consumers
  should pin an exact version when using programmatic exports.
- Uses checkout-relative README artwork in the repository and immutable
  release-commit URLs in npm READMEs without shipping artwork in the tarball.
- Includes the rc.2 release verification fix for READMEs that intentionally
  reference only a subset of the repository artwork allowlist.

### Supply-chain safeguards

- Keeps GitHub Actions dependencies pinned to immutable commits with weekly
  Dependabot update PRs.
- Protects `main` through the repository-owned `Required checks` contract and
  protects npm release tags from mutation.
- Publishes only through GitHub OIDC trusted publishing with npm provenance,
  exact tarball identity checks, and post-publication verification.

## [0.3.0-rc.2]

### Release verification fix

- Post-publication verification now accepts generated package READMEs that use
  only a subset of the repository artwork allowlist. It still rejects mutable
  or relative release references and independently verifies every allowlisted
  commit-pinned asset's bytes and media type.

## [0.3.0-rc.1]

### Added

- Audience-aware CLI output for human TTY, human Markdown, and agent Markdown
  surfaces, including copyable TUI selections.
- Content-language contracts, temporary output-language overrides, localized
  active-idea tables, and agent-guided setup prompts.
- Layered sanity, commit, and release validation with conservative package-risk
  selection in ordinary CI.
- MIT licensing, community health documentation, issue and pull-request
  templates, and an explicit security-reporting route.
- Weekly Dependabot updates for npm and GitHub Actions, plus repository-owned
  contracts for CodeQL default setup, security updates, and `main` protection.

### Changed

- Repository READMEs use checkout-relative artwork while published package
  READMEs use release-commit-pinned hosted images; artwork remains outside the
  npm tarball.
- GitHub Actions dependencies are pinned to immutable commits with reviewable
  version comments and Dependabot updates.
- npm metadata now explicitly identifies the project homepage, issue tracker,
  author, contributors, and maintainers.
- The root JavaScript package export is explicitly experimental before
  `1.0.0`; consumers should pin an exact version.
- Validation and integration fixtures are faster while retaining release-grade
  coverage and fail-closed behavior.

### Fixed

- Windows TUI output preserves Unicode, table layout uses terminal cell widths,
  and copy feedback remains in the shortcut row.
- Localized idea counts, sanity-suite boundaries, and Windows npm invocation
  behave consistently across supported platforms.
- Post-publication verification accepts the correct SVG and PNG media types for
  each immutable hosted artwork asset.

### Security

- The `main` ruleset contract blocks deletion and non-fast-forward updates and
  requires the stable `Required checks` CI gate, with an explicit maintainer
  recovery bypass.
- npm publication continues to use the protected immutable tag namespace,
  GitHub OIDC trusted publishing, provenance, and post-publication identity
  verification, now including MIT and public package metadata.

[0.4.0]: https://github.com/shazhou-ww/silvermoon/compare/npm/silvermoon/v0.3.0...npm/silvermoon/v0.4.0
[0.3.0]: https://github.com/shazhou-ww/silvermoon/compare/npm/silvermoon/v0.2.2...npm/silvermoon/v0.3.0
[0.3.0-rc.2]: https://github.com/shazhou-ww/silvermoon/compare/npm/silvermoon/v0.3.0-rc.1...npm/silvermoon/v0.3.0-rc.2
[0.3.0-rc.1]: https://github.com/shazhou-ww/silvermoon/compare/npm/silvermoon/v0.2.2...npm/silvermoon/v0.3.0-rc.1
