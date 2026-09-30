# Contributing

Thanks for helping improve Silvermoon.

## Before Opening Work

- Search existing issues before filing a new one.
- Use an issue to discuss substantial behavior or contract changes first.
- Follow the [Security Policy](./SECURITY.md) for vulnerabilities; do not
  disclose them in a public issue.
- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md) in all project spaces.

## Development

Silvermoon requires Node.js 22 or newer, Git, and the pnpm version declared in
`package.json`.

```sh
pnpm install --frozen-lockfile
pnpm check:sanity
```

Use the smallest relevant test while iterating. Before submitting a pull
request, stage the intended candidate and run:

```sh
pnpm check:commit
pnpm check
```

See [Maintaining Silvermoon](./docs/maintaining.md) for validation tiers,
documentation ownership, and release guidance.

## Pull Requests

- Keep each pull request focused.
- Add or update tests for behavior changes.
- Update directly affected documentation.
- Explain user-visible and compatibility effects.
- Do not include credentials, private data, or generated local artifacts.

Unless explicitly stated otherwise, contributions are provided under the
[MIT License](./LICENSE).
