import { spawnSync } from "node:child_process";
import type { SpawnSyncOptionsWithStringEncoding } from "node:child_process";

import { traceSync } from "../trace/index.ts";

export function runSubprocess(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
  {
    attributes = {},
    spanName = "process.command",
    spawn = spawnSync,
  }: {
    attributes?: Record<string, unknown>;
    spanName?: string;
    spawn?: typeof spawnSync;
  } = {},
) {
  return traceSync(
    spanName,
    attributes,
    () => spawn(command, args, options),
    (completed) => ({
      attributes: {
        exitCode: completed.status,
        signal: completed.signal,
      },
      status: completed.status === 0 ? "ok" : "error",
    }),
  );
}
