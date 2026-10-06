import type {
  AgentMessage, ChannelBinding, GeneralRoute, IdeaAction, IdeaEvent, IdeaRoute,
  MessageEnvelope, MessageContent, NextStep, Sender,
  WssSubprotocol,
} from "./Protocol-types.js";

// envelope 示例不填造 hash；验证时对规范字节计算真实 ID。
const oid = "0123456789012345678901234567890123456789";
const ideaRoute = {
  scope: "idea", projectUrl: "https://github.com/example/project.git",
  ideaId: "01M3SJ90WVJB56Z1PP72BPAHFZ",
} satisfies IdeaRoute;
export const channel = {
  channelId: "example-upstream-channel", route: ideaRoute,
  silvermoonId: "device-1", agentSessionId: "agent-session-1",
  agentGeneration: 1, connectionRole: "upstream",
} satisfies ChannelBinding;
export const selectedSubprotocol = "silvermoon.v1" satisfies WssSubprotocol;
export const inputEnvelope = {
  version: 1, channelId: channel.channelId, sender: "agent",
  refs: { after: null, inputs: [] },
  content: "继续当前工作。",
} satisfies MessageEnvelope<MessageContent>;
export const action = {
  kind: "idea", actionId: "action-1", route: ideaRoute,
  basis: {
    head: { length: 120, digest: oid },
    revisions: { idealRevision: oid, implementationRevision: oid, deploymentRevision: oid },
  },
  instruction: "执行当前任务并报告结果。",
} satisfies IdeaAction;
export function resultEnvelope(inputId: string, previousId: string | null): MessageEnvelope<MessageContent> {
  return {
    version: 1, channelId: channel.channelId, sender: "silvermoon",
    refs: { after: previousId, inputs: [inputId] },
    content: "项目暂不可用，需要先检查仓库访问情况。",
  };
}
export function downstreamEnvelope(channelId: string): MessageEnvelope<MessageContent> {
  return {
    version: 1, channelId, sender: "silvermoon",
    refs: { after: null, inputs: [] }, content: action.instruction,
  };
}
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

// RPC object 不是 Agent 对话正文。
// @ts-expect-error
export const invalidRpcContent: MessageContent = { type: "input", operation: "general.submit", params: { message: "检查状态。" } };
// 本期未定义多模态附件类型。
// @ts-expect-error
export const invalidMultimodalContent: MessageContent = [{ type: "image", url: "https://example.com/image.png" }];
// 相对接线角色不是消息 sender。
// @ts-expect-error
export const invalidSender: Sender = "downstream";
// envelope 不重复具体 participant 身份。
// @ts-expect-error
export const invalidIdentity: MessageEnvelope<MessageContent> = { ...inputEnvelope, sender: { kind: "agent", id: "agent-1" } };
// general route 不绑定 idea。
// @ts-expect-error
export const invalidGeneralRoute: GeneralRoute = { scope: "project", projectUrl: ideaRoute.projectUrl, ideaId: ideaRoute.ideaId };
// wait 不伪造 instruction。
// @ts-expect-error
export const invalidWait: NextStep = { state: "wait", route: ideaRoute, reason: "等待。", recipient: "downstream", action };
// WSS/Agent 外层不再是 request/response/notification 或 hello。
// @ts-expect-error
export const invalidOuterMessage: AgentMessage = { kind: "request", requestId: "old-request", operation: "idea.observe", params: { route: ideaRoute } };
// 固定 subprotocol 不降级。
// @ts-expect-error
export const invalidSubprotocol: WssSubprotocol = "silvermoon.v0";
