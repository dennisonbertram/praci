import { BOT_COLORS } from "./ids.js";

/** Index into BOT_COLORS for each page agent, chosen once so the pages stay distinct. */
const PAGE_AGENT_COLOR: Record<string, number> = {
  inbox: 2,
  finance: 0,
  "data-room": 1,
  carta: 3,
  legal: 6,
};

/** The palette entry nearest each app's brand, keyed by lowercase app or provider name. */
const APP_COLOR: Record<string, number> = {
  box: 4,
  brex: 5,
  mercury: 0,
  devin: 3,
  notion: 6,
  "google calendar": 4,
  calendar: 4,
  "google drive": 1,
  drive: 1,
  gmail: 5,
};

const hashIndex = (text: string) => {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % BOT_COLORS.length;
};

export const pageAgentColor = (kind: keyof typeof PAGE_AGENT_COLOR | string): string =>
  BOT_COLORS[PAGE_AGENT_COLOR[kind] ?? 0] ?? BOT_COLORS[0];

/** An app agent's colour: the first name found in the brand map, else a stable hash of its spawn key. */
export const appAgentColor = (
  names: Array<string | null | undefined>,
  spawnKey: string,
): string => {
  for (const name of names) {
    const index = APP_COLOR[name?.trim().toLowerCase() ?? ""];
    if (index !== undefined) return BOT_COLORS[index] ?? BOT_COLORS[0];
  }
  return BOT_COLORS[hashIndex(spawnKey)] ?? BOT_COLORS[0];
};
