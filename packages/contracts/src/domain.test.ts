import { describe, expect, it } from "vitest";
import type { ConnectionCatalogItem } from "./domain.js";
import {
  ConnectionSchema,
  CreateScratchpadItemInput,
  preferNativeGoogle,
  ScratchpadCategorySchema,
  ScratchpadChannelSchema,
  ScratchpadItemSchema,
} from "./domain.js";

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

describe("scratchpad metadata schemas", () => {
  it("accepts the plan enums and rejects values outside them", () => {
    expect(ScratchpadCategorySchema.options).toEqual([
      "goal",
      "research",
      "draft",
      "public_post",
      "create_account",
      "outbound_email",
    ]);
    expect(ScratchpadChannelSchema.options).toEqual([
      "x",
      "linkedin",
      "threads",
      "bluesky",
      "reddit",
      "hn",
      "producthunt",
      "directory",
      "email",
    ]);
    expect(ScratchpadCategorySchema.safeParse("public_post").success).toBe(true);
    expect(ScratchpadCategorySchema.safeParse("other").success).toBe(false);
    expect(ScratchpadChannelSchema.safeParse("producthunt").success).toBe(true);
    expect(ScratchpadChannelSchema.safeParse("mastodon").success).toBe(false);
  });

  it("keeps the new output fields optional for old scratchpad literals", () => {
    const old = {
      id: "item-1",
      botId: "bot-1",
      title: "Old item",
      status: "open",
      notes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(ScratchpadItemSchema.parse(old)).toMatchObject(old);
    expect(
      ScratchpadItemSchema.parse({
        ...old,
        category: "public_post",
        channel: "x",
        target: null,
        scheduledFor: null,
        proof: null,
        approvedAt: null,
        approvedBy: "user",
      }),
    ).toMatchObject({ category: "public_post", channel: "x", approvedBy: "user" });
    expect(
      CreateScratchpadItemInput.parse({
        botId: "bot-1",
        title: "A goal",
        category: "goal",
      }),
    ).not.toHaveProperty("status");
  });
});
