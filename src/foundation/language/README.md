# language

Normalize content language, output language, and locale values.

## Capability boundary

- Allowed dependencies: coordinates.
- Does not own: project reads and command behavior selection.
- Cross-module callers use [index.ts](./index.ts); sibling implementations do not import their own index.

## Key exports

- `canonicalizeLanguageTag`: normalizes supported content-language tags.
- `canonicalizeOutputLanguage`: normalizes invocation output-language tags.
- `resolveLanguage`: resolves explicit idea, project, and global language precedence.
- `localize`: selects localized text from an explicit language.
