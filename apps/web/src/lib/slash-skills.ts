import { t } from "@lingui/core/macro";
import type { AgentSkillCatalogEntry } from "@rakazo/contracts";

/** Most skills the / picker lists at once. */
export const SLASH_SKILL_LIMIT = 8;

/**
 * Bundled skills the agent uses on its own or that serve developers; founders never pick them.
 * Bots still load them, they are only left out of the / picker.
 */
const HIDDEN_BUILTIN_SKILLS = new Set(["Interrogate", "inbox-search"]);

/** A plain-language title and line for a bundled skill, whose stored name is a slug. */
export function slashSkillLabel(
  skill: Pick<AgentSkillCatalogEntry, "name" | "description" | "source">,
): {
  title: string;
  description: string;
} {
  if (skill.source === "builtin") {
    switch (skill.name) {
      case "finance-cost-cutting":
        return {
          title: t`Cut costs`,
          description: t`Find recurring and overlapping spend to cut.`,
        };
      case "finance-crypto":
        return { title: t`Crypto holdings`, description: t`Wallet balances and allocation.` };
      case "crypto-scams":
        return {
          title: t`Check for crypto scams`,
          description: t`Spot scam tokens and look-alike addresses in your wallets.`,
        };
      case "finance-runway-scenarios":
        return { title: t`Runway scenarios`, description: t`How long cash lasts, with what-ifs.` };
      case "finance-monthly-review":
        return {
          title: t`Monthly money review`,
          description: t`Spend, changes, and new or upcoming charges.`,
        };
      case "carta-investor-update":
        return {
          title: t`Draft investor update`,
          description: t`Written from Finance, Carta and past updates.`,
        };
      case "carta-audit-response":
        return {
          title: t`Answer auditor requests`,
          description: t`Uses Carta figures and asks before sending.`,
        };
      case "finance-categorize":
        return {
          title: t`Categorize transactions`,
          description: t`Suggests categories for uncategorized transactions.`,
        };
    }
  }
  return { title: skill.name, description: skill.description };
}

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
  const matches = skills.filter((skill) => {
    if (skill.source === "builtin" && HIDDEN_BUILTIN_SKILLS.has(skill.name)) return false;
    if (!needle) return true;
    const label = slashSkillLabel(skill);
    return [skill.name, label.title, label.description].some((text) =>
      text.toLowerCase().includes(needle),
    );
  });
  // Array.prototype.sort is stable, so each group keeps its original order.
  return matches
    .sort((a, b) => Number(b.source === "user") - Number(a.source === "user"))
    .slice(0, limit);
}
