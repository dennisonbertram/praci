import { t } from "@lingui/core/macro";
import { humanizeToolName } from "@rakazo/core";

const MESSAGE_AGENT = humanizeToolName("message_bot");
const INTERNAL = new Set(["skill_read"].map((name) => humanizeToolName(name)));

/** Plain words for tool calls that are the agent's own plumbing, not work the founder asked for. */
export function internalToolLabel(label: string): string | undefined {
  if (label === MESSAGE_AGENT) return t`Asking another agent`;
  return INTERNAL.has(label) ? t`Thinking` : undefined;
}
