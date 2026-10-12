import { describe, expect, it } from "vitest";
import { deriveMcpName } from "./mcp.js";

describe("deriveMcpName", () => {
  it.each([
    ["https://api.brex.com/mcp", "Brex"],
    ["https://mcp.linear.app/mcp", "Linear"],
    ["https://www.example.co.uk/mcp", "Example"],
    ["https://mcp.api.stripe.com/", "Stripe"],
    ["https://notion.com/mcp", "Notion"],
    ["http://localhost:8000/mcp", "Localhost"],
  ])("names %s %s", (url, name) => {
    expect(deriveMcpName(url)).toBe(name);
  });

  it("falls back to the generic name when no host label is readable", () => {
    expect(deriveMcpName("http://127.0.0.1:3000/mcp")).toBe("MCP server");
    expect(deriveMcpName("not a url")).toBe("MCP server");
  });
});
