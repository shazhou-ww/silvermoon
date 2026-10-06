/**
 * Ideal World 协议候选，不是已实现的 SDK 或发布 API。
 * 字符串/数值约束与跨消息不变量仍须运行时校验。
 */

export type ProtocolVersion = 1;
export type WssSubprotocol = "silvermoon.v1";
export type RequestId = string;
export type ActionId = string;
export type SubscriptionId = string;
export type GitOid = string;

export type GeneralRoute =
  | { readonly scope: "device" }
  | { readonly scope: "project"; readonly projectUrl: string };

export type IdeaRoute =
  | { readonly scope: "device-idea"; readonly ideaId: string }
  | { readonly scope: "idea"; readonly projectUrl: string; readonly ideaId: string };

export type SessionRoute = GeneralRoute | IdeaRoute;

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
        | "invalid-request" | "unauthenticated" | "unsupported-version"
        | "unsupported-capability" | "unknown-project" | "unknown-idea"
        | "request-id-conflict" | "action-id-conflict" | "session-conflict"
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
  | {
      readonly outcome: "completed";
      readonly message: string;
      readonly evidence: readonly Evidence[];
    }
  | {
      readonly outcome: "blocked";
      readonly message: string;
      readonly needs: readonly string[];
    }
  | { readonly outcome: "unknown"; readonly message: string };

export interface GeneralAction {
  readonly kind: "general";
  readonly actionId: ActionId;
  readonly route: GeneralRoute;
  readonly basis: { readonly requestIds: readonly RequestId[] };
  readonly instruction: string;
}

export interface IdeaAction {
  readonly kind: "idea";
  readonly actionId: ActionId;
  readonly route: IdeaRoute;
  readonly basis: {
    readonly head: EventCursor;
    readonly revisions: WorldRevisions;
  };
  readonly instruction: string;
}

export type Action = GeneralAction | IdeaAction;
export type ActionReference =
  | Pick<GeneralAction, "kind" | "actionId" | "route" | "basis">
  | Pick<IdeaAction, "kind" | "actionId" | "route" | "basis">;

export interface GeneralObservation {
  readonly binding: SessionBinding & { readonly route: GeneralRoute };
  readonly requests: readonly { readonly requestId: RequestId; readonly message: string }[];
  readonly replies: readonly { readonly action: GeneralAction; readonly result: ActionResult }[];
}

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

export type DurableAcceptance =
  | {
      readonly kind: "agent-session";
      readonly binding: SessionBinding & { readonly route: GeneralRoute };
      readonly sdkReceiptReference: string;
    }
  | {
      readonly kind: "idea-event";
      readonly receipt: AppendReceipt;
    };

export type RequestReceipt =
  | { readonly state: "pending"; readonly requestId: RequestId }
  | { readonly state: "accepted"; readonly requestId: RequestId; readonly durable: DurableAcceptance }
  | { readonly state: "failed"; readonly requestId: RequestId; readonly error: ProtocolError }
  | { readonly state: "unknown"; readonly requestId: RequestId; readonly reason: string }
  | { readonly state: "not-found"; readonly requestId: RequestId };

export type Delivery =
  | {
      readonly state: "queued" | "delivered" | "processed";
      readonly boundary: string;
      readonly sdkEvidenceReference: string;
    }
  | { readonly state: "unknown"; readonly reason: string };

export type RequestMessage<M> = {
  [K in keyof M & string]: {
    readonly protocolVersion: ProtocolVersion;
    readonly kind: "request";
    readonly requestId: RequestId;
    readonly operation: K;
    readonly params: M[K];
  }
}[keyof M & string];

export type ResponseMessage<M> = {
  [K in keyof M & string]: {
    readonly protocolVersion: ProtocolVersion;
    readonly kind: "response";
    readonly requestId: RequestId;
    readonly operation: K;
  } & (
    | { readonly status: "ok"; readonly result: M[K] }
    | { readonly status: "error"; readonly error: ProtocolError }
  )
}[keyof M & string];

// 上游 WSS 操作与后面的本地 SDK 边界分开。
export interface UpstreamRequestParams {
  "project.onboard": { readonly projectUrl: string };
  "general.submit": { readonly route: GeneralRoute; readonly message: string; readonly inReplyToActionId: ActionId | null };
  "idea.ping.append": { readonly route: IdeaRoute; readonly expectedHead: EventCursor; readonly message: string; readonly inReplyToActionId: ActionId | null };
  "idea.decision.append": {
    readonly route: IdeaRoute;
    readonly expectedHead: EventCursor;
    readonly expectedPrimary: GitOid;
    readonly decision: HumanDecision;
    readonly humanStatement: string;
    readonly inReplyToActionId: ActionId | null;
  };
  "idea.observe": { readonly route: IdeaRoute };
  "idea.events.subscribe": { readonly route: IdeaRoute; readonly after: EventCursor };
  "idea.events.unsubscribe": { readonly subscriptionId: SubscriptionId };
  "request.inspect": { readonly targetRequestId: RequestId };
  "action.ack": { readonly actionId: ActionId; readonly boundary: "received" };
}

export interface UpstreamResponseResults {
  "project.onboard": { readonly duplicate: boolean; readonly durable: Extract<DurableAcceptance, { kind: "agent-session" }> };
  "general.submit": { readonly duplicate: boolean; readonly durable: Extract<DurableAcceptance, { kind: "agent-session" }> };
  "idea.ping.append": { readonly duplicate: boolean; readonly receipt: AppendReceipt };
  "idea.decision.append": { readonly duplicate: boolean; readonly receipt: AppendReceipt };
  "idea.observe": IdeaSnapshot;
  "idea.events.subscribe": { readonly subscriptionId: SubscriptionId; readonly delta: EventDelta };
  "idea.events.unsubscribe": { readonly subscriptionId: SubscriptionId };
  "request.inspect": RequestReceipt;
  "action.ack": { readonly actionId: ActionId };
}

export type UpstreamRequest = RequestMessage<UpstreamRequestParams>;
export type UpstreamResponse = ResponseMessage<UpstreamResponseResults>;

export type ReplyRecording =
  | { readonly kind: "general-session" }
  | { readonly kind: "idea-event"; readonly receipt: AppendReceipt }
  | { readonly kind: "not-recorded"; readonly error: ProtocolError };

export type DaemonEvent =
  | { readonly type: "request.received"; readonly requestId: RequestId }
  | {
      readonly type: "project.ready";
      readonly requestId: RequestId;
      readonly projectUrl: string;
      readonly projectKey: string;
      readonly schema: SchemaCapability;
      readonly binding: SessionBinding & { readonly route: { readonly scope: "project"; readonly projectUrl: string } };
    }
  | { readonly type: "action.handoff"; readonly recipient: "upstream"; readonly action: Action }
  | { readonly type: "action.delivery"; readonly action: ActionReference; readonly binding: SessionBinding; readonly delivery: Delivery }
  | { readonly type: "action.result"; readonly action: ActionReference; readonly binding: SessionBinding; readonly result: ActionResult; readonly recording: ReplyRecording }
  | { readonly type: "idea.events"; readonly subscriptionId: SubscriptionId; readonly delta: EventDelta }
  | { readonly type: "subscription.error"; readonly subscriptionId: SubscriptionId; readonly error: ProtocolError }
  | { readonly type: "loop.state"; readonly step: Exclude<NextStep, { state: "dispatch" }> };

export interface DaemonEventMessage {
  readonly protocolVersion: ProtocolVersion;
  readonly kind: "event";
  readonly connectionId: string;
  readonly sequence: number;
  readonly event: DaemonEvent;
}

export interface WireProtocolError {
  readonly protocolVersion: ProtocolVersion;
  readonly kind: "protocol-error";
  readonly error: ProtocolError;
}

export type UpstreamToDaemonMessage = UpstreamRequest;
export type DaemonToUpstreamMessage = UpstreamResponse | DaemonEventMessage | WireProtocolError;
export type WssMessage = UpstreamToDaemonMessage | DaemonToUpstreamMessage;

// 下游 adapter 归一化本地 SDK 调用，不新增 WSS 服务。
export interface DownstreamCapabilities {
  readonly resumeSession: boolean;
  readonly sendWhileRunning: boolean;
  readonly inspectAction: boolean;
  readonly durableRequestCorrelation: boolean;
  readonly structuredReply: boolean;
}

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

export type DownstreamSendParams =
  | { readonly binding: SessionBinding & { readonly route: GeneralRoute }; readonly action: GeneralAction }
  | { readonly binding: SessionBinding & { readonly route: IdeaRoute }; readonly action: IdeaAction };

export type SessionState =
  | { readonly state: "running" | "idle" | "gone" }
  | { readonly state: "unknown"; readonly reason: string };

export interface DownstreamRequestParams {
  "adapter.capabilities": Record<string, never>;
  "session.open": SessionOpenParams;
  "session.inspect": { readonly binding: SessionBinding };
  "session.send": DownstreamSendParams;
  "action.inspect": { readonly binding: SessionBinding; readonly action: ActionReference };
  "session.detach": { readonly binding: SessionBinding };
}

export interface DownstreamResponseResults {
  "adapter.capabilities": DownstreamCapabilities;
  "session.open": { readonly binding: SessionBinding; readonly state: SessionState };
  "session.inspect": { readonly binding: SessionBinding; readonly state: SessionState };
  "session.send": { readonly binding: SessionBinding; readonly action: ActionReference; readonly delivery: Delivery };
  "action.inspect": {
    readonly binding: SessionBinding;
    readonly action: ActionReference;
    readonly observation:
      | { readonly state: "found"; readonly delivery: Delivery }
      | { readonly state: "not-found"; readonly boundary: string }
      | { readonly state: "unknown"; readonly reason: string };
  };
  "session.detach": { readonly binding: SessionBinding; readonly disconnected: true };
}

export type DownstreamRequest = RequestMessage<DownstreamRequestParams>;
export type DownstreamResponse = ResponseMessage<DownstreamResponseResults>;

export type DownstreamEvent =
  | { readonly type: "session.state"; readonly binding: SessionBinding; readonly state: SessionState }
  | { readonly type: "action.delivery"; readonly binding: SessionBinding; readonly action: ActionReference; readonly delivery: Delivery }
  | { readonly type: "action.reply"; readonly binding: SessionBinding; readonly action: ActionReference; readonly result: ActionResult }
  | { readonly type: "action.activity"; readonly binding: SessionBinding; readonly action: ActionReference; readonly activity: "message" | "tool-start" | "tool-end" };

export type SilvermoonRequestParams = {
  "project.inspect": { readonly route: SessionRoute };
  "next": (
    | { readonly kind: "general"; readonly route: GeneralRoute; readonly observation: GeneralObservation }
    | { readonly kind: "idea"; readonly route: IdeaRoute }
  );
  "idea.observe": { readonly route: IdeaRoute };
  "idea.readSince": { readonly route: IdeaRoute; readonly after: EventCursor };
  "idea.interaction.append": { readonly route: IdeaRoute; readonly expectedHead: EventCursor; readonly event: Extract<IdeaEventInput, { type: "ping" | "pong" }> };
  "idea.decision.append": UpstreamRequestParams["idea.decision.append"];
};

export interface SilvermoonResponseResults {
  "project.inspect": { readonly route: SessionRoute; readonly schema: SchemaCapability };
  "next": NextStep;
  "idea.observe": IdeaSnapshot;
  "idea.readSince": EventDelta;
  "idea.interaction.append": AppendReceipt;
  "idea.decision.append": AppendReceipt;
}

export type SilvermoonRequest = RequestMessage<SilvermoonRequestParams>;
export type SilvermoonResponse = ResponseMessage<SilvermoonResponseResults>;
