import { describe, expect, it } from "vitest";
import { isPublicResearchEndpoint } from "./public-research.js";

describe("isPublicResearchEndpoint", () => {
  it("matches Exa and Tavily by https host only", () => {
    expect(isPublicResearchEndpoint("https://mcp.exa.ai/mcp")).toBe(true);
    expect(isPublicResearchEndpoint("https://mcp.tavily.com/mcp/?tavilyApiKey=key")).toBe(true);
    expect(isPublicResearchEndpoint("http://mcp.exa.ai/mcp")).toBe(false);
    expect(isPublicResearchEndpoint("https://mcp.exa.ai.evil.test/mcp")).toBe(false);
    expect(isPublicResearchEndpoint("https://mcp.mercury.com/mcp")).toBe(false);
    expect(isPublicResearchEndpoint(null)).toBe(false);
  });
});

describe("isPublicResearchTool and isPublicResearchConnection", () => {
  it("lists search and page-read tools of Exa and Tavily only", async () => {
    const { isPublicResearchTool, isPublicResearchConnection } = await import(
      "./public-research.js"
    );
    for (const name of [
      "EXA_SEARCH",
      "EXA_FIND_SIMILAR",
      "EXA_ANSWER",
      "web_search_exa",
      "crawling_exa",
      "TAVILY_MCP_TAVILY_SEARCH",
      "TAVILY_MCP_TAVILY_EXTRACT",
      "tavily-search",
      "tavily-crawl",
      "mcp__exa__web_search_exa",
    ]) {
      expect(isPublicResearchTool(name), name).toBe(true);
    }
    for (const name of ["EXA_CREATE_WEBSET", "EXA_CREATE_MONITOR", "tavily-research", "send"]) {
      expect(isPublicResearchTool(name), name).toBe(false);
    }
    expect(isPublicResearchConnection({ connectorId: "composio", provider: "exa" })).toBe(true);
    expect(isPublicResearchConnection({ connectorId: "composio", provider: "tavily_mcp" })).toBe(
      true,
    );
    expect(isPublicResearchConnection({ connectorId: "composio", provider: "GMAIL" })).toBe(false);
    expect(isPublicResearchConnection({ connectorId: "pipedream", provider: "exa" })).toBe(false);
  });
});
