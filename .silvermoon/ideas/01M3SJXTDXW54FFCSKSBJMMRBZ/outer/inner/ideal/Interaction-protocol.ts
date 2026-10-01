/**
 * 理想世界的协议设计，不是当前运行时代码。
 * Before: v2 events.jsonl 只有生命周期事件；回放结果为
 *   { status: { id, ...原 status 字段 }, sequence }。
 * After: 原 status 和 sequence 不变；同一日志新增 ping/pong 两种
 *   事件，完整回放结果再包含 interaction。不创建第二份权威。
 *   所有已有事件只增加写入时的发送权限校验，不改其 payload 或归约。
 */

export type Ulid = string;
export type GitObjectId = string;
export type Sender = "upstream" | "downstream";
export type Permission = Sender | "both";

/** Before 的七种业务事件；After 仅为它们定义发送方权限，不另设 tap。 */
export type ExistingEventType =
  | "alias.updated"
  | "language.updated"
  | "ideal.approved"
  | "implementation.accepted"
  | "deployment.accepted"
  | "idea.abandoned"
  | "idea.resumed";

/** Before/After 均保留的 v2 status 字段；世界 revision 仍由观察决定。 */
export interface StatusProjection {
  readonly id: Ulid;
  readonly alias?: string;
  readonly language?: string;
  readonly abandoned?: true;
  readonly approvedRevision?: GitObjectId;
  readonly implementationAcceptedRevision?: GitObjectId;
  readonly deploymentAcceptedRevision?: GitObjectId;
}

/** After 新增：日志序号就是消息的身份，不再另设消息 ID。 */
export interface Message {
  readonly sequence: number;
  readonly message: string;
}

/** After 新增；Before 不存在 interaction 投影。 */
export interface InteractionProjection {
  readonly unansweredPings: readonly Message[];
  readonly lastPong?: Message;
  readonly lastSignal: "ping" | "pong" | null;
}

/** Before 只有 status 与 sequence；After 增加 interaction。 */
export interface IdeaStateProjection {
  readonly status: StatusProjection;
  readonly sequence: number;
  readonly interaction: InteractionProjection;
}

/** Before 的记录已有 sequence/type/payload；After 只新增单词 type。 */
export type InteractionEvent = {
  readonly sequence: number;
  readonly type: "ping" | "pong";
  readonly payload: { readonly message: string };
};

/**
 * After 新增的权限规则。upstream/downstream/both 仅约束谁可写入，
 * 不等同于球权；三个决策与放弃/恢复仍需单独的人类授权校验。
 * 旧日志不含发送者身份，回放不凭空断言历史记录由谁写入。
 */
export const EVENT_PERMISSIONS = {
  "alias.updated": "both",
  "language.updated": "both",
  "ideal.approved": "upstream",
  "implementation.accepted": "upstream",
  "deployment.accepted": "upstream",
  "idea.abandoned": "upstream",
  "idea.resumed": "upstream",
  ping: "upstream",
  pong: "downstream",
} as const satisfies Record<ExistingEventType | InteractionEvent["type"], Permission>;

/**
 * 角色必须来自可信调用边界；不能让输入文件或自报 CLI 参数充当身份。
 * 球在下游时仍允许上游连续 ping 或修改双方可写的 metadata。
 */
export function assertSenderAllowed(
  type: keyof typeof EVENT_PERMISSIONS,
  sender: Sender,
): void {
  const permission: Permission = EVENT_PERMISSIONS[type];
  if (permission !== "both" && permission !== sender) {
    throw new Error(`${sender} 无权追加 ${type}。`);
  }
}

/** 仅最后的 ping/pong 决定路由；其他事件不更改 lastSignal。 */
export function nextRecipient(state: IdeaStateProjection): Sender {
  return state.interaction.lastSignal === "ping" ? "downstream" : "upstream";
}

export class InteractionTransitionError extends Error {
  readonly code: "sequence-conflict" | "incomplete-event" | "no-state-change";

  constructor(code: InteractionTransitionError["code"], message: string) {
    super(message);
    this.name = "InteractionTransitionError";
    this.code = code;
  }
}

/** Before 的空状态已有 status.id 和 sequence: 0；After 增加空交互状态。 */
export function createInitialIdeaState(ideaId: Ulid): IdeaStateProjection {
  return {
    status: { id: ideaId },
    sequence: 0,
    interaction: { unansweredPings: [], lastSignal: null },
  };
}

/** After 新增的两种转换；Before 的生命周期事件沿用原 status 归约。 */
export function transitionInteraction(
  state: IdeaStateProjection,
  event: InteractionEvent,
): IdeaStateProjection {
  if (!Number.isSafeInteger(event.sequence) || event.sequence !== state.sequence + 1) {
    throw new InteractionTransitionError(
      "sequence-conflict",
      `事件序号必须是 ${state.sequence + 1}。`,
    );
  }
  if (typeof event.payload.message !== "string" || !event.payload.message.trim()) {
    throw new InteractionTransitionError("incomplete-event", "message 不能为空。");
  }

  const current: Message = { sequence: event.sequence, message: event.payload.message };
  if (event.type === "ping") {
    return {
      status: state.status,
      sequence: event.sequence,
      interaction: {
        ...state.interaction,
        unansweredPings: [...state.interaction.unansweredPings, current],
        lastSignal: "ping",
      },
    };
  }
  if (event.type !== "pong") {
    throw new InteractionTransitionError("incomplete-event", "未知交互事件。");
  }
  if (state.interaction.unansweredPings.length === 0) {
    throw new InteractionTransitionError("no-state-change", "没有未回应的 ping。");
  }
  return {
    status: state.status,
    sequence: event.sequence,
    interaction: { unansweredPings: [], lastPong: current, lastSignal: "pong" },
  };
}

/**
 * 只有两种状态变化：ping 在日志中新增一条未回应的消息；pong 回应
 * 前一完整投影中所有未回应的 ping，并清空该集合。下一条 ping 不受旧
 * pong 影响。只有这两类事件更新 lastSignal；所有既有业务事件（包括
 * 准确 revision 的批准/验收、放弃/恢复）都不交球。若上游完成决定后
 * 要把工作交给下游，必须另写 ping；已放弃状态先于路由阻止派发。
 * 消息内容是供人或 Agent 阅读的字符串，不解析结果类型。
 *
 * CLI 仍使用 event replay/append，不新增 interaction 命令组。
 * append 的交互请求为 {type,payload:{message}}，CLI 分配 sequence；
 * 交互写入只绑定 replay 给出的准确本地日志长度、摘要和可信角色，
 * 无须 fetch、--expected-primary、commit 或 clean worktree。乐观锁冲突后必须
 * 重新观察再提交 pong：不可把旧响应自动扩展到并发新增的 ping。
 * 仅在原前态后已写入准确相同的请求时，重试返回原结果；其余
 * 长度/摘要冲突必须重新观察，不能误认后来相同 message 为同一请求。
 * 生命周期决策仍要求准确 primary、世界 revision 和人类授权；
 * 原有事务恢复、schema 与 append-only 历史检查继续有效。
 */
