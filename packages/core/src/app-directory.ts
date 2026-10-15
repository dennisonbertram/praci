import type { ConnectionCatalogItem, ConnectionCategory } from "@rakazo/contracts";

type AppEntry = { description: string; category: ConnectionCategory };

const mail: ConnectionCategory = "email_calendar";
const chat: ConnectionCategory = "chat";
const docs: ConnectionCategory = "docs_files";
const dev: ConnectionCategory = "developer";
const crm: ConnectionCategory = "sales_crm";
const fin: ConnectionCategory = "finance";

/** The one static directory of what an agent can do with an app, keyed by normalized slug. */
const DIRECTORY: Record<string, AppEntry> = {
  gmail: { category: mail, description: "Read, search and draft email" },
  googlecalendar: { category: mail, description: "Read your schedule and create events" },
  outlook: { category: mail, description: "Read, search and draft email and events" },
  googledrive: { category: docs, description: "Search, read and create files and documents" },
  dropbox: { category: docs, description: "Search, read and upload files" },
  notion: { category: docs, description: "Search, read and edit pages and databases" },
  airtable: { category: docs, description: "Read and update records in your bases" },
  slack: { category: chat, description: "Read channels and send messages" },
  discord: { category: chat, description: "Read channels and send messages" },
  teams: { category: chat, description: "Read channels and send messages" },
  zoom: { category: chat, description: "Schedule meetings and read recordings" },
  intercom: { category: chat, description: "Read conversations and reply to customers" },
  zendesk: { category: chat, description: "Read and update support tickets" },
  x: { category: chat, description: "Read your timeline and publish posts" },
  github: { category: dev, description: "Read repos, issues and pull requests, and comment" },
  linear: { category: dev, description: "Search, create and update issues" },
  jira: { category: dev, description: "Search, create and update issues" },
  asana: { category: dev, description: "Search, create and update tasks" },
  trello: { category: dev, description: "Read boards and create or move cards" },
  figma: { category: dev, description: "Read files and comments" },
  hubspot: { category: crm, description: "Look up and update contacts, companies and deals" },
  salesforce: { category: crm, description: "Look up and update leads, accounts and deals" },
  shopify: { category: crm, description: "Read orders, products and customers" },
  stripe: { category: fin, description: "Read payments, customers and invoices" },
  quickbooks: { category: fin, description: "Read invoices, bills and accounts" },
};

const ALIASES: Record<string, string> = {
  googlemail: "gmail",
  gcal: "googlecalendar",
  gdrive: "googledrive",
  microsoftoutlook: "outlook",
  microsoftteams: "teams",
  twitter: "x",
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function describeApp(slug: string): AppEntry | undefined {
  const key = normalize(slug);
  return DIRECTORY[ALIASES[key] ?? key];
}

type RawCatalogItem = Omit<ConnectionCatalogItem, "description" | "category">;

export function withAppDirectory(items: RawCatalogItem[]): ConnectionCatalogItem[] {
  return items.map((item) => {
    const entry = describeApp(item.slug);
    return {
      ...item,
      description: entry?.description ?? null,
      category: entry?.category ?? "other",
    };
  });
}

// Lower rank wins. Native Google is handled separately.
const CONNECTOR_RANK: Record<string, number> = { composio: 0, pipedream: 1 };
const rank = (connectorId: string) => CONNECTOR_RANK[connectorId] ?? 2;

/**
 * One item per app: a connected entry first, then composio before pipedream. Native Google entries
 * are kept next to the best managed entry because only the client knows whether native sign-in works
 * there; `preferNativeGoogle` then leaves one.
 */
export function dedupeCatalogBySlug<
  T extends Pick<ConnectionCatalogItem, "connectorId" | "slug" | "connected">,
>(items: T[]): T[] {
  const best = new Map<string, T>();
  for (const item of items) {
    if (item.connectorId === "google") continue;
    const key = normalize(item.slug);
    const current = best.get(key);
    const better =
      !current ||
      (item.connected && !current.connected) ||
      (item.connected === current.connected && rank(item.connectorId) < rank(current.connectorId));
    if (better) best.set(key, item);
  }
  const emitted = new Set<string>();
  return items.filter((item) => {
    if (item.connectorId === "google") return true;
    const key = normalize(item.slug);
    if (best.get(key) !== item || emitted.has(key)) return false;
    emitted.add(key);
    return true;
  });
}
