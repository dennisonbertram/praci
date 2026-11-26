import { hasMentionToken } from "./group-mentions.js";

export const SLASH_ACTIONS = [
  { id: "chat-settings" as const, label: "Settings" },
  { id: "settings-general" as const, label: "Settings: General" },
] as const;

/** Entries that put a command in the draft instead of opening a screen. */
export const SLASH_INSERTS = [{ id: "goal" as const, label: "Goal", text: "/goal " }] as const;

export type SlashActionId = (typeof SLASH_ACTIONS)[number]["id"];

/** Serialize composer chips + draft into the prompt text sent to the agent. */
export function serializeComposerPrompt(
  draft: string,
  skill: { name: string } | null,
  mentions: Array<{ name: string }>,
): string {
  const body = draft.replace(/^\s+/, "");
  // A mention already written into the text (inline picker) is not repeated up front.
  const mentionPrefix = mentions
    .filter((member) => !hasMentionToken(body, member.name))
    .map((member) => `@${member.name}`)
    .join(" ");
  const afterSkill = [mentionPrefix, body].filter((part) => part.trim().length > 0).join(" ");
  if (!skill) return afterSkill.trimEnd();
  return afterSkill.trim().length > 0 ? `/${skill.name}\n${afterSkill}` : `/${skill.name}`;
}

export function truncateSlashDescription(value: string, max = 72): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
