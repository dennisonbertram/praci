export type TeachRecordingEvent = {
  at: string;
  kind: "pointer" | "key" | "clipboard" | "snapshot" | "scroll" | "window" | "file" | "command";
  x?: number;
  y?: number;
  button?: string;
  type?: string;
  key?: string;
  text?: string;
  summary?: string;
  sensitive?: boolean;
  /** Label of the field the input went to, such as "Password". */
  field?: string;
  /** Which protected value this event belongs to. Set by the server. */
  segment?: number;
  title?: string;
  app?: string;
  path?: string;
  command?: string;
};

const PROTECTED_FIELD_LABEL =
  /pass(word|code|phrase)|\bpin\b|secret|token|api[\s_-]?key|\botp\b|2fa|verification code|\bcvv\b|security code/i;

/** True when a field label says the value typed into it is a credential. */
export function isProtectedFieldLabel(label: string | undefined): boolean {
  return Boolean(label && PROTECTED_FIELD_LABEL.test(label));
}

/** A credential: marked Protected, or typed into a field whose label names one. */
export function isProtectedTeachInput(
  event: Pick<TeachRecordingEvent, "kind" | "sensitive" | "field">,
): boolean {
  if (event.sensitive) return true;
  return (event.kind === "key" || event.kind === "clipboard") && isProtectedFieldLabel(event.field);
}

const SECRET_TEXT_PATTERNS: [RegExp, string][] = [
  // Credentials inside a URL: https://user:pass@host
  [/(\w+:\/\/[^\s/:@]+):[^\s/@]+@/g, "$1:[redacted]@"],
  // Authorization: Bearer x
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [redacted]"],
  // --password=x, password: x, token x, api_key=x
  [
    /\b(pass(?:word|wd|phrase)?|secret|token|api[_-]?key|authorization)(["']?\s*[=:]\s*|\s+)(?!\[redacted\]|bearer |basic )("[^"]*"|'[^']*'|\S+)/gi,
    "$1$2[redacted]",
  ],
  // ENV assignments such as AWS_SECRET_ACCESS_KEY=abc
  [/\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD))=\S+/g, "$1=[redacted]"],
  // Well-known token shapes.
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, "[redacted]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[redacted]"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[redacted]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[redacted]"],
];

/** Removes anything that looks like a password, token or key from a window title, path or command line. */
export function redactSecretText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SECRET_TEXT_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  // A long mixed letter-and-digit word is almost always a key.
  return out.replace(
    /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g,
    "[redacted]",
  );
}

/** Replaces every held value (and its URL-encoded form) that appears in `text`. */
export function scrubValues(text: string, values: readonly string[]): string {
  let out = text;
  for (const value of values) {
    if (!value) continue;
    // Replacing a one or two character value inside text would mangle it, so drop the text.
    if (value.length < 3) {
      if (out.includes(value)) return "[redacted]";
      continue;
    }
    for (const form of new Set([value, encodeURIComponent(value)])) {
      out = out.split(form).join("[redacted]");
    }
  }
  return out;
}

export function sanitizeTeachRecordingEvent(event: TeachRecordingEvent): TeachRecordingEvent {
  const sanitized: TeachRecordingEvent = { ...event };
  if (isProtectedTeachInput(event)) {
    sanitized.sensitive = true;
    delete sanitized.key;
    delete sanitized.text;
  }
  if (sanitized.kind === "window") {
    delete sanitized.text;
    if (sanitized.title) sanitized.title = redactSecretText(sanitized.title);
    if (sanitized.app) sanitized.app = redactSecretText(sanitized.app);
  } else if (sanitized.kind === "file") {
    // The path is recorded, never what was written.
    delete sanitized.text;
    if (sanitized.path) sanitized.path = redactSecretText(sanitized.path);
  } else if (sanitized.kind === "command") {
    delete sanitized.text;
    if (sanitized.command) sanitized.command = redactSecretText(sanitized.command);
  }
  return sanitized;
}

export type TeachSnapshot = {
  at: string;
  summary: string;
  hash?: string;
};

export type SkillPlaybook = {
  whenToUse: string;
  inputs: string[];
  steps: string[];
  howToCheck: string;
  whatToReturn: string;
  approvalBoundaries: string;
  failureHandling: string;
};

const DEFAULT_APPROVAL =
  "Do not send messages, spend money, publish content, or delete data without explicit user approval.";
const DEFAULT_FAILURE =
  "If a step fails or the expected screen is not visible, stop and ask the user before retrying.";

function describePointer(event: TeachRecordingEvent): string {
  const action = event.type ?? "click";
  const button = event.button ?? "left";
  if (action === "move") {
    return `Move pointer to (${event.x ?? 0}, ${event.y ?? 0}).`;
  }
  if (action === "down") {
    return `Press ${button} button at (${event.x ?? 0}, ${event.y ?? 0}).`;
  }
  if (action === "up") {
    return `Release ${button} button at (${event.x ?? 0}, ${event.y ?? 0}).`;
  }
  return `${action === "click" ? "Click" : action} ${button} button at (${event.x ?? 0}, ${event.y ?? 0}).`;
}

function describeScroll(event: TeachRecordingEvent): string {
  const direction = event.type === "up" ? "up" : "down";
  const amount = Number(event.text ?? 3);
  return Number.isFinite(amount) && amount > 1
    ? `Scroll ${direction} ${amount} times.`
    : `Scroll ${direction}.`;
}

const REDACTED_INPUT = "[redacted input]";
/** The step that stands for a value typed into a credential field. */
export const PROTECTED_STEP = `Type ${JSON.stringify(REDACTED_INPUT)}.`;

export type ProtectedStep = { stepIndex: number; segment: number; field: string };

function redactSensitiveText(text: string): string {
  const trimmed = text.trim();
  if (/password|secret|token|api[_-]?key/i.test(trimmed)) return REDACTED_INPUT;
  return redactSecretText(trimmed);
}

function isTypedCharacter(key: string): boolean {
  return key.length === 1;
}

export function buildPlaybookFromRecording(
  goal: string,
  events: TeachRecordingEvent[],
  snapshots: TeachSnapshot[] = [],
): SkillPlaybook {
  return buildPlaybookWithProtected(goal, events, snapshots).playbook;
}

/** The playbook, and which of its steps stand for a credential the user typed. */
export function buildPlaybookWithProtected(
  goal: string,
  events: TeachRecordingEvent[],
  snapshots: TeachSnapshot[] = [],
): { playbook: SkillPlaybook; protectedSteps: ProtectedStep[] } {
  const steps: string[] = [];
  const protectedSteps: ProtectedStep[] = [];
  let typed = "";
  let typedSensitive: { segment: number; field: string } | null = null;
  let nextSegment = 0;
  let drag: { button: string; fromX: number; fromY: number; toX: number; toY: number } | null =
    null;

  function flushTyped() {
    if (!typed) return;
    const text = redactSensitiveText(typed);
    if (text) steps.push(`Type ${JSON.stringify(text)}.`);
    typed = "";
  }

  function pushProtected(segment: number | undefined, field: string | undefined) {
    protectedSteps.push({
      stepIndex: steps.length,
      segment: segment ?? nextSegment,
      field: field ?? "",
    });
    nextSegment = Math.max(nextSegment, (segment ?? nextSegment) + 1);
    steps.push(PROTECTED_STEP);
  }

  function flushSensitiveTyped() {
    if (!typedSensitive) return;
    pushProtected(typedSensitive.segment, typedSensitive.field);
    typedSensitive = null;
  }

  function flushPendingInput() {
    flushTyped();
    flushSensitiveTyped();
  }

  function pushUnlessRepeat(step: string) {
    if (steps.at(-1) !== step) steps.push(step);
  }

  function flushDrag() {
    if (!drag) return;
    const moved = Math.hypot(drag.toX - drag.fromX, drag.toY - drag.fromY) >= 8;
    steps.push(
      moved
        ? `Drag ${drag.button} button from (${drag.fromX}, ${drag.fromY}) to (${drag.toX}, ${drag.toY}).`
        : `Click ${drag.button} button at (${drag.fromX}, ${drag.fromY}).`,
    );
    drag = null;
  }

  for (const event of events) {
    if (event.kind === "key") {
      if (event.sensitive) {
        flushDrag();
        flushTyped();
        typedSensitive ??= { segment: event.segment ?? nextSegment, field: event.field ?? "" };
        continue;
      }
      const key = event.key;
      if (!key) continue;
      flushDrag();
      if (isTypedCharacter(key)) {
        flushSensitiveTyped();
        typed += key;
        continue;
      }
      flushPendingInput();
      steps.push(`Press key: ${key}.`);
      continue;
    }
    flushPendingInput();
    if (event.kind === "pointer") {
      const action = event.type ?? "click";
      const button = event.button ?? "left";
      const x = event.x ?? 0;
      const y = event.y ?? 0;
      if (action === "down") {
        flushDrag();
        drag = { button, fromX: x, fromY: y, toX: x, toY: y };
        continue;
      }
      if (action === "move" && drag) {
        drag.toX = x;
        drag.toY = y;
        continue;
      }
      if (action === "up") {
        if (drag) {
          drag.toX = x;
          drag.toY = y;
          flushDrag();
        } else {
          steps.push(describePointer(event));
        }
        continue;
      }
      flushDrag();
      steps.push(describePointer(event));
    } else if (event.kind === "clipboard") {
      flushDrag();
      if (event.sensitive) pushProtected(event.segment, event.field);
      else {
        const text = event.text ? redactSensitiveText(event.text) : "";
        if (text) steps.push(`Paste or type: ${text}.`);
      }
    } else if (event.kind === "window") {
      flushDrag();
      const where = [event.app, event.title].filter(Boolean).join(": ");
      if (where) pushUnlessRepeat(`Switch to ${where}.`);
    } else if (event.kind === "file") {
      flushDrag();
      if (event.path) pushUnlessRepeat(`Save the file ${event.path}.`);
    } else if (event.kind === "command") {
      flushDrag();
      if (event.command) pushUnlessRepeat(`Run the command: ${event.command}`);
    } else if (event.kind === "scroll") {
      flushDrag();
      steps.push(describeScroll(event));
    } else {
      flushDrag();
    }
  }
  flushPendingInput();
  flushDrag();

  // The typed value is dropped when a protected event is recorded, so a snapshot summary (a
  // window title) that echoes it cannot be scrubbed by value. Drop the summary instead.
  const finalSummary = events.some((event) => event.sensitive)
    ? undefined
    : snapshots.at(-1)?.summary;

  if (steps.length === 0) {
    steps.push("Repeat the demonstrated workflow using the same navigation pattern.");
  }

  return {
    playbook: {
      whenToUse: goal.trim() || "When the user asks to repeat the demonstrated task.",
      inputs: goal.trim() ? [goal.trim()] : [],
      steps,
      howToCheck: finalSummary
        ? `The final screen should match: ${redactSecretText(finalSummary)}.`
        : "Confirm the outcome matches the user's goal before reporting success.",
      whatToReturn: "A short summary of what was completed and where outputs were saved.",
      approvalBoundaries: DEFAULT_APPROVAL,
      failureHandling: DEFAULT_FAILURE,
    },
    protectedSteps,
  };
}

const SKILL_RUN_PROMPT_PREFIX = "run taught skill:";
const SKILL_INVOCATION_VERB = /\b(run|use|do|repeat|perform|execute)\b/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A saved skill only takes over a task when the user actually asks for it: an invocation verb
 * plus the whole skill name. A bare substring match would hijack any request that happens to
 * mention a common word used as a skill name.
 */
export function promptInvokesSkill(prompt: string, name: string): boolean {
  const skill = name.trim().toLowerCase();
  const text = prompt.toLowerCase();
  if (skill.length < 3) return false;
  if (text.startsWith(SKILL_RUN_PROMPT_PREFIX)) return false;
  if (!SKILL_INVOCATION_VERB.test(text)) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(skill)}([^\\p{L}\\p{N}]|$)`, "u").test(text);
}

export const FILL_LOGIN_STEP_PREFIX = "Fill saved login ";
export const ASK_SIGN_IN_STEP = "Ask the user to sign in.";

/** The step a saved login leaves behind; `fill_secret` runs it. */
export function fillLoginStep(name: string, field: string): string {
  return `${FILL_LOGIN_STEP_PREFIX}${name} into ${field.trim() || "Password"}.`;
}

const LOGIN_STEP_GUIDANCE =
  'Login steps: for "Fill saved login <name> into <field>", call browser_act with kind fill_secret and secret <name>; use field "username" when the label names a username or email, otherwise "password". If that login is not saved, stop at that step and call request_secret for it. For "Ask the user to sign in", call request_takeover and wait for the user.';

export function formatSkillRunPrompt(name: string, playbook: SkillPlaybook, test = false): string {
  const safety = test
    ? "This is a safe test run. Do not send, spend, delete, or publish anything."
    : "";
  return [
    `Run taught skill: ${name}`,
    safety,
    `When to use: ${playbook.whenToUse}`,
    playbook.inputs.length ? `Inputs: ${playbook.inputs.join("; ")}` : undefined,
    "Steps:",
    ...playbook.steps.map((step, index) => `${index + 1}. ${step}`),
    playbook.steps.some(
      (step) => step.startsWith(FILL_LOGIN_STEP_PREFIX) || step === ASK_SIGN_IN_STEP,
    )
      ? LOGIN_STEP_GUIDANCE
      : undefined,
    `How to check: ${playbook.howToCheck}`,
    `Return: ${playbook.whatToReturn}`,
    `Approval boundaries: ${playbook.approvalBoundaries}`,
    `Failure handling: ${playbook.failureHandling}`,
    RESULT_LINE_GUIDANCE,
  ]
    .filter(Boolean)
    .join("\n");
}

const RESULT_LINE_GUIDANCE =
  'End your final reply with one last line, exactly "Result: worked" if every step was done and the check passed, or "Result: stopped at step N: <reason>" if you stopped or a step could not be done.';
const RESULT_LINE = /^\s*Result:\s*(worked|stopped(?:\s+at\s+step\s+\d+)?\s*:?\s*(.*))\s*$/im;

/**
 * How a taught skill run ended, from the "Result:" line the run prompt asks for. Anything but an
 * explicit "Result: worked" counts as stopped, so a bot that gave up cannot show as Worked.
 */
export function parseSkillResult(text: string | null | undefined): {
  outcome: "worked" | "stopped";
  note: string | null;
} {
  const lines = (text ?? "").split("\n").filter((line) => RESULT_LINE.test(line));
  const match = RESULT_LINE.exec(lines.at(-1) ?? "");
  if (!match) return { outcome: "stopped", note: "The bot did not report a result" };
  if (/^worked$/i.test(match[1]!)) return { outcome: "worked", note: null };
  const step = /step\s+(\d+)/i.exec(match[1]!)?.[1];
  const reason = match[2]?.trim().slice(0, 200);
  return {
    outcome: "stopped",
    note: [step ? `Stopped at step ${step}` : "Stopped", reason].filter(Boolean).join(": "),
  };
}

/**
 * "Report.xlsx - LibreOffice Calc" is the file in the app. Most desktop apps put their name last;
 * a title without a separator has no app we can name.
 */
export function splitWindowTitle(title: string): { app?: string; title: string } {
  const parts = title.split(/\s[-–—]\s/);
  const app = parts.length > 1 ? parts.at(-1)?.trim() : undefined;
  return app && app.length <= 40 ? { app, title: title.trim() } : { title: title.trim() };
}

/**
 * Swaps the coordinate steps for the model's plain steps. The model must keep every protected
 * step as the exact `PROTECTED_STEP` line, so each held value still maps to one step. Anything
 * else (a missing or extra protected line, no steps) returns null and the caller keeps the
 * coordinate steps.
 */
export function applyPlainSteps(
  protectedSteps: ProtectedStep[],
  plain: string[],
): { steps: string[]; protectedSteps: ProtectedStep[] } | null {
  const steps = plain.map((step) => step.trim()).filter(Boolean);
  if (steps.length === 0) return null;
  const marked = steps.flatMap((step, index) => (step === PROTECTED_STEP ? [index] : []));
  if (marked.length !== protectedSteps.length) return null;
  return {
    steps,
    protectedSteps: protectedSteps.map((original, index) => ({
      ...original,
      stepIndex: marked[index]!,
    })),
  };
}
