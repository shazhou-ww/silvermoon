import childProcess from "node:child_process";
import dgram from "node:dgram";
import dns from "node:dns";
import http from "node:http";
import http2 from "node:http2";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";

function forbid(target, names, kind) {
  for (const name of names) {
    target[name] = () => {
      throw new Error(`SANITY_IO_FORBIDDEN: ${kind}.${name}`);
    };
  }
}

export function installSanityGuard() {
  forbid(childProcess, ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"], "child_process");
  forbid(childProcess.ChildProcess.prototype, ["spawn"], "ChildProcess");
  forbid(net, ["connect", "createConnection", "createServer"], "net");
  forbid(net.Socket.prototype, ["connect"], "net.Socket");
  forbid(net.Server.prototype, ["listen"], "net.Server");
  forbid(http, ["request", "get", "createServer"], "http");
  forbid(https, ["request", "get", "createServer"], "https");
  forbid(http2, ["connect", "createServer", "createSecureServer"], "http2");
  forbid(tls, ["connect", "createServer"], "tls");
  forbid(dgram, ["createSocket"], "dgram");
  forbid(dgram.Socket.prototype, ["bind", "connect", "send"], "dgram.Socket");
  for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
    forbid(target, Object.getOwnPropertyNames(target).filter((name) =>
      /^(?:lookup|resolve|reverse)/.test(name)
    ), "dns");
  }
  forbid(globalThis, ["fetch"], "global");
  syncBuiltinESMExports();
}

// The runner needs its own workers; the boundary applies inside each test worker.
if (process.env.NODE_TEST_CONTEXT === "child-v8") installSanityGuard();
