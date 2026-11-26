import type { UiBlock } from "@rakazo/contracts";

const cell = (value: string | number) =>
  String(value)
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ");

const TONE_LABEL = {
  info: "Note",
  warning: "Warning",
  success: "Done",
  danger: "Problem",
} as const;

/** Markdown for surfaces that cannot draw a block: messaging, quotes, history, native fallback. */
export function uiBlockText(block: UiBlock): string {
  switch (block.type) {
    case "table": {
      const header = `| ${block.columns.map((column) => cell(column.label)).join(" | ")} |`;
      const rule = `| ${block.columns.map((column) => (column.align === "right" ? "---:" : "---")).join(" | ")} |`;
      const rows = block.rows.map((row) => `| ${row.map(cell).join(" | ")} |`);
      return [block.title ? `**${block.title}**\n` : "", header, rule, ...rows]
        .filter(Boolean)
        .join("\n");
    }
    case "sections":
      return block.sections.map((s) => `**${s.heading}**\n${s.body}`).join("\n\n");
    case "summary":
      return [
        block.title ? `**${block.title}**` : "",
        ...block.items.map((item) => `- ${item.label}: ${item.value}`),
      ]
        .filter(Boolean)
        .join("\n");
    case "stats":
      return block.stats
        .map((s) => `- ${s.label}: ${s.value}${s.hint ? ` (${s.hint})` : ""}`)
        .join("\n");
    case "cards":
      return block.cards
        .map((card) => {
          const head = [`**${card.title}**`, card.badge && `[${card.badge}]`, card.subtitle]
            .filter(Boolean)
            .join(" ");
          return [
            `- ${head}`,
            card.body && `  ${card.body.replace(/\n/g, "\n  ")}`,
            card.href && `  ${card.href}`,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n");
    case "callout":
      return `> **${block.title ?? TONE_LABEL[block.tone]}**\n> ${block.body.replace(/\n/g, "\n> ")}`;
  }
}

/** One line naming a block, for a reply quote or preview. */
export function uiBlockSummary(block: UiBlock): string {
  switch (block.type) {
    case "table":
      return block.title ?? block.columns.map((column) => column.label).join(" · ");
    case "sections":
      return block.sections[0]?.heading ?? "";
    case "summary":
      return block.title ?? block.items[0]?.label ?? "";
    case "stats":
      return block.stats.map((s) => `${s.label}: ${s.value}`).join(" · ");
    case "cards":
      return block.cards[0]?.title ?? "";
    case "callout":
      return block.title ?? block.body;
  }
}
