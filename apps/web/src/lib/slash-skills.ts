import type { AgentSkillCatalogEntry } from "@rakazo/contracts";

/** Most skills the / picker lists at once. */
export const SLASH_SKILL_LIMIT = 8;

/**
 * Skills the / picker offers for a query: the person's own first, then bundled and plugin ones,
 * so the cap never hides a skill they made. Typing filters across all of them.
 */
export function slashSkillOptions(
  skills: readonly AgentSkillCatalogEntry[],
  query: string,
  limit = SLASH_SKILL_LIMIT,
): AgentSkillCatalogEntry[] {
  const needle = query.trim().toLowerCase();
  const matches = skills.filter(
    (skill) =>
      !needle ||
      skill.name.toLowerCase().includes(needle) ||
      skill.description.toLowerCase().includes(needle),
  );
  // Array.prototype.sort is stable, so each group keeps its original order.
  return matches
    .sort((a, b) => Number(b.source === "user") - Number(a.source === "user"))
    .slice(0, limit);
}
