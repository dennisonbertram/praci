import { existsSync } from "node:fs";
import type { Connection, ConnectionCatalogItem, McpServer } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  appPath,
  appStatus,
  classifyTool,
  FINANCE_PROVIDERS,
  filterCatalog,
  groupConnections,
  groupTools,
  isSameMcpEndpoint,
  mcpStatus,
  popularApps,
  toggleAccess,
  toolLabel,
} from "./integrations";

const item = (
  slug: string,
  category: ConnectionCatalogItem["category"],
  extra: Partial<ConnectionCatalogItem> = {},
): ConnectionCatalogItem => ({
  connectorId: "composio",
  slug,
  name: slug[0]?.toUpperCase() + slug.slice(1),
  logo: null,
  connected: false,
  noAuth: false,
  description: null,
  category,
  ...extra,
});

const row = (status: Connection["status"], extra: Partial<Connection> = {}): Connection => ({
  id: `c-${status}`,
  connectorId: "composio",
  provider: "slack",
  displayName: "Slack",
  status,
  error: null,
  capabilities: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});

describe("filterCatalog", () => {
  const catalog = [
    item("slack", "chat"),
    item("gmail", "email_calendar"),
    item("stripe", "finance", { description: "Look up payments" }),
    item("odd", "other"),
  ];
  it("filters by category chip", () => {
    expect(filterCatalog(catalog, { query: "", category: "chat" }).map((i) => i.slug)).toEqual([
      "slack",
    ]);
  });
  it("keeps every app, including uncategorised ones, under All", () => {
    expect(filterCatalog(catalog, { query: "", category: "all" })).toHaveLength(4);
  });
  it("combines the chip with the search text, including descriptions", () => {
    expect(
      filterCatalog(catalog, { query: "payments", category: "finance" }).map((i) => i.slug),
    ).toEqual(["stripe"]);
    expect(filterCatalog(catalog, { query: "payments", category: "chat" })).toEqual([]);
  });
});

describe("status badges", () => {
  it("maps connection rows: a working account wins, then pending, then error", () => {
    expect(appStatus([row("error"), row("connected")])).toBe("connected");
    expect(appStatus([row("error"), row("pending")])).toBe("connecting");
    expect(appStatus([row("error")])).toBe("failed");
    expect(appStatus([row("revoked")])).toBeNull();
  });

  const server = (extra: Partial<McpServer>): McpServer => ({
    id: "s",
    spaceId: "w",
    slug: "s",
    name: "S",
    description: "",
    transport: "streamable_http",
    endpoint: "https://mcp.example.test/mcp",
    command: null,
    args: [],
    envKeys: [],
    headerKeys: [],
    hasSecret: false,
    oauthStatus: "connected",
    oauthAttempted: false,
    enabled: true,
    revision: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...extra,
  });
  it("maps MCP servers, treating an unfinished sign-in as needing a reconnect", () => {
    expect(mcpStatus(server({}))).toBe("connected");
    expect(mcpStatus(server({ oauthStatus: "reconnect" }))).toBe("reconnect");
    expect(mcpStatus(server({ oauthStatus: "none" }))).toBe("connected");
    expect(mcpStatus(server({ oauthStatus: "none", oauthAttempted: true }))).toBe("reconnect");
    expect(mcpStatus(server({ oauthStatus: "connected", oauthAttempted: true }))).toBe("connected");
    expect(mcpStatus(server({ oauthStatus: "none", hasSecret: true }))).toBe("connected");
    expect(mcpStatus(server({ oauthStatus: "none", transport: "stdio", endpoint: null }))).toBe(
      "connected",
    );
  });
});

describe("classifyTool", () => {
  it("separates read tools from write tools", () => {
    for (const name of ["search_threads", "get_message", "list_labels", "GMAIL_FETCH_EMAILS"]) {
      expect(classifyTool(name)).toBe("read");
    }
    for (const name of ["create_draft", "send_message", "trash_thread", "SLACK_SEND_MESSAGE"]) {
      expect(classifyTool(name)).toBe("write");
    }
  });
  it("groups a tool list", () => {
    const grouped = groupTools([{ name: "list_a" }, { name: "delete_a" }]);
    expect(grouped.read.map((t) => t.name)).toEqual(["list_a"]);
    expect(grouped.write.map((t) => t.name)).toEqual(["delete_a"]);
  });
});

describe("groupConnections and popularApps", () => {
  it("builds one entry per app and hides connected apps from Popular", () => {
    const catalog = [item("slack", "chat"), item("notion", "docs_files")];
    const rows = [row("connected"), row("pending", { id: "c2" }), row("revoked", { id: "c3" })];
    const grouped = groupConnections(rows, catalog);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ name: "Slack", status: "connected" });
    expect(popularApps(catalog, rows).map((i) => i.slug)).toEqual(["notion"]);
  });
  it("surfaces the server error of a failed app", () => {
    const [app] = groupConnections([row("error", { error: "Access was denied" })], []);
    expect(app).toMatchObject({ status: "failed", error: "Access was denied" });
  });
});

describe("toggleAccess", () => {
  const all = ["a", "b", "c"];
  it("turns one agent off from everyone, leaving the rest listed", () => {
    expect(toggleAccess({ allAgents: true, botIds: [] }, all, "b", false)).toEqual({
      allAgents: false,
      botIds: ["a", "c"],
    });
  });
  it("collapses back to everyone when the last agent is turned on", () => {
    expect(toggleAccess({ allAgents: false, botIds: ["a", "b"] }, all, "c", true)).toEqual({
      allAgents: true,
      botIds: [],
    });
  });
});

describe("toolLabel", () => {
  it("strips the app prefix and sentence-cases the rest", () => {
    expect(toolLabel("GMAIL_FETCH_EMAILS", "gmail")).toBe("Fetch emails");
    expect(toolLabel("search_files", "drive")).toBe("Search files");
    expect(toolLabel("GMAIL", "gmail")).toBe("Gmail");
  });
});

describe("FINANCE_PROVIDERS logos", () => {
  it("gives every provider a logo, and vendored ones exist under public/", () => {
    for (const { logo } of FINANCE_PROVIDERS) {
      expect(logo).toBeTruthy();
      if (logo.startsWith("/"))
        expect(existsSync(new URL(`../../public${logo}`, import.meta.url))).toBe(true);
    }
  });
});

describe("isSameMcpEndpoint", () => {
  const x = "https://api.x.com/mcp";
  it("matches the same https host and path, ignoring a trailing slash", () => {
    expect(isSameMcpEndpoint("https://api.x.com/mcp", x)).toBe(true);
    expect(isSameMcpEndpoint("https://api.x.com/mcp/", x)).toBe(true);
  });
  it("does not match another path, protocol or host", () => {
    expect(isSameMcpEndpoint("https://api.x.com/other", x)).toBe(false);
    expect(isSameMcpEndpoint("http://api.x.com/mcp", x)).toBe(false);
    expect(isSameMcpEndpoint("https://x.com/mcp", x)).toBe(false);
    expect(isSameMcpEndpoint(null, x)).toBe(false);
  });
});

describe("first-party services", () => {
  it("are not offered a second time from the managed catalog", () => {
    const catalog = ["x", "twitter", "treg", "notion"].map((slug) => item(slug, "other"));
    expect(popularApps(catalog, []).map((i) => i.slug)).toEqual(["notion"]);
  });
});

describe("appPath", () => {
  it("builds the connect link a caller can return from", () => {
    expect(appPath({ connectorId: "google", slug: "gmail" })).toBe(
      "/app/integrations/app/google/gmail",
    );
    expect(
      appPath({ connectorId: "google", slug: "gmail" }, { connect: true, next: "/app/data-room" }),
    ).toBe("/app/integrations/app/google/gmail?connect=1&next=%2Fapp%2Fdata-room");
  });
});
