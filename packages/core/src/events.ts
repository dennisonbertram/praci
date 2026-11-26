import type { MessageBlock, ThreadMessage } from "@rakazo/contracts";
import { cloudAgentBlockFromPayload } from "./cloud-agent.js";
import { asRecord } from "./record.js";

export function projectMessages(
  events: Array<{
    seq: number;
    type: string;
    payload: unknown;
    runId?: string | null;
    createdAt: Date | string;
    id: string;
    threadId: string;
    botId?: string | null;
  }>,
  runs?: readonly { id: string; status: string }[],
): ThreadMessage[] {
  const messages: ThreadMessage[] = [];
  type LiveProjection = {
    blocks: MessageBlock[];
    meta: {
      id: string;
      threadId: string;
      seq: number;
      botId?: string;
      runId?: string;
      createdAt: string;
    };
  };
  const liveById = new Map<string, LiveProjection>();
  const liveSubagents = new Map<string, ThreadMessage>();
  const durableSubagents = new Set<string>();
  const liveProjection = (event: (typeof events)[number], createdAt: string): LiveProjection => {
    const id = progressMessageId(event);
    const existing = liveById.get(id);
    if (existing) return existing;
    const projection: LiveProjection = {
      blocks: [],
      meta: {
        id,
        threadId: event.threadId,
        seq: event.seq,
        botId: event.botId ?? undefined,
        runId: event.runId ?? undefined,
        createdAt,
      },
    };
    liveById.set(id, projection);
    return projection;
  };
  const clearLive = (event: (typeof events)[number]) => {
    if (event.runId) liveById.delete(progressMessageId(event));
    else liveById.clear();
  };
  for (const event of events) {
    if (stopsRunHelpers(event)) {
      const settled = settleRunSubagents([...liveSubagents.values()], event.runId);
      for (const message of settled) {
        const block = message.blocks[0];
        if (block?.kind === "subagent") liveSubagents.set(block.agentId, message);
      }
    }
    const payload = asRecord(event.payload) ?? {};
    const createdAt =
      typeof event.createdAt === "string" ? event.createdAt : event.createdAt.toISOString();
    if (event.type === "thread.message.created") {
      clearLive(event);
      const role = (payload.role as ThreadMessage["role"]) ?? "bot";
      const blocks = (payload.blocks as MessageBlock[]) ?? [];
      for (const block of blocks) {
        if (block.kind === "subagent") {
          durableSubagents.add(block.agentId);
          liveSubagents.delete(block.agentId);
        }
      }
      messages.push({
        id: (payload.messageId as string) ?? event.id,
        threadId: event.threadId,
        seq: event.seq,
        role,
        blocks,
        botId: event.botId ?? undefined,
        runId: event.runId ?? undefined,
        createdAt,
      });
      continue;
    }
    if (event.type === "thread.cloud_agent") {
      const block = cloudAgentBlockFromPayload(payload);
      for (const message of messages) {
        if (message.id === payload.messageId)
          message.blocks = message.blocks.map((old) =>
            old.kind === "cloud_agent" && old.agentId === block.agentId ? block : old,
          );
      }
      continue;
    }
    if (event.type === "thread.progress") {
      const live = liveProjection(event, createdAt);
      live.blocks = reduceLiveMessageBlocks(live.blocks, { type: "progress", payload });
      live.meta = {
        ...live.meta,
        seq: event.seq,
        botId: event.botId ?? undefined,
        createdAt,
      };
      continue;
    }
    if (event.type === "agent.tool.called") {
      const live = liveProjection(event, createdAt);
      live.blocks = reduceLiveMessageBlocks(live.blocks, {
        type: "tool",
        name: String(payload.name ?? ""),
      });
      live.meta = {
        ...live.meta,
        seq: event.seq,
        botId: event.botId ?? undefined,
        createdAt,
      };
      continue;
    }
    if (event.type === "thread.cleared") {
      messages.length = 0;
      liveById.clear();
      liveSubagents.clear();
      durableSubagents.clear();
      continue;
    }
    if (event.type === "thread.subagent") {
      const block = subagentBlockFromPayload(payload);
      if (durableSubagents.has(block.agentId)) continue;
      liveSubagents.set(block.agentId, {
        id: `subagent:${block.agentId}`,
        threadId: event.threadId,
        seq: event.seq,
        role: "bot",
        blocks: [block],
        botId: event.botId ?? undefined,
        runId: event.runId ?? undefined,
        createdAt,
      });
      continue;
    }
    if (
      event.type === "run.completed" ||
      event.type === "run.failed" ||
      event.type === "run.cancelled"
    ) {
      clearLive(event);
    }
  }
  let helpers = [...liveSubagents.values()];
  if (runs) {
    const running = new Set(runs.filter((run) => run.status === "running").map((run) => run.id));
    for (const runId of new Set(helpers.map((message) => message.runId))) {
      if (runId && !running.has(runId)) helpers = settleRunSubagents(helpers, runId);
    }
  }
  for (const live of helpers) messages.push(live);
  for (const live of liveById.values()) {
    if (live.blocks.length > 0) {
      messages.push({
        id: live.meta.id,
        threadId: live.meta.threadId,
        seq: live.meta.seq,
        role: "bot",
        blocks: live.blocks,
        botId: live.meta.botId,
        runId: live.meta.runId,
        createdAt: live.meta.createdAt,
      });
    }
  }
  return messages;
}

/** A pause ends the current helper execution, even when the run later resumes. */
export function stopsRunHelpers(event: { type: string }): boolean {
  return (
    isRunTerminalEvent(event) ||
    event.type === "run.waiting_input" ||
    event.type === "computer.takeover.requested"
  );
}

export function settleRunSubagents<T extends { runId?: string; blocks: readonly unknown[] }>(
  messages: T[],
  runId: string | null | undefined,
): T[] {
  if (!runId) return messages;
  let changed = false;
  const next = messages.map((message) => {
    if (message.runId !== runId) return message;
    let settled = false;
    const blocks = message.blocks.map((value) => {
      const block = asRecord(value) ?? {};
      if (block.kind !== "subagent" || block.status !== "running") return value;
      settled = true;
      return { ...block, status: "failed", result: "stopped" };
    });
    if (!settled) return message;
    changed = true;
    return { ...message, blocks };
  });
  return changed ? next : messages;
}

export function progressMessageId(event: { runId?: string | null; id?: string }): string {
  return `progress:${event.runId ?? event.id ?? "live"}`;
}

export function isRunTerminalEvent(event: { type: string }): boolean {
  return (
    event.type === "run.completed" || event.type === "run.failed" || event.type === "run.cancelled"
  );
}

export const RESPONSE_STREAMING_STORAGE_KEY = "rakazo.responseStreaming";
export type ResponseStreamingPreference = "on" | "off";

/** Missing and unknown values stay off; only an explicit "on" enables streaming. */
export function normalizeResponseStreamingPreference(
  raw: string | null | undefined,
): ResponseStreamingPreference {
  return raw?.trim().toLowerCase() === "on" ? "on" : "off";
}

export function responseStreamingEnabled(preference: ResponseStreamingPreference = "off"): boolean {
  return preference === "on";
}

/** Hide assistant token text on synthetic progress rows. Tool activity stays. */
export function stripLiveStreamingProgress<
  T extends { id: string; blocks: readonly MessageBlock[] },
>(messages: readonly T[]): T[] {
  let changed = false;
  const next: T[] = [];
  for (const message of messages) {
    if (!message.id.startsWith("progress:")) {
      next.push(message);
      continue;
    }
    const blocks = message.blocks.filter(
      (block) => block.kind !== "text" && (block.kind !== "progress" || block.activity === true),
    );
    if (blocks.length === message.blocks.length) {
      next.push(message);
      continue;
    }
    changed = true;
    if (blocks.length === 0) continue;
    next.push({ ...message, blocks });
  }
  return changed ? next : (messages as T[]);
}

export function withLiveStreamingProgress<
  T extends { messages: readonly U[] },
  U extends { id: string; blocks: readonly MessageBlock[] },
>(snapshot: T | null, streamResponses: boolean): T | null {
  if (!snapshot || streamResponses) return snapshot;
  const messages = stripLiveStreamingProgress(snapshot.messages);
  if (messages === snapshot.messages) return snapshot;
  return { ...snapshot, messages };
}

const RUN_FAILURE_ERROR_MAX = 300;

/** Reason a run failed, clamped for display, or null when there is no usable error to show. */
export function runFailureError(event: {
  type: string;
  payload?: Record<string, unknown>;
}): string | null {
  if (event.type !== "run.failed") return null;
  const error = event.payload?.error;
  if (typeof error !== "string" || !error.trim()) return null;
  const message = error.trim();
  // A provider can fail with a stack or a whole response body; the run record keeps the full
  // text while the UI shows a bounded first line.
  return message.length > RUN_FAILURE_ERROR_MAX
    ? `${message.slice(0, RUN_FAILURE_ERROR_MAX)}…`
    : message;
}

export type LiveMessageUpdate =
  | { type: "progress"; payload: Record<string, unknown> | undefined }
  | { type: "tool"; name: string };

export function reduceLiveMessageBlocks(
  blocks: readonly MessageBlock[],
  update: LiveMessageUpdate,
): MessageBlock[] {
  const tail = blocks.at(-1);
  const segments = tail?.kind === "progress" ? blocks.slice(0, -1) : blocks;
  const priorText = liveMessageText(blocks);
  const flushedLength =
    tail?.kind === "progress" ? priorText.length - tail.text.length : priorText.length;
  const tailText =
    update.type === "progress"
      ? progressMessageText(update.payload, priorText).slice(flushedLength)
      : tail?.kind === "progress"
        ? tail.text
        : "";
  const pendingToolNames = [
    ...(tail?.kind === "progress" ? (tail.pendingToolNames ?? []) : []),
    ...(update.type === "tool" ? [update.name] : []),
  ];
  const activity =
    update.type === "progress"
      ? update.payload?.activity === true
      : tail?.kind === "progress" && tail.activity === true;

  // A status line a tool just reported stays until the next update, whatever its last character is.
  const reachedBoundary =
    update.type === "progress" && activity ? tailText.trim() === "" : endsSentence(tailText);
  if (pendingToolNames.length > 0 && reachedBoundary) {
    let next = activity ? [...segments] : appendTextSegment(segments, tailText);
    for (const name of pendingToolNames) next = appendToolCallSegment(next, name);
    return next;
  }
  if (!tailText) return [...segments];
  return [
    ...segments,
    {
      kind: "progress",
      text: tailText,
      ...(activity ? { activity: true as const } : {}),
      ...(pendingToolNames.length > 0 ? { pendingToolNames } : {}),
    },
  ];
}

function liveMessageText(blocks: readonly MessageBlock[]): string {
  return blocks
    .filter((block) => block.kind === "text" || block.kind === "progress")
    .map((block) => block.text)
    .join("");
}

export type ToolStep = Extract<MessageBlock, { kind: "steps" }>["steps"][number];

export function appendToolStep(steps: readonly ToolStep[], toolName: string): ToolStep[] {
  const label = humanizeToolName(toolName);
  const last = steps.at(-1);
  if (last && last.label === label) {
    return [...steps.slice(0, -1), { ...last, count: last.count + 1 }];
  }
  return [...steps, { label, count: 1 }];
}

const MAX_STEP_LINES = 30;

/** Adds what a finished tool call reported to the newest step with that tool's label. */
export function attachToolNotes(
  segments: readonly MessageBlock[],
  toolName: string,
  notes: { lines: readonly { text: string; failed?: true }[]; summary?: string },
): MessageBlock[] {
  const label = humanizeToolName(toolName);
  const index = segments.findLastIndex((block) => block.kind === "steps");
  const block = segments[index];
  if (block?.kind !== "steps" || (notes.lines.length === 0 && !notes.summary)) return [...segments];
  const at = block.steps.findLastIndex((step) => step.label === label);
  const step = block.steps[at];
  if (!step) return [...segments];
  const lines = [...(step.lines ?? []), ...notes.lines].slice(-MAX_STEP_LINES);
  const steps = block.steps.map((candidate, i) =>
    i === at ? { ...step, lines, ...(notes.summary ? { summary: notes.summary } : {}) } : candidate,
  );
  return segments.map((candidate, i) => (i === index ? { ...block, steps } : candidate));
}

export type ToolCallStreak = { key: string | undefined; count: number };

export function trackToolCallStreak(
  streak: ToolCallStreak,
  name: string,
  args: unknown,
): ToolCallStreak {
  const key = `${name}:${JSON.stringify(args)}`;
  return key === streak.key ? { key, count: streak.count + 1 } : { key, count: 1 };
}

export type ToolNameStreak = { name: string | undefined; count: number };

export function trackToolNameStreak(streak: ToolNameStreak, name: string): ToolNameStreak {
  return name === streak.name ? { name, count: streak.count + 1 } : { name, count: 1 };
}

const SENTENCE_END_RE = /[.!?]["'”’)\]]*\s*$/;

/** True once `text` ends at a sentence boundary (or is empty) — safe to flush without cutting a clause. */
export function endsSentence(text: string): boolean {
  return text.trim() === "" || SENTENCE_END_RE.test(text);
}

export function appendTextSegment(segments: readonly MessageBlock[], text: string): MessageBlock[] {
  if (!text) return [...segments];
  const last = segments.at(-1);
  if (last?.kind === "text") {
    return [...segments.slice(0, -1), { kind: "text", text: last.text + text }];
  }
  return [...segments, { kind: "text", text }];
}

export function appendToolCallSegment(
  segments: readonly MessageBlock[],
  toolName: string,
): MessageBlock[] {
  const last = segments.at(-1);
  const priorSteps = last?.kind === "steps" ? last.steps : [];
  const steps = appendToolStep(priorSteps, toolName);
  if (last?.kind === "steps") {
    return [...segments.slice(0, -1), { kind: "steps", steps }];
  }
  return [...segments, { kind: "steps", steps }];
}

/** Carta's own tool names, in words a founder reads after "Using". */
const CARTA_TOOL_LABELS: Record<string, string> = {
  cap_table_chart: "Carta cap table",
  set_context: "Carta company",
  list_contexts: "Carta company",
  list_accounts: "Carta company",
};

/** Leading verbs of tool ids, as [activity text, finished text]. Anything else keeps its own words. */
const TOOL_VERBS: Record<string, readonly [string, string]> = {
  get: ["checking", "checked"],
  list: ["checking", "checked"],
  query: ["checking", "checked"],
  search: ["searching", "searched"],
  find: ["searching", "searched"],
  read: ["reading", "read"],
  fetch: ["reading", "read"],
  create: ["creating", "created"],
  add: ["adding", "added"],
  update: ["updating", "updated"],
  edit: ["updating", "updated"],
  replace: ["updating", "updated"],
  send: ["sending", "sent"],
  delete: ["deleting", "deleted"],
  cancel: ["cancelling", "cancelled"],
  upload: ["uploading", "uploaded"],
  remove: ["removing", "removed"],
  complete: ["completing", "completed"],
  ask: ["asking", "asked"],
};

const MAIL_WRITE_PENDING: Record<string, string> = {
  "mail send": "Email to send",
  "mail reply batch": "Emails to send",
  "mail draft": "Draft to save",
};

/** The step line for an approved mail_send or mail_draft once it ended; never "Sent" before then. */
export function mailOutcomeSummary(
  tool: "mail_send" | "mail_draft",
  outcome: "sent" | "saved" | "unknown" | "failed",
): string {
  if (outcome === "sent") return "Sent email";
  if (outcome === "saved") return "Draft saved";
  if (outcome === "unknown") return "Unknown";
  return tool === "mail_send" ? "Couldn't send" : "Draft not saved";
}

const TOOL_NAME_MAX_CHARS = 60;

/** Built-in ids whose own words mean nothing to a person ("scratchpad list"). */
const PLAIN_TOOL_WORDS: Record<string, string> = {
  scratchpad_list: "get notes",
  scratchpad_add: "add note",
  scratchpad_update: "update note",
  scratchpad_complete: "complete note",
  scratchpad_remove: "remove note",
  task_catalog: "get open tasks",
  calendar_agenda: "get upcoming schedule",
  render_ui: "format the answer",
  legal_unreviewed_documents: "get unreviewed documents",
  legal_upsert_node: "update legal records",
  legal_upsert_contract: "update contracts",
  legal_upsert_deadline: "update deadlines",
  legal_link: "update legal records",
  legal_query: "get legal records",
  // Mercury asks for approval; nothing moves until the user allows it.
  "request send money": "ask to send money",
  "request transfer money": "ask to transfer money",
};

/** The plain lowercase words of any tool id: no `mcp__server__` prefix, no case or separator style. */
function toolWords(name: string, service?: string): string[] {
  const plain = PLAIN_TOOL_WORDS[name];
  if (plain) return plain.split(" ");
  let id = name;
  if (id.startsWith("mcp__")) {
    // mcp__<server slug>__<tool>; the slug can be an opaque id, so keep the tool only.
    const carta = CARTA_TOOL_LABELS[/^mcp__.+?__(.+)$/.exec(id)?.[1] ?? ""];
    if (carta) return carta.toLowerCase().split(" ");
    id = id.split("__").filter(Boolean).slice(2).join(" ");
  }
  let words = id
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z\d]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  // "Get card by id" is "Get card" to a person.
  if (words.length > 2 && words.at(-2) === "by" && words.at(-1) === "id")
    words = words.slice(0, -2);
  const plainWords = PLAIN_TOOL_WORDS[words.join(" ")];
  if (plainWords) return plainWords.split(" ");
  const own = new Set(
    (service ?? "")
      .toLowerCase()
      .split(/[^a-z\d]+/)
      .filter(Boolean),
  );
  const rest = words.filter((word) => !own.has(word));
  return (rest.length > 0 ? rest : words).slice(0, 8);
}

function capitalized(text: string): string {
  const clipped =
    text.length > TOOL_NAME_MAX_CHARS
      ? `${text.slice(0, TOOL_NAME_MAX_CHARS - 1).trimEnd()}…`
      : text;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

/** A short plain label for a tool id or an earlier label: "Get banking transactions". Empty when there is nothing to say. */
export function humanizeToolName(name: string, service?: string): string {
  return capitalized(toolWords(name, service).join(" "));
}

/** A saved step label as shown: labels saved before tool names were humanized are raw ids. */
export function toolStepLabel(label: string): string {
  return /^mcp__|_/.test(label) ? humanizeToolName(label) : label;
}

/**
 * A tool as a verb phrase: "Checking banking transactions" while it runs, "Checked banking
 * transactions" after. `service` drops the agent's own service name ("Brex") from the words.
 */
export function toolPhrase(name: string, tense: "activity" | "done", service?: string): string {
  const words = toolWords(name, service);
  // A finished step only means the call was made. An approved send or save replaces this with
  // `mailOutcomeSummary`; until then the mail has not gone out, so the step must not say it did.
  if (tense === "done") {
    const pending = MAIL_WRITE_PENDING[words.join(" ")];
    if (pending) return pending;
  }
  const [first, ...rest] = words;
  if (!first) return "";
  const verb = TOOL_VERBS[first]?.[tense === "activity" ? 0 : 1] ?? first;
  return capitalized([verb, ...rest].join(" "));
}

/** One line for a run that ended in tool calls: the latest call, or a count when there were several. */
export function toolStepsSummary(steps: readonly ToolStep[], service?: string): string {
  const last = steps.at(-1);
  if (!last) return "";
  const total = steps.reduce((sum, step) => sum + step.count, 0);
  return total > 1 ? `Used ${total} tools` : toolPhrase(last.label, "done", service);
}

export function progressMessageText(
  payload: Record<string, unknown> | undefined,
  previousText = "",
): string {
  return typeof payload?.delta === "string"
    ? previousText + payload.delta
    : String(payload?.text ?? "");
}

export function subagentBlockFromPayload(
  payload: Record<string, unknown>,
): Extract<MessageBlock, { kind: "subagent" }> {
  const status = payload.status;
  return {
    kind: "subagent",
    agentId: String(payload.agentId ?? ""),
    name: String(payload.name ?? "subagent"),
    task: String(payload.task ?? ""),
    status: status === "completed" || status === "failed" ? status : "running",
    progress: payload.progress ? String(payload.progress) : undefined,
    result: payload.result ? String(payload.result) : undefined,
  };
}

/** Shorter lines, or lines with spaces such as a key's BEGIN header, also appear in ordinary text. */
const MIN_SECRET_LINE_LENGTH = 16;

/**
 * The values to hide for `secrets`: each value, and each long unspaced line of a multi-line value
 * such as a private key's body, since output that prints only some lines or joins them with
 * spaces (an unquoted `echo $KEY`) never contains the whole value.
 */
function protectedValues(secrets: Iterable<string>): string[] {
  const values = new Set<string>();
  for (const secret of secrets) {
    if (!secret) continue;
    values.add(secret);
    if (!/[\r\n]/.test(secret)) continue;
    for (const line of secret.split(/\r\n?|\n/)) {
      const trimmed = line.trim();
      if (trimmed.length >= MIN_SECRET_LINE_LENGTH && !/\s/.test(trimmed)) values.add(trimmed);
    }
  }
  return [...values];
}

/**
 * The stretches protected values cover in `value`, in order, as [start, end). Matches that
 * overlap make one stretch, so a shorter value inside or across a longer one can't cut it and
 * leave the rest readable; matches that only touch stay separate.
 */
export function redactedRanges(value: string, secrets: Iterable<string>): Array<[number, number]> {
  // Count matches starting and ending at each offset rather than listing every match, so a value
  // that repeats or overlaps itself across a long text costs no more than two counters per offset.
  let starts: Int32Array | undefined;
  let ends: Int32Array | undefined;
  for (const secret of protectedValues(secrets)) {
    for (let at = value.indexOf(secret); at !== -1; at = value.indexOf(secret, at + 1)) {
      starts ??= new Int32Array(value.length + 1);
      ends ??= new Int32Array(value.length + 1);
      starts[at] = starts[at]! + 1;
      ends[at + secret.length] = ends[at + secret.length]! + 1;
    }
  }
  if (!starts || !ends) return [];
  const ranges: Array<[number, number]> = [];
  let open = 0;
  let start = 0;
  for (let offset = 0; offset <= value.length; offset += 1) {
    const ending = ends[offset]!;
    const starting = starts[offset]!;
    if (ending === 0 && starting === 0) continue;
    open -= ending;
    if (ending > 0 && open === 0) ranges.push([start, offset]);
    if (starting > 0 && open === 0) start = offset;
    open += starting;
  }
  return ranges;
}

export function redactSecrets(value: string, secrets: string[]): string {
  let output = "";
  let offset = 0;
  for (const [start, end] of redactedRanges(value, secrets)) {
    output += `${value.slice(offset, start)}[redacted]`;
    offset = end;
  }
  return output + value.slice(offset);
}

export function containsSecret(value: unknown, secrets: string[]): boolean {
  const active = protectedValues(secrets);
  if (active.length === 0) return false;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return false;
  const pending: unknown[] = [JSON.parse(serialized)];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === "string") {
      if (active.some((secret) => current.includes(secret))) return true;
      continue;
    }
    if (current === null || typeof current === "number" || typeof current === "boolean") {
      const primitive = String(current);
      if (active.some((secret) => primitive.includes(secret))) return true;
      continue;
    }
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    if (current && typeof current === "object") {
      for (const [key, nested] of Object.entries(current)) {
        if (active.some((secret) => key.includes(secret))) return true;
        pending.push(nested);
      }
    }
  }
  return false;
}

/** UTF-16 high surrogates (0xD800–0xDBFF) must be paired with a low surrogate for valid JSON. */
const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;

function isHighSurrogate(code: number): boolean {
  return code >= HIGH_SURROGATE_START && code <= HIGH_SURROGATE_END;
}

function endsWithHighSurrogate(value: string): boolean {
  return value.length > 0 && isHighSurrogate(value.charCodeAt(value.length - 1));
}

/**
 * Replace unpaired UTF-16 surrogates so the string is safe for JSON (Postgres rejects them).
 */
export function sanitizeUtf16ForJson(value: string): string {
  return value.replace(UNSAFE_UTF16, "\uFFFD");
}

/** NUL, a high surrogate with no low after it, or a low surrogate with no high before it. */
const UNSAFE_UTF16 = /\0|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Deep-sanitize string leaves and keys so event payloads always persist in Postgres. */
export function sanitizeJsonValue<T>(value: T): T {
  if (typeof value === "string") return sanitizeUtf16ForJson(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    const used = new Map<string, number>();
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      let safeKey = sanitizeUtf16ForJson(key);
      const seen = used.get(safeKey) ?? 0;
      used.set(safeKey, seen + 1);
      // Deterministic collision handling when sanitizing collapses distinct keys.
      if (seen > 0) safeKey = `${safeKey}#${seen + 1}`;
      // An own property, so a parsed "__proto__" key stays data instead of setting the prototype.
      Object.defineProperty(out, safeKey, {
        value: sanitizeJsonValue(nested),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out as T;
  }
  return value;
}

export function createStreamingRedactor(secrets: string[]) {
  const values = protectedValues(secrets);
  const maxLength = Math.max(0, ...values.map((value) => value.length));
  let buffer = "";
  let covered = 0;

  const drain = (final: boolean) => {
    let output: string;
    if (values.length === 0) {
      output = buffer;
      buffer = "";
    } else {
      // A match a later chunk completes starts in the last maxLength - 1 units, so text before
      // that is final. A stretch reaching past it is shown now and its rest kept as `covered`: a
      // later match starting inside it extends the same placeholder, so nothing is held for long.
      const cut = final ? buffer.length : Math.max(0, buffer.length - maxLength + 1);
      let offset = covered;
      output = "";
      for (const [start, end] of redactedRanges(buffer, values)) {
        if (start >= cut) break;
        if (start >= offset) output += `${buffer.slice(offset, start)}[redacted]`;
        offset = Math.max(offset, end);
      }
      output += buffer.slice(Math.min(offset, cut), cut);
      covered = Math.max(0, offset - cut);
      buffer = buffer.slice(cut);
    }
    // No-secret path emits the whole buffer; hold a trailing high until the next chunk.
    if (!final && endsWithHighSurrogate(output)) {
      buffer = output.slice(-1) + buffer;
      output = output.slice(0, -1);
    }
    return sanitizeUtf16ForJson(output);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      return drain(false);
    },
    finish() {
      return drain(true);
    },
  };
}
