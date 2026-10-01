/**
 * Ideal World design sketch for the daemon's upstream connection.
 * This is a protocol proposal, not a runtime implementation.
 *
 * The transport changes by deployment mode; routing and interaction semantics do not.
 * Project-version Silvermoon remains the authority that validates and appends events.
 * Exact wire formats and URL normalization remain open until prerequisite work is done.
 */

export interface SecretReference {
  /** Resolve the secret from a protected local source; never put its value in a URL. */
  readonly source: "environment";
  readonly name: string;
}

export type UpstreamConnectionConfig =
  | {
      /** The worker daemon makes an outbound connection; no inbound port is opened. */
      readonly mode: "connect";
      readonly protocol: "wss";
      readonly endpoint: string;
      readonly credential: SecretReference;
    }
  | {
      /** Local/test mode; remote binding must be an explicit later policy decision. */
      readonly mode: "serve";
      readonly protocol: "http-sse";
      readonly listen: {
        readonly host: "127.0.0.1" | "::1";
        readonly port: number;
      };
      readonly apiKey: SecretReference;
    };

/** Repository remote URL is project identity; credentials must not be part of this value. */
export type ProjectRemoteUrl = string;

/** A repository project and idea identify work independently of any particular worktree. */
export interface IdeaRoute {
  readonly project: ProjectRemoteUrl;
  readonly ideaId: string;
}

/** The current log position used to reject stale concurrent append attempts. */
export interface LogHead {
  readonly sequence: number;
  readonly digest: string;
}

/** Stable across reconnect retries so the same request cannot append twice. */
export interface RequestEnvelope {
  readonly protocolVersion: 1;
  readonly requestId: string;
  readonly body: UpstreamRequest;
}

export type UpstreamRequest =
  | {
      /** Append an upstream instruction as a project interaction event. */
      readonly type: "ping.append";
      readonly target: IdeaRoute;
      readonly expectedHead: LogHead;
      readonly message: string;
    }
  | {
      /** Resume project interaction events after the last event the caller observed. */
      readonly type: "events.subscribe";
      readonly target: IdeaRoute;
      readonly afterSequence: number;
    };

export type DaemonMessage =
  | {
      readonly type: "ready";
      readonly protocolVersion: 1;
      readonly daemonId: string;
    }
  | {
      /**
       * Confirms durable acceptance of the request and its project event sequence.
       * It does not claim that a downstream Agent received or processed the ping.
       */
      readonly type: "request.accepted";
      readonly requestId: string;
      readonly target: IdeaRoute;
      readonly eventSequence: number;
    }
  | {
      readonly type: "request.rejected";
      readonly requestId: string;
      readonly reason:
        | "unknown-project"
        | "unknown-idea"
        | "stale-log-head"
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
      /** Actual project interaction facts, replayable by route and event sequence. */
      readonly type: "interaction";
      readonly target: IdeaRoute;
      readonly eventSequence: number;
      readonly eventType: "ping" | "pong";
      readonly message: string;
    };

/**
 * Both transports carry the same JSON message shapes:
 * - connect: WSS, with ready/receipt/delivery/interaction frames on one connection.
 * - serve: POST /v1/messages and GET /v1/events?afterSequence=... (SSE).
 *
 * Transport receipts, downstream delivery observations, and project pong events
 * are separate facts. A pong is never an acknowledgement for a particular ping.
 * The local service binds to loopback by default and requires API-key authentication.
 */
export type UpstreamProtocol = RequestEnvelope | DaemonMessage;
