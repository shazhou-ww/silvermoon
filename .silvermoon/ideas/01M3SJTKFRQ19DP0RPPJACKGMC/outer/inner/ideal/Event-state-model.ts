// Ideal World 设计模型，不是生产入口。外层负责严格解析、授权及 Git 校验。
export type GitOid = string;

export type DecisionField =
  | "approvedRevision"
  | "implementationAcceptedRevision"
  | "deploymentAcceptedRevision";

export interface StatusProjection {
  readonly id: string;
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

// null 表示移除可选字段；不是将 null 写进 status 投影。
export type IdeaEvent = { readonly sequence: number } & (
  | {
      readonly type: "alias.updated";
      readonly payload: { readonly alias: string | null };
    }
  | {
      readonly type: "language.updated";
      readonly payload: { readonly language: string | null };
    }
  | {
      readonly type: "ideal.approved";
      readonly payload: { readonly idealRevision: GitOid };
    }
  | {
      readonly type: "implementation.accepted";
      readonly payload: { readonly implementationRevision: GitOid };
    }
  | {
      readonly type: "deployment.accepted";
      readonly payload: { readonly deploymentRevision: GitOid };
    }
  | {
      readonly type: "idea.abandoned";
    }
  | {
      readonly type: "idea.resumed";
    }
  | {
      readonly type: "decision.retracted";
      readonly payload: {
        readonly field: DecisionField;
        readonly expectedRevision: GitOid;
      };
    }
);

export interface EventState {
  readonly status: StatusProjection;
  readonly sequence: number;
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
  | "no-state-change"
  | "stale-decision-target";

export type Reduction =
  | { readonly ok: true; readonly state: EventState }
  | { readonly ok: false; readonly code: Rejection; readonly sequence: number };

// 身份来自 idea 目录；存在即已创建，空日志是合法初态。
export function initialEventState(ideaId: string): EventState {
  return { status: { id: ideaId }, sequence: 0 };
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

// 输入已通过严格 schema 校验。失败不改变前态或消费序号。
// 此处只归约业务事实；实际写入前的世界复核和人工门槛属于命令层。
export function reduceEvent(
  before: EventState,
  event: IdeaEvent,
): Reduction {
  const reject = (code: Rejection): Reduction => ({
    ok: false,
    code,
    sequence: event.sequence,
  });
  if (
    !Number.isSafeInteger(event.sequence)
    || event.sequence < 1
    || event.sequence !== before.sequence + 1
  ) return reject("sequence-conflict");

  const status = { ...before.status };
  switch (event.type) {
    case "alias.updated": {
      const value = event.payload.alias;
      if (value === null) {
        if (status.alias === undefined) return reject("no-state-change");
        delete status.alias;
      } else {
        if (status.alias === value) return reject("no-state-change");
        status.alias = value;
      }
      break;
    }
    case "language.updated": {
      const value = event.payload.language;
      if (value === null) {
        if (status.language === undefined) return reject("no-state-change");
        delete status.language;
      } else {
        if (status.language === value) return reject("no-state-change");
        status.language = value;
      }
      break;
    }
    case "ideal.approved":
      if (status.approvedRevision === event.payload.idealRevision) {
        return reject("no-state-change");
      }
      status.approvedRevision = event.payload.idealRevision;
      break;
    case "implementation.accepted":
      if (status.implementationAcceptedRevision === event.payload.implementationRevision) {
        return reject("no-state-change");
      }
      status.implementationAcceptedRevision = event.payload.implementationRevision;
      break;
    case "deployment.accepted":
      if (status.deploymentAcceptedRevision === event.payload.deploymentRevision) {
        return reject("no-state-change");
      }
      status.deploymentAcceptedRevision = event.payload.deploymentRevision;
      break;
    case "idea.abandoned":
      if (status.abandoned) return reject("no-state-change");
      status.abandoned = true;
      break;
    case "idea.resumed":
      if (!status.abandoned) return reject("no-state-change");
      delete status.abandoned;
      break;
    case "decision.retracted": {
      const { field, expectedRevision } = event.payload;
      if (status[field] !== expectedRevision) {
        return reject("stale-decision-target");
      }
      delete status[field];
      break;
    }
    default: {
      const unreachable: never = event;
      void unreachable;
      return reject("unsupported-event");
    }
  }
  return { ok: true, state: { status, sequence: event.sequence } };
}

export function replayEvents(
  ideaId: string,
  events: readonly IdeaEvent[],
): Reduction {
  let state = initialEventState(ideaId);
  for (const event of events) {
    const result = reduceEvent(state, event);
    if (!result.ok) return result;
    state = result.state;
  }
  return { ok: true, state };
}
