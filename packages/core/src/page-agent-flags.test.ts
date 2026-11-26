import type { PageAgentKind } from "@rakazo/contracts";
import { PAGE_AGENTS, pageAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { botUsesConnectorTools, botUsesNativeGoogle } from "./connection-access.js";
import { messagingProviderBlocksBot } from "./messaging-policy.js";

/**
 * Kind x predicate matrix, written out by hand from the behaviour before the registry existed.
 * GTM is the only kind that uses connector tools; B2/B3 (GTM owner agent) are unchanged.
 */
const MATRIX: Record<PageAgentKind, { connector: boolean; google: boolean; photon: boolean }> = {
  inbox: { connector: false, google: true, photon: false },
  finance: { connector: false, google: true, photon: true },
  legal: { connector: false, google: true, photon: true },
  investors: { connector: false, google: true, photon: true },
  carta: { connector: false, google: true, photon: false },
  "data-room": { connector: false, google: true, photon: false },
  scanner: { connector: false, google: false, photon: false },
  gtm: { connector: true, google: true, photon: false },
  company: { connector: false, google: false, photon: false },
  "company-importer": { connector: false, google: false, photon: false },
  voice: { connector: false, google: false, photon: false },
};

describe("page agent predicate matrix", () => {
  it("covers every kind", () => {
    expect(Object.keys(MATRIX).sort()).toEqual(Object.keys(PAGE_AGENTS).sort());
  });

  for (const [kind, expected] of Object.entries(MATRIX)) {
    it(kind, () => {
      const key = pageAgentSpawnKey(kind as PageAgentKind, "user1");
      expect(botUsesConnectorTools(key)).toBe(expected.connector);
      expect(botUsesNativeGoogle(key)).toBe(expected.google);
      expect(messagingProviderBlocksBot("photon", key)).toBe(expected.photon);
      expect(messagingProviderBlocksBot("other", key)).toBe(false);
    });
  }

  it("treats mail-thread, integration and plain bots as before", () => {
    expect(botUsesConnectorTools("mail-thread:c:t")).toBe(false);
    expect(botUsesConnectorTools("integration-agent:x")).toBe(false);
    expect(botUsesNativeGoogle("integration-agent:x")).toBe(false);
    expect(botUsesNativeGoogle("mail-thread:c:t")).toBe(true);
    expect(botUsesConnectorTools("onboarding:first")).toBe(true);
    expect(botUsesConnectorTools(null)).toBe(true);
  });
});
