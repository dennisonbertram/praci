import { describe, expect, it } from "vitest";
import { FINANCE_READ_TOOLS } from "./finance.js";
import {
  INTEGRATION_PRESETS,
  integrationAgentSpawnKey,
  integrationPresetForEndpoint,
  isIntegrationAgentSpawnKey,
  isReadTool,
} from "./integration-agent.js";

const mercury = INTEGRATION_PRESETS.mercury;
const brex = INTEGRATION_PRESETS.brex;

describe("isReadTool", () => {
  it("reads on readOnlyHint true", () => {
    expect(isReadTool({ name: "anything", annotations: { readOnlyHint: true } })).toBe(true);
  });
  it("reads when the preset lists the tool", () => {
    expect(isReadTool({ name: "getAccounts" }, mercury)).toBe(true);
    expect(isReadTool({ name: "getAccount" }, mercury)).toBe(true);
    expect(isReadTool({ name: "list_cards" }, brex)).toBe(true);
  });
  it("forced writes win over annotations and read lists", () => {
    expect(
      isReadTool({ name: "requestSendMoney", annotations: { readOnlyHint: true } }, mercury),
    ).toBe(false);
    expect(isReadTool({ name: "lock_card", annotations: { readOnlyHint: true } }, brex)).toBe(
      false,
    );
    expect(isReadTool({ name: "start_expense_download" }, brex)).toBe(false);
    expect(isReadTool({ name: "verify_shipping_address" }, brex)).toBe(false);
  });
  it("treats unknown and unannotated tools as writes", () => {
    expect(isReadTool({ name: "mystery" })).toBe(false);
    expect(isReadTool({ name: "mystery", annotations: { readOnlyHint: false } }, mercury)).toBe(
      false,
    );
    expect(isReadTool({ name: "requestSendMoney" }, mercury)).toBe(false);
    expect(isReadTool({ name: "lock_card" }, brex)).toBe(false);
  });
  it("keeps every Finance read tool a read", () => {
    for (const provider of ["mercury", "brex"] as const)
      for (const name of FINANCE_READ_TOOLS[provider])
        expect(isReadTool({ name }, INTEGRATION_PRESETS[provider])).toBe(true);
  });
  it("matches presets by endpoint host", () => {
    expect(integrationPresetForEndpoint("https://mcp.mercury.com/mcp")?.service).toBe("Mercury");
    expect(integrationPresetForEndpoint("https://example.test/mcp")).toBeUndefined();
  });
  it("builds and recognizes the spawn key", () => {
    expect(isIntegrationAgentSpawnKey(integrationAgentSpawnKey("s1"))).toBe(true);
    expect(isIntegrationAgentSpawnKey("carta-agent:u1")).toBe(false);
  });
});
