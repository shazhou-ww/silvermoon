# Objective Guide Runtime

Silvermoon exports a URI-keyed Objective Guide core from its package root.
The [module](../src/objective-guide/README.md) does not execute repairs,
regulators, autonomous Agent loops or portfolio scheduling.

## Loading and binding

`createObjectiveLoader({ checks, resources?, resolveChecks? })` creates an
application-runtime identity map. `load(manifestUri)` accepts an absolute URI
or an absolute filesystem path and returns the same language-neutral Guide
for the same canonical URI, including concurrent requests. Relative
prerequisite and resource references resolve against their Manifest URI.
Cycles, unavailable resources and invalid configuration reject explicitly;
failed loads may be retried without poisoning the cache.

The default resolver reads JSON/YAML files and recursively discovers Markdown
pages in a file References directory without following symlinks. Other URI
schemes require an explicit `ObjectiveResourceResolver`. The resolver supplies
text and page resources; it does not fetch implicitly. `resolveChecks(uri)`
can bind different typed checks for different definitions.

A Manifest declares `schemaVersion: 1`, a Draft 2020-12 root-object
`domainSchema`, optional immediate `prerequisite`, ordered `levels`,
`defaultLanguage`, and complete `localizations`. Levels use nonempty stable
IDs, each with `advancement.checks`; `terminal` is reserved and synthesized.
Only local `#/$defs/...` schema references are allowed. Validation neither
coerces subject fields nor applies defaults or remote schemas.

```ts
const loader = createObjectiveLoader({
  checks: {
    "project-ready": async (subject, language) => {
      const ready = await inspectProject(subject.root, language);
      return ready
        ? { pass: true }
        : {
            pass: false,
            problems: [{
              pageId: "project-unready",
              description: "Project configuration needs repair.",
            }],
          };
    },
  },
});
const guide = await loader.load(manifestUri);
const created = guide.createInstance({
  subject: { root: projectRoot },
  language: "en-US",
});
if (!created.ok) {
  handleCreationError(created.error);
} else {
  const observation = await created.instance.probe();
  for (const problem of observation.problems) {
    const page = await observation.current.instance.readPage(problem.pageId);
    presentReference(page);
  }
}
```

The example's inspection and presentation functions are application bindings,
not runtime exports. A loader is shared within that application runtime; it is
not a cross-process singleton or a subject-indexed instance cache.

## Instances and observations

`createInstance` is synchronous and returns a discriminated result. Failures
are `invalid-subject`, `invalid-prerequisite-subject` or
`unsupported-language`; chains contain direct Guide objects. Prerequisite
failures distinguish projection from schema validation. Subject validation
precedes language validation, and the nearest unsupported Guide is reported.

Successful instances snapshot and freeze the subject. Their methods do not
accept another subject or a generic runtime context. Omitted language uses
the root default; an explicit unsupported language fails, without parent or
field fallback. Every prerequisite instance uses the same resolved language.

`describeLevels()` returns prerequisite non-terminal descriptions followed by
local levels and one terminal. Each description contains its owning instance,
stable `id`, localized text and `advancementOutcome`; terminal outcome is
`null`. No numeric level/index or objective ID is exposed.

`probe()` checks the prerequisite first, then local checks in order, stopping
at the first failure. It returns that owning instance, problems containing
page IDs, and a concise gap summary. Every probe samples again; observations
are not atomic truth. Invalid check results, unknown problem pages and
unexpected operation failures are explicit errors, not low-level successes.

## Prerequisite projection

The deterministic JSONata profile supports literal object/array construction,
subject paths, `$` as the current subject, numeric arithmetic and string-only
concatenation. It rejects functions, named variables, assignment, dynamic
evaluation, recursion, time/random and external capabilities. Expressions are
limited to 4096 bytes, 512 AST nodes and depth 32; execution is limited to
25 ms and output to 64 KiB of finite JSON. The projected result must satisfy
the prerequisite object schema.

## References

Locale content covers every local level and terminal. Reference Markdown
starts with `id` frontmatter and a level-one title; filenames are not identity.
Internal links use `[[page-id]]` or `[[page-id|label]]` in the body. Loader
validation rejects duplicate IDs, dangling links, incomplete locale page sets
and empty pages, while allowing shared pages and link cycles.

By default the References root must contain `404.md` with `id: "404"`.
An explicit `notFoundPageId` selects another existing ID regardless of filename.
Only an absent requested ID returns that normal page; resource/permission/
parsing errors are never concealed by it. `searchPages(query)` searches the
instance's localized title/body and returns only `{ id, title }` summaries;
no matches return an empty list. Pages do not expose separate links/tags.

## Silvermoon scopes

The [bundled definitions](../src/business/objective-guides.ts) are serializable
Manifest and locale resources for Device, Project and Idea. Every scope starts
with `configuration-invalid`; Device remains independent advisory, and Idea
directly composes the cached Project Guide. No selector means Project-only
navigation, never a selection-required Idea level.

Project validates all three optional guidance files locally and again at the
confirmed primary. Only a selected active phase's captured content is returned.
Idea separates submission and acceptance for Ideal, Inner and Outer revisions;
stale submissions return to unsubmitted. Existing lifecycle reduction remains
authoritative, v1 does not gain fabricated submission events, and abandoned is
stopped rather than completed.
Abandoned command routes stop after Project readiness without constructing an
Idea instance or mislabeling the abandoned object as invalid configuration.

Business navigation uses the existing content-template resolution to select
the bundled `en-US` or `zh-CN` Guide locale, independently of temporary output
language. This does not rewrite the Idea's arbitrary canonical content-language
preference; the Guide core itself never falls back from an explicit language.
The CLI retains its four report projections without serializing runtime object
references. `list-ideas` and snapshot `check` retain their own limited readiness
boundaries.
