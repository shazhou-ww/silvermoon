// Ideal World 可执行设计模型，不是生产入口或 JSONL 解析器。
// 字符串格式、未知字段、规范字节、摘要真实性和 Git 基线由外层严格验证。
export type Ulid = string;
export type GitOid = string;
export type Sha256 = string;
export type Timestamp = string;

export type DecisionField =
  | "approvedRevision"
  | "implementationAcceptedRevision"
  | "deploymentAcceptedRevision";
export type FactField = DecisionField | "abandoned";

// 与旧 status 的业务字段一一对应；version 只是存储格式，不进入业务投影。
export interface StatusProjection {
  readonly id: Ulid;
  readonly alias?: string;
  readonly language?: string;
  readonly abandoned?: true;
  readonly approvedRevision?: GitOid;
  readonly implementationAcceptedRevision?: GitOid;
  readonly deploymentAcceptedRevision?: GitOid;
}

export interface WorldRevisions {
  readonly idealRevision: GitOid;
  readonly implementationRevision: GitOid;
  readonly deploymentRevision: GitOid;
}

export interface WorldObservation {
  readonly revisions: WorldRevisions;
  readonly objectFormat: "sha1" | "sha256";
  readonly target: "worktree" | "staged" | "commit" | "remote";
  readonly baseCommit: GitOid;
  readonly snapshotTree: GitOid;
}

export interface DecisionSource {
  readonly kind: "explicit-human";
  readonly actor: string | null;
  readonly reference: string;
  readonly occurredAt: Timestamp | null;
}

export interface DecisionContext {
  readonly decisionSource: DecisionSource;
  readonly observation: WorldObservation;
  readonly reviewedPrimaryCommit: GitOid;
}

export interface FactReference {
  readonly eventId: Ulid;
  // 导入事件可以同时建立多个事实，必须连同字段名定位。
  readonly field: FactField;
}

export type MetadataChange =
  | { readonly operation: "set"; readonly value: string }
  | { readonly operation: "remove" };

type MetadataPatch =
  | { readonly alias: MetadataChange; readonly language?: MetadataChange }
  | { readonly alias?: MetadataChange; readonly language: MetadataChange };

export interface EventPayloads {
  "idea.created": {
    readonly alias?: string;
    readonly language?: string;
  };
  "idea.imported": {
    readonly source: {
      readonly version: 1;
      readonly commit: GitOid;
      readonly statusPath: string;
      readonly statusBlob: GitOid;
      readonly statusSha256: Sha256;
    };
    readonly status: StatusProjection;
  };
  "idea.metadata.updated": {
    readonly changes: MetadataPatch;
    readonly reason?: string;
  };
  "ideal.approved": DecisionContext & { readonly idealRevision: GitOid };
  "implementation.accepted": DecisionContext & {
    readonly implementationRevision: GitOid;
  };
  "deployment.accepted": DecisionContext & {
    readonly deploymentRevision: GitOid;
  };
  "idea.abandoned": DecisionContext & { readonly reason: string };
  "idea.resumed": DecisionContext & {
    readonly target: FactReference & { readonly field: "abandoned" };
  };
  "decision.retracted": DecisionContext & {
    readonly target: FactReference & { readonly field: DecisionField };
    readonly expectedRevision: GitOid;
    readonly reason: string;
  };
}

export interface Envelope {
  readonly schemaVersion: 2;
  readonly eventId: Ulid;
  readonly ideaId: Ulid;
  readonly sequence: number;
  readonly previousEventHash: Sha256 | null;
  readonly basePrimaryCommit: GitOid;
  readonly recordedAt: Timestamp;
  readonly recordedBy: {
    readonly kind: "human" | "agent" | "tool";
    readonly identity: string | null;
  };
}

export type IdeaEvent = {
  [Type in keyof EventPayloads]: Envelope & {
    readonly type: Type;
    readonly payload: EventPayloads[Type];
  };
}[keyof EventPayloads];

// 解析/历史层提供准确规范行的摘要；reducer 不计算或信任调用者伪造的字节。
export interface VerifiedRecord {
  readonly event: IdeaEvent;
  readonly eventHash: Sha256;
}

export interface EventState {
  readonly status: StatusProjection | null;
  readonly sequence: number;
  readonly eventHash: Sha256 | null;
  readonly eventIds: readonly Ulid[];
  readonly origins: Readonly<Partial<Record<FactField, FactReference>>>;
}

export type Lifecycle =
  | "preparing"
  | "implementing"
  | "deploying"
  | "completed"
  | "abandoned";

export type Rejection =
  | "unsupported-event"
  | "sequence-conflict"
  | "previous-hash-conflict"
  | "duplicate-event-id"
  | "identity-mismatch"
  | "already-initialized"
  | "not-initialized"
  | "no-state-change"
  | "stale-decision-target"
  | "decision-context-mismatch"
  | "wrong-lifecycle-gate";

export type Reduction =
  | { readonly ok: true; readonly state: EventState }
  | { readonly ok: false; readonly code: Rejection; readonly eventId: Ulid };

export function emptyEventState(): EventState {
  return {
    status: null,
    sequence: 0,
    eventHash: null,
    eventIds: [],
    origins: {},
  };
}

export function deriveLifecycle(
  status: StatusProjection,
  worlds: WorldRevisions,
): Lifecycle {
  if (status.abandoned) return "abandoned";
  if (status.approvedRevision !== worlds.idealRevision) return "preparing";
  if (status.implementationAcceptedRevision !== worlds.implementationRevision) {
    return "implementing";
  }
  if (status.deploymentAcceptedRevision !== worlds.deploymentRevision) {
    return "deploying";
  }
  return "completed";
}

function matchesOrigin(
  state: EventState,
  target: FactReference,
): boolean {
  const origin = state.origins[target.field];
  return origin?.eventId === target.eventId && origin.field === target.field;
}

// 错误输入不消费序号、不改变前态。已存在请求的幂等回执由写入层处理；
// 日志真的包含重复 ID 或无操作记录时，回放必须失败，不能悄悄忽略。
export function reduceEvent(
  before: EventState,
  record: VerifiedRecord,
): Reduction {
  const event = record.event;
  const reject = (code: Rejection): Reduction => ({
    ok: false,
    code,
    eventId: event.eventId,
  });
  if (event.schemaVersion !== 2) return reject("unsupported-event");
  if (
    !Number.isSafeInteger(event.sequence)
    || event.sequence < 1
    || event.sequence !== before.sequence + 1
  ) return reject("sequence-conflict");
  if (event.previousEventHash !== before.eventHash) {
    return reject("previous-hash-conflict");
  }
  if (before.eventIds.includes(event.eventId)) return reject("duplicate-event-id");
  if (before.status !== null && before.status.id !== event.ideaId) {
    return reject("identity-mismatch");
  }

  const origins = { ...before.origins };
  const origin = (field: FactField): FactReference => ({
    eventId: event.eventId,
    field,
  });
  const finish = (status: StatusProjection): Reduction => ({
    ok: true,
    state: {
      status,
      sequence: event.sequence,
      eventHash: record.eventHash,
      eventIds: [...before.eventIds, event.eventId],
      origins,
    },
  });

  if (event.type === "idea.created") {
    if (before.status !== null) return reject("already-initialized");
    return finish({ id: event.ideaId, ...event.payload });
  }
  if (event.type === "idea.imported") {
    if (before.status !== null) return reject("already-initialized");
    if (event.payload.status.id !== event.ideaId) return reject("identity-mismatch");
    const status = { ...event.payload.status };
    const fields: readonly FactField[] = [
      "abandoned", "approvedRevision",
      "implementationAcceptedRevision", "deploymentAcceptedRevision",
    ];
    for (const field of fields) {
      if (status[field] !== undefined) origins[field] = origin(field);
    }
    return finish(status);
  }
  if (before.status === null) return reject("not-initialized");
  const status = { ...before.status };

  if (event.type === "idea.metadata.updated") {
    const fields = ["alias", "language"] as const;
    let changed = false;
    for (const field of fields) {
      const change = event.payload.changes[field];
      if (change === undefined) continue;
      if (change.operation === "remove") {
        if (status[field] === undefined) return reject("no-state-change");
        delete status[field];
      } else {
        if (status[field] === change.value) return reject("no-state-change");
        status[field] = change.value;
      }
      changed = true;
    }
    return changed ? finish(status) : reject("no-state-change");
  }

  const context = event.payload;
  if (
    context.decisionSource.kind !== "explicit-human"
    || context.reviewedPrimaryCommit !== event.basePrimaryCommit
    || context.observation.baseCommit !== context.reviewedPrimaryCommit
    || !["commit", "remote"].includes(context.observation.target)
  ) return reject("decision-context-mismatch");
  const worlds = context.observation.revisions;
  const gate = deriveLifecycle(status, worlds);

  switch (event.type) {
    case "ideal.approved":
      if (event.payload.idealRevision !== worlds.idealRevision) {
        return reject("decision-context-mismatch");
      }
      if (status.approvedRevision === event.payload.idealRevision) {
        return reject("no-state-change");
      }
      if (gate !== "preparing") return reject("wrong-lifecycle-gate");
      status.approvedRevision = event.payload.idealRevision;
      origins.approvedRevision = origin("approvedRevision");
      break;
    case "implementation.accepted":
      if (event.payload.implementationRevision !== worlds.implementationRevision) {
        return reject("decision-context-mismatch");
      }
      if (status.implementationAcceptedRevision === event.payload.implementationRevision) {
        return reject("no-state-change");
      }
      if (gate !== "implementing") return reject("wrong-lifecycle-gate");
      status.implementationAcceptedRevision = event.payload.implementationRevision;
      origins.implementationAcceptedRevision = origin("implementationAcceptedRevision");
      break;
    case "deployment.accepted":
      if (event.payload.deploymentRevision !== worlds.deploymentRevision) {
        return reject("decision-context-mismatch");
      }
      if (status.deploymentAcceptedRevision === event.payload.deploymentRevision) {
        return reject("no-state-change");
      }
      if (gate !== "deploying") return reject("wrong-lifecycle-gate");
      status.deploymentAcceptedRevision = event.payload.deploymentRevision;
      origins.deploymentAcceptedRevision = origin("deploymentAcceptedRevision");
      break;
    case "idea.abandoned":
      if (status.abandoned) return reject("no-state-change");
      status.abandoned = true;
      origins.abandoned = origin("abandoned");
      break;
    case "idea.resumed":
      if (!status.abandoned || !matchesOrigin(before, event.payload.target)) {
        return reject("stale-decision-target");
      }
      delete status.abandoned;
      delete origins.abandoned;
      break;
    case "decision.retracted": {
      const { target, expectedRevision } = event.payload;
      if (
        status[target.field] !== expectedRevision
        || !matchesOrigin(before, target)
      ) return reject("stale-decision-target");
      delete status[target.field];
      delete origins[target.field];
      break;
    }
    default: {
      const unreachable: never = event;
      void unreachable;
      return reject("unsupported-event");
    }
  }
  return finish(status);
}

export function replayEvents(records: readonly VerifiedRecord[]): Reduction {
  let state = emptyEventState();
  for (const record of records) {
    const result = reduceEvent(state, record);
    if (!result.ok) return result;
    state = result.state;
  }
  return { ok: true, state };
}
