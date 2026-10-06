/**
 * Ideal World 协议候选，不是运行时代码或发布 API。
 * JSON 编码、hash、引用和跨字段不变量见 Message-encoding.md。
 */
export type ProtocolVersion = 1;
export type WssSubprotocol = "silvermoon.v1";
export type MessageId = string;
export type ChannelId = string;
export type ActionId = string;
export type SubscriptionId = string;
export type GitOid = string;
export type Sender = "silvermoon" | "agent";

export type GeneralRoute =
  | { readonly scope: "device" }
  | { readonly scope: "project"; readonly projectUrl: string };
export type IdeaRoute =
  | { readonly scope: "device-idea"; readonly ideaId: string }
  | { readonly scope: "idea"; readonly projectUrl: string; readonly ideaId: string };
export type SessionRoute = GeneralRoute | IdeaRoute;

// 本机接线信息，不要求 Agent 理解 upstream/downstream 或重复自报身份。
export interface ChannelBinding {
  readonly channelId: ChannelId;
  readonly route: SessionRoute;
  readonly silvermoonId: string;
  readonly agentSessionId: string;
  readonly agentGeneration: number;
  readonly connectionRole: "upstream" | "downstream";
}

export interface MessageEnvelope<C> {
  readonly version: ProtocolVersion;
  readonly channelId: ChannelId;
  readonly sender: Sender;
  readonly refs: {
    readonly after: MessageId | null;
    readonly inputs: readonly MessageId[];
  };
  readonly content: C;
}
export interface Message<C> {
  readonly id: MessageId;
  readonly envelope: MessageEnvelope<C>;
}

export interface EventCursor {
  readonly length: number;
  readonly digest: GitOid;
}
export interface WorldRevisions {
  readonly idealRevision: GitOid;
  readonly implementationRevision: GitOid;
  readonly deploymentRevision: GitOid;
}
export type HumanDecision =
  | { readonly type: "acceptIdeal"; readonly payload: { readonly idealRevision: GitOid } }
  | { readonly type: "acceptInner"; readonly payload: { readonly implementationRevision: GitOid } }
  | { readonly type: "acceptOuter"; readonly payload: { readonly deploymentRevision: GitOid } }
  | { readonly type: "abandon" }
  | { readonly type: "resume" };
export type IdeaEventInput =
  | HumanDecision
  | { readonly type: "setAlias"; readonly payload: { readonly alias: string | null } }
  | { readonly type: "setLanguage"; readonly payload: { readonly language: string | null } }
  | { readonly type: "ping" | "pong"; readonly payload: { readonly message: string } };
export type IdeaEvent = IdeaEventInput & { readonly sequence: number };

export type ProtocolError =
  | {
      readonly code: "stale-head";
      readonly message: string;
      readonly expectedHead: EventCursor;
      readonly currentHead: EventCursor;
    }
  | {
      readonly code:
        | "invalid-message" | "unsupported-capability" | "unknown-project" | "unknown-idea"
        | "missing-parent" | "message-fork" | "channel-conflict" | "session-conflict"
        | "cursor-gap" | "schema-unavailable" | "permission-denied"
        | "repository-conflict" | "unknown-result" | "unavailable";
      readonly message: string;
    };
export interface SessionBinding {
  readonly route: SessionRoute;
  readonly sessionId: string;
  readonly generation: number;
}
export interface Evidence {
  readonly kind: "repository" | "check" | "operation";
  readonly reference: string;
  readonly summary: string;
}
export type ActionResult =
  | { readonly outcome: "completed"; readonly message: string; readonly evidence: readonly Evidence[] }
  | { readonly outcome: "blocked"; readonly message: string; readonly needs: readonly string[] }
  | { readonly outcome: "unknown"; readonly message: string };

export interface GeneralAction {
  readonly kind: "general";
  readonly actionId: ActionId;
  readonly route: GeneralRoute;
  readonly basis: { readonly messageIds: readonly MessageId[] };
  readonly instruction: string;
}
export interface IdeaAction {
  readonly kind: "idea";
  readonly actionId: ActionId;
  readonly route: IdeaRoute;
  readonly basis: { readonly head: EventCursor; readonly revisions: WorldRevisions };
  readonly instruction: string;
}
export type Action = GeneralAction | IdeaAction;
export type ActionReference =
  | Pick<GeneralAction, "kind" | "actionId" | "route" | "basis">
  | Pick<IdeaAction, "kind" | "actionId" | "route" | "basis">;
export type NextStep =
  | { readonly state: "dispatch"; readonly recipient: "upstream" | "downstream"; readonly action: Action }
  | { readonly state: "wait"; readonly route: SessionRoute; readonly reason: string }
  | { readonly state: "blocked"; readonly route: SessionRoute; readonly error: ProtocolError }
  | { readonly state: "done"; readonly route: SessionRoute; readonly reason: string };

export interface SchemaCapability {
  readonly schemaVersion: number;
  readonly read: boolean;
  readonly observeEvents: boolean;
  readonly appendInteractions: boolean;
  readonly migration: "not-needed" | "explicit-v1-to-v2" | "unavailable";
}
export interface IdeaSnapshot {
  readonly route: IdeaRoute;
  readonly head: EventCursor;
  readonly sequence: number;
  readonly schema: SchemaCapability;
  readonly revisions: WorldRevisions;
  readonly lifecycle: "preparing" | "implementing" | "deploying" | "completed" | "abandoned";
  readonly alias: string | null;
  readonly contentLanguage: string;
}
export interface EventDelta {
  readonly route: IdeaRoute;
  readonly after: EventCursor;
  readonly head: EventCursor;
  readonly sequence: number;
  readonly events: readonly IdeaEvent[];
}
export interface AppendReceipt {
  readonly outcome: "appended" | "already-present";
  readonly route: IdeaRoute;
  readonly eventSequence: number;
  readonly head: EventCursor;
}
export type Delivery =
  | {
      readonly state: "queued" | "delivered" | "processed";
      readonly boundary: string;
      readonly sdkEvidenceReference: string;
    }
  | { readonly state: "unknown"; readonly reason: string };
export type ReplyRecording =
  | { readonly kind: "general-session" }
  | { readonly kind: "idea-event"; readonly receipt: AppendReceipt }
  | { readonly kind: "not-recorded"; readonly error: ProtocolError };

// operation 是内容语义，不是 request/response 传输类别。
export interface InputParams {
  "project.onboard": { readonly projectUrl: string };
  "general.submit": { readonly message: string };
  "idea.ping.append": { readonly expectedHead: EventCursor; readonly message: string };
  "idea.decision.append": {
    readonly expectedHead: EventCursor;
    readonly expectedPrimary: GitOid;
    readonly decision: HumanDecision;
    readonly humanStatement: string;
  };
  "idea.observe": Record<string, never>;
  "idea.events.subscribe": { readonly after: EventCursor };
  "idea.events.unsubscribe": { readonly subscriptionId: SubscriptionId };
}
export type InputContent = {
  [K in keyof InputParams]: { readonly type: "input"; readonly operation: K; readonly params: InputParams[K] }
}[keyof InputParams];
export interface OperationResults {
  "project.onboard": {
    readonly projectUrl: string;
    readonly projectKey: string;
    readonly schema: SchemaCapability;
    readonly binding: SessionBinding;
  };
  "general.submit": { readonly result: ActionResult };
  "idea.ping.append": AppendReceipt;
  "idea.decision.append": AppendReceipt;
  "idea.observe": IdeaSnapshot;
  "idea.events.subscribe": { readonly subscriptionId: SubscriptionId; readonly delta: EventDelta };
  "idea.events.unsubscribe": { readonly subscriptionId: SubscriptionId };
}
export type OperationContent = {
  [K in keyof OperationResults]: { readonly type: "operation.result"; readonly operation: K; readonly result: OperationResults[K] }
}[keyof OperationResults];
export type MessageContent =
  | InputContent
  | OperationContent
  | { readonly type: "instruction"; readonly action: Action }
  | { readonly type: "action.result"; readonly action: ActionReference; readonly result: ActionResult }
  | { readonly type: "reply.recorded"; readonly action: ActionReference; readonly recording: ReplyRecording }
  | { readonly type: "idea.events"; readonly subscriptionId: SubscriptionId; readonly delta: EventDelta }
  | { readonly type: "error"; readonly error: ProtocolError };

export type WssMessage = Message<MessageContent>;
export type AgentMessage = Message<MessageContent>;

// 本机 SDK 管理调用不是 Agent 业务消息，也不是 WSS 协议。
export interface DownstreamCapabilities {
  readonly resumeSession: boolean;
  readonly sendWhileRunning: boolean;
  readonly inspectMessage: boolean;
  readonly durableMessageCorrelation: boolean;
  readonly structuredReply: boolean;
}
export type SessionState =
  | { readonly state: "running" | "idle" | "gone" }
  | { readonly state: "unknown"; readonly reason: string };
export type SessionOpenParams =
  | {
      readonly kind: "general";
      readonly route: GeneralRoute;
      readonly repositoryRoot: string;
      readonly mode: { readonly type: "create" | "resume"; readonly binding: SessionBinding };
      readonly skill: { readonly path: string; readonly digest: string };
    }
  | {
      readonly kind: "idea";
      readonly route: IdeaRoute;
      readonly repositoryRoot: string;
      readonly worktreeRoot: string;
      readonly mode: { readonly type: "create" | "resume"; readonly binding: SessionBinding };
      readonly skill: { readonly path: string; readonly digest: string };
    };
export interface DownstreamAdapter {
  capabilities(): Promise<DownstreamCapabilities>;
  open(params: SessionOpenParams): Promise<{ readonly binding: SessionBinding; readonly state: SessionState }>;
  inspect(binding: SessionBinding): Promise<SessionState>;
  send(binding: SessionBinding, message: AgentMessage): Promise<Delivery>;
  messages(binding: SessionBinding): AsyncIterable<AgentMessage>;
  inspectMessage(binding: SessionBinding, id: MessageId): Promise<
    | { readonly state: "found"; readonly message: AgentMessage; readonly delivery: Delivery }
    | { readonly state: "not-found"; readonly boundary: string }
    | { readonly state: "unknown"; readonly reason: string }
  >;
  detach(binding: SessionBinding): Promise<void>;
}
export interface GeneralObservation {
  readonly binding: SessionBinding;
  readonly channel: ChannelBinding;
  readonly messages: readonly AgentMessage[];
}
// 无状态能力的窄类型接口，不取代现有 CommandReport 的公开契约。
export interface SilvermoonOperations {
  inspect(route: SessionRoute): Promise<SchemaCapability>;
  next(input:
    | { readonly kind: "general"; readonly route: GeneralRoute; readonly observation: GeneralObservation }
    | { readonly kind: "idea"; readonly route: IdeaRoute }
  ): Promise<NextStep>;
  observe(route: IdeaRoute): Promise<IdeaSnapshot>;
  readSince(route: IdeaRoute, after: EventCursor): Promise<EventDelta>;
  appendInteraction(route: IdeaRoute, expectedHead: EventCursor,
    event: Extract<IdeaEventInput, { type: "ping" | "pong" }>): Promise<AppendReceipt>;
  appendDecision(route: IdeaRoute, input: InputParams["idea.decision.append"]): Promise<AppendReceipt>;
}
