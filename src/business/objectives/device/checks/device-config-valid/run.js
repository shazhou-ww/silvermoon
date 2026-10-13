#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let source = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => source += chunk);
process.stdin.on("end", async () => {
  const request = JSON.parse(source);
  const checkId = basename(dirname(fileURLToPath(import.meta.url)));
  const path = join(request.probe.tempDirectory, "silvermoon-check-results", `${checkId}.json`);
  process.stdout.write(await readFile(path, "utf8"));
});
