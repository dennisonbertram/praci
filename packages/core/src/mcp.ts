export function deriveMcpSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || `mcp-${Date.now()}`
  );
}

const GENERIC_MCP_NAME = "MCP server";
const HOST_PREFIXES = new Set(["www", "api", "mcp"]);
const SECOND_LEVEL_TLDS = new Set(["co", "com", "org", "net", "gov", "ac"]);

/** Readable default name for a server added by URL: api.brex.com -> "Brex". */
export function deriveMcpName(endpoint: string): string {
  let host: string;
  try {
    host = new URL(endpoint).hostname;
  } catch {
    return GENERIC_MCP_NAME;
  }
  if (/^[\d.]+$/.test(host) || host.includes(":")) return GENERIC_MCP_NAME;
  const labels = host.split(".").filter(Boolean);
  while (labels.length > 2 && HOST_PREFIXES.has(labels[0] as string)) labels.shift();
  if (labels.length > 1) labels.pop();
  if (labels.length > 1 && SECOND_LEVEL_TLDS.has(labels[labels.length - 1] as string)) {
    labels.pop();
  }
  const label = labels[labels.length - 1];
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : GENERIC_MCP_NAME;
}
