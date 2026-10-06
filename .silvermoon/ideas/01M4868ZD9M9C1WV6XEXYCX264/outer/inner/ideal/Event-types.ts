// Ideal World 候选；运行时须验证规范编码、引用与授权，不是已发布 API。
export type EventId = `sha256:${string}`;
export type GitOid = string;
export type IdeaId = string;
export type Source = "upstream" | "downstream";

export type Acceptance =
  | { readonly type: "acceptIdeal"; readonly payload: { readonly idealRevision: GitOid } }
  | { readonly type: "acceptInner"; readonly payload: { readonly implementationRevision: GitOid } }
  | { readonly type: "acceptOuter"; readonly payload: { readonly deploymentRevision: GitOid } };
export type UpstreamBody = Acceptance
  | { readonly type: "abandon" | "resume" }
  | { readonly type: "ping"; readonly payload: { readonly message: string } };
export type MetadataBody =
  | { readonly type: "setAlias"; readonly payload: { readonly alias: string | null } }
  | { readonly type: "setLanguage"; readonly payload: { readonly language: string | null } };
export type DownstreamBody =
  { readonly type: "pong"; readonly payload: { readonly message: string } };
interface EnvelopeBase {
  readonly version: 1;
  readonly ideaId: IdeaId;
  readonly after: EventId | null;
  readonly observed: EventId | null;
}
export type EventEnvelope = EnvelopeBase & (
  | { readonly source: "upstream"; readonly body: UpstreamBody | MetadataBody }
  | { readonly source: "downstream"; readonly body: DownstreamBody | MetadataBody }
);
export interface IdeaEvent {
  readonly id: EventId;
  readonly envelope: EventEnvelope;
}
export interface Frontier {
  readonly upstream: EventId | null;
  readonly downstream: EventId | null;
}
export interface PhysicalPrefix {
  readonly length: number;
  readonly digest: GitOid;
}
export interface EventCursor {
  readonly format: "merkle-dag-v1";
  readonly ideaId: IdeaId;
  readonly frontier: Frontier;
  readonly storageDigest: GitOid;
  readonly prefixes: Readonly<Record<Source, PhysicalPrefix>>;
}
export interface WorldRevisions {
  readonly idealRevision: GitOid;
  readonly implementationRevision: GitOid;
  readonly deploymentRevision: GitOid;
}
export interface DecisionBasis {
  readonly cursor: EventCursor;
  readonly expectedPrimary: GitOid;
  readonly worlds: WorldRevisions;
  readonly explicitHumanDecision: string;
}
export interface InteractionProjection {
  readonly importedMessages: readonly {
    readonly sequence: number;
    readonly type: "ping" | "pong";
    readonly message: string;
  }[];
  readonly messages: readonly IdeaEvent[];
  readonly lastSignal: "ping" | "pong" | null;
  readonly concurrent: boolean;
  readonly maximalSignals: readonly EventId[];
}
export type Conflict =
  | { readonly code: "same-side-fork"; readonly source: Source; readonly nodes: readonly EventId[] }
  | { readonly code: "metadata-conflict"; readonly field: "alias" | "language"; readonly nodes: readonly EventId[] };
export type ValidationResult =
  | { readonly ok: true; readonly cursor: EventCursor; readonly interaction: InteractionProjection }
  | { readonly ok: false; readonly conflicts: readonly Conflict[]; readonly diagnostic: string };
export interface EventDelta {
  readonly after: EventCursor;
  readonly cursor: EventCursor;
  readonly events: readonly IdeaEvent[];
}
export type AppendReceipt =
  | { readonly outcome: "candidate-written" | "already-present"; readonly eventId: EventId; readonly cursor: EventCursor }
  | { readonly outcome: "no-state-change"; readonly cursor: EventCursor };
