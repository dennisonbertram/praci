import { execFile } from "node:child_process";
import os from "node:os";

/**
 * @typedef {Object} AccessMethodContext
 * @property {number} webPort
 * @property {number} timeoutMs
 * @property {typeof run} run
 */

/** @typedef {{url: string}} AccessMethodResult */

/**
 * @typedef {Object} AccessMethod
 * @property {"url"|"lan"|"tailscale"} id
 * @property {(context: AccessMethodContext) => Promise<AccessMethodResult>} resolve Resolves a validated origin or rejects with AccessError.
 * @property {(context: AccessMethodContext) => Promise<boolean>} [isAvailable] Optional presence probe.
 */

/** Safe rejection from an access method when its endpoint is invalid or unavailable. */
export class AccessError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccessError";
  }
}

export function run(command, args, { timeoutMs = 10_000, signal, onOutput } = {}) {
  if (
    typeof command !== "string" ||
    !Array.isArray(args) ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    (signal !== undefined &&
      (!signal ||
        typeof signal.addEventListener !== "function" ||
        typeof signal.removeEventListener !== "function")) ||
    (onOutput !== undefined && typeof onOutput !== "function")
  ) {
    return Promise.reject(
      new TypeError("Command, argument array, and positive timeout are required."),
    );
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error("The command was aborted.");
      error.name = "AbortError";
      error.code = "ABORT_ERR";
      reject(error);
      return;
    }

    let timeoutError;
    let abortError;
    let timeout;
    let forceKill;
    let settled = false;
    const child = execFile(
      command,
      args,
      { encoding: "utf8", windowsHide: true },
      (error, stdout, stderr) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (timeoutError) {
          reject(timeoutError);
          return;
        }
        if (abortError) {
          reject(abortError);
          return;
        }
        if (!error) {
          resolve({ code: 0, stdout, stderr });
        } else if (Number.isInteger(error.code) && !error.killed) {
          resolve({ code: error.code, stdout, stderr });
        } else {
          reject(error);
        }
      },
    );
    const isRunning = () => child.exitCode === null && child.signalCode === null;
    const terminate = () => {
      if (!isRunning()) return;
      try {
        child.kill("SIGTERM");
      } catch {}
      if (!forceKill) {
        forceKill = setTimeout(() => {
          if (!isRunning()) return;
          try {
            child.kill("SIGKILL");
          } catch {}
        }, 250);
      }
    };
    const onAbort = () => {
      abortError = new Error("The command was aborted.");
      abortError.name = "AbortError";
      abortError.code = "ABORT_ERR";
      terminate();
    };
    const cleanup = () => {
      clearTimeout(timeout);
      clearTimeout(forceKill);
      signal?.removeEventListener("abort", onAbort);
    };
    const notify = (stream, chunk) => {
      try {
        onOutput?.(stream, String(chunk));
      } catch {}
    };

    child.stdout?.on("data", (chunk) => notify("stdout", chunk));
    child.stderr?.on("data", (chunk) => notify("stderr", chunk));
    child.once("close", cleanup);
    signal?.addEventListener("abort", onAbort, { once: true });
    timeout = setTimeout(() => {
      timeoutError = new Error(`Command timed out after ${timeoutMs} ms.`);
      timeoutError.code = "ETIMEDOUT";
      terminate();
    }, timeoutMs);
    child.stdin?.end();
  });
}

function isIPv4(value) {
  const octets = value.split(".");
  if (
    octets.length !== 4 ||
    octets.some((octet) => !/^\d{1,3}$/.test(octet) || Number(octet) > 255)
  ) {
    return null;
  }
  return octets.map(Number);
}

function isPrivateIPv4(value) {
  const octets = isIPv4(value);
  if (!octets) return false;
  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isContainerLinkInterface(name) {
  return /^docker\d+$/i.test(name) || /^br-[0-9a-f]{12}$/i.test(name) || /^veth/i.test(name);
}

function isAllowedHTTPHost(host) {
  const normalizedHost = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1"
  ) {
    return true;
  }
  if (normalizedHost.endsWith(".local") && normalizedHost.length > ".local".length) return true;

  const ipv4 = isIPv4(normalizedHost);
  if (!ipv4) return false;
  const [first, second] = ipv4;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function inputHostname(value) {
  const authority = /^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i.exec(value)?.[1];
  if (!authority) return "";
  const hostPort = authority.slice(authority.lastIndexOf("@") + 1);
  if (hostPort.startsWith("[")) return hostPort.slice(0, hostPort.indexOf("]") + 1);
  return hostPort.split(":", 1)[0];
}

export function createUrlAccessMethod(value) {
  return {
    id: "url",
    async resolve(_ctx) {
      const input = typeof value === "string" ? value.trim() : value;
      let url;
      try {
        url = new URL(input);
      } catch {
        throw new AccessError("Enter a valid http or https URL.");
      }

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new AccessError("Use an http or https URL.");
      }
      if (!url.hostname) throw new AccessError("Enter a valid http or https URL.");
      if (
        url.protocol === "http:" &&
        (!isAllowedHTTPHost(inputHostname(input)) || !isAllowedHTTPHost(url.hostname))
      ) {
        throw new AccessError("Public servers need https://.");
      }

      return { url: url.origin };
    },
  };
}

export function createLanAccessMethod({ networkInterfaces = os.networkInterfaces } = {}) {
  return {
    id: "lan",
    async resolve({ webPort }) {
      const candidates = new Set();
      try {
        const interfaces = networkInterfaces();
        // Name heuristics can filter common container links but cannot prove phone routing.
        for (const [name, addresses] of Object.entries(interfaces)) {
          if (isContainerLinkInterface(name)) continue;
          for (const address of addresses ?? []) {
            if (
              !address.internal &&
              (address.family === "IPv4" || address.family === 4) &&
              isPrivateIPv4(address.address)
            ) {
              candidates.add(address.address);
            }
          }
        }
      } catch {
        throw new AccessError(
          "Could not inspect network interfaces for LAN access. Use --method url --url with a reachable server origin.",
        );
      }

      if (candidates.size === 0) {
        throw new AccessError(
          "No private IPv4 address is available for LAN access. Use --method url --url with a reachable server origin.",
        );
      }
      if (candidates.size > 1) {
        throw new AccessError(
          "Multiple private IPv4 addresses are available for LAN access. Use --method url --url with a reachable server origin.",
        );
      }

      const [address] = candidates;
      return { url: `http://${address}:${webPort}` };
    },
  };
}
