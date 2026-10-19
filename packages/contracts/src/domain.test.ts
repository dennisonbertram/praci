import { describe, expect, it } from "vitest";
import type { ConnectionCatalogItem } from "./domain.js";
import { ConnectionSchema, preferNativeGoogle } from "./domain.js";

const item = (connectorId: string, slug: string): ConnectionCatalogItem => ({
  connectorId,
  slug,
  name: slug,
  logo: null,
  connected: false,
  noAuth: false,
  description: null,
  category: "other" as const,
});
const google = item("google", "gmail");
const composio = item("composio", "gmail");
const pipedream = item("pipedream", "gmail");
const slack = item("composio", "slack");

describe("preferNativeGoogle", () => {
  it("shows only the Google Gmail entry when native Google is configured and allowed", () => {
    expect(
      preferNativeGoogle([composio, slack, google, pipedream], { nativeGoogle: true }),
    ).toEqual([slack, google]);
  });

  it("keeps the managed Gmail entry when Google is not configured", () => {
    expect(preferNativeGoogle([composio, slack], { nativeGoogle: true })).toEqual([
      composio,
      slack,
    ]);
  });

  it("hides the Google entry and keeps the managed one where native Google is unavailable", () => {
    expect(preferNativeGoogle([composio, google, slack], { nativeGoogle: false })).toEqual([
      composio,
      slack,
    ]);
  });

  it("keeps a connected managed Gmail entry so it can be disconnected", () => {
    const connected = { ...composio, connected: true };
    expect(preferNativeGoogle([connected, google, pipedream], { nativeGoogle: true })).toEqual([
      connected,
      google,
    ]);
  });

  it("does not drop a managed non-Gmail entry whose slug merely contains gmail", () => {
    const other = item("composio", "gmail-labels");
    expect(preferNativeGoogle([google, other], { nativeGoogle: true })).toEqual([google, other]);
  });

  it("drops managed Calendar and Drive entries however their slug is spelled", () => {
    const nativeCal = item("google", "googlecalendar");
    const nativeDrive = item("google", "googledrive");
    const managed = [
      item("composio", "GOOGLECALENDAR"),
      item("pipedream", "google-calendar"),
      item("composio", "googledrive"),
      item("composio", "google_drive"),
    ];
    expect(
      preferNativeGoogle([...managed, slack, nativeCal, nativeDrive], { nativeGoogle: true }),
    ).toEqual([slack, nativeCal, nativeDrive]);
  });

  it("keeps a managed Calendar entry that is connected, or has no native twin", () => {
    const connected = { ...item("composio", "googlecalendar"), connected: true };
    const drive = item("composio", "googledrive");
    expect(preferNativeGoogle([connected, drive, google], { nativeGoogle: true })).toEqual([
      connected,
      drive,
      google,
    ]);
  });
});

describe("ConnectionSchema", () => {
  it("keeps agent fields optional for existing fixtures and exposes durable values", () => {
    const base = {
      id: "connection-1",
      connectorId: "composio",
      provider: "GMAIL",
      displayName: "Work Gmail",
      status: "connected",
      error: null,
      capabilities: [],
      createdAt: "2026-10-01T00:00:00.000Z",
    };
    expect(ConnectionSchema.parse(base)).toMatchObject(base);
    expect(
      ConnectionSchema.parse({ ...base, writesEnabled: true, agentBotId: "bot-1" }),
    ).toMatchObject({ writesEnabled: true, agentBotId: "bot-1" });
  });
});
