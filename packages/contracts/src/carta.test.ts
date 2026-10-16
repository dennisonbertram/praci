import { describe, expect, it } from "vitest";
import {
  CARTA_MCP_ENDPOINT,
  cartaAgentSpawnKey,
  isCartaAgentSpawnKey,
  isCartaEndpoint,
} from "./carta.js";

describe("isCartaEndpoint", () => {
  it("matches Carta's https host", () => {
    expect(isCartaEndpoint(CARTA_MCP_ENDPOINT)).toBe(true);
    expect(isCartaEndpoint("https://mcp.app.carta.com/other")).toBe(true);
  });
  it("rejects look-alike hosts, plain http and junk", () => {
    expect(isCartaEndpoint("https://mcp.app.carta.com.evil.test/mcp")).toBe(false);
    expect(isCartaEndpoint("http://mcp.app.carta.com/mcp")).toBe(false);
    expect(isCartaEndpoint("not a url")).toBe(false);
    expect(isCartaEndpoint(null)).toBe(false);
  });
});

describe("carta agent spawn key", () => {
  it("is recognized by prefix", () => {
    expect(isCartaAgentSpawnKey(cartaAgentSpawnKey("u1"))).toBe(true);
    expect(isCartaAgentSpawnKey("finance-agent:u1")).toBe(false);
    expect(isCartaAgentSpawnKey(null)).toBe(false);
  });
});
