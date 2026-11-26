import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import QRCode from "qrcode";
import { AccessError, createLanAccessMethod, createUrlAccessMethod, run } from "./access.mjs";
import { mergeConnectEnv, parseConnectEnv } from "./env.mjs";
import { buildConnectLink } from "./payload.mjs";
import { createTailscaleAccessMethod } from "./tailscale.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const AVAILABLE_METHODS = ["url", "lan", "tailscale"];
const FALLBACK_METHODS = ["url", "lan"];
const DEFAULT_WEB_PORT = 5173;
const DEFAULT_TIMEOUT_SECONDS = 10;
const MAX_TIMEOUT_SECONDS = 300;
const MAX_HEALTH_RESPONSE_BYTES = 64 * 1024;

class ConnectError extends Error {}

export class HealthProbeError extends Error {}

function parseOptions(args) {
  const values = {};
  const flags = new Set(["--method", "--url", "--web-port", "--timeout"]);
  const booleanFlags = new Set(["--yes", "--no-env-write"]);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!flags.has(flag) && !booleanFlags.has(flag))
      throw new ConnectError(
        "Unknown option. Use --method, --url, --web-port, --timeout, --yes, or --no-env-write.",
      );
    if (Object.hasOwn(values, flag))
      throw new ConnectError("Each option may be provided only once.");
    if (booleanFlags.has(flag)) {
      values[flag] = true;
      continue;
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--"))
      throw new ConnectError(`Missing value for ${flag}.`);
    values[flag] = value;
    index += 1;
  }

  return {
    method: values["--method"],
    url: values["--url"],
    webPort: values["--web-port"],
    timeout: values["--timeout"],
    yes: Boolean(values["--yes"]),
    noEnvWrite: Boolean(values["--no-env-write"]),
  };
}

function parsePort(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null;
}

function parseTimeout(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_TIMEOUT_SECONDS ? seconds : null;
}

export function resolveWebPort({ webPortFlag, env = process.env, fileEnv = {} } = {}) {
  if (webPortFlag !== undefined) {
    const port = parsePort(webPortFlag);
    if (port === null) throw new ConnectError("--web-port must be an integer between 1 and 65535.");
    return port;
  }

  const configuredPort = env.WEB_PORT ?? fileEnv.WEB_PORT;
  if (configuredPort === undefined) return DEFAULT_WEB_PORT;
  const port = parsePort(String(configuredPort));
  if (port === null) throw new ConnectError("WEB_PORT must be an integer between 1 and 65535.");
  return port;
}

function readEnvText(envPath, dependencies) {
  if (dependencies.readEnvFile) return dependencies.readEnvFile(envPath);
  return existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
}

async function confirmEnvWrite(options, dependencies, stdin, stdout, stderr, lines, shellNotes) {
  writeLine(stdout, "Add these lines to .env:");
  for (const line of lines) stdout(`${line}\n`);
  for (const note of shellNotes) writeLine(stdout, note);

  if (options.noEnvWrite) {
    writeLine(stderr, "No changes written (--no-env-write).");
    return false;
  }
  if (!options.yes) {
    if (!stdin.isTTY) {
      writeLine(
        stderr,
        "No changes written in a non-interactive terminal. Use --yes to write them.",
      );
      return false;
    }
    stdout("Write these lines to .env? [y/N] ");
    let answer;
    if (dependencies.confirmEnvWrite) {
      answer = await dependencies.confirmEnvWrite();
    } else {
      const prompt = createInterface({ input: stdin });
      try {
        answer = await prompt.question("");
      } finally {
        prompt.close();
      }
    }
    if (String(answer).trim().toLowerCase() !== "y") {
      writeLine(stderr, "No changes made.");
      return false;
    }
  }
  return true;
}

function oidcWarning(env, origin) {
  const configured = ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"].every(
    (key) => typeof env[key] === "string" && env[key].trim() !== "",
  );
  if (!configured) return null;

  const authUrl = env.BETTER_AUTH_URL ?? env.WEB_ORIGIN ?? "http://127.0.0.1:5173";
  let safeAuthUrl = "[invalid URL]";
  try {
    const url = new URL(authUrl);
    if (url.protocol === "http:" || url.protocol === "https:") safeAuthUrl = url.origin;
  } catch {}

  return `Warning: SSO returns to BETTER_AUTH_URL (${safeAuthUrl}). Make sure this URL is reachable from the phone. Sign in with a password on the phone, or register ${origin}/api/auth/callback/oidc with the identity provider and set BETTER_AUTH_URL to ${origin}.`;
}

async function ensureTrustedUrl({
  options,
  dependencies,
  env,
  envText,
  fileEnv,
  envPath,
  origin,
  host,
  stdout,
  stderr,
}) {
  const plan = mergeConnectEnv(envText, origin, host, {
    shellEnv: env,
    fileEnv,
  });
  if (plan.error?.startsWith("shell-invalid:")) {
    const key = plan.error.slice("shell-invalid:".length);
    writeLine(stderr, `${key} is invalid in the shell; no .env changes were made.`);
    return false;
  }
  if (plan.error?.startsWith("unsupported:")) {
    const key = plan.error.slice("unsupported:".length);
    writeLine(stderr, `${key} uses unsupported .env syntax; no changes were made.`);
    return false;
  }
  if (plan.error) {
    writeLine(stderr, `${plan.error} is invalid; no .env changes were made.`);
    return false;
  }
  if (plan.lines.length === 0) {
    for (const note of plan.shellNotes ?? []) writeLine(stdout, note);
    return true;
  }

  const stdin = dependencies.stdin ?? process.stdin;
  if (
    !(await confirmEnvWrite(
      options,
      dependencies,
      stdin,
      stdout,
      stderr,
      plan.lines,
      plan.shellNotes ?? [],
    ))
  )
    return false;
  let currentEnvText;
  try {
    currentEnvText = readEnvText(envPath, dependencies);
  } catch {
    writeLine(
      stderr,
      "Could not verify that .env is unchanged; no changes were written. Run `pnpm connect` again.",
    );
    return false;
  }
  if (currentEnvText !== envText) {
    writeLine(
      stderr,
      "The .env file changed after preview; no changes were written. Run `pnpm connect` again.",
    );
    return false;
  }
  try {
    if (dependencies.writeEnvFile) dependencies.writeEnvFile(envPath, plan.text);
    else writeFileSync(envPath, plan.text);
  } catch {
    writeLine(stderr, "Could not write .env.");
    return false;
  }
  writeLine(stdout, "Restart `pnpm dev` so the server picks this up.");
  return true;
}

export function isLoopbackPortListening(port) {
  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;
    const finish = (listening) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.connect(port, "127.0.0.1");
  });
}

async function readBoundedBody(response) {
  const declaredLength = Number(response.headers?.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_HEALTH_RESPONSE_BYTES) {
    throw new HealthProbeError("Health check returned an oversized response.");
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_HEALTH_RESPONSE_BYTES) {
      await reader.cancel();
      throw new HealthProbeError("Health check returned an oversized response.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, length).toString("utf8");
}

export async function probeHealth(origin, { timeoutMs, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  let timer;
  const timeoutError = new HealthProbeError("Health check timed out.");
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(timeoutError);
    }, timeoutMs);
  });

  const request = (async () => {
    try {
      const response = await fetchImpl(`${origin}/rpc/health`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: {} }),
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.redirected || (response.status >= 300 && response.status < 400)) {
        throw new HealthProbeError("Health check redirected; redirects are not allowed.");
      }
      if (!response.ok)
        throw new HealthProbeError(`Health check failed with HTTP ${response.status}.`);

      let body;
      try {
        body = JSON.parse(await readBoundedBody(response));
      } catch (error) {
        if (error instanceof HealthProbeError) throw error;
        throw new HealthProbeError("Health check returned invalid JSON.");
      }
      if (body?.json?.ok !== true) {
        throw new HealthProbeError(
          "Health check failed: /rpc/health did not return json.ok: true.",
        );
      }
    } catch (error) {
      if (error instanceof HealthProbeError) throw error;
      if (controller.signal.aborted) throw timeoutError;
      throw new HealthProbeError("Could not reach /rpc/health at that URL.");
    }
  })();

  try {
    await Promise.race([request, timeoutPromise]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function writeLine(write, message) {
  write(`${message.replace(/[\r\n]+/g, " ").trim()}\n`);
}

export async function main(args = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout ?? ((value) => process.stdout.write(value));
  const stderr = dependencies.stderr ?? ((value) => process.stderr.write(value));
  try {
    const options = parseOptions(args);
    if (options.url !== undefined && options.method !== "url") {
      throw new ConnectError("--url can only be used with --method url.");
    }
    if (options.method && !AVAILABLE_METHODS.includes(options.method)) {
      throw new ConnectError(`Unknown method; choose one of: ${AVAILABLE_METHODS.join(", ")}.`);
    }
    if (options.method === "url" && options.url === undefined) {
      throw new ConnectError("--url is required for --method url.");
    }

    const env = dependencies.env ?? process.env;
    const envPath = dependencies.envPath ?? path.join(root, ".env");
    const envText =
      dependencies.envText ?? (dependencies.fileEnv ? "" : readEnvText(envPath, dependencies));
    const fileEnv = dependencies.fileEnv ?? parseConnectEnv(envText);
    const webPort = resolveWebPort({ webPortFlag: options.webPort, env, fileEnv });
    const timeoutSeconds =
      options.timeout === undefined ? DEFAULT_TIMEOUT_SECONDS : parseTimeout(options.timeout);
    if (timeoutSeconds === null) {
      throw new ConnectError(
        `--timeout must be greater than 0 and no more than ${MAX_TIMEOUT_SECONDS} seconds.`,
      );
    }
    const timeoutMs = timeoutSeconds * 1000;
    const commandRunner = dependencies.run ?? run;
    const tailscaleMethod = createTailscaleAccessMethod();
    let method = options.method;
    if (!method) {
      if (!(await tailscaleMethod.isAvailable({ webPort, timeoutMs, run: commandRunner }))) {
        writeLine(stdout, `Available methods: ${FALLBACK_METHODS.join(", ")}`);
        return 1;
      }
      method = "tailscale";
    }

    const checkListening = dependencies.checkListening ?? isLoopbackPortListening;
    if (!(await checkListening(webPort))) {
      throw new ConnectError(
        `Nothing is listening on port ${webPort}. Start the server with \`pnpm dev\` first, or pass --web-port.`,
      );
    }

    const accessMethod =
      method === "url"
        ? createUrlAccessMethod(options.url)
        : method === "lan"
          ? createLanAccessMethod({
              networkInterfaces: dependencies.networkInterfaces ?? os.networkInterfaces,
            })
          : tailscaleMethod;
    const access = await accessMethod.resolve({ webPort, timeoutMs, run: commandRunner });

    const resolvedUrl = new URL(access.url);
    const origin = resolvedUrl.origin;
    if (
      !(await ensureTrustedUrl({
        options,
        dependencies,
        env,
        envText,
        fileEnv,
        envPath,
        origin,
        host: resolvedUrl.hostname,
        stdout,
        stderr,
      }))
    )
      return 1;

    const warning = oidcWarning({ ...fileEnv, ...env }, origin);
    if (warning) writeLine(stdout, warning);

    try {
      await probeHealth(origin, { timeoutMs, fetchImpl: dependencies.fetchImpl ?? fetch });
    } catch (error) {
      if (method === "lan") {
        throw new ConnectError(
          `${error instanceof HealthProbeError ? error.message : "Health check failed."} If Vite is bound to loopback, set RAKAZO_DEV_HOST=0.0.0.0 and restart pnpm dev.`,
        );
      }
      throw error;
    }

    if (method === "lan") writeLine(stdout, "Warning: LAN connections are unencrypted.");

    let qr;
    try {
      const link = buildConnectLink(access.url);
      qr = await (
        dependencies.qrEncoder ?? ((text) => QRCode.toString(text, { type: "terminal" }))
      )(link);
    } catch {
      throw new ConnectError("Could not render the connect QR code.");
    }
    stdout(`${String(qr).trimEnd()}\n${access.url}\n`);
    return 0;
  } catch (error) {
    const message =
      error instanceof ConnectError ||
      error instanceof AccessError ||
      error instanceof HealthProbeError
        ? error.message
        : "Could not complete the connect check.";
    writeLine(stderr, message);
    return 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}
