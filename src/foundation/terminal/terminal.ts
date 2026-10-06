export function terminalCapabilities({
  stdin = process.stdin,
  stdout = process.stdout,
} = {}) {
  return {
    stdinIsTTY: stdin.isTTY === true,
    stdoutIsTTY: stdout.isTTY === true,
  };
}

export function writeTerminalLine(method: { (...data: unknown[]): void; (...data: unknown[]): void; (arg0: unknown): void; }, value: string) {
  const text = value.replace(/\n$/, "");
  if (text) method(text);
}
