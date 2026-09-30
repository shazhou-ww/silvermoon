import { win32 } from "node:path";

export function npmCommand(args, {
  platform = process.platform,
  execPath = process.execPath,
  env = process.env,
} = {}) {
  if (platform !== "win32") return { command: "npm", args };
  const configured = env.npm_execpath;
  const npmCli = configured && /^npm-cli\.js$/i.test(win32.basename(configured))
    ? configured
    : win32.resolve(win32.dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js");
  return { command: execPath, args: [npmCli, ...args] };
}
