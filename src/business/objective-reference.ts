import { ObjectiveOperationError } from "../objective-guide/index.ts";
import type {
  ReferencePageSummary,
} from "../objective-guide/index.ts";
import { localize } from "../foundation/language/index.ts";
import {
  createSilvermoonObjectiveLoader,
  silvermoonObjectiveContext,
  SILVERMOON_OBJECTIVE_URIS,
} from "./objective-guides.ts";
import type {
  SilvermoonObjectiveChecks,
  SilvermoonObjectiveContext,
  SilvermoonReferencePage,
} from "./objective-guides.ts";

export type SilvermoonObjectiveId = keyof typeof SILVERMOON_OBJECTIVE_URIS;
export type ObjectiveReferenceAudience = "human" | "agent";
export type ObjectiveReferenceNamespace =
  | "level"
  | "check"
  | "problem"
  | "page"
  | "system";

export interface ObjectiveReferencePageResult {
  readonly objective: SilvermoonObjectiveId;
  readonly language: string;
  readonly page: SilvermoonReferencePage;
}

export interface ObjectiveReferenceSearchResult {
  readonly objective: SilvermoonObjectiveId;
  readonly language: string;
  readonly query: string;
  readonly results: readonly ReferencePageSummary[];
}

export interface ObjectiveReferenceCandidate extends ReferencePageSummary {
  readonly namespace: ObjectiveReferenceNamespace;
  readonly owner: SilvermoonObjectiveId;
  readonly referenceId: string;
  readonly command: string;
}

export interface ObjectiveReferenceLookupPageResult {
  readonly lookup: string;
  readonly operation: "read" | "search";
  readonly namespace: ObjectiveReferenceNamespace;
  readonly query: string;
  readonly owner: SilvermoonObjectiveId;
  readonly referenceId: string;
  readonly language: string;
  readonly page: SilvermoonReferencePage;
}

export interface ObjectiveReferenceLookupSearchResult {
  readonly lookup: string;
  readonly operation: "search";
  readonly namespace: null;
  readonly query: string;
  readonly language: string;
  readonly results: readonly ObjectiveReferenceCandidate[];
}

export interface ObjectiveReferenceLookupAmbiguousResult {
  readonly lookup: string;
  readonly operation: "read";
  readonly namespace: ObjectiveReferenceNamespace;
  readonly query: string;
  readonly language: string;
  readonly ambiguous: true;
  readonly candidates: readonly ObjectiveReferenceCandidate[];
}

export interface ObjectiveReferenceLookupNotFoundResult {
  readonly lookup: string;
  readonly operation: "read";
  readonly namespace: ObjectiveReferenceNamespace;
  readonly query: string;
  readonly language: string;
  readonly found: false;
  readonly candidates: readonly ObjectiveReferenceCandidate[];
}

export type ObjectiveReferenceLookupResult =
  | ObjectiveReferenceLookupPageResult
  | ObjectiveReferenceLookupSearchResult
  | ObjectiveReferenceLookupAmbiguousResult
  | ObjectiveReferenceLookupNotFoundResult;

const NAMESPACE_PREFIXES: Readonly<Record<ObjectiveReferenceNamespace, string>> =
  Object.freeze({
    level: "levels/",
    check: "checks/",
    problem: "problems/",
    page: "pages/",
    system: "system/",
  });
const PREFIX_NAMESPACES = new Map(
  Object.entries(NAMESPACE_PREFIXES).map(([namespace, prefix]) => [
    prefix,
    namespace as ObjectiveReferenceNamespace,
  ]),
);

function isObjectiveReferenceNamespace(
  value: string,
): value is ObjectiveReferenceNamespace {
  return Object.hasOwn(NAMESPACE_PREFIXES, value);
}

async function referenceInstance(objective: SilvermoonObjectiveId, language: string) {
  const checks = {} as SilvermoonObjectiveChecks;
  const loader = createSilvermoonObjectiveLoader(checks);
  const spec = await loader.load(SILVERMOON_OBJECTIVE_URIS[objective]);
  return silvermoonObjectiveContext(spec, language);
}

function ownerOf(instance: SilvermoonObjectiveContext): SilvermoonObjectiveId {
  const owner = Object.entries(SILVERMOON_OBJECTIVE_URIS).find(
    ([, uri]) => uri === instance.spec.objectiveId,
  )?.[0];
  if (owner === undefined) {
    throw new ObjectiveOperationError(
      `Unknown bundled Objective: ${instance.spec.objectiveId}.`,
    );
  }
  return owner as SilvermoonObjectiveId;
}

async function referenceChain(language: string) {
  const instances: SilvermoonObjectiveContext[] = [];
  let current: SilvermoonObjectiveContext | null = await referenceInstance("idea", language);
  while (current !== null) {
    instances.push(current);
    current = current.prerequisite;
  }
  return instances;
}

function namespaceForId(referenceId: string): ObjectiveReferenceNamespace {
  for (const [prefix, namespace] of PREFIX_NAMESPACES) {
    if (referenceId.startsWith(prefix)) return namespace;
  }
  throw new ObjectiveOperationError(`Unknown Reference page namespace: ${referenceId}.`);
}

export function parseObjectiveReferenceLookup(lookup: string): {
  namespace: ObjectiveReferenceNamespace | null;
  query: string;
} {
  const value = lookup.trim();
  if (value === "") throw new ObjectiveOperationError("Reference lookup must be nonempty.");
  if (/[\u0000-\u001f\u007f\\]/.test(value)) {
    throw new ObjectiveOperationError("Reference lookup contains an invalid character.");
  }
  const separators = [...value.matchAll(/:/g)];
  if (separators.length > 1) {
    throw new ObjectiveOperationError("Reference lookup may contain at most one namespace separator.");
  }
  let namespace: ObjectiveReferenceNamespace | null = null;
  let query = value;
  if (separators.length === 1) {
    const [prefix = "", suffix = ""] = value.split(":");
    if (!isObjectiveReferenceNamespace(prefix)) {
      throw new ObjectiveOperationError(`Unknown Reference namespace: ${prefix || "(empty)"}.`);
    }
    namespace = prefix;
    query = suffix.trim();
    if (query === "") throw new ObjectiveOperationError("Reference namespace query must be nonempty.");
  }
  if (query.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new ObjectiveOperationError("Reference lookup cannot contain '.' or '..' path segments.");
  }
  return { namespace, query };
}

export function objectiveReferenceLookup(referenceId: string): string {
  const namespace = namespaceForId(referenceId);
  return `${namespace}:${referenceId.slice(NAMESPACE_PREFIXES[namespace].length)}`;
}

export function objectiveReferenceCommand(pageId: string, language: string): string;
export function objectiveReferenceCommand(
  objective: SilvermoonObjectiveId,
  pageId: string,
  language: string,
): string;
export function objectiveReferenceCommand(
  first: SilvermoonObjectiveId | string,
  second: string,
  third?: string,
): string {
  const pageId = third === undefined ? first : second;
  const language = third ?? second;
  return `silvermoon reference ${objectiveReferenceLookup(pageId)} --language ${language}`;
}

export function renderObjectiveReferenceContent(
  content: string,
  objective: SilvermoonObjectiveId,
  language: string,
): string {
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,
    (_match, pageId: string, label: string | undefined) =>
      `${label?.trim() || pageId} (\`${objectiveReferenceCommand(pageId, language)}\`)`,
  );
}

export async function readObjectiveReference(
  objective: SilvermoonObjectiveId,
  pageId: string,
  language = "en-US",
): Promise<ObjectiveReferencePageResult> {
  const instance = await referenceInstance(objective, language);
  return Object.freeze({
    objective,
    language: instance.language,
    page: await instance.readPage(pageId),
  });
}

export async function searchObjectiveReferences(
  objective: SilvermoonObjectiveId,
  query: string,
  language = "en-US",
): Promise<ObjectiveReferenceSearchResult> {
  const instance = await referenceInstance(objective, language);
  return Object.freeze({
    objective,
    language: instance.language,
    query,
    results: await instance.searchPages(query),
  });
}

function candidate(
  owner: SilvermoonObjectiveId,
  summary: ReferencePageSummary,
  language: string,
): ObjectiveReferenceCandidate {
  return Object.freeze({
    namespace: namespaceForId(summary.id),
    owner,
    referenceId: summary.id,
    id: summary.id,
    title: summary.title,
    command: objectiveReferenceCommand(summary.id, language),
  });
}

async function allCandidates(
  chain: readonly SilvermoonObjectiveContext[],
  language: string,
): Promise<ObjectiveReferenceCandidate[]> {
  const candidates = await Promise.all(chain.map(async (instance) =>
    (await instance.searchPages(""))
      .map((summary) => candidate(ownerOf(instance), summary, language))
  ));
  return candidates.flat();
}

export async function resolveObjectiveReference(
  lookup: string,
  language = "en-US",
): Promise<ObjectiveReferenceLookupResult> {
  const parsed = parseObjectiveReferenceLookup(lookup);
  const chain = await referenceChain(language);
  const resolvedLanguage = chain[0]?.language ?? language;
  if (parsed.namespace === null) {
    const grouped = await Promise.all(chain.map(async (instance) =>
      (await instance.searchPages(parsed.query))
        .map((summary) => candidate(ownerOf(instance), summary, resolvedLanguage))
    ));
    const seen = new Set<string>();
    const results = grouped.flat().filter(({ owner, referenceId }) => {
      const identity = `${owner}\0${referenceId}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
    if (results.length !== 1) {
      return Object.freeze({
        lookup,
        operation: "search",
        namespace: null,
        query: parsed.query,
        language: resolvedLanguage,
        results: Object.freeze(results),
      });
    }
    const match = results[0]!;
    const instance = chain.find((entry) => ownerOf(entry) === match.owner)!;
    return Object.freeze({
      lookup,
      operation: "search",
      namespace: match.namespace,
      query: parsed.query,
      owner: match.owner,
      referenceId: match.referenceId,
      language: resolvedLanguage,
      page: await instance.readPage(match.referenceId),
    });
  }

  const referenceId = `${NAMESPACE_PREFIXES[parsed.namespace]}${parsed.query}`;
  const inventory = await allCandidates(chain, resolvedLanguage);
  const matches = inventory.filter((entry) => entry.referenceId === referenceId);
  if (matches.length > 1) {
    return Object.freeze({
      lookup,
      operation: "read",
      namespace: parsed.namespace,
      query: parsed.query,
      language: resolvedLanguage,
      ambiguous: true,
      candidates: Object.freeze(matches),
    });
  }
  const match = matches[0];
  if (match === undefined) {
    return Object.freeze({
      lookup,
      operation: "read",
      namespace: parsed.namespace,
      query: parsed.query,
      language: resolvedLanguage,
      found: false,
      candidates: Object.freeze(
        inventory.filter((entry) => entry.namespace === parsed.namespace),
      ),
    });
  }
  const instance = chain.find((entry) => ownerOf(entry) === match.owner)!;
  return Object.freeze({
    lookup,
    operation: "read",
    namespace: parsed.namespace,
    query: parsed.query,
    owner: match.owner,
    referenceId,
    language: resolvedLanguage,
    page: await instance.readPage(referenceId),
  });
}

export function renderObjectiveReferencePage(
  result: ObjectiveReferencePageResult | ObjectiveReferenceLookupPageResult,
  audience: ObjectiveReferenceAudience = "human",
): string {
  const objective = "owner" in result ? result.owner : result.objective;
  const { language, page } = result;
  const markdown = [
    `# ${page.title}`,
    ...(page.description === undefined ? [] : ["", page.description]),
    ...(page.outcome === undefined
      ? []
      : ["", `**${localize(language, "Outcome", "结果")}:** ${page.outcome}`]),
    ...(page.instruction === undefined
      ? []
      : ["", `**${localize(language, "Instruction", "指引")}:** ${page.instruction}`]),
    ...(page.content === ""
      ? []
      : ["", renderObjectiveReferenceContent(page.content, objective, language)]),
    "",
    `${localize(language, "Owner", "所属 Objective")}: \`${objective}\``,
    `${localize(language, "Reference ID", "引用 ID")}: \`${page.id}\``,
    `${localize(language, "Open", "打开")}: \`${objectiveReferenceCommand(page.id, language)}\``,
  ].join("\n");
  switch (audience) {
    case "human":
    case "agent":
      return markdown;
  }
}

export function renderObjectiveReferenceSearch(
  result: ObjectiveReferenceSearchResult | ObjectiveReferenceLookupSearchResult,
  audience: ObjectiveReferenceAudience = "human",
): string {
  const heading = result.query.trim() === ""
    ? localize(result.language, "Objective Reference pages", "Objective 引用页面")
    : localize(
      result.language,
      `Objective Reference search: ${result.query}`,
      `Objective 引用搜索：${result.query}`,
    );
  const markdown = [
    `# ${heading}`,
    "",
    ...(result.results.length === 0
      ? [localize(result.language, "No matching Reference pages.", "没有匹配的引用页面。")]
      : result.results.map((entry) => {
        if (!("owner" in entry)) {
          const objective = "objective" in result ? result.objective : "idea";
          return `- ${entry.title} (\`${
            objectiveReferenceCommand(objective, entry.id, result.language)
          }\`)`;
        }
        return [
          `- **${entry.namespace}:${entry.referenceId.slice(NAMESPACE_PREFIXES[entry.namespace].length)}** — ${entry.title}`,
          `  ${localize(result.language, "owner", "所属 Objective")}: \`${entry.owner}\`; ${
            localize(result.language, "stable ID", "稳定 ID")
          }: \`${entry.referenceId}\``,
          `  \`${entry.command}\``,
        ].join("\n");
      })),
  ].join("\n");
  switch (audience) {
    case "human":
    case "agent":
      return markdown;
  }
}

export function renderObjectiveReferenceLookup(
  result: ObjectiveReferenceLookupResult,
  audience: ObjectiveReferenceAudience = "human",
): string {
  if ("page" in result) return renderObjectiveReferencePage(result, audience);
  if ("results" in result) return renderObjectiveReferenceSearch(result, audience);
  const heading = "ambiguous" in result
    ? localize(result.language, "Ambiguous Reference", "Reference 存在歧义")
    : localize(result.language, "Reference not found", "未找到 Reference");
  const explanation = "ambiguous" in result
    ? localize(
      result.language,
      "The same canonical page ID exists under multiple Objective owners. Choose an owner-specific candidate; traversal order was not used.",
      "同一规范页面 ID 存在于多个 Objective owner 下。请选择候选项；未按遍历顺序静默选择。",
    )
    : localize(
      result.language,
      "No page matched this explicit namespace lookup. Available pages in the namespace:",
      "显式 namespace lookup 没有匹配页面。该 namespace 中可用页面如下：",
    );
  return [
    `# ${heading}`,
    "",
    explanation,
    ...(result.candidates.length === 0
      ? []
      : [
        "",
        ...result.candidates.map((entry) =>
          `- \`${entry.owner}\` — \`${entry.referenceId}\` — ${entry.title}`
        ),
      ]),
  ].join("\n");
}
