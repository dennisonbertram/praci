import type {
  Connection,
  ConnectionCatalogItem,
  ConnectionCategory,
  McpServer,
} from "@rakazo/contracts";
import {
  BOX_MCP_ENDPOINT,
  BOX_OAUTH_SCOPE,
  DEVIN_MCP_ENDPOINT,
  GRANOLA_MCP_ENDPOINT,
  WISPR_FLOW_MCP_ENDPOINT,
} from "@rakazo/contracts";
import type { StatusKind } from "@rakazo/core";
import { appStatus, matchFeaturedConnectorId } from "@rakazo/core";

export type { StatusKind };

export type CategoryFilter = "all" | Exclude<ConnectionCategory, "other">;

export const CATEGORY_IDS: readonly CategoryFilter[] = [
  "all",
  "email_calendar",
  "chat",
  "docs_files",
  "finance",
  "developer",
  "sales_crm",
];

/** Chips filter the catalog; "all" keeps every app, including uncategorised ones. */
export function filterCatalog(
  items: readonly ConnectionCatalogItem[],
  { query, category }: { query: string; category: CategoryFilter },
): ConnectionCatalogItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter(
    (item) =>
      (category === "all" || item.category === category) &&
      (!needle ||
        item.name.toLowerCase().includes(needle) ||
        item.slug.toLowerCase().includes(needle) ||
        (item.description ?? "").toLowerCase().includes(needle)),
  );
}

export { appStatus };

/**
 * Status of an MCP server. It needs a reconnect when its stored sign-in lapsed, or when a sign-in
 * was started and never finished. A server with no sign-in at all (stdio, public or header-keyed)
 * is simply connected.
 */
export function mcpStatus(server: McpServer): StatusKind {
  if (server.oauthStatus === "reconnect") return "reconnect";
  if (server.oauthStatus === "none" && server.oauthAttempted) return "reconnect";
  return "connected";
}

/** Read tools never change the account. Anything not clearly read-only counts as write. */
const READ_PREFIX =
  /^(get|list|search|read|find|fetch|query|lookup|check|view|show|describe|count)/i;

export function classifyTool(name: string): "read" | "write" {
  // Composio names look like GMAIL_FETCH_EMAILS; compare the verb after the app prefix too.
  const parts = name.split(/[_\-.\s]+/).filter(Boolean);
  const verbs = parts.length > 1 ? [parts[0], parts[1]] : parts;
  return verbs.some((verb) => READ_PREFIX.test(verb ?? "")) ? "read" : "write";
}

export function groupTools<T extends { name: string }>(tools: readonly T[]) {
  return {
    read: tools.filter((tool) => classifyTool(tool.name) === "read"),
    write: tools.filter((tool) => classifyTool(tool.name) === "write"),
  };
}

/** "GMAIL_FETCH_EMAILS" for app "gmail" becomes "Fetch emails". */
export function toolLabel(name: string, slug: string): string {
  const prefix = `${slug}_`.toLowerCase();
  const rest =
    name.toLowerCase().startsWith(prefix) && name.length > prefix.length
      ? name.slice(prefix.length)
      : name;
  const text = rest
    .replace(/[_\s]+/g, " ")
    .trim()
    .toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Mercury and Brex are first-party integrations: they connect through the Finance API. */
export const FINANCE_PROVIDERS = [
  {
    provider: "mercury",
    name: "Mercury",
    // No Simple Icons mark exists for Mercury: its own icon, vendored from mercury.com.
    logo: "/logos/mercury.svg",
  },
  { provider: "brex", name: "Brex", logo: "https://cdn.simpleicons.org/brex" },
] as const;

/** First-party hosted MCP servers: the tile opens the custom connection dialog prefilled with `endpoint`. */
export const FIRST_PARTY_MCP = [
  {
    id: "zernio",
    name: "Zernio",
    logo: "/logos/zernio.svg",
    endpoint: "https://mcp.zernio.com/mcp",
    section: "social",
    category: null,
  },
  {
    id: "x",
    name: "X",
    logo: "https://cdn.simpleicons.org/x",
    endpoint: "https://api.x.com/mcp",
    section: "social",
    category: null,
    // X does not register clients on the fly: the user brings the Client ID of their own X app.
    oauthClient: true,
    // Read scopes only: X's metadata also lists billing and developer write scopes.
    scope:
      "tweet.read users.read follows.read like.read list.read bookmark.read dm.read offline.access",
  },
  {
    id: "carta",
    name: "Carta",
    logo: null,
    endpoint: "https://mcp.app.carta.com/mcp",
    section: "equity",
    category: "finance",
  },
  {
    id: "treg",
    name: "Treg",
    logo: null,
    endpoint: "https://treg.to/mcp/",
    section: "tools",
    category: "developer",
  },
  {
    id: "devin",
    name: "Devin",
    // No official Devin logo is vendored yet: the tile shows the AppLogo letter fallback.
    logo: null,
    endpoint: DEVIN_MCP_ENDPOINT,
    section: "tools",
    category: "developer",
    // Devin takes a service-user key, sent as a bearer token, not a sign-in.
    apiKey: true,
  },
  {
    id: "box",
    name: "Box",
    logo: "https://cdn.simpleicons.org/box",
    endpoint: BOX_MCP_ENDPOINT,
    section: "tools",
    category: "docs_files",
    // Box does not register clients on the fly: the user brings the Client ID and secret of a Box app.
    oauthClient: true,
    scope: BOX_OAUTH_SCOPE,
  },
  {
    // Both register their own client on the fly (browser sign-in only): no key, no client ID.
    id: "granola",
    name: "Granola",
    // No Simple Icons mark exists for Granola: the tile shows the AppLogo letter fallback.
    logo: null,
    endpoint: GRANOLA_MCP_ENDPOINT,
    section: "tools",
    category: "docs_files",
  },
  {
    // Id has no hyphen so a catalog toolkit "wispr_flow" or "wispr-flow" matches it.
    id: "wisprflow",
    name: "Wispr Flow",
    logo: null,
    endpoint: WISPR_FLOW_MCP_ENDPOINT,
    section: "tools",
    category: "docs_files",
  },
] as const satisfies readonly {
  id: string;
  name: string;
  logo: string | null;
  endpoint: string;
  section: string;
  category: string | null;
  oauthClient?: boolean;
  scope?: string;
  apiKey?: boolean;
}[];

const FIRST_PARTY_SLUGS: ReadonlySet<string> = new Set([
  ...FIRST_PARTY_MCP.map((entry) => entry.id),
  "twitter",
]);

/** True when `candidate` is the same https endpoint as `endpoint`: same host and path, ignoring a trailing slash. */
export function isSameMcpEndpoint(candidate: string | null | undefined, endpoint: string): boolean {
  try {
    const a = new URL(candidate ?? "");
    const b = new URL(endpoint);
    const path = (url: URL) => url.pathname.replace(/\/+$/, "");
    return a.protocol === "https:" && a.host === b.host && path(a) === path(b);
  } catch {
    return false;
  }
}

/** Exchanges connect with a read-only API key; `keyUrl` is the vendor page where the user creates it. */
export const EXCHANGES = [
  {
    provider: "coinbase",
    name: "Coinbase",
    // Local square marks: Simple Icons' Coinbase wordmark cannot be read at tile size.
    logo: "/logos/coinbase.svg",
    keyUrl: "https://portal.cdp.coinbase.com/access/api",
  },
  {
    provider: "kraken",
    name: "Kraken",
    logo: "/logos/kraken.svg",
    keyUrl: "https://www.kraken.com/u/security/api",
  },
] as const;

export function appKey(item: Pick<ConnectionCatalogItem, "connectorId" | "slug">) {
  return `${item.connectorId}:${item.slug}`;
}

/**
 * An app's detail page. `connect` opens its connect dialog on arrival; `next` (a path under /app) is
 * where the person lands once connected.
 */
export function appPath(
  item: Pick<ConnectionCatalogItem, "connectorId" | "slug">,
  { connect, next }: { connect?: boolean; next?: string } = {},
): string {
  const query = new URLSearchParams();
  if (connect) query.set("connect", "1");
  if (next) query.set("next", next);
  const suffix = query.toString() ? `?${query}` : "";
  return `/app/integrations/app/${encodeURIComponent(item.connectorId)}/${encodeURIComponent(item.slug)}${suffix}`;
}

export function providerLabel(connectorId: string): string {
  return connectorId === "google"
    ? "Google"
    : connectorId === "pipedream"
      ? "Pipedream"
      : connectorId === "composio"
        ? "Composio"
        : connectorId;
}

export type ConnectedApp = {
  key: string;
  connectorId: string;
  provider: string;
  name: string;
  logo: string | null;
  rows: Connection[];
  status: StatusKind;
  /** Server text for the newest failed attempt, shown with Try again. */
  error: string | null;
};

/** One entry per app, built from its account rows (revoked rows are never listed). */
export function groupConnections(
  connections: readonly Connection[],
  catalog: readonly ConnectionCatalogItem[],
): ConnectedApp[] {
  const byApp = new Map<string, Connection[]>();
  for (const row of connections) {
    if (row.status === "revoked") continue;
    const key = `${row.connectorId}:${row.provider}`;
    byApp.set(key, [...(byApp.get(key) ?? []), row]);
  }
  return [...byApp.entries()].flatMap(([key, rows]) => {
    const status = appStatus(rows);
    const first = rows[0];
    if (!status || !first) return [];
    const item = catalog.find((entry) => appKey(entry) === key);
    return [
      {
        key,
        connectorId: first.connectorId,
        provider: first.provider,
        name: item?.name ?? first.displayName,
        logo: item?.logo ?? null,
        rows,
        status,
        error: rows.find((row) => row.status === "error")?.error ?? null,
      },
    ];
  });
}

/** Catalog apps with no account row yet, featured apps first. */
export function popularApps(
  catalog: readonly ConnectionCatalogItem[],
  connections: readonly Connection[],
): ConnectionCatalogItem[] {
  const used = new Set(
    connections
      .filter((row) => row.status !== "revoked")
      .map((row) => `${row.connectorId}:${row.provider}`),
  );
  // `item.connected` is the provider's per-user flag, which also counts other spaces; this space's
  // rows decide. First-party services (X, Treg, ...) have their own tile, so they are left out here.
  const open = catalog.filter(
    (item) =>
      !used.has(appKey(item)) &&
      // A toolkit named "<service>_mcp" is the same service as its first-party tile.
      !FIRST_PARTY_SLUGS.has(
        item.slug
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "")
          .replace(/mcp$/, ""),
      ),
  );
  const featured = (item: ConnectionCatalogItem) =>
    matchFeaturedConnectorId(item.slug) !== null || matchFeaturedConnectorId(item.name) !== null;
  return [...open.filter(featured), ...open.filter((item) => !featured(item))];
}

/** The next access after switching one agent on or off, collapsing "everyone" back to allAgents. */
export function toggleAccess(
  current: { allAgents: boolean; botIds: string[] },
  allBotIds: string[],
  botId: string,
  on: boolean,
): { allAgents: boolean; botIds: string[] } {
  const ids = new Set(current.allAgents ? allBotIds : current.botIds);
  if (on) ids.add(botId);
  else ids.delete(botId);
  const all = allBotIds.every((id) => ids.has(id));
  return { allAgents: all, botIds: all ? [] : [...ids] };
}
