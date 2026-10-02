import type { IdeaRoute, LocalProjectRegistry } from "./copilot.js";

export interface ProjectReport {
  readonly intention: { readonly command: string; readonly args?: Record<string, unknown> };
  readonly observation: Record<string, unknown>;
  readonly actions: Record<string, unknown>;
  readonly response: Record<string, unknown>;
}

export interface RuntimeResult {
  readonly protocolVersion: 1;
  readonly exitCode: 0 | 1;
  readonly report: ProjectReport;
}

export class ProjectRuntime {
  constructor(options?: { registry?: LocalProjectRegistry });
  next(route: IdeaRoute): Promise<RuntimeResult>;
  replay(route: IdeaRoute): Promise<RuntimeResult>;
  readSince(route: IdeaRoute, cursor: { length: number; digest: string }): Promise<RuntimeResult>;
  appendInteraction(route: IdeaRoute, request: {
    type: "ping" | "pong";
    message: string;
    expectedLength: number;
    /** Canonical events-folder Git tree OID, using the project's object format. */
    expectedDigest: string;
  }): Promise<RuntimeResult>;
}
