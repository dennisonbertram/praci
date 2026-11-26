export type GroupMemberRef = {
  id: string;
  name: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** An `@Name` token, bounded so it never matches part of a longer word or an email address. */
export function mentionTokenPattern(name: string, flags: string): RegExp {
  const allFlags = flags.includes("u") ? flags : `${flags}u`;
  return new RegExp(`(^|[^\\p{L}\\p{N}_-])@${escapeRegExp(name)}(?![\\p{L}\\p{N}_-])`, allFlags);
}

export function hasMentionToken(text: string, name: string): boolean {
  const normalized = name.trim();
  if (!normalized) return false;
  return mentionTokenPattern(normalized, "i").test(text);
}

export type MentionRange<T extends { name: string }> = { start: number; end: number; mention: T };

/** Where each mention's `@Name` token sits in the text, in order, without overlaps. */
export function findMentionRanges<T extends { name: string }>(
  text: string,
  mentions: readonly T[],
): MentionRange<T>[] {
  const all: MentionRange<T>[] = [];
  for (const mention of mentions) {
    const name = mention.name.trim();
    if (!name) continue;
    const pattern = mentionTokenPattern(name, "gi");
    for (const match of text.matchAll(pattern)) {
      const start = match.index + (match[1] ?? "").length;
      all.push({ start, end: start + name.length + 1, mention });
    }
  }
  all.sort((a, b) => a.start - b.start || b.end - a.end);
  const ranges: MentionRange<T>[] = [];
  for (const range of all) {
    if (range.start >= (ranges.at(-1)?.end ?? 0)) ranges.push(range);
  }
  return ranges;
}

export function resolveGroupTargetBotIds(input: {
  text: string;
  members: GroupMemberRef[];
  /** Bot ids from typed mention chips (non-members are ignored for wake). */
  explicitMentions?: string[];
}): string[] {
  const membersById = new Map(input.members.map((member) => [member.id, member]));
  const targetIds = new Set<string>();

  for (const mentionId of input.explicitMentions ?? []) {
    // Out-of-chat bots stay as @Name in the prompt; only members are woken here.
    if (membersById.has(mentionId)) targetIds.add(mentionId);
  }

  // Only an explicit "@everyone" token broadcasts; the plain word never does,
  // and explicit chips take precedence over text tokens.
  if (targetIds.size === 0 && hasMentionToken(input.text, "everyone")) {
    for (const member of input.members) targetIds.add(member.id);
  } else {
    for (const { mention } of findMentionRanges(input.text, input.members))
      targetIds.add(mention.id);
  }

  if (targetIds.size === 0 && input.members[0]) {
    targetIds.add(input.members[0].id);
  }

  return [...targetIds];
}

export function inferHandoffTargetName(prompt: string): string | undefined {
  const handoffMatch =
    /hand(?:\s+this|\s+off|\s+it)?\s+to\s+@?([A-Za-z0-9][A-Za-z0-9_-]{0,39})/i.exec(prompt) ??
    /@([A-Za-z0-9][A-Za-z0-9_-]{0,39})\s+take/i.exec(prompt);
  return handoffMatch?.[1];
}
