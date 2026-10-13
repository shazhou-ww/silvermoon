export type ObjectiveManifestUri = string;
export type CheckId = string;
export type ReferencePageId = string;
export type ObjectiveLevelId = string;
export type LanguageTag = string;
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;
export type JsonObject = Readonly<{ [key: string]: JsonValue }>;
export type ObjectiveSubject = JsonObject;
export type ObjectiveDomainSchema = JsonObject;

export interface ObservedProblem {
  pageId: ReferencePageId;
  description: string;
}
export interface ReferencePageSummary {
  id: ReferencePageId;
  title: string;
}
export interface ReferencePage extends ReferencePageSummary {
  content: string;
}
export interface ObjectiveLevelDescription {
  instance: ObjectiveGuideInstance;
  id: ObjectiveLevelId;
  title: string;
  description: string;
  advancementOutcome: string | null;
}
export interface ObjectiveObservation {
  current: ObjectiveLevelDescription;
  problems: readonly ObservedProblem[];
  gapSummary: string;
}
export interface ObjectiveSubjectValidationIssue {
  instancePath: string;
  keyword: string;
  message: string;
}
export type ObjectiveValidationIssues = readonly [
  ObjectiveSubjectValidationIssue, ...ObjectiveSubjectValidationIssue[],
];
export type ObjectivePrerequisiteSubjectFailure =
  | { type: "projection-failed"; message: string }
  | { type: "validation-failed"; projectedSubject: unknown; issues: ObjectiveValidationIssues };
export type ObjectiveGuideInstanceCreationError =
  | { type: "invalid-subject"; guide: ObjectiveGuide; subject: ObjectiveSubject; issues: ObjectiveValidationIssues }
  | {
    type: "invalid-prerequisite-subject";
    chain: readonly [ObjectiveGuide, ObjectiveGuide, ...ObjectiveGuide[]];
    guide: ObjectiveGuide;
    failure: ObjectivePrerequisiteSubjectFailure;
  }
  | {
    type: "unsupported-language";
    chain: readonly [ObjectiveGuide, ...ObjectiveGuide[]];
    guide: ObjectiveGuide;
    language: LanguageTag;
    supportedLanguages: readonly LanguageTag[];
  };
export type ObjectiveGuideInstanceCreationResult =
  | { ok: true; instance: ObjectiveGuideInstance }
  | { ok: false; error: ObjectiveGuideInstanceCreationError };
export interface ObjectiveGuideInstanceOptions {
  subject: ObjectiveSubject;
  language?: LanguageTag;
}
export interface ObjectivePrerequisite {
  readonly guide: ObjectiveGuide;
  mapSubject(subject: ObjectiveSubject): unknown;
}
export interface ObjectiveGuide {
  readonly manifestUri: ObjectiveManifestUri;
  readonly domainSchema: ObjectiveDomainSchema;
  readonly prerequisite: ObjectivePrerequisite | null;
  createInstance(options: ObjectiveGuideInstanceOptions): ObjectiveGuideInstanceCreationResult;
}
export interface ObjectiveGuideInstance {
  readonly guide: ObjectiveGuide;
  readonly subject: ObjectiveSubject;
  readonly language: LanguageTag;
  readonly title: string;
  readonly description: string;
  readonly prerequisite: ObjectiveGuideInstance | null;
  describeLevels(): readonly ObjectiveLevelDescription[];
  probe(): Promise<ObjectiveObservation>;
  readPage(pageId: ReferencePageId): Promise<ReferencePage>;
  searchPages(query: string): Promise<readonly ReferencePageSummary[]>;
}
export interface ObjectiveLevelAdvancementManifest {
  checks: readonly CheckId[];
}
export interface ObjectiveLevelManifest {
  id: ObjectiveLevelId;
  advancement: ObjectiveLevelAdvancementManifest;
}
export type ObjectiveLevelsManifest = readonly [ObjectiveLevelManifest, ...ObjectiveLevelManifest[]];
export interface ObjectivePrerequisiteManifest {
  manifestUri: ObjectiveManifestUri;
  subject: string;
}
export interface ObjectiveLevelContentManifest {
  title: string;
  description: string;
  outcome: string;
}
export interface ObjectiveTerminalContentManifest {
  title: string;
  description: string;
}
export interface ObjectiveGuideContentManifest {
  title: string;
  description: string;
  terminal: ObjectiveTerminalContentManifest;
  levels: Readonly<Record<ObjectiveLevelId, ObjectiveLevelContentManifest>>;
}
export interface ObjectiveReferencesManifest {
  source: string;
  notFoundPageId?: ReferencePageId;
}
export interface ObjectiveLocalizationManifest {
  content: string;
  references: ObjectiveReferencesManifest;
}
export interface ObjectiveGuideManifest {
  schemaVersion: 1;
  domainSchema: ObjectiveDomainSchema;
  prerequisite?: ObjectivePrerequisiteManifest;
  levels: ObjectiveLevelsManifest;
  defaultLanguage: LanguageTag;
  localizations: Readonly<Record<LanguageTag, ObjectiveLocalizationManifest>>;
}
export type CheckResult =
  | { pass: true }
  | { pass: false; problems: readonly [ObservedProblem, ...ObservedProblem[]] };
export type ObjectiveCheck = (subject: ObjectiveSubject, language: LanguageTag) => Promise<CheckResult>;
export interface ObjectiveGuideLoadBindings {
  checks: Readonly<Record<CheckId, ObjectiveCheck>>;
  prerequisite?: ObjectiveGuide;
}
export interface ObjectiveLoader {
  load(manifestUri: ObjectiveManifestUri): Promise<ObjectiveGuide>;
}
export interface ObjectivePageResource {
  uri: string;
  source: string;
}
export interface ObjectiveResourceResolver {
  readText(uri: string): Promise<string>;
  readPages(sourceUri: string): Promise<readonly ObjectivePageResource[]>;
}
export interface ObjectiveLoaderOptions {
  resources?: ObjectiveResourceResolver;
  checks?: Readonly<Record<CheckId, ObjectiveCheck>>;
  resolveChecks?: (manifestUri: ObjectiveManifestUri) => Readonly<Record<CheckId, ObjectiveCheck>>;
}
