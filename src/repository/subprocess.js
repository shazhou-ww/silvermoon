import { spawnSync } from "node:child_process";

import { traceSync } from "../command/trace/index.js";

export function runSubprocess(
  command,
  args,
  options,
  {
    attributes = {},
    spanName = "process.command",
    spawn = spawnSync,
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
