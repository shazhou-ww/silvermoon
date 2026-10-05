/**
 * daemon 上游连接的 Ideal World 类型草案，不是运行时代码。
 *
 * daemon 永远连接 upstream；本地 upstream server 由独立 CLI 启动。
 * HEADQUARTER Silvermoon 按目标 repository schema 保持事件校验、追加和流程判断的权威。
 * 类型表达三种调度范围；具体 wire 编码、治理操作结果及冲突协议仍待细化。
 */

export interface UpstreamConnectionConfig {
  /** 远端要求 wss://；本地 loopback 测试可显式使用 ws://。 */
  readonly endpoint: string;
  /** 只在受保护的用户级配置中保存；不放入 URL、命令行、日志或错误。 */
  readonly token: string;
}

export interface DaemonConfig {
  readonly version: 1;
  readonly daemonId: string;
  readonly storageRoot: string;
  readonly upstream: UpstreamConnectionConfig;
  readonly downstream: { readonly adapter: "copilot" };
}

/** 可迁移的对外项目地址；本机稳定身份是 projectKey，URL 不含凭据。 */
export type ProjectRemoteUrl = string;

/** 首次登记生成的稳定本机 key，不由 URL 哈希派生，不作为上游路由地址。 */
export type ProjectKey = string;

export interface ProjectRegistration {
  readonly projectKey: ProjectKey;
  readonly projectUrl: ProjectRemoteUrl;
  readonly repositoryPath: string;
}

/** 操作目标项目的上下文；请求仍由唯一 device governance session 处理。 */
export interface ProjectRoute {
  readonly scope: "project";
  readonly projectUrl: ProjectRemoteUrl;
}

/** Device-control project ideas are local to one device and need no remote URL. */
export interface DeviceIdeaRoute {
  readonly scope: "device-idea";
  readonly ideaId: string;
}

/** A managed project idea identifies work independently of any particular worktree. */
export interface IdeaRoute {
  readonly scope: "idea";
  readonly projectUrl: ProjectRemoteUrl;
  readonly ideaId: string;
}

/** project routes carry context; device and either idea route select persistent sessions. */
export type SessionRoute =
  | { readonly scope: "device" }
  | ProjectRoute
  | DeviceIdeaRoute
  | IdeaRoute;

/** Exact stream prefix; digest covers its canonical event folder at this byte length. */
export interface EventCursor {
  readonly length: number;
  readonly digest: string;
}

/** Full HEAD of one project idea event folder. */
export type LogHead = EventCursor;

/** Stable requestId lets upstream retry until the daemon acknowledges acceptance. */
export interface RequestEnvelope {
  readonly protocolVersion: 1;
  readonly requestId: string;
  readonly body: UpstreamRequest;
}

export type UpstreamRequest =
  | {
      /** Governance conversation is persisted by the bound Agent SDK session. */
      readonly type: "governance.submit";
      readonly route: { readonly scope: "device" } | ProjectRoute;
      readonly message: string;
    }
  | {
      /** Idea input is atomically appended to that idea's authoritative event stream. */
      readonly type: "idea.ping.append";
      readonly route: DeviceIdeaRoute | IdeaRoute;
      /** Stale is returned to upstream; the daemon never retries with a new head. */
      readonly expectedHead: LogHead;
      readonly message: string;
    }
  | {
      /** Production subscription to one idea stream; never implemented via replay CLI. */
      readonly type: "idea.events.subscribe";
      readonly route: DeviceIdeaRoute | IdeaRoute;
      readonly after: EventCursor;
    };

export type DaemonMessage =
  | {
      readonly type: "ready";
      readonly protocolVersion: 1;
      readonly daemonId: string;
    }
  | {
      /**
       * Acknowledges durable receipt/session handoff or an existing requestId receipt;
       * it does not mean the Agent processed the request or the device action completed.
       */
      readonly type: "request.accepted";
      readonly requestId: string;
      readonly route: SessionRoute;
      readonly duplicate: boolean;
      readonly durablePosition:
        | { readonly kind: "agent-session" }
        | { readonly kind: "idea-event"; readonly eventSequence: number; readonly head: LogHead };
    }
  | {
      readonly type: "request.rejected";
      readonly requestId: string;
      readonly reason:
        | "unknown-project"
        | "unknown-idea"
        | "stale-idea-head"
        | "request-id-conflict"
        | "conflict"
        | "unknown-result"
        | "cursor-gap"
        | "unauthorized"
        | "unsupported";
      readonly currentHead?: LogHead;
    }
  | {
      /** Delivery observations come from the downstream adapter, not from pong events. */
      readonly type: "delivery";
      readonly requestId: string;
      readonly state: "queued" | "delivered" | "processed" | "unknown";
      readonly boundary?: string;
      readonly reason?: string;
    }
  | {
      /** Incremental facts from an idea lifecycle stream, never a governance transcript. */
      readonly type: "interaction";
      readonly route: DeviceIdeaRoute | IdeaRoute;
      readonly eventSequence: number;
      readonly eventType: "ping" | "pong";
      readonly message: string;
      readonly head: LogHead;
    };

/**
 * 远端与本地 upstream server 向 daemon 提供同一 WebSocket 应用协议。
 * 本地服务可另有测试客户端入口，但 daemon 不承担 HTTP/SSE 服务。
 * 接收确认、Agent 投递观察和项目 pong 是不同事实，pong 不配对确认某条 ping。
 */
export type UpstreamProtocol = RequestEnvelope | DaemonMessage;
