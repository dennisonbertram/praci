import { describe, expect, it } from "vitest";
import { pageAgentColor } from "./agent-colors.js";
import type { PageAgentKind } from "./index.js";
import {
  cartaAgentSpawnKey,
  companyAgentSpawnKey,
  companyImporterSpawnKey,
  dataRoomAgentSpawnKey,
  financeAgentSpawnKey,
  gtmAgentSpawnKey,
  inboxAgentSpawnKey,
  investorsAgentSpawnKey,
  legalAgentSpawnKey,
  PAGE_AGENTS,
  pageAgentKindOf,
  pageAgentSpawnKey,
  retiredVoiceAgentSpawnKey,
  scannerAgentSpawnKey,
  voiceAgentSpawnKey,
} from "./index.js";

const kinds = Object.keys(PAGE_AGENTS) as PageAgentKind[];

describe("page agent registry", () => {
  it("round-trips every kind through its spawn key", () => {
    for (const kind of kinds) {
      expect(pageAgentKindOf(pageAgentSpawnKey(kind, "user1"))).toBe(kind);
    }
  });

  it("maps every spawn key a builder produces back to its kind", () => {
    const built: Record<PageAgentKind, string> = {
      inbox: inboxAgentSpawnKey("u"),
      finance: financeAgentSpawnKey("u"),
      legal: legalAgentSpawnKey("u"),
      investors: investorsAgentSpawnKey("u"),
      carta: cartaAgentSpawnKey("u"),
      "data-room": dataRoomAgentSpawnKey("u"),
      scanner: scannerAgentSpawnKey("u"),
      gtm: gtmAgentSpawnKey("u"),
      company: companyAgentSpawnKey("u"),
      "company-importer": companyImporterSpawnKey("u"),
      voice: voiceAgentSpawnKey("u"),
    };
    expect(Object.keys(built).sort()).toEqual([...kinds].sort());
    for (const [kind, key] of Object.entries(built)) expect(pageAgentKindOf(key)).toBe(kind);
    expect(pageAgentKindOf(retiredVoiceAgentSpawnKey("bot1"))).toBe("voice");
  });

  it("recognises gtm and company as page agents", () => {
    expect(pageAgentKindOf("gtm-agent:user1")).toBe("gtm");
    expect(pageAgentKindOf("company-agent:user1")).toBe("company");
    expect(PAGE_AGENTS.gtm.page).toBe(true);
    expect(PAGE_AGENTS.company.page).toBe(true);
  });

  it("returns null for other bots", () => {
    expect(pageAgentKindOf("onboarding:first")).toBeNull();
    expect(pageAgentKindOf("integration-agent:abc")).toBeNull();
    expect(pageAgentKindOf(null)).toBeNull();
    expect(pageAgentKindOf(undefined)).toBeNull();
  });

  it("keeps prefixes unambiguous", () => {
    for (const a of kinds) {
      for (const b of kinds) {
        if (a !== b) expect(PAGE_AGENTS[a].prefix.startsWith(PAGE_AGENTS[b].prefix)).toBe(false);
      }
    }
  });

  it("keeps page agent colours", () => {
    const colors = Object.fromEntries(
      (
        [
          "inbox",
          "finance",
          "data-room",
          "scanner",
          "company",
          "carta",
          "investors",
          "legal",
          "gtm",
        ] as const
      ).map((kind) => [kind, PAGE_AGENTS[kind].color]),
    );
    expect(colors).toEqual({
      inbox: 2,
      finance: 0,
      "data-room": 1,
      scanner: 1,
      company: 4,
      carta: 3,
      investors: 3,
      legal: 6,
      gtm: 5,
    });
    expect(pageAgentColor("gtm")).not.toBe(pageAgentColor("finance"));
    expect(pageAgentColor("unknown")).toBe(pageAgentColor("finance"));
  });
});
