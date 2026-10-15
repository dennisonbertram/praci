import type {
  Connection,
  ConnectionCatalogItem,
  ConnectionCategory,
  McpServer,
} from "@rakazo/contracts";
import { matchFeaturedConnectorId } from "@rakazo/core";

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

export type StatusKind = "connected" | "reconnect" | "failed" | "connecting";

/** Status of one managed app, from all of its account rows. A working account wins. */
export function appStatus(rows: readonly Pick<Connection, "status">[]): StatusKind | null {
  if (rows.some((row) => row.status === "connected")) return "connected";
  if (rows.some((row) => row.status === "pending")) return "connecting";
  if (rows.some((row) => row.status === "error")) return "failed";
  return null;
}

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
  },
] as const;

/** True when an MCP server endpoint is the https server at the same host as `endpoint`. */
export function isMcpEndpointHost(candidate: string | null | undefined, endpoint: string): boolean {
  try {
    const url = new URL(candidate ?? "");
    return url.protocol === "https:" && url.host === new URL(endpoint).host;
  } catch {
    return false;
  }
}

/** Exchanges connect with a read-only API key; `keyUrl` is the vendor page where the user creates it. */
export const EXCHANGES = [
  {
    provider: "coinbase",
    name: "Coinbase",
    logo: "https://cdn.simpleicons.org/coinbase",
    keyUrl: "https://portal.cdp.coinbase.com/access/api",
  },
  {
    provider: "kraken",
    name: "Kraken",
    // No Simple Icons mark exists for Kraken, so the tile shows its first letter.
    logo: null,
    keyUrl: "https://www.kraken.com/u/security/api",
  },
] as const;

export function appKey(item: Pick<ConnectionCatalogItem, "connectorId" | "slug">) {
  return `${item.connectorId}:${item.slug}`;
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
  const open = catalog.filter((item) => !item.connected && !used.has(appKey(item)));
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
