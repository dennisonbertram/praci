import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it } from "vitest";
import { type OAuthMaterial, StoredMcpOAuthProvider } from "./mcp-oauth.js";
import { ThirdPartyConnectorEmulator } from "./third-party-connector-emulator.js";

const ENDPOINT = "https://mcp.mock-equity.test/mcp";
const CALLBACK = "http://127.0.0.1:5378/mcp/oauth/callback";

describe("ThirdPartyConnectorEmulator mock sign-in", () => {
  it("makes an extra server with authorizeUrl ask for a sign-in, then answers with the issued token", async () => {
    const emulator = new ThirdPartyConnectorEmulator({
      "mcp.mock-equity.test": {
        authorizeUrl: `${CALLBACK}?code=mock-code`,
        tools: [{ name: "cap_table_chart", description: "", inputSchema: { type: "object" } }],
        call: () => ({ ok: true }),
      },
    });
    const material: OAuthMaterial = {};
    let authorizationUrl: URL | undefined;
    const provider = () =>
      new StoredMcpOAuthProvider("server-1", material, async () => undefined, {
        redirectUri: CALLBACK,
        state: "session-1",
        onAuthorization: (url) => {
          authorizationUrl = url;
        },
      });
    const signingIn = provider();
    const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
      authProvider: signingIn,
      fetch: emulator.fetch,
    });
    // Without a token the server refuses, so Connect cannot finish as "connected" with no login.
    await expect(new Client({ name: "t", version: "1" }).connect(transport)).rejects.toThrow();
    expect(authorizationUrl?.searchParams.get("code")).toBe("mock-code");
    expect(authorizationUrl?.searchParams.get("state")).toBe("session-1");
    expect(`${authorizationUrl?.origin}${authorizationUrl?.pathname}`).toBe(CALLBACK);

    await transport.finishAuth("mock-code");
    expect(material.oauth?.tokens?.access_token).toBe("mock-demo-token");

    const client = new Client({ name: "t", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(ENDPOINT), {
        authProvider: provider(),
        fetch: emulator.fetch,
      }),
    );
    const result = await client.callTool({ name: "cap_table_chart", arguments: {} });
    expect(JSON.stringify(result.content)).toContain("ok");
    await client.close();
  });
});
