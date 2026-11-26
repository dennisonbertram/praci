/** What the registry records about one page agent: facts that are already a yes or no per kind. */
export interface PageAgentDef {
  /** The spawn key is `prefix + userId`. */
  readonly prefix: string;
  /** A second prefix the same kind's key can carry (a retired agent keeps its restrictions). */
  readonly retiredPrefix?: string;
  /** Index into BOT_COLORS, chosen once so the pages stay distinct. */
  readonly color: number;
  /** Has a page of its own in the app; false for agents with no page chat or intro. */
  readonly page: boolean;
  /** Offered Composio, Pipedream and other connector tools. */
  readonly connectorTools: boolean;
  /** Offered the built-in mail, calendar and Drive tools of native Google. */
  readonly nativeGoogle: boolean;
  /** Owns one account, so other bots ask it. */
  readonly ownerAgent: boolean;
  /** Offered the Data room tools. */
  readonly readsDataRoom: boolean;
  /** Not reachable over Photon, whose terms forbid automated financial or legal advice. */
  readonly photonBlocked: boolean;
}

const def = (
  prefix: string,
  color: number,
  flags: Partial<Omit<PageAgentDef, "prefix" | "color">> = {},
): PageAgentDef => ({
  prefix,
  color,
  page: true,
  connectorTools: false,
  nativeGoogle: true,
  ownerAgent: false,
  readsDataRoom: true,
  photonBlocked: false,
  ...flags,
});

/** Every page agent, once. Data only: prompts and tool lists stay with their owners. */
export const PAGE_AGENTS = {
  inbox: def("inbox-agent:", 2, { ownerAgent: true }),
  finance: def("finance-agent:", 0, { photonBlocked: true }),
  legal: def("legal-agent:", 6, { photonBlocked: true }),
  investors: def("investors-agent:", 3, { photonBlocked: true }),
  carta: def("carta-agent:", 3, { ownerAgent: true, readsDataRoom: false }),
  "data-room": def("data-room-agent:", 1),
  scanner: def("scanner-agent:", 1, { nativeGoogle: false }),
  // The palette is full; GTM deliberately shares this app colour.
  gtm: def("gtm-agent:", 5, { connectorTools: true }),
  company: def("company-agent:", 4, { nativeGoogle: false }),
  "company-importer": def("company-importer:", 4, { page: false, nativeGoogle: false }),
  voice: def("voice-agent:", 0, {
    page: false,
    nativeGoogle: false,
    retiredPrefix: "voice-agent-retired:",
  }),
} as const satisfies Record<string, PageAgentDef>;

export type PageAgentKind = keyof typeof PAGE_AGENTS;

const ENTRIES = Object.entries(PAGE_AGENTS) as [PageAgentKind, PageAgentDef][];

/** The one place a page agent's spawn key is built. */
export const pageAgentSpawnKey = (kind: PageAgentKind, userId: string) =>
  `${PAGE_AGENTS[kind].prefix}${userId}`;

/** Which page agent a spawn key belongs to (null for any other bot). */
export function pageAgentKindOf(spawnKey: string | null | undefined): PageAgentKind | null {
  if (!spawnKey) return null;
  for (const [kind, { prefix, retiredPrefix }] of ENTRIES) {
    if (spawnKey.startsWith(prefix) || (retiredPrefix && spawnKey.startsWith(retiredPrefix))) {
      return kind;
    }
  }
  return null;
}

/** The registry row for a spawn key, or undefined for any other bot. */
export function pageAgentDefOf(spawnKey: string | null | undefined): PageAgentDef | undefined {
  const kind = pageAgentKindOf(spawnKey);
  return kind ? PAGE_AGENTS[kind] : undefined;
}

/** The signed-in user's own agent of this kind; another member's agent in the same space does not match. */
export function findPageAgent<T extends { spawnKey: string | null }>(
  bots: readonly T[],
  kind: PageAgentKind,
  userId: string | null | undefined,
): T | undefined {
  if (!userId) return undefined;
  const key = pageAgentSpawnKey(kind, userId);
  return bots.find((bot) => bot.spawnKey === key);
}
