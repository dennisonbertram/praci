import { createHash } from "node:crypto";
import type {
  ActionApprovalResolved,
  AutoReviewJudgeDecision,
  HardLine,
  HardLineCall,
} from "./action-approval.js";
import { hardLineFor } from "./action-approval.js";
import { stableJsonValue } from "./approval-effect-key.js";
import { builtinToolRisk } from "./tool-risk.js";

/**
 * The auto-approval classifier is pure and deterministic. The caller loads the rules and the past
 * decisions for this space, user, agent, tool and target, and this decides. Only step 6 uses a
 * model, and only when the caller already has its answer.
 */
export const CLASSIFIER_VERSION = 1;
/** Human approvals of the same tool on the same target, with no denial or undo since. */
export const PRECEDENT_APPROVALS = 3;
export const PRECEDENT_WINDOW_DAYS = 90;
/** A call's args may be at most this many times the size of the largest approved one. */
export const PRECEDENT_SIZE_FACTOR = 4;
/** After an Undo of any call of a tool, precedent for that whole tool waits this long. */
export const UNDO_PAUSE_DAYS = 7;

/**
 * Built-ins with an undo handler (section 7.7) whose risk profile says "cannot be put back": a
 * page write is reverted from its revisions, a label change by its inverse.
 */
const UNDO_HANDLER_TOOLS: ReadonlySet<string> = new Set([
  "mail_modify",
  "page_write",
  "page_edit",
  "scratchpad_add",
  "contacts_add",
  "archive_bot",
  "calendar_create_event",
]);

/**
 * Only these can be approved from precedent or a judge: a reversible internal write by its risk
 * profile, or a built-in with an undo handler. Hard lines are taken out by classificationTier.
 */
export function isUndoableTool(toolName: string): boolean {
  if (UNDO_HANDLER_TOOLS.has(toolName)) return true;
  const profile = builtinToolRisk(toolName);
  return profile?.effect === "internal_write" && profile.reversible;
}

/** The args that name what a call acts on; any other tool's target is all of its args. */
const TARGET_ARGS: Record<string, string[]> = {
  mail_modify: ["addLabels", "removeLabels", "addLabelIds", "removeLabelIds", "connectionId"],
  page_write: ["pageId", "path"],
  page_edit: ["pageId", "path"],
  archive_bot: ["botId"],
};

export type ApprovalDecisionKind =
  | "approved"
  | "denied"
  | "edited"
  | "undone"
  | "auto_approved"
  | "auto_asked"
  | "blocked";

export type ArgsShape = { keys: string[]; size: number };

/** One row of the decision log, already scoped to this space, user, agent, tool and target. */
export type PastDecision = {
  decision: ApprovalDecisionKind;
  /** Null for a decision nobody made by hand. */
  decidedByUserId: string | null;
  cleanRun: boolean;
  argsShape: ArgsShape;
  createdAt: Date;
};

export type ClassificationTier =
  | "own_state"
  | "reversible"
  | "outside_reversible"
  | "irreversible"
  | "hard_line";

export type ActionClassification = {
  decision: "approve" | "ask" | "deny";
  basis:
    | "rule"
    | "hard_line"
    | "mandatory"
    | "precedent"
    | "low_risk"
    | "judge"
    | "default"
    | "open";
  tier: ClassificationTier;
  hardLine?: HardLine;
  reason: string;
  targetKey: string;
  precedent?: { approvals: number; denials: number; lastAt: string };
  version: number;
};

export type ClassifyActionInput = {
  /** The call as hardLineFor reads it, including the caller's recipient check. */
  call: HardLineCall;
  /** The saved-rule resolution for this call (resolveActionApprovalDetail). */
  rules: ActionApprovalResolved;
  /** An existing reason a person must decide (taint, Firewall, unattended, explicit-only tools). */
  mandatory: boolean;
  /** The call writes or reaches outside, so with no rule it is Auto Review's to judge. */
  consequential: boolean;
  /** Outside content (mail, a page, a webhook, an MCP result, a meeting) is in the run. */
  untrustedContentSeen: boolean;
  /** Goal runs are never approved automatically. */
  goalRun?: boolean;
  /** Nobody can answer a card (a webhook run): a hard line is refused instead of asked. */
  nobodyToAsk?: boolean;
  /** Auto Review is on. Off means ask: nothing is approved by precedent or a judge. */
  autoReviewEnabled: boolean;
  /** The judge's answer when the caller ran it; undefined when there is no judge. */
  judge?: AutoReviewJudgeDecision;
  /** Past decisions for this space, user, agent, tool and target key. */
  history: PastDecision[];
  /**
   * The run's user when they own the space, else null. Only their own answers count as their
   * precedent, so in a shared space another member's approvals never clear the owner's cards.
   */
  ownerUserId: string | null;
  /** The latest Undo of this tool on any target, for the same scope. */
  toolUndoneAt?: Date | null;
  now: Date;
};

export function targetKeyFor(toolName: string, args: Record<string, unknown> = {}): string {
  const keys = TARGET_ARGS[toolName];
  const picked = keys
    ? Object.fromEntries(keys.filter((key) => key in args).map((key) => [key, args[key]]))
    : args;
  const digest = createHash("sha256").update(stableJsonValue(picked)).digest("hex").slice(0, 32);
  return `${toolName}:${digest}`;
}

export function argsShapeOf(args: Record<string, unknown> = {}): ArgsShape {
  return { keys: Object.keys(args).sort(), size: stableJsonValue(args).length };
}

export function classificationTier(call: HardLineCall): ClassificationTier {
  if (hardLineFor(call)) return "hard_line";
  if (call.viaConnector) return "irreversible";
  if (isUndoableTool(call.toolName)) return "reversible";
  const profile = builtinToolRisk(call.toolName);
  return profile?.effect === "outside_write" && profile.reversible
    ? "outside_reversible"
    : "irreversible";
}

/**
 * The precedent for a target: the owner's own approvals since the last denial or undo, inside the window,
 * all from runs that had not read outside content. Edits and automatic decisions do not count.
 */
export function precedentSummary(history: PastDecision[], now: Date, ownerUserId: string | null) {
  const sorted = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lastReset = sorted.findLastIndex(
    (row) => row.decision === "denied" || row.decision === "undone",
  );
  const since = now.getTime() - PRECEDENT_WINDOW_DAYS * 86_400_000;
  const approvals = sorted
    .slice(lastReset + 1)
    .filter(
      (row) =>
        row.decision === "approved" &&
        ownerUserId !== null &&
        row.decidedByUserId === ownerUserId &&
        row.cleanRun &&
        row.createdAt.getTime() >= since,
    );
  const denials = sorted.filter(
    (row) => row.decision === "denied" || row.decision === "undone",
  ).length;
  return { approvals, denials, lastAt: sorted.at(-1)?.createdAt };
}

function shapeMatches(shape: ArgsShape, approved: PastDecision[]): boolean {
  const keys = shape.keys.join("\n");
  if (!approved.every((row) => row.argsShape.keys.join("\n") === keys)) return false;
  const largest = Math.max(...approved.map((row) => row.argsShape.size));
  return shape.size <= largest * PRECEDENT_SIZE_FACTOR;
}

/**
 * Order: block rule, hard line or mandatory reason, saved rule, precedent, low risk, judge, the
 * type's default. A model only ever widens what deterministic code rates as undoable.
 */
export function classifyAction(input: ClassifyActionInput): ActionClassification {
  const { call, rules } = input;
  const targetKey = targetKeyFor(call.toolName, call.args);
  const hardLine = hardLineFor(call) ?? undefined;
  const tier = classificationTier(call);
  const summary = precedentSummary(input.history, input.now, input.ownerUserId);
  const precedent = summary.lastAt
    ? {
        approvals: summary.approvals.length,
        denials: summary.denials,
        lastAt: summary.lastAt.toISOString(),
      }
    : undefined;
  const out = (
    decision: ActionClassification["decision"],
    basis: ActionClassification["basis"],
    reason: string,
  ): ActionClassification => ({
    decision,
    basis,
    tier,
    ...(hardLine ? { hardLine } : {}),
    reason,
    targetKey,
    ...(precedent ? { precedent } : {}),
    version: CLASSIFIER_VERSION,
  });

  // 1. Block rule.
  if (rules.decision === "block") return out("deny", "rule", "Blocked by your rule");
  // 2. Hard line, then any existing mandatory reason.
  if (hardLine) {
    return input.nobodyToAsk
      ? out("deny", "hard_line", "Needs a person, and nobody can be asked")
      : out("ask", "hard_line", "Always asks");
  }
  if (input.mandatory) return out("ask", "mandatory", "Needs your approval");
  // Once outside content is in the run, injected text could pick the call: nothing that writes
  // past what Undo can restore runs without a person, whatever was saved before (H4).
  if (input.untrustedContentSeen && input.consequential && tier !== "reversible") {
    return out("ask", "mandatory", "Asked because an earlier step read outside content");
  }
  // 3. A saved rule decides as it does today.
  if (rules.source === "always_allow") return out("approve", "rule", "Allowed by your rule");
  if (rules.source === "require_approval") return out("ask", "rule", "Asked because of your rule");
  // 4. Precedent: undoable, clean run, Auto Review on, not a goal run, enough approvals.
  if (
    tier === "reversible" &&
    input.autoReviewEnabled &&
    !input.untrustedContentSeen &&
    !input.goalRun &&
    !(
      input.toolUndoneAt &&
      input.now.getTime() - input.toolUndoneAt.getTime() < UNDO_PAUSE_DAYS * 86_400_000
    ) &&
    summary.approvals.length >= PRECEDENT_APPROVALS &&
    shapeMatches(argsShapeOf(call.args), summary.approvals)
  ) {
    return out("approve", "precedent", `You approved this ${summary.approvals.length} times`);
  }
  // 5. A call with nothing at stake runs, as it does today.
  if (!input.consequential && rules.decision === "allow") {
    return out("approve", "low_risk", "Low risk");
  }
  // 6. The judge, only for undoable calls and never once outside content is in the run.
  if (
    tier === "reversible" &&
    input.autoReviewEnabled &&
    !input.goalRun &&
    !input.untrustedContentSeen &&
    input.judge === "pass"
  ) {
    return out("approve", "judge", "Passed Auto Review");
  }
  // 7. The type's default; a consequential call with no judge pass asks.
  return input.consequential || rules.decision === "ask"
    ? out("ask", "default", "Needs your approval")
    : out("approve", "default", "Allowed by default");
}
