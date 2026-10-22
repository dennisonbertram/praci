import { describe, expect, it } from "vitest";
import { INTEGRATION_PRESETS, isReadTool } from "./integration-agent.js";
import {
  isZernioEndpoint,
  ZERNIO_API_BASE_URL,
  ZERNIO_MCP_ENDPOINT,
  ZERNIO_READ_TOOLS,
  ZernioPostingCapabilitySchema,
} from "./zernio.js";

describe("Zernio contracts", () => {
  it("matches only the HTTPS MCP host", () => {
    expect(isZernioEndpoint(ZERNIO_MCP_ENDPOINT)).toBe(true);
    expect(isZernioEndpoint("https://mcp.zernio.com/other")).toBe(true);
    for (const endpoint of [
      null,
      undefined,
      "junk",
      "http://mcp.zernio.com/mcp",
      "https://mcp.zernio.com.evil.test/mcp",
      "https://mcp.zernio.com:444/mcp",
      "https://zernio.com/api",
    ])
      expect(isZernioEndpoint(endpoint)).toBe(false);
    expect(ZERNIO_API_BASE_URL).toBe("https://zernio.com/api");
  });

  it("classifies only the nine observed read tools as reads", () => {
    expect(ZERNIO_READ_TOOLS).toEqual([
      "accounts_list",
      "accounts_get",
      "profiles_list",
      "profiles_get",
      "posts_list",
      "posts_get",
      "posts_list_failed",
      "media_check_upload_status",
      "docs_search",
    ]);
    for (const name of ZERNIO_READ_TOOLS)
      expect(isReadTool({ name }, INTEGRATION_PRESETS.zernio)).toBe(true);
    for (const name of [
      "posts_create",
      "posts_update",
      "posts_delete",
      "posts_publish_now",
      "posts_retry",
      "call_tool",
      "search_tools",
      "generated_tool",
      "gtm_post",
    ])
      expect(
        isReadTool({ name, annotations: { readOnlyHint: true } }, INTEGRATION_PRESETS.zernio),
      ).toBe(false);
  });

  it("distinguishes missing connection, MCP-only auth and REST API-key capability", () => {
    for (const capability of ["not_connected", "api_key_required", "ready"])
      expect(ZernioPostingCapabilitySchema.parse(capability)).toBe(capability);
    expect(ZernioPostingCapabilitySchema.safeParse("oauth_ready").success).toBe(false);
  });
});
