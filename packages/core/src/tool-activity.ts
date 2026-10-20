import type { MessageBlock } from "@rakazo/contracts";
import { humanizeToolName } from "./events.js";

export function isToolActivityBlock(block: MessageBlock): boolean {
  return block.kind === "steps" || (block.kind === "progress" && block.activity === true);
}

/** Tools that report their steps while they run, and the service each one talks to. */
const REPORTING_SERVICES = new Map(
  Object.entries({
    mail_search: "Gmail",
    mail_get: "Gmail",
    calendar_list_events: "Google Calendar",
    drive_search: "Google Drive",
    drive_read: "Google Drive",
  }).map(([name, service]) => [humanizeToolName(`mcp__s__${name}`), service]),
);

/**
 * The step a running Google tool last reported (such as "Searching mail: from Kevin") and the
 * service it waits on, read from a live message. Null when no such tool is running.
 */
export function reportedToolStep(
  blocks: readonly MessageBlock[],
): { detail: string; service: string } | null {
  const tail = blocks.at(-1);
  if (tail?.kind !== "progress" || !tail.activity) return null;
  const pending = tail.pendingToolNames?.at(-1);
  const service = pending ? REPORTING_SERVICES.get(humanizeToolName(pending)) : undefined;
  const detail = tail.text.trim();
  return service && detail ? { detail, service } : null;
}
