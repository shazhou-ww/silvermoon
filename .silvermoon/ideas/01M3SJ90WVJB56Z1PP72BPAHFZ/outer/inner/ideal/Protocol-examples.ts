import type {
  DaemonEventMessage, DownstreamEvent, DownstreamRequest, DownstreamResponse,
  DownstreamRequestParams, DownstreamResponseResults, EventCursor, GeneralRoute,
  IdeaAction, IdeaEvent, IdeaRoute, NextStep, SilvermoonRequest, SilvermoonResponse,
  SilvermoonRequestParams, SilvermoonResponseResults, UpstreamRequest,
  UpstreamRequestParams, UpstreamResponse, UpstreamResponseResults, WssMessage, WssSubprotocol,
} from "./Protocol-types.js";

// 文档消息示例，不执行真实操作；OID 仅为格式示例，不声称对应真实 repo facts。
const oid = "0123456789012345678901234567890123456789";
const head = { length: 120, digest: oid } satisfies EventCursor;
export const appendedEvent = {
  sequence: 3, type: "ping", payload: { message: "继续当前工作。" },
} satisfies IdeaEvent;
const appendedHead = {
  length: head.length + new TextEncoder().encode(`${JSON.stringify(appendedEvent)}\n`).length,
  digest: "89abcdef0123456789abcdef0123456789abcdef01",
} satisfies EventCursor;
const ideaRoute = {
  scope: "idea", projectUrl: "https://github.com/example/project.git",
  ideaId: "01M3SJ90WVJB56Z1PP72BPAHFZ",
} satisfies IdeaRoute;
const generalRoute = {
  scope: "project", projectUrl: ideaRoute.projectUrl,
} satisfies GeneralRoute;
const action = {
  kind: "idea", actionId: "action-1", route: ideaRoute,
  basis: {
    head: appendedHead,
    revisions: { idealRevision: oid, implementationRevision: oid, deploymentRevision: oid },
  },
  instruction: "执行当前任务并返回结果与证据。",
} satisfies IdeaAction;
const binding = { route: ideaRoute, sessionId: "session-1", generation: 1 };
export const selectedSubprotocol = "silvermoon.v1" satisfies WssSubprotocol;

export const pingRequest = {
  protocolVersion: 1, kind: "request", requestId: "request-1",
  operation: "idea.ping.append",
  params: { route: ideaRoute, expectedHead: head, message: appendedEvent.payload.message, inReplyToActionId: null },
} satisfies UpstreamRequest;

export const pingResponse = {
  protocolVersion: 1, kind: "response", requestId: "request-1",
  operation: "idea.ping.append", status: "ok",
  result: {
    duplicate: false,
    receipt: { outcome: "appended", route: ideaRoute, eventSequence: 3, head: appendedHead },
  },
} satisfies UpstreamResponse;

export const staleResponse = {
  protocolVersion: 1, kind: "response", requestId: "request-2",
  operation: "idea.ping.append", status: "error",
  error: { code: "stale-head", message: "事件前态已变化。", expectedHead: head, currentHead: appendedHead },
} satisfies UpstreamResponse;

export const handoffMessage = {
  protocolVersion: 1, kind: "event", connectionId: "connection-1", sequence: 1,
  event: { type: "action.handoff", recipient: "upstream", action },
} satisfies DaemonEventMessage;

export const generalRequest = {
  protocolVersion: 1, kind: "request", requestId: "general-request-1",
  operation: "general.submit",
  params: { route: generalRoute, message: "检查项目状态。", inReplyToActionId: null },
} satisfies UpstreamRequest;

export const sendRequest = {
  protocolVersion: 1, kind: "request", requestId: "send-1",
  operation: "session.send", params: { binding, action },
} satisfies DownstreamRequest;

export const sendResponse = {
  protocolVersion: 1, kind: "response", requestId: "send-1",
  operation: "session.send", status: "ok",
  result: {
    binding, action,
    delivery: { state: "unknown", reason: "SDK 不能证明该动作已处理。" },
  },
} satisfies DownstreamResponse;

export const agentReply = {
  type: "action.reply", binding, action,
  result: { outcome: "blocked", message: "当前操作受阻。", needs: ["重新观察项目事实。"] },
} satisfies DownstreamEvent;

export const nextRequest = {
  protocolVersion: 1, kind: "request", requestId: "next-1",
  operation: "next", params: { kind: "idea", route: ideaRoute },
} satisfies SilvermoonRequest;

export const nextResponse = {
  protocolVersion: 1, kind: "response", requestId: "next-1",
  operation: "next", status: "ok",
  result: { state: "dispatch", recipient: "downstream", action },
} satisfies SilvermoonResponse;

export const wireExamples = [
  pingRequest, pingResponse, staleResponse, handoffMessage, generalRequest,
] satisfies readonly WssMessage[];

export const eventExamples = [
  { sequence: 1, type: "setAlias", payload: { alias: "example" } },
  { sequence: 2, type: "setLanguage", payload: { language: "zh-CN" } },
  { sequence: 3, type: "acceptIdeal", payload: { idealRevision: oid } },
  { sequence: 4, type: "acceptInner", payload: { implementationRevision: oid } },
  { sequence: 5, type: "acceptOuter", payload: { deploymentRevision: oid } },
  { sequence: 6, type: "abandon" },
  { sequence: 7, type: "resume" },
  { sequence: 8, type: "ping", payload: { message: "继续。" } },
  { sequence: 9, type: "pong", payload: { message: "报告当前结果。" } },
] satisfies readonly IdeaEvent[];

type Assert<T extends true> = T;
type SameKeys<A, B> = [Exclude<keyof A, keyof B> | Exclude<keyof B, keyof A>] extends [never] ? true : false;
export type OperationCoverage = [
  Assert<SameKeys<UpstreamRequestParams, UpstreamResponseResults>>,
  Assert<SameKeys<DownstreamRequestParams, DownstreamResponseResults>>,
  Assert<SameKeys<SilvermoonRequestParams, SilvermoonResponseResults>>,
];

// general route 不可携带 ideaId。
// @ts-expect-error
export const invalidGeneralRoute: GeneralRoute = { scope: "project", projectUrl: ideaRoute.projectUrl, ideaId: ideaRoute.ideaId };
// idea route 必须携带 ideaId。
// @ts-expect-error
export const invalidIdeaRoute: IdeaRoute = { scope: "idea", projectUrl: ideaRoute.projectUrl };
// ping request 不可缺少 expectedHead。
// @ts-expect-error
export const invalidPing: UpstreamRequest = { protocolVersion: 1, kind: "request", requestId: "bad-1", operation: "idea.ping.append", params: { route: ideaRoute, message: "继续。", inReplyToActionId: null } };
// 错误响应不可同时包含成功 result。
// @ts-expect-error
export const invalidResponse: UpstreamResponse = { ...staleResponse, result: pingResponse.result };
// wait 不可伪造 dispatch recipient/action。
// @ts-expect-error
export const invalidWait: NextStep = { state: "wait", route: ideaRoute, reason: "等待输入。", recipient: "downstream", action };
// 上游连接没有应用层 hello/welcome 消息。
// @ts-expect-error
export const invalidHello: WssMessage = { protocolVersion: 1, kind: "hello", daemonId: "daemon-1", connectionId: "connection-1", silvermoonVersion: "0.4.0", capabilities: [] };
// @ts-expect-error
export const invalidWelcome: WssMessage = { protocolVersion: 1, kind: "welcome", connectionId: "connection-1", status: "ok", capabilities: [] };
// 固定 subprotocol 不静默降级。
// @ts-expect-error
export const invalidSubprotocol: WssSubprotocol = "silvermoon.v0";
