import { describe, expect, it } from "vitest";
import { serveMcpRequest } from "./mcp-http-server.js";

const post = (body: unknown) =>
  new Request("http://mcp.test/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
const serve = (request: Request) =>
  serveMcpRequest(request, {
    name: "test",
    version: "1",
    register: (server) =>
      server.registerTool("hello", { description: "Says hello" }, async () => ({
        content: [{ type: "text", text: "hi" }],
      })),
  });

describe("serveMcpRequest", () => {
  it("answers ping and lists the registered tools without a session", async () => {
    const ping = await serve(post({ jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(await ping.json()).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
    const list = await serve(post({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    expect(list.headers.get("mcp-session-id")).toBeNull();
    const body = (await list.json()) as { result: { tools: Array<{ name: string }> } };
    expect(body.result.tools.map((tool) => tool.name)).toEqual(["hello"]);
  });
});
