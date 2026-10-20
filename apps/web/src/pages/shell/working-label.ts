import { t } from "@lingui/core/macro";
import type { ToolAction } from "../../lib/working-activity";

/** Plain words for the tool a run is calling; `agentName` is the agent being asked, when known. */
export function toolActionLabel(
  action: ToolAction | undefined,
  agentName?: string,
): string | undefined {
  switch (action) {
    case "contact-add":
      return t`Adding a contact`;
    case "contact-save":
      return t`Saving a contact`;
    case "contacts-read":
      return t`Reading your contacts`;
    case "cap-table-read":
      return t`Reading the cap table`;
    case "cap-table-update":
      return t`Updating the cap table`;
    case "carta-cap-table":
      return t`Reading your cap table from Carta`;
    case "carta-company":
      return t`Choosing your company in Carta`;
    case "connected-app":
      return t`Reading a connected app`;
    case "mail-search":
      return t`Searching your mail`;
    case "mail-open":
      return t`Opening an email`;
    case "mail-draft":
      return t`Writing a draft email`;
    case "mail-show":
      return t`Showing the emails it found`;
    case "finance":
      return t`Reading your finances`;
    case "ask-agent":
      return agentName ? t`Asking ${agentName}` : t`Asking another agent`;
    case "message-user":
      return t`Messaging you`;
    case "thinking":
      return t`Thinking`;
    default:
      return undefined;
  }
}
