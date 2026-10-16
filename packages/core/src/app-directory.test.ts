import { describe, expect, it } from "vitest";
import { dedupeCatalogBySlug, describeApp, withAppDirectory } from "./app-directory.js";

const item = (connectorId: string, slug: string, connected = false) => ({
  connectorId,
  slug,
  name: slug,
  logo: null,
  connected,
  noAuth: false,
  description: null,
  category: "other" as const,
});

describe("app directory", () => {
  it("looks up apps by normalized slug", () => {
    expect(describeApp("GMAIL")?.category).toBe("email_calendar");
    expect(describeApp("google_calendar")?.description).toBeTruthy();
    expect(describeApp("Google Drive")?.category).toBe("docs_files");
    expect(describeApp("googlemail")).toEqual(describeApp("gmail"));
    expect(describeApp("not-a-real-app")).toBeUndefined();
  });

  it("defaults unknown apps to no description and category other", () => {
    const [enriched] = withAppDirectory([
      {
        connectorId: "composio",
        slug: "mystery",
        name: "Mystery",
        logo: null,
        connected: false,
        noAuth: false,
      },
    ]);
    expect(enriched).toMatchObject({ description: null, category: "other" });
  });
});

describe("dedupeCatalogBySlug", () => {
  it("prefers composio over pipedream and keeps one item per slug", () => {
    const out = dedupeCatalogBySlug([
      item("pipedream", "Slack"),
      item("composio", "slack"),
      item("pipedream", "linear"),
    ]);
    expect(out.map((i) => `${i.connectorId}:${i.slug}`)).toEqual([
      "composio:slack",
      "pipedream:linear",
    ]);
  });

  it("prefers a connected entry over connector order", () => {
    const out = dedupeCatalogBySlug([item("composio", "slack"), item("pipedream", "slack", true)]);
    expect(out).toHaveLength(1);
    expect(out[0]?.connectorId).toBe("pipedream");
  });

  it("keeps the native google entry beside the best managed one so clients can pick", () => {
    const out = dedupeCatalogBySlug([
      item("pipedream", "gmail"),
      item("composio", "gmail"),
      item("google", "gmail"),
    ]);
    expect(out.map((i) => i.connectorId).sort()).toEqual(["composio", "google"]);
  });
});
