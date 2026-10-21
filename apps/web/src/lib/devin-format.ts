import { t } from "@lingui/core/macro";
import type { DevinSessionKind } from "@rakazo/contracts";

export type DevinSection = "needs_you" | "working" | "earlier";

/** `owner/repo#n` for a GitHub pull request, the host for any other link. Text only, never a link. */
export function prLabel(pr: { url: string; state: string }): { ref: string; state: string } {
  const github = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(pr.url);
  if (github) return { ref: `${github[1]}/${github[2]}#${github[3]}`, state: pr.state };
  try {
    return { ref: new URL(pr.url).host, state: pr.state };
  } catch {
    return { ref: pr.url, state: pr.state };
  }
}

export function sourceLabel(origin: string): string {
  switch (origin) {
    case "webapp":
      return t`Web`;
    case "slack":
      return t`Slack`;
    case "teams":
      return t`Teams`;
    case "api":
      return t`API`;
    case "linear":
      return t`Linear`;
    case "jira":
      return t`Jira`;
    case "automation":
      return t`Automation`;
    case "cli":
      return t`CLI`;
    case "desktop":
      return t`Desktop`;
    case "code_scan":
      return t`Code scan`;
    default:
      return t`Other`;
  }
}

/** One word per kind; a status the mapping has not seen shows Devin's own text. */
export function statusLabel(kind: DevinSessionKind, status: string): string {
  switch (kind) {
    case "needs_you":
      return t`Needs input`;
    case "error":
      return t`Error`;
    case "working":
      return t`Working`;
    case "finished":
      return t`Finished`;
    case "suspended":
      return t`Suspended`;
    default:
      return status || t`Unknown`;
  }
}

/** A failed session also needs a person, so it sits under Needs you. */
export function kindSection(kind: DevinSessionKind): DevinSection {
  if (kind === "needs_you" || kind === "error") return "needs_you";
  return kind === "working" ? "working" : "earlier";
}

/** How long a session has waited: "Waiting 45m", "Waiting 3h", "Waiting 3d". */
export function waitingLabel(updatedAt: string, now = new Date()): string {
  const minutes = Math.max(1, Math.floor((now.getTime() - new Date(updatedAt).getTime()) / 60_000));
  if (minutes < 60) return t`Waiting ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t`Waiting ${hours}h`;
  const days = Math.floor(hours / 24);
  return t`Waiting ${days}d`;
}
