import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export interface McpJsonTool {
  name: string;
  description?: string;
  inputSchema: { type: "object"; [key: string]: unknown };
  readOnly: boolean;
}

/**
 * Serves tools described by JSON Schema, such as the bot tool definitions. The SDK's
 * `registerTool` only takes zod schemas, so this answers `tools/list` and `tools/call` directly.
 */
export function serveJsonTools(
  server: McpServer,
  tools: McpJsonTool[],
  call: (name: string, args: Record<string, unknown>) => Promise<CallToolResult>,
  /** The tools `tools/list` shows, when fewer than the tools that can be called (they then refuse themselves). */
  listed: McpJsonTool[] = tools,
) {
  server.server.registerCapabilities({ tools: {} });
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listed.map(({ readOnly, ...tool }) => ({
      ...tool,
      annotations: { readOnlyHint: readOnly },
    })),
  }));
  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!tools.some((tool) => tool.name === name)) {
      return { isError: true, content: [{ type: "text", text: `Unknown tool ${name}` }] };
    }
    return call(name, args ?? {});
  });
}

/**
 * Answers one MCP request over Streamable HTTP in stateless mode: a new server per request,
 * a plain JSON reply, no session id, nothing kept between calls, so any API process can serve it.
 * `ping` comes from the SDK; the caller registers the tools.
 */
export async function serveMcpRequest(
  request: Request,
  options: {
    name: string;
    version: string;
    instructions?: string;
    register: (server: McpServer) => void;
  },
): Promise<Response> {
  const server = new McpServer(
    { name: options.name, version: options.version },
    { instructions: options.instructions },
  );
  options.register(server);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export type { McpServer };
