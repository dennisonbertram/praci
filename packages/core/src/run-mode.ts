/**
 * The run mode is decided once, when a run is created, and stored on `Run.unattended`.
 * Every `run.create` must set it; `run-create-sites.test.ts` fails if one does not.
 *
 * | Run is created by                                                    | unattended |
 * | user, reaction, call_end, skill, goal; follow_up with no source run  | false      |
 * | any run caused by another run (follow_up, spawn, resume, bot_message)| copy source|
 * | routine, webhook, messaging, cloud_agent, created, tickets, mcp, unknown | true  |
 */
// A goal run (/goal) is the owner's own request continued by the server: it gets exactly what a run
// started by their message gets, so the bot's allow rules apply and anything else raises a card.
const OWNER_LIVE_TRIGGERS = new Set(["user", "reaction", "call_end", "skill", "goal"]);

export function newRunUnattended(input: {
  trigger: string;
  /** The run that caused this one, when there is one. Its mode is copied. */
  source?: { unattended: boolean } | null;
}): boolean {
  if (input.source) return input.source.unattended;
  if (OWNER_LIVE_TRIGGERS.has(input.trigger)) return false;
  // A follow_up with no source run is the owner typing into a run that is still active.
  return input.trigger !== "follow_up";
}

/** Triggers whose prompt carries outside content. */
const EXTERNAL_CONTENT_TRIGGERS = new Set(["webhook", "messaging", "mcp"]);

/**
 * `Run.externalTaint`: the run's prompt carries outside content, so every call outside the
 * taint-safe list asks. It lives on the run and approving a card never clears it. A run caused
 * by another run inherits the source's taint (OR its own trigger's).
 */
export function newRunExternalTaint(input: {
  trigger: string;
  source?: { externalTaint: boolean } | null;
}): boolean {
  return Boolean(input.source?.externalTaint) || EXTERNAL_CONTENT_TRIGGERS.has(input.trigger);
}

/**
 * Mode of a run caused by another run (group handoff, spawn, bot message). Copies the source
 * run's mode; when the source cannot be read it fails closed (unattended and tainted).
 */
export function chainedRunMode(
  trigger: string,
  source:
    | { unattended: boolean; externalTaint: boolean; readOutsideContent?: boolean }
    | null
    | undefined,
): { unattended: boolean; externalTaint: boolean; readOutsideContent: boolean } {
  const known = source ?? { unattended: true, externalTaint: true, readOutsideContent: true };
  return {
    // The receiving run starts as having read what the source read, so a relay cannot launder it.
    readOutsideContent: known.readOutsideContent === true,
    unattended: newRunUnattended({ trigger, source: known }),
    externalTaint: newRunExternalTaint({ trigger, source: known }),
  };
}
