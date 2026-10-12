import { chmod, copyFile, writeFile } from "node:fs/promises";

await copyFile(
  new URL("../src/business/whats-next-model.yaml", import.meta.url),
  new URL("../dist/src/business/whats-next-model.yaml", import.meta.url),
);

const shimUrl = new URL("../bin/silvermoon.js", import.meta.url);
const shim = `#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { runCli } from "../dist/bin/silvermoon.js";

const bootstrapStartedAt = process.hrtime.bigint();
process.exitCode = await runCli(process.argv.slice(2), console, {
  bootstrapStartedAt,
  entryPath: fileURLToPath(import.meta.url),
});
`;

await writeFile(shimUrl, shim, "utf8");
await chmod(shimUrl, 0o755);
