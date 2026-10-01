/**
 * 理想世界的协议设计，不是当前运行时代码。
 * Before: v2 events.jsonl 有七种点分事件；回放结果为
 *   { status: { id, ...原 status 字段 }, sequence }。
 * After: 显式版本迁移将七种既有事件改为单词 type，再新增 ping/pong；
 *   保留原 payload、sequence、status 语义，完整回放增加有序消息投影。
 *   不创建第二份权威，也不改写 Git 中已存在的旧提交。
 */

export type Ulid = string;
export type GitObjectId = string;
export type Sender = "upstream" | "downstream";
export type Permission = Sender | "both";

/** Before: 已写入 v2 日志的事件名；迁移入口专用，不再接受为新写入请求。 */
export type LegacyEventType =
  | "alias.updated"
  | "language.updated"
  | "ideal.approved"
  | "implementation.accepted"
  | "deployment.accepted"
  | "idea.abandoned"
  | "idea.resumed";

/** After: 每个 type 是一个不含分隔符的 token，payload 与旧事件完全相同。 */
export const EVENT_RENAMES = {
  "alias.updated": "setAlias",
  "language.updated": "setLanguage",
  "ideal.approved": "approveIdeal",
  "implementation.accepted": "acceptImplementation",
  "deployment.accepted": "acceptDeployment",
  "idea.abandoned": "abandon",
  "idea.resumed": "resume",
} as const satisfies Record<LegacyEventType, string>;

export type ExistingEventType = (typeof EVENT_RENAMES)[LegacyEventType];

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
  readonly type: "ping" | "pong";
  readonly message: string;
}

/** After 新增；Before 不存在 interaction 投影。 */
export interface InteractionProjection {
  readonly messages: readonly Message[];
  readonly lastSignal: "ping" | "pong" | null;
}

/** Before 只有 status 与 sequence；After 增加 interaction。 */
export interface IdeaStateProjection {
  readonly status: StatusProjection;
  readonly sequence: number;
  readonly interaction: InteractionProjection;
}

/** Before 的记录已有 sequence/type/payload；After 两种新增 type 也是单词。 */
export type InteractionEvent = {
  readonly sequence: number;
  readonly type: "ping" | "pong";
  readonly payload: { readonly message: string };
};

/**
 * After 的发送方约定，供未来可信运行时路由，不是无状态 CLI 的
 * 身份认证规则，也不等同于球权。人工决定保留独立授权校验；
 * 旧日志不含发送者身份，回放不凭空断言历史记录由谁写入。
 */
export const EVENT_PERMISSIONS = {
  setAlias: "both",
  setLanguage: "both",
  approveIdeal: "upstream",
  acceptImplementation: "upstream",
  acceptDeployment: "upstream",
  abandon: "upstream",
  resume: "upstream",
  ping: "upstream",
  pong: "downstream",
} as const satisfies Record<ExistingEventType | InteractionEvent["type"], Permission>;

/** 仅最后的 ping/pong 决定路由；其他事件不更改 lastSignal。 */
export function nextRecipient(state: IdeaStateProjection): Sender {
  return state.interaction.lastSignal === "ping" ? "downstream" : "upstream";
}

export class InteractionTransitionError extends Error {
  readonly code: "sequence-conflict" | "incomplete-event" | "abandoned";

  constructor(code: InteractionTransitionError["code"], message: string) {
    super(message);
    this.name = "InteractionTransitionError";
    this.code = code;
  }
}

/**
 * After 新增：完整归约器在处理任一 v3 事件前调用此检查；决定事件
 * 仍需原有人工 gate。放弃期间只有 resume 可以写入，旧消息不交球。
 */
export function assertEventAllowed(
  state: IdeaStateProjection,
  type: ExistingEventType | InteractionEvent["type"],
): void {
  if (state.status.abandoned && type !== "resume") {
    throw new InteractionTransitionError("abandoned", "放弃后仅能追加 resume。");
  }
}

/** Before 的空状态已有 status.id 和 sequence: 0；After 增加空交互状态。 */
export function createInitialIdeaState(ideaId: Ulid): IdeaStateProjection {
  return {
    status: { id: ideaId },
    sequence: 0,
    interaction: { messages: [], lastSignal: null },
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
  assertEventAllowed(state, event.type);
  if (typeof event.payload.message !== "string" || !event.payload.message.trim()) {
    throw new InteractionTransitionError("incomplete-event", "message 不能为空。");
  }

  if (event.type !== "ping" && event.type !== "pong") {
    throw new InteractionTransitionError("incomplete-event", "未知交互事件。");
  }
  const current: Message = {
    sequence: event.sequence,
    type: event.type,
    message: event.payload.message,
  };
  return {
    status: state.status,
    sequence: event.sequence,
    interaction: {
      messages: [...state.interaction.messages, current],
      lastSignal: event.type,
    },
  };
}

/**
 * 不动点 1：任一事件 append 必须绑定作者观察过的完整日志长度和摘要；
 * 先前有新事件则拒绝，绝不能自动换序号并解释为已观察新状态。
 * 这个前态条件不等于 CLI 能验证发送者的主观阅读或身份。
 * 不动点 2：ping 投递新目标或决定；pong 只陈述下游当前的阻塞。
 * 两者各自追加有序消息，pong 不清除先前目标或宣称已完成工作，
 * 连续 pong 也产生新的状态。只有这两类事件更新 lastSignal；
 * 迁移后的业务事件（包括
 * 准确 revision 的批准/验收、放弃/恢复）都不交球。若上游完成决定后
 * 要把工作交给下游，必须另写 ping；放弃期间仅接受 resume，
 * 即使球权仍指向下游也不能继续追加 ping/pong 或派发执行。
 * 消息内容是供人或 Agent 阅读的字符串，不解析结果类型。
 *
 * CLI 仍使用 event replay/append，不新增 interaction 命令组。
 * append 的交互请求为 {type,payload:{message}}，CLI 分配 sequence；
 * 交互写入只绑定 replay 给出的准确本地日志长度和摘要，
 * 无须 fetch、--expected-primary、commit 或 clean worktree。乐观锁冲突后必须
 * 重新观察再提交 pong：不可把旧响应自动扩展到并发新增的 ping。
 * 仅在原前态后已写入准确相同的请求时，重试返回原结果；其余
 * 长度/摘要冲突必须重新观察，不能误认后来相同 message 为同一请求。
 * CLI 不认证发送角色，也不因球权拒绝连续 ping/pong；未来可信
 * 运行时按 EVENT_PERMISSIONS 路由。生命周期决策仍要求准确
 * primary、世界 revision 和人类授权。
 *
 * 显式一次性 v2 -> v3 迁移：冻结并观察 primary，先验证每个 v2 日志
 * 可完整归约；逐条只改 type（EVENT_RENAMES），保持顺序、sequence、
 * payload 和最终 status。用 v3 schema 与归约重验所有 idea 后，在
 * 同一可恢复事务中切换所有日志与项目版本；只允许经独立校验的版本
 * 边界突破旧日志的字节前缀，立即重新启用 append-only 保护。
 * Git 历史旧提交仍按 v2 解释，迁移 commit 按 v2 -> v3 验证逐条
 * 等价；绝不重写 Git 历史、直接手工编辑 JSONL 或推断新的人工决定。
 * 若旧日志在 abandon 和 resume 之间存在其他事件，迁移必须阻断并
 * 报告，不自动删除或重排历史。无法验证的日志、并发 primary 变化
 * 或中断必须阻断并明确恢复；
 * 老版运行时不能误读 v3。普通命令不自动触发迁移。
 */
