import { createHash } from "node:crypto";
import type {
  AdapterContext,
  AdapterDescriptor,
  AppControlAction,
  AppControlActResult,
  AppControlCapabilities,
  AppControlPolicy,
  AppControlProvider,
  AppControlScope,
  AppControlSnapshot,
  AppControlSnapshotRequest,
  AppControlStatus,
  AppControlStore,
  AppControlSurface,
  AppControlWindow,
} from "@rakazo/adapter-kit";
import { AppControlRefusedError } from "@rakazo/adapter-kit";
import type { AppControlApp } from "@rakazo/contracts";
import { isDeniedApp } from "@rakazo/contracts";
import { allowedEntry, requireActionableRef, requireKey } from "./policy.js";
import type { AgentDesktopRunner } from "./runners.js";
import { AgentDesktopNotInstalledError } from "./runners.js";

/**
 * The only code that knows agent-desktop's argv and JSON envelopes. Every call is checked
 * against the owner's allowlist, the hard denylist, and ref ownership before the runner
 * is used (docs/local-desktop-control, "Security model").
 */

type Node = Record<string, unknown>;

interface Envelope {
  ok: boolean;
  data: Node;
  error?: { code: string; message: string; delivery?: string; retry?: string };
}

const COMMANDS = new Set([
  "list-apps",
  "list-windows",
  "list-surfaces",
  "launch",
  "snapshot",
  "get",
  "click",
  "type",
  "set-value",
  "clear",
  "select",
  "toggle",
  "check",
  "uncheck",
  "expand",
  "collapse",
  "scroll",
  "scroll-to",
  "focus",
  "press",
  "status",
]);
const VALUE_FLAGS = new Set([
  "--app",
  "--window-id",
  "--surface",
  "--root",
  "--session",
  "--direction",
  "--amount",
  "--property",
]);
const FLAGS = new Set([...VALUE_FLAGS, "--headed", "--activate", "-i", "--compact"]);

const SURFACES: readonly AppControlSurface[] = [
  "window",
  "focused",
  "sheet",
  "popover",
  "alert",
  "menu",
];
const REF_COMMANDS = {
  click: "click",
  toggle: "toggle",
  check: "check",
  uncheck: "uncheck",
  expand: "expand",
  collapse: "collapse",
  scroll_to: "scroll-to",
  focus: "focus",
  clear: "clear",
  type: "type",
  set_value: "set-value",
  select: "select",
  scroll: "scroll",
} as const;
const DIRECTIONS = ["up", "down", "left", "right"];

const READ_TIMEOUT_MS = 15_000;
const LAUNCH_TIMEOUT_MS = 40_000;
const MAX_TREE_CHARS = 40_000;
const MASK = "[redacted]";

/** Names that read like a secret: masked, and the screen counts as sensitive. */
const SECRET_RE =
  /pass(word|code|phrase)|\bpin\b|one time|verification code|security code|\botp\b|\btoken\b|\bsecret\b|\b2fa\b|\bcvv\b|\bcvc\b|\bssn\b/;
/**
 * Text that reads like a sign-in, purchase or authorization prompt. It applies to every
 * surface: a window with a visible "Sign In" button is read-only for that snapshot. That is
 * intended for v1; the owner signs in themselves.
 */
const PROMPT_RE =
  /sign[ -]?in|log[ -]?in|password|purchase|\bbuy\b|subscribe|authori[sz]e|touch id|apple account|payment|credit card/i;
const DIALOG_ROLE_RE = /sheet|alert|dialog/i;
const PASTE_RE = /\bpaste\b/i;

/** Lowercase words: splits snake_case, kebab-case and camelCase so "api_token" reads "api token". */
function words(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .toLowerCase();
}

function record(value: unknown): Node | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Node) : undefined;
}
function list(value: unknown): Node[] {
  return Array.isArray(value) ? value.filter((item): item is Node => !!record(item)) : [];
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function argvOf(command: string, flags: string[] = [], positionals: string[] = []): string[] {
  const separator = positionals.some((value) => value.startsWith("-")) ? ["--"] : [];
  return [command, ...flags, ...separator, ...positionals];
}

/** Defense in depth: a bug here must not reach a command or flag outside the fixed set. */
function assertSafeArgv(argv: string[]) {
  if (!COMMANDS.has(argv[0] ?? "")) throw new Error("agent-desktop command is not allowed.");
  for (let i = 1; i < argv.length && argv[i] !== "--"; i += 1) {
    const token = argv[i] as string;
    if (!token.startsWith("-")) continue;
    if (!FLAGS.has(token)) throw new Error("agent-desktop flag is not allowed.");
    if (VALUE_FLAGS.has(token)) i += 1;
  }
}

function parseEnvelope(stdout: string): Envelope {
  let raw: Node | undefined;
  try {
    raw = record(JSON.parse(stdout));
  } catch {
    raw = undefined;
  }
  if (!raw || typeof raw.ok !== "boolean")
    throw new Error("agent-desktop returned unreadable output.");
  const error = record(raw.error);
  const disposition = record(error?.disposition);
  return {
    ok: raw.ok,
    // list-windows answers with a bare array.
    data: Array.isArray(raw.data) ? { windows: raw.data } : (record(raw.data) ?? {}),
    error: raw.ok
      ? undefined
      : {
          code: text(error?.code) || "UNKNOWN",
          message: text(error?.message).slice(0, 300),
          delivery: text(disposition?.delivery) || undefined,
          retry: text(disposition?.retry) || undefined,
        },
  };
}

function sessionFlags(scope: AppControlScope): string[] {
  const hash = createHash("sha256")
    .update(JSON.stringify([scope.spaceId, scope.userId, scope.botId, scope.runId]))
    .digest("hex");
  return ["--session", `r${hash.slice(0, 24)}`];
}

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

interface RunningApp extends AppControlApp {
  pid: number;
}

/** Running apps whose bundle id and name both match the entry and are not denied. */
function matchRunning(apps: Node[], entry: AppControlApp): RunningApp[] {
  return apps.flatMap((app) => {
    const id = text(app.bundle_id);
    const name = text(app.name);
    const pid = typeof app.pid === "number" ? app.pid : undefined;
    if (pid === undefined || !sameName(id, entry.id) || !sameName(name, entry.name)) return [];
    return isDeniedApp({ id, name }) ? [] : [{ id, name, pid }];
  });
}

interface Scrubbed {
  sensitive: boolean;
  /** A sheet, alert or dialog role was seen anywhere in the tree. */
  dialog: boolean;
  /** Visible, unmasked text of the whole tree. */
  visible: string[];
}

/** Masks secret values in place of a copy of the tree and records what it saw. */
function scrub(node: Node, state: Scrubbed): Node {
  const role = text(node.role);
  const states = Array.isArray(node.states) ? node.states.map(String) : [];
  const secure = /secure|password/i.test(role) || states.some((s) => /secure|password/i.test(s));
  const identity = [
    role,
    text(node.name),
    text(record(node.native_id)?.value),
    text(node.description),
  ];
  const out: Node = { ...node };
  if (DIALOG_ROLE_RE.test(role)) state.dialog = true;
  if (secure || SECRET_RE.test(words(identity.join(" ")))) {
    state.sensitive = true;
    if ("value" in out) out.value = MASK;
    if (secure && "name" in out) out.name = MASK;
  } else {
    state.visible.push(text(node.name), text(node.value), text(node.description));
  }
  if (Array.isArray(node.children)) out.children = list(node.children).map((c) => scrub(c, state));
  return out;
}

function isSensitive(seen: Scrubbed): boolean {
  return seen.sensitive || seen.dialog || PROMPT_RE.test(seen.visible.join(" "));
}

function countNodes(node: Node): number {
  return 1 + list(node.children).reduce((sum, child) => sum + countNodes(child), 0);
}

/** Breadth-first copy of the first `limit` nodes. */
function keepFirst(root: Node, limit: number): Node {
  const { children: _children, ...rest } = root;
  const top: Node = { ...rest };
  const queue: Array<[Node, Node]> = [[root, top]];
  let count = 1;
  for (let item = queue.shift(); item; item = queue.shift()) {
    const [source, target] = item;
    for (const child of list(source.children)) {
      if (count >= limit) break;
      count += 1;
      const { children: _drop, ...copy } = child;
      const kept: Node = { ...copy };
      target.children = [...list(target.children), kept];
      queue.push([child, kept]);
    }
  }
  return top;
}

function limitSize(tree: Node): { tree: Node; truncated: boolean } {
  if (JSON.stringify(tree).length <= MAX_TREE_CHARS) return { tree, truncated: false };
  let limit = countNodes(tree);
  for (;;) {
    limit = Math.floor(limit * 0.8);
    const kept = keepFirst(tree, limit);
    if (limit <= 1 || JSON.stringify(kept).length <= MAX_TREE_CHARS) {
      return { tree: kept, truncated: true };
    }
  }
}

function hostPlatform(value: string | null | undefined): "macos" | "windows" | "linux" | undefined {
  const v = value?.toLowerCase();
  if (v === "macos" || v === "darwin") return "macos";
  if (v === "windows" || v === "win32") return "windows";
  if (v === "linux") return "linux";
  return undefined;
}

export class AgentDesktopAppControl implements AppControlProvider {
  private readonly runner: AgentDesktopRunner;
  private readonly store: AppControlStore;
  /** The platform this process runs the CLI on; null when a bridge runs it on another host. */
  private readonly platform: string | null;

  constructor(opts: {
    runner: AgentDesktopRunner;
    store: AppControlStore;
    platform?: string | null;
  }) {
    this.runner = opts.runner;
    this.store = opts.store;
    this.platform = opts.platform === undefined ? process.platform : opts.platform;
  }

  describe(): AdapterDescriptor<AppControlCapabilities> {
    return {
      id: "agent-desktop",
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { headed: true },
    };
  }

  private async call(argv: string[], timeoutMs = READ_TIMEOUT_MS): Promise<Envelope> {
    assertSafeArgv(argv);
    const result = await this.runner(argv, { timeoutMs });
    return parseEnvelope(result.stdout);
  }

  private async read(argv: string[], timeoutMs?: number): Promise<Node> {
    const envelope = await this.call(argv, timeoutMs);
    if (!envelope.ok) {
      throw new Error(`agent-desktop ${envelope.error?.code}: ${envelope.error?.message}`);
    }
    return envelope.data;
  }

  async status(_context: AdapterContext): Promise<AppControlStatus> {
    if (this.platform !== null && this.platform !== "darwin") {
      return { available: false, accessibility: "unknown", reason: "Only macOS is supported." };
    }
    try {
      const data = await this.read(["status"]);
      const state = text(record(record(data.permissions)?.accessibility)?.state);
      const accessibility = state === "granted" || state === "denied" ? state : "unknown";
      const platform = hostPlatform(text(data.platform) ?? this.platform);
      return { available: true, accessibility, ...(platform ? { platform } : {}) };
    } catch (error) {
      return {
        available: false,
        accessibility: "unknown",
        ...(error instanceof AgentDesktopNotInstalledError ? { installed: false } : {}),
        reason: error instanceof Error ? error.message : "agent-desktop is unavailable.",
      };
    }
  }

  async listApps(_context: AdapterContext): Promise<AppControlApp[]> {
    const data = await this.read(argvOf("list-apps"));
    const seen = new Map<string, AppControlApp>();
    for (const app of list(data.apps)) {
      const id = text(app.bundle_id);
      const name = text(app.name);
      if (id && name && !isDeniedApp({ id, name })) seen.set(id.toLowerCase(), { id, name });
    }
    return [...seen.values()];
  }

  async listAllowed(
    _scope: AppControlScope,
    policy: AppControlPolicy,
    _context: AdapterContext,
  ): Promise<Array<AppControlApp & { running: boolean; windows: AppControlWindow[] }>> {
    const entries = policy.allowed.filter((app) => !isDeniedApp(app));
    if (entries.length === 0) return [];
    const apps = list((await this.read(argvOf("list-apps"))).apps);
    const result = [];
    for (const entry of entries) {
      const running = matchRunning(apps, entry);
      const windows = running.length === 1 ? await this.windowsOf(running[0] as RunningApp) : [];
      result.push({ ...entry, running: running.length > 0, windows });
    }
    return result;
  }

  /** Windows that belong to the verified process (another process may share the name). */
  private async windowRows(app: RunningApp): Promise<Node[]> {
    const data = await this.read(argvOf("list-windows", ["--app", app.name]));
    return list(data.windows).filter((window) => window.pid === app.pid && text(window.id));
  }

  private async windowsOf(app: RunningApp): Promise<AppControlWindow[]> {
    return (await this.windowRows(app)).map((window) => ({
      id: text(window.id),
      ...(text(window.title) ? { title: text(window.title) } : {}),
    }));
  }

  /** The requested window, or the focused (else first visible) one of the verified process. */
  private async pickWindow(app: RunningApp, wanted?: string): Promise<string> {
    const rows = await this.windowRows(app);
    if (wanted) {
      if (!rows.some((window) => window.id === wanted)) {
        throw new AppControlRefusedError(
          "window_not_allowed",
          "That window belongs to another app.",
        );
      }
      return wanted;
    }
    const chosen =
      rows.find((window) => window.is_focused === true) ??
      rows.find((window) => window.visible !== false) ??
      rows[0];
    if (!chosen) throw new AppControlRefusedError("window_not_found", "That app has no window.");
    return text(chosen.id);
  }

  /** The one running process for an allowed entry, verified by bundle id and name. */
  private async requireRunning(entry: AppControlApp): Promise<RunningApp> {
    const data = await this.read(argvOf("list-apps", ["--app", entry.name]));
    const matches = matchRunning(list(data.apps), entry);
    if (matches.length === 0) {
      throw new AppControlRefusedError("app_not_running", "That app is not running.");
    }
    if (matches.length > 1) {
      throw new AppControlRefusedError("app_ambiguous", "More than one process matches that app.");
    }
    return matches[0] as RunningApp;
  }

  async snapshot(
    scope: AppControlScope,
    policy: AppControlPolicy,
    request: AppControlSnapshotRequest,
    _context: AdapterContext,
  ): Promise<AppControlSnapshot> {
    const entry = allowedEntry(policy, request.appId);
    const app = await this.requireRunning(entry);
    let surface = request.surface ?? "window";
    let windowId = request.windowId;
    if (!SURFACES.includes(surface)) {
      throw new AppControlRefusedError("surface_not_allowed", "That surface cannot be read.");
    }
    const flags = ["-i", "--compact"];
    if (request.root) {
      const parent = await requireActionableRef(this.store, scope, entry.id, request.root);
      surface = parent.surface;
      windowId = parent.windowId;
      flags.push("--root", request.root);
    } else {
      windowId = await this.pickWindow(app, windowId);
      flags.push("--app", app.name, "--window-id", windowId);
      if (surface !== "window") flags.push("--surface", surface);
    }
    const data = await this.read(argvOf("snapshot", [...flags, ...sessionFlags(scope)]));
    const snapshotId = text(data.snapshot_id);
    const rawTree = record(data.tree);
    if (!snapshotId || !rawTree) throw new Error("agent-desktop returned no snapshot.");
    const seen: Scrubbed = { sensitive: false, dialog: false, visible: [] };
    const scrubbed = scrub(rawTree, seen);
    const sensitive = isSensitive(seen);
    windowId ??= text(record(data.window)?.id) || undefined;
    await this.store.record(scope, {
      snapshotId,
      appId: entry.id,
      ...(windowId ? { windowId } : {}),
      surface,
      sensitive,
    });
    const limited = limitSize(scrubbed);
    return {
      snapshotId,
      app: { id: entry.id, name: entry.name },
      ...(windowId ? { windowId } : {}),
      surface,
      sensitive,
      truncated: limited.truncated || data.complete === false,
      tree: limited.tree,
    };
  }

  async act(
    scope: AppControlScope,
    policy: AppControlPolicy,
    request: { appId: string; action: AppControlAction },
    _context: AdapterContext,
  ): Promise<AppControlActResult> {
    try {
      return await this.actChecked(scope, policy, request);
    } catch (error) {
      if (error instanceof AppControlRefusedError) {
        return { ok: false, delivery: "not_delivered", code: error.code, error: error.message };
      }
      throw error;
    }
  }

  private async actChecked(
    scope: AppControlScope,
    policy: AppControlPolicy,
    { appId, action }: { appId: string; action: AppControlAction },
  ): Promise<AppControlActResult> {
    const entry = allowedEntry(policy, appId);
    const headed = policy.headed ? ["--headed"] : [];
    if (action.kind === "launch") {
      const flags = policy.headed ? ["--activate", "--headed"] : [];
      const outcome = await this.send(argvOf("launch", flags, [entry.id]), LAUNCH_TIMEOUT_MS);
      if (outcome instanceof Error || !outcome.ok) return this.settle(scope, entry.id, outcome);
      try {
        await this.requireRunning(entry);
      } catch (error) {
        await this.spendLatest(scope, entry.id);
        return {
          ok: false,
          delivery: "uncertain",
          code: error instanceof AppControlRefusedError ? error.code : "launch_unverified",
          error: "The launched process could not be verified.",
        };
      }
      return { ok: true, delivery: "delivered" };
    }
    const app = await this.requireRunning(entry);
    if (action.kind === "key") {
      const key = requireKey(action.key);
      if (policy.headed) {
        // Headed delivery goes to whatever window is in front, which was not checked.
        throw new AppControlRefusedError(
          "keys_headless_only",
          "Keys are only sent without real input.",
        );
      }
      await this.requireQuietFocus(app);
      const flags = ["--app", app.name, ...sessionFlags(scope), ...headed];
      return this.settle(scope, entry.id, await this.send(argvOf("press", flags, [key])));
    }
    const command = REF_COMMANDS[action.kind as keyof typeof REF_COMMANDS];
    if (!command)
      throw new AppControlRefusedError("action_not_allowed", "That action is not supported.");
    const rec = await requireActionableRef(this.store, scope, entry.id, action.ref);
    const session = sessionFlags(scope);
    if (action.kind === "click") {
      let title: string;
      try {
        const got = await this.read(
          argvOf("get", [...session, "--property", "title"], [action.ref]),
        );
        title = Object.values(got)
          .filter((value) => typeof value === "string")
          .join(" ");
      } catch {
        throw new AppControlRefusedError("ref_unreadable", "That element could not be read.");
      }
      if (PASTE_RE.test(title)) {
        throw new AppControlRefusedError("paste_not_allowed", "Paste cannot be clicked.");
      }
    }
    let flags = [...session, ...headed];
    let positionals = [action.ref];
    if (action.kind === "type" || action.kind === "set_value")
      positionals = [action.ref, action.text];
    if (action.kind === "select") {
      if (PASTE_RE.test(action.option)) {
        throw new AppControlRefusedError("paste_not_allowed", "Paste cannot be selected.");
      }
      positionals = [action.ref, action.option];
    }
    if (action.kind === "scroll") {
      if (!DIRECTIONS.includes(action.direction)) {
        throw new AppControlRefusedError(
          "direction_not_allowed",
          "That scroll direction is not allowed.",
        );
      }
      const amount = Math.min(Math.max(Math.trunc(action.amount ?? 3), 1), 50);
      flags = [...flags, "--direction", action.direction, "--amount", String(amount)];
    }
    return this.settle(
      scope,
      entry.id,
      await this.send(argvOf(command, flags, positionals)),
      rec.snapshotId,
    );
  }

  /**
   * A key goes to whatever is focused, so the focused surface must be quiet and plain.
   * ponytail: a sheet can still open between this check and the press; agent-desktop has no
   * atomic check-and-press, so that small window remains.
   */
  private async requireQuietFocus(app: RunningApp) {
    const surfaces = await this.read(argvOf("list-surfaces", ["--app", app.name]));
    if (/sheet|alert|unclassified/i.test(JSON.stringify(surfaces.surfaces ?? surfaces))) {
      throw new AppControlRefusedError("surface_open", "A sheet or alert is open.");
    }
    const windowId = await this.pickWindow(app);
    const incomplete = new AppControlRefusedError(
      "observation_incomplete",
      "The focused surface could not be read completely.",
    );
    let envelope: Envelope;
    try {
      envelope = await this.call(
        argvOf("snapshot", [
          "--app",
          app.name,
          "--window-id",
          windowId,
          "--surface",
          "focused",
          "-i",
          "--compact",
        ]),
      );
    } catch {
      throw incomplete;
    }
    const tree = record(envelope.data.tree);
    if (!envelope.ok || !tree || envelope.data.complete === false) throw incomplete;
    const seen: Scrubbed = { sensitive: false, dialog: false, visible: [] };
    scrub(tree, seen);
    if (isSensitive(seen)) {
      throw new AppControlRefusedError(
        "sensitive",
        "The focused surface has sign-in or secret content.",
      );
    }
  }

  private async send(argv: string[], timeoutMs = READ_TIMEOUT_MS): Promise<Envelope | Error> {
    try {
      return await this.call(argv, timeoutMs);
    } catch (error) {
      return error instanceof Error ? error : new Error("agent-desktop failed.");
    }
  }

  /** Delivered, provably not delivered, or uncertain. Uncertain spends the snapshot. */
  private async settle(
    scope: AppControlScope,
    appId: string,
    outcome: Envelope | Error,
    snapshotId?: string,
  ): Promise<AppControlActResult> {
    if (!(outcome instanceof Error) && outcome.ok) return { ok: true, delivery: "delivered" };
    const error = outcome instanceof Error ? undefined : outcome.error;
    if (error?.delivery === "not_delivered" && error.retry === "safe") {
      return { ok: false, delivery: "not_delivered", code: error.code, error: error.message };
    }
    if (snapshotId) await this.store.markSpent(scope, snapshotId);
    else await this.spendLatest(scope, appId);
    return {
      ok: false,
      delivery: "uncertain",
      code: error?.code ?? "runner_failed",
      error: error?.message ?? "agent-desktop did not answer.",
    };
  }

  private async spendLatest(scope: AppControlScope, appId: string) {
    const latest = await this.store.latest(scope, appId);
    if (latest) await this.store.markSpent(scope, latest.snapshotId);
  }

  async endRun(scope: AppControlScope, _context: AdapterContext): Promise<void> {
    await this.store.clearRun(scope);
    try {
      await this.runner.reset?.();
    } catch {
      // Best effort: the bridge also stops its helpers when the stack stops.
    }
  }
}
