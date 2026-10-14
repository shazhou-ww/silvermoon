import { ObjectiveOperationError } from "../objective-guide/index.ts";
import type { JsonObject, ReferencePage, ReferencePageSummary } from "../objective-guide/index.ts";
import { localize } from "../foundation/language/index.ts";
import {
  createSilvermoonObjectiveLoader,
  SILVERMOON_OBJECTIVE_URIS,
} from "./objective-guides.ts";
import type { SilvermoonObjectiveChecks } from "./objective-guides.ts";

export type SilvermoonObjectiveId = keyof typeof SILVERMOON_OBJECTIVE_URIS;
export type ObjectiveReferenceAudience = "human" | "agent";

export interface ObjectiveReferencePageResult {
  readonly objective: SilvermoonObjectiveId;
  readonly language: string;
  readonly page: ReferencePage;
}

export interface ObjectiveReferenceSearchResult {
  readonly objective: SilvermoonObjectiveId;
  readonly language: string;
  readonly query: string;
  readonly results: readonly ReferencePageSummary[];
}

const SUBJECTS: Readonly<Record<SilvermoonObjectiveId, JsonObject>> = Object.freeze({
  device: Object.freeze({ userHome: "reference" }),
  project: Object.freeze({ root: "reference", userHome: "reference" }),
  idea: Object.freeze({
    root: "reference",
    userHome: "reference",
    ideaId: "00000000000000000000000000",
  }),
});

async function referenceInstance(objective: SilvermoonObjectiveId, language: string) {
  const checks = {} as SilvermoonObjectiveChecks;
  const loader = createSilvermoonObjectiveLoader(checks, { executeEntries: false });
  const guide = await loader.load(SILVERMOON_OBJECTIVE_URIS[objective]);
  const created = guide.createInstance({ subject: SUBJECTS[objective], language });
  if (created.ok) return created.instance;
  if (created.error.type === "unsupported-language") {
    throw new ObjectiveOperationError(
      `Unsupported Reference locale: ${language}. Supported locales: ${
        created.error.supportedLanguages.join(", ")
      }.`,
    );
  }
  throw new ObjectiveOperationError(
    `Could not create ${objective} Reference reader: ${created.error.type}.`,
  );
}

export function objectiveReferenceCommand(
  objective: SilvermoonObjectiveId,
  pageId: string,
  language: string,
): string {
  return `silvermoon reference page ${objective} ${pageId} --language ${language}`;
}

export function renderObjectiveReferenceContent(
  content: string,
  objective: SilvermoonObjectiveId,
  language: string,
): string {
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,
    (_match, pageId: string, label: string | undefined) =>
      `${label?.trim() || pageId} (\`${objectiveReferenceCommand(objective, pageId, language)}\`)`,
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

export function renderObjectiveReferencePage(
  result: ObjectiveReferencePageResult,
  audience: ObjectiveReferenceAudience = "human",
): string {
  const { objective, language, page } = result;
  const markdown = [
    `# ${page.title}`,
    ...(page.description === undefined ? [] : ["", page.description]),
    ...(page.outcome === undefined
      ? []
      : [
        "",
        `**${localize(language, "Outcome", "结果")}:** ${page.outcome}`,
      ]),
    ...(page.instruction === undefined
      ? []
      : [
        "",
        `**${localize(language, "Instruction", "指引")}:** ${page.instruction}`,
      ]),
    ...(page.content === "" ? [] : [
      "",
      renderObjectiveReferenceContent(page.content, objective, language),
    ]),
    "",
    `${localize(language, "Reference ID", "引用 ID")}: \`${page.id}\``,
    `${localize(language, "Open", "打开")}: \`${
      objectiveReferenceCommand(objective, page.id, language)
    }\``,
  ].join("\n");
  switch (audience) {
    case "human":
    case "agent":
      return markdown;
  }
}

export function renderObjectiveReferenceSearch(
  result: ObjectiveReferenceSearchResult,
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
      ? [localize(
        result.language,
        "No matching Reference pages.",
        "没有匹配的引用页面。",
      )]
      : result.results.map(({ id, title }) =>
        `- ${title} (\`${objectiveReferenceCommand(result.objective, id, result.language)}\`)`
      )),
  ].join("\n");
  switch (audience) {
    case "human":
    case "agent":
      return markdown;
  }
}
