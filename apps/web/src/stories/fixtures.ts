import type { BotPins } from "@rakazo/contracts";

/** Invented data shared by stories. Never put real names, emails or amounts here. */
export const mockPins: BotPins = {
  botId: "bot_demo",
  stats: [
    { id: "runway", label: "Runway", value: "14 months", detail: "at current spend" },
    { id: "open", label: "Open invoices", value: "3" },
  ],
  list: {
    title: "This week",
    items: [
      { id: "a", text: "Send the demo invoice", done: false },
      { id: "b", text: "Review the sample budget", done: true },
    ],
  },
  revision: 1,
  updatedBy: "bot",
  updatedAt: "2026-01-01T00:00:00.000Z",
  refreshedAt: "2026-01-01T00:00:00.000Z",
};
