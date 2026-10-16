import * as z from "zod";

export const McpTransportSchema = z.enum(["streamable_http", "sse", "stdio"]);
export type McpTransport = z.infer<typeof McpTransportSchema>;

/** OAuth begin error for a server without dynamic client registration; the web app keys on this text. */
export const MCP_OAUTH_CLIENT_ID_REQUIRED = "This server needs an OAuth client ID";

/** A client registered by the user with the server's provider, for servers that refuse dynamic registration. */
export const McpOauthClientSchema = z.object({
  clientId: z.string().min(1).max(256),
  clientSecret: z.string().min(1).max(1024).optional(),
  /** Space-separated scopes to request instead of everything the server lists. */
  scope: z.string().min(1).max(1000).optional(),
});

export function isLocalMcpHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

export const McpRemoteEndpointSchema = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    try {
      if (value.endsWith("#")) return false;
      const url = new URL(value);
      if (url.username || url.password || url.hash) return false;
      // Persist HTTP(S). Runtime SSRF still requires HTTPS for public hosts and
      // blocks private LAN targets unless the deployment-owner escape is on.
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "MCP remote endpoint must be an HTTP(S) URL without credentials or a fragment");

export const McpHeadersSchema = z
  .record(z.string().regex(/^[A-Za-z0-9-]+$/), z.string().max(4096))
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 32) {
      ctx.addIssue({ code: "custom", message: "At most 32 headers are allowed" });
    }
  });
