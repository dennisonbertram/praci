import { AccessError } from "./access.mjs";

// Official references for CLI syntax and status/Serve fields; not verified live:
// https://tailscale.com/docs/reference/tailscale-cli/serve
// https://github.com/tailscale/tailscale/blob/main/ipn/ipnstate/ipnstate.go
// https://github.com/tailscale/tailscale/blob/main/ipn/serve.go
const VERSION_ARGS = ["version"];
const STATUS_ARGS = ["status", "--json"];
const SERVE_STATUS_ARGS = ["serve", "status", "--json"];
const SERVE_ARGS = ["serve", "--bg", "--https=443"];
const STATUS_ERROR = "Could not read Tailscale status; verify the Tailscale connection.";
const SERVE_STATUS_ERROR =
  "Could not read Tailscale Serve status; verify the Tailscale configuration.";
const SERVE_VERIFY_ERROR =
  "Could not verify the Tailscale Serve configuration; check Tailscale Serve status.";
const SERVE_CONFIGURE_ERROR = "Could not configure Tailscale Serve; check Tailscale Serve status.";
const SERVE_NOT_ENABLED =
  "Tailscale Serve is not enabled; enable Serve in the Tailscale admin console.";
const MAX_LINK_BUFFER = 8192;

class CommandTimeoutError extends Error {}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeDnsName(value, allowTrailingDot = true) {
  if (typeof value !== "string" || value.length === 0) return null;
  let name = value;
  if (allowTrailingDot && name.endsWith(".")) name = name.slice(0, -1);
  if (
    name.length === 0 ||
    name.length > 253 ||
    name.endsWith(".") ||
    !name.split(".").every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
  ) {
    return null;
  }
  return name.toLowerCase();
}

function parseStatus(stdout) {
  let status;
  try {
    status = JSON.parse(stdout);
  } catch {
    throw new AccessError(STATUS_ERROR);
  }
  if (!isRecord(status) || typeof status.BackendState !== "string") {
    throw new AccessError(STATUS_ERROR);
  }
  if (status.BackendState === "NeedsLogin") {
    throw new AccessError("Tailscale needs sign-in; sign in with the Tailscale app.");
  }
  if (status.BackendState === "Stopped") {
    throw new AccessError("Tailscale is stopped; start it from the Tailscale app.");
  }
  if (status.BackendState !== "Running") throw new AccessError(STATUS_ERROR);

  const self = status.Self;
  const tailnet = status.CurrentTailnet;
  const hostname = isRecord(self) ? normalizeDnsName(self.DNSName) : null;
  if (
    !hostname ||
    !isRecord(tailnet) ||
    typeof tailnet.MagicDNSEnabled !== "boolean" ||
    (status.CertDomains !== null &&
      (!Array.isArray(status.CertDomains) ||
        status.CertDomains.some((domain) => !normalizeDnsName(domain, false))))
  ) {
    throw new AccessError(STATUS_ERROR);
  }
  if (!tailnet.MagicDNSEnabled) {
    throw new AccessError(
      "MagicDNS is disabled; enable it in the Tailscale admin console DNS settings.",
    );
  }

  const certDomains = (status.CertDomains ?? []).map((domain) => normalizeDnsName(domain, false));
  if (!certDomains.includes(hostname)) {
    throw new AccessError(
      "HTTPS certificates are unavailable for this machine; enable them in the Tailscale admin console DNS settings.",
    );
  }
  return hostname;
}

function failServeStatus() {
  throw new AccessError(SERVE_STATUS_ERROR);
}

function objectMap(value) {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) failServeStatus();
  return value;
}

function assertKeys(value, allowed) {
  if (Object.keys(value).some((key) => !allowed.has(key))) failServeStatus();
}

function parsePort(value) {
  if (typeof value !== "string" || !/^[1-9]\d{0,4}$/.test(value)) return null;
  const port = Number(value);
  return port <= 65_535 ? port : null;
}

function parseHostPort(value) {
  if (typeof value !== "string") return null;
  const separator = value.lastIndexOf(":");
  if (separator <= 0) return null;
  const hostname = normalizeDnsName(value.slice(0, separator), false);
  const port = parsePort(value.slice(separator + 1));
  if (!hostname || !port) return null;
  return { hostname, port, key: `${hostname}:${port}` };
}

function validateTcpHandler(handler) {
  if (!isRecord(handler)) failServeStatus();
  assertKeys(handler, new Set(["HTTPS", "HTTP", "TCPForward", "TerminateTLS", "ProxyProtocol"]));
  if (
    (handler.HTTPS !== undefined && typeof handler.HTTPS !== "boolean") ||
    (handler.HTTP !== undefined && typeof handler.HTTP !== "boolean") ||
    (handler.TCPForward !== undefined && typeof handler.TCPForward !== "string") ||
    (handler.TerminateTLS !== undefined && typeof handler.TerminateTLS !== "string") ||
    (handler.ProxyProtocol !== undefined &&
      (!Number.isInteger(handler.ProxyProtocol) ||
        handler.ProxyProtocol < 0 ||
        handler.ProxyProtocol > 2))
  ) {
    failServeStatus();
  }
  return handler;
}

function validateHttpHandler(handler) {
  if (!isRecord(handler)) failServeStatus();
  assertKeys(handler, new Set(["Path", "Proxy", "Text", "AcceptAppCaps", "Redirect"]));
  for (const key of ["Path", "Proxy", "Text", "Redirect"]) {
    if (handler[key] !== undefined && typeof handler[key] !== "string") failServeStatus();
  }
  if (
    handler.AcceptAppCaps !== undefined &&
    (!Array.isArray(handler.AcceptAppCaps) ||
      handler.AcceptAppCaps.some((value) => typeof value !== "string"))
  ) {
    failServeStatus();
  }
  return handler;
}

function parseServeConfig(value, foreground = false) {
  if (value === null) value = {};
  if (!isRecord(value)) failServeStatus();
  assertKeys(value, new Set(["TCP", "Web", "Services", "AllowFunnel", "Foreground"]));

  const tcp = new Map();
  for (const [key, handler] of Object.entries(objectMap(value.TCP))) {
    const port = parsePort(key);
    if (!port) failServeStatus();
    tcp.set(port, validateTcpHandler(handler));
  }

  const web = new Map();
  for (const [key, server] of Object.entries(objectMap(value.Web))) {
    const hostPort = parseHostPort(key);
    if (!hostPort || !isRecord(server)) failServeStatus();
    assertKeys(server, new Set(["Handlers"]));
    if (!Object.hasOwn(server, "Handlers") || !isRecord(server.Handlers)) failServeStatus();
    const handlers = new Map();
    for (const [path, handler] of Object.entries(server.Handlers)) {
      if (!path.startsWith("/")) failServeStatus();
      handlers.set(path, validateHttpHandler(handler));
    }
    if (web.has(hostPort.key)) failServeStatus();
    web.set(hostPort.key, { ...hostPort, handlers });
  }

  const services = objectMap(value.Services);
  if (Object.keys(services).length > 0) {
    throw new AccessError(
      "Tailscale Service configuration is present; choose another access method.",
    );
  }

  const allowFunnel = new Map();
  for (const [key, enabled] of Object.entries(objectMap(value.AllowFunnel))) {
    const hostPort = parseHostPort(key);
    if (!hostPort || typeof enabled !== "boolean") failServeStatus();
    allowFunnel.set(hostPort.key, enabled);
  }

  const foregroundConfigs = [];
  const foregroundMap = objectMap(value.Foreground);
  if (foreground && Object.keys(foregroundMap).length > 0) failServeStatus();
  for (const config of Object.values(foregroundMap)) {
    if (!isRecord(config)) failServeStatus();
    foregroundConfigs.push(parseServeConfig(config, true));
  }

  return { tcp, web, allowFunnel, foregroundConfigs };
}

function proxyForTarget(webEntry, target) {
  return webEntry
    ? [...webEntry.handlers.values()].some((handler) => handler.Proxy === target)
    : false;
}

function inspectServeConfig(value, hostname, target) {
  const root = parseServeConfig(value);
  const endpointKey = `${hostname}:443`;
  let alreadyServing = false;

  const inspect = (config, isForeground = false) => {
    for (const [key, enabled] of config.allowFunnel) {
      if (!enabled) continue;
      if (key === endpointKey || proxyForTarget(config.web.get(key), target)) {
        throw new AccessError(
          "Tailscale Serve has public access enabled for this endpoint; disable public access before retrying.",
        );
      }
    }

    const portHandler = config.tcp.get(443);
    const portWebEntries = [...config.web.values()].filter((entry) => entry.port === 443);
    if (isForeground && (portHandler || portWebEntries.length > 0)) {
      throw new AccessError(
        "Tailscale Serve already uses HTTPS port 443; change that Serve configuration.",
      );
    }
    if (!isForeground && (portHandler || portWebEntries.length > 0)) {
      const endpoint = config.web.get(endpointKey);
      const rootHandler = endpoint?.handlers.get("/");
      const isHttps =
        portHandler?.HTTPS === true &&
        portHandler.HTTP !== true &&
        portHandler.TCPForward === undefined &&
        portHandler.TerminateTLS === undefined &&
        portHandler.ProxyProtocol === undefined;
      if (
        !isHttps ||
        rootHandler?.Proxy !== target ||
        Object.keys(rootHandler ?? {}).length !== 1 ||
        endpoint.handlers.size !== 1 ||
        portWebEntries.some((entry) => entry.hostname !== hostname)
      ) {
        throw new AccessError(
          "Tailscale Serve already uses HTTPS port 443; change that Serve configuration.",
        );
      }
      alreadyServing = true;
    }

    for (const foregroundConfig of config.foregroundConfigs) inspect(foregroundConfig, true);
  };

  inspect(root);
  return alreadyServing;
}

function safeLoginLink(text) {
  for (const match of text.matchAll(/https:\/\/[^\s"'<>]+/g)) {
    const candidate = match[0];
    if (/[\p{Cc}\p{Cf}]/u.test(candidate)) continue;
    const authority = candidate.slice("https://".length).split(/[/?#]/, 1)[0];
    if (authority.includes("@")) continue;
    let url;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }
    if (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "login.tailscale.com" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      !/[\p{Cc}\p{Cf}]/u.test(url.href)
    ) {
      return url.href;
    }
  }
  return null;
}

function serveNotEnabled(link) {
  return new AccessError(link ? `${SERVE_NOT_ENABLED.slice(0, -1)}: ${link}` : SERVE_NOT_ENABLED);
}

function isRunResult(value) {
  return isRecord(value) && Number.isInteger(value.code) && typeof value.stdout === "string";
}

async function boundedRun(context, args, onOutput) {
  if (
    typeof context?.run !== "function" ||
    !Number.isFinite(context.timeoutMs) ||
    context.timeoutMs <= 0
  ) {
    throw new TypeError("A command runner and positive timeout are required.");
  }

  const controller = new AbortController();
  let timer;
  let timedOut = false;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new CommandTimeoutError());
    }, context.timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() =>
        context.run("tailscale", args, {
          timeoutMs: context.timeoutMs,
          signal: controller.signal,
          onOutput,
        }),
      ),
      timeoutPromise,
    ]);
  } catch (error) {
    if (timedOut) throw new CommandTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(stdout, error) {
  if (typeof stdout !== "string") throw new AccessError(error);
  try {
    return JSON.parse(stdout);
  } catch {
    throw new AccessError(error);
  }
}

function missingCommand(error) {
  return error?.code === "ENOENT";
}

export function createTailscaleAccessMethod() {
  let versionProbe;

  function probeVersion(context) {
    if (
      versionProbe &&
      versionProbe.run === context.run &&
      versionProbe.timeoutMs === context.timeoutMs
    ) {
      return versionProbe.promise;
    }
    const promise = boundedRun(context, VERSION_ARGS).then((result) => {
      if (!isRunResult(result)) throw new TypeError("Invalid command result.");
      return result;
    });
    versionProbe = { run: context.run, timeoutMs: context.timeoutMs, promise };
    return promise;
  }

  async function readStatus(context) {
    let result;
    try {
      result = await boundedRun(context, STATUS_ARGS);
    } catch {
      throw new AccessError(STATUS_ERROR);
    }
    if (!isRunResult(result) || result.code !== 0) throw new AccessError(STATUS_ERROR);
    return parseStatus(result.stdout);
  }

  async function readServeConfig(context) {
    let result;
    try {
      result = await boundedRun(context, SERVE_STATUS_ARGS);
    } catch {
      throw new AccessError(SERVE_STATUS_ERROR);
    }
    if (!isRunResult(result) || result.code !== 0) throw new AccessError(SERVE_STATUS_ERROR);
    return parseJson(result.stdout, SERVE_STATUS_ERROR);
  }

  return {
    id: "tailscale",
    async isAvailable(context) {
      try {
        return (await probeVersion(context)).code === 0;
      } catch {
        return false;
      }
    },
    async resolve(context) {
      try {
        let version;
        try {
          version = await probeVersion(context);
        } catch (error) {
          if (missingCommand(error)) {
            throw new AccessError("Tailscale CLI was not found; install the Tailscale app.");
          }
          throw new AccessError(
            "Tailscale CLI could not be verified; check the Tailscale installation.",
          );
        }
        if (version.code !== 0) {
          throw new AccessError(
            "Tailscale CLI could not be verified; check the Tailscale installation.",
          );
        }

        const hostname = await readStatus(context);
        const target = `http://127.0.0.1:${context.webPort}`;
        const existing = await readServeConfig(context);
        if (inspectServeConfig(existing, hostname, target)) {
          return { url: `https://${hostname}` };
        }

        let output = "";
        let link = null;
        const captureLink = (_stream, chunk) => {
          const text = String(chunk);
          link = safeLoginLink(`${output}${text}`) ?? safeLoginLink(text) ?? link;
          output = `${output}${text}`.slice(-MAX_LINK_BUFFER);
        };

        let serveResult;
        try {
          serveResult = await boundedRun(context, [...SERVE_ARGS, target], captureLink);
        } catch (error) {
          if (error instanceof CommandTimeoutError || link) throw serveNotEnabled(link);
          throw new AccessError(SERVE_CONFIGURE_ERROR);
        }
        if (isRecord(serveResult)) {
          link =
            (typeof serveResult.stdout === "string" ? safeLoginLink(serveResult.stdout) : null) ??
            (typeof serveResult.stderr === "string" ? safeLoginLink(serveResult.stderr) : null) ??
            link;
        }
        if (link) throw serveNotEnabled(link);
        if (!isRunResult(serveResult) || serveResult.code !== 0) {
          throw new AccessError(SERVE_CONFIGURE_ERROR);
        }

        const updated = await readServeConfig(context);
        if (!inspectServeConfig(updated, hostname, target)) {
          throw new AccessError(SERVE_VERIFY_ERROR);
        }
        return { url: `https://${hostname}` };
      } catch (error) {
        if (error instanceof AccessError) throw error;
        if (missingCommand(error)) {
          throw new AccessError("Tailscale CLI was not found; install the Tailscale app.");
        }
        throw new AccessError(STATUS_ERROR);
      }
    },
  };
}
