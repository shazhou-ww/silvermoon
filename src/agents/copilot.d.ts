import type { CopilotClient, PermissionHandler } from "@github/copilot-sdk";

export interface IdeaRoute {
  readonly projectUrl: string;
  readonly ideaId: string;
}

export interface AdapterCapabilities {
  readonly resumeSession: boolean;
  readonly observation: "session" | "activity" | "activityDetails";
  readonly sendWhileRunning: boolean;
}

export type Delivery =
  | { readonly state: "queued"; readonly boundary: string }
  | { readonly state: "delivered"; readonly boundary: string }
  | { readonly state: "processed"; readonly boundary: string }
  | { readonly state: "unknown"; readonly reason: string };

export type SessionObservation =
  | { readonly type: "session"; readonly state: "running" | "idle" | "gone" }
  | { readonly type: "session"; readonly state: "unknown"; readonly reason: string }
  | { readonly type: "message"; readonly text: string }
  | {
      readonly type: "tool";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "started" | "succeeded" | "failed";
    }
  | {
      readonly type: "toolDetails";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "started";
      readonly input: string;
    }
  | {
      readonly type: "toolDetails";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "succeeded";
      readonly output: string;
    }
  | {
      readonly type: "toolDetails";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "failed";
      readonly error: string;
    };

export interface AgentAdapter {
  capabilities(): Promise<AdapterCapabilities>;
  start(route: IdeaRoute): Promise<void>;
  observe(route: IdeaRoute): AsyncIterable<SessionObservation>;
  send(route: IdeaRoute, message: string): AsyncIterable<Delivery>;
  events(route: IdeaRoute): AsyncIterable<string>;
  close(): Promise<void>;
}

export class LocalProjectRegistry {
  constructor(options?: { root?: string });
  register(projectUrl: string, projectRoot: string): Promise<void>;
  resolve(route: IdeaRoute): Promise<string>;
  acquire(route: IdeaRoute): Promise<() => Promise<void>>;
  recover(route: IdeaRoute, options: { confirmStopped: true }): Promise<void>;
}

export class CopilotAdapter implements AgentAdapter {
  constructor(options: {
    onPermissionRequest: PermissionHandler;
    client?: CopilotClient;
    registry?: LocalProjectRegistry;
  });
  capabilities(): Promise<AdapterCapabilities>;
  start(route: IdeaRoute): Promise<void>;
  observe(route: IdeaRoute): AsyncIterable<SessionObservation>;
  send(route: IdeaRoute, message: string): AsyncIterable<Delivery>;
  events(route: IdeaRoute): AsyncIterable<string>;
}
