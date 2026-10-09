export interface Problem {
  type: string;
  summary: string;
}

export interface Diagnostic {
  code: string;
  level?: string;
  message: string;
  path?: string;
  remediation?: string;
}

export interface ProjectVersion {
  type: string;
  commit?: string | null;
}

export interface ProjectConfiguration {
  primaryRepository: string;
  primaryBranch: string;
  preferredLanguage?: string;
}

export interface DeviceAdvisory {
  runtime: {
    source: "global" | "host" | "source-checkout";
    version: string | null;
    summary?: string;
  };
  skill: {
    status:
      | "ready"
      | "missing"
      | "mismatched"
      | "invalid"
      | "managed-by-host"
      | "source-checkout";
    expectedRoot: string;
    paths: string[];
    invalidPaths?: string[];
    remediation?: string;
    summary?: string;
  };
  update: {
    status:
      | "available"
      | "current"
      | "unavailable"
      | "managed-by-host"
      | "source-checkout";
    currentVersion: string | null;
    source: "cache" | "registry" | "runtime";
    latestVersion?: string;
    checkedAt?: string;
    lastSuccessfulCheck?: {
      checkedAt: string;
      latestVersion: string;
    };
    summary?: string;
  };
}

export interface IdeaReference {
  id: string;
  state: string;
  alias?: string;
  createdAt?: string;
  title?: string;
}

export interface IdeaInventoryItem extends IdeaReference {
  createdAt: string;
}

export interface IdeaCounts {
  [state: string]: number;
}

export interface IdeaSummary {
  counts: IdeaCounts;
  activeIdeas: IdeaReference[];
}

export interface InventorySummary {
  counts: IdeaCounts;
  matched: number;
  returned: number;
}

export interface Guidance {
  phase: string;
  path: string;
  contentRevision: string;
  content: string;
}

export interface PublicGuidance {
  phase: string;
  path: string;
  contentRevision: string;
}

export interface ReviewDocument {
  role: "current-contract" | "ledger";
  path: string;
}

export interface ReviewContext {
  phase: "preparing" | "implementing" | "deploying";
  decision: "acceptIdeal" | "acceptInner" | "acceptOuter";
  revision: {
    field: "idealRevision" | "implementationRevision" | "deploymentRevision";
    value: string;
  };
  primaryCommit: string;
  scopePath: string;
  canonicalDocuments: ReviewDocument[];
}

export interface CreatedIdea {
  id: string;
  path: string;
  state: string;
}

export interface EventReceipt {
  outcome: string;
  [field: string]: object | string | number | boolean | null | undefined;
}

interface ObservationBase {
  state: string;
  root: string;
  outputLanguage: string;
  problems: Problem[];
  device?: DeviceAdvisory;
  version?: ProjectVersion;
  configuration?: ProjectConfiguration;
}

export interface ProjectSetupObservation extends ObservationBase {
  state: "project-setup-required";
  observedThrough: "root" | "version" | "configuration" | "ideas";
  ideas?: IdeaSummary;
}

export interface CheckUnavailableObservation extends ObservationBase {
  state: "check-unavailable";
}

export interface ProjectReadyObservation extends ObservationBase {
  state: "project-ready";
  configuration: ProjectConfiguration;
  version: ProjectVersion;
  ideas?: IdeaSummary;
  eventHistory?: object;
}

export interface RepositoryBlockedObservation extends ObservationBase {
  state:
    | "repository-preparation-required"
    | "repository-sync-required"
    | "phase-guidance-invalid"
    | "idea-create-failed";
  configuration?: ProjectConfiguration;
  ideas?: IdeaSummary;
  selectedIdea?: IdeaReference;
}

export interface NavigationReadyObservation extends ObservationBase {
  state: "navigation-ready";
  configuration: ProjectConfiguration;
  version: ProjectVersion;
  ideas: {
    counts: IdeaCounts;
    activeIdeas: IdeaInventoryItem[];
  };
}

export interface IdeaNotFoundObservation extends ObservationBase {
  state: "idea-not-found";
  configuration: ProjectConfiguration;
  version: ProjectVersion;
  candidates: IdeaInventoryItem[];
}

export interface IdeaSelectedObservation extends ObservationBase {
  state: "idea-selected";
  configuration: ProjectConfiguration;
  version: ProjectVersion;
  selectedIdea: IdeaReference;
  guidance?: Guidance;
}

export interface IdeaCreatedObservation extends ObservationBase {
  state: "idea-created";
  configuration: ProjectConfiguration;
  version: ProjectVersion;
  createdIdea: CreatedIdea;
  guidance?: Guidance;
}

export interface IdeasListedObservation extends ObservationBase {
  state: "ideas-listed";
  configuration: ProjectConfiguration;
  version: ProjectVersion;
  summary: InventorySummary;
  ideas: IdeaInventoryItem[];
}

export interface EventResultObservation extends ObservationBase {
  state: "event-result";
  receipt: EventReceipt;
}

export type Observation =
  | ProjectSetupObservation
  | CheckUnavailableObservation
  | ProjectReadyObservation
  | RepositoryBlockedObservation
  | NavigationReadyObservation
  | IdeaNotFoundObservation
  | IdeaSelectedObservation
  | IdeaCreatedObservation
  | IdeasListedObservation
  | EventResultObservation;

export interface CheckTarget {
  type: string;
  revision?: string;
}

export interface CommandArguments {
  language?: string | null;
  idea?: string | null;
  target?: CheckTarget;
  states?: string[];
  query?: string | null;
  createdSince?: string | null;
  createdBefore?: string | null;
  sort?: string;
  limit?: number | null;
  [argument: string]: object | string | number | boolean | null | undefined;
}

export interface CommandIntention {
  command: string;
  args: CommandArguments;
}

export interface ResponseContext {
  nextSteps?: string | string[];
  review?: ReviewContext;
}

export interface ResponseDetails {
  root?: string;
  version?: ProjectVersion;
  primary?: {
    repository: string;
    branch: string;
  };
  contentLanguage?: string;
}

export interface InstructionStep {
  type: "instruction";
  text: string;
}

interface ResponseBase {
  kind: string;
  language: string;
  summary: string;
  device?: DeviceAdvisory;
  details?: ResponseDetails;
}

export interface ValidationResponse extends ResponseBase {
  kind: "validation-result";
  validation: {
    target: CheckTarget;
    valid: boolean;
    eventHistory?: object;
    version?: ProjectVersion;
  };
  problems: Problem[];
}

export interface EventResponse extends ResponseBase {
  kind: "event-result";
  receipt: EventReceipt;
  nextSteps: InstructionStep[];
}

export interface BlockedResponse extends ResponseBase {
  kind: "blocked";
  problems: Problem[];
  nextSteps: InstructionStep[];
  idea?: IdeaReference;
}

export interface IdeaCreatedResponse extends ResponseBase {
  kind: "idea-created";
  createdIdea: CreatedIdea;
  nextSteps: InstructionStep[];
  guidance?: Guidance;
}

export interface ChoiceRequiredResponse extends ResponseBase {
  kind: "choice-required";
  choices: IdeaInventoryItem[];
  nextSteps: InstructionStep[];
  problems?: Problem[];
}

export interface NextStepsResponse extends ResponseBase {
  kind: "next-steps";
  idea: IdeaReference;
  nextSteps: InstructionStep[];
  guidance?: Guidance;
  review?: ReviewContext;
}

export interface IdeaListResponse extends ResponseBase {
  kind: "idea-list";
  query: CommandArguments;
  inventory: InventorySummary;
  items: IdeaInventoryItem[];
}

export type ReportResponse =
  | ValidationResponse
  | EventResponse
  | BlockedResponse
  | IdeaCreatedResponse
  | ChoiceRequiredResponse
  | NextStepsResponse
  | IdeaListResponse;

export interface DateFacts {
  milliseconds: number;
  localDate: string;
}
