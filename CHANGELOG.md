# Changelog

This changelog starts with the Silvermoon 0.3.0 release series. Earlier release
history remains available through npm and Git tags.

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

[0.3.0-rc.2]: https://github.com/shazhou-ww/silvermoon/compare/npm/silvermoon/v0.3.0-rc.1...npm/silvermoon/v0.3.0-rc.2
[0.3.0-rc.1]: https://github.com/shazhou-ww/silvermoon/compare/npm/silvermoon/v0.2.2...npm/silvermoon/v0.3.0-rc.1
