import { chmod, writeFile } from "node:fs/promises";

const shimUrl = new URL("../bin/silvermoon.js", import.meta.url);
const shim = `#!/usr/bin/env node
import { runCli } from "../dist/bin/silvermoon.js";

const bootstrapStartedAt = process.hrtime.bigint();
process.exitCode = await runCli(process.argv.slice(2), console, { bootstrapStartedAt });
`;

await writeFile(shimUrl, shim, "utf8");
await chmod(shimUrl, 0o755);
