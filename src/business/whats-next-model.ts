import { readFile } from "node:fs/promises";

import type { CheckResult } from "../professional-model/index.ts";

export function readWhatsNextModel() {
  return readFile(new URL("./whats-next-model.yaml", import.meta.url), "utf8");
}

export const CHECK_PASSED: CheckResult = Object.freeze({ passed: true });

export function pending(code: string, description: string): CheckResult {
  return { passed: false, problems: [{ code, description }] };
}
