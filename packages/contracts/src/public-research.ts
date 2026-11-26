/**
 * MCP servers that only search and read the public web. An integration agent whose every server is
 * on this list holds no private data of its own. A small explicit list, never decided by a model.
 */
export const PUBLIC_RESEARCH_HOSTS: readonly string[] = ["mcp.exa.ai", "mcp.tavily.com"];

/** Composio toolkits (connection `provider`) that only search and read the public web. */
export const PUBLIC_RESEARCH_COMPOSIO_PROVIDERS: readonly string[] = ["exa", "tavily_mcp"];

/** Whether a connection row is a public research app: Composio Exa or Tavily. */
export function isPublicResearchConnection(row: {
  connectorId: string;
  provider: string;
}): boolean {
  return (
    row.connectorId === "composio" && PUBLIC_RESEARCH_COMPOSIO_PROVIDERS.includes(row.provider)
  );
}

/** The search, find-similar, answer and page-reading tools of Exa and Tavily, by base name. */
const PUBLIC_RESEARCH_TOOLS: ReadonlySet<string> = new Set([
  "search",
  "web_search",
  "find_similar",
  "answer",
  "get_contents",
  "get_contents_for_urls",
  "crawling",
  "crawl",
  "extract",
  "map",
  "get_code_context",
  "company_research",
  "people_search",
  "linkedin_search",
]);

/**
 * Whether a tool of an Exa or Tavily app is one of their public search or page-read tools. Matches
 * Composio names (EXA_SEARCH, TAVILY_MCP_TAVILY_EXTRACT) and MCP names (web_search_exa,
 * tavily-extract, mcp__slug__crawling_exa) after removing the provider's name; anything else
 * (creating research tasks, websets, monitors) is not on the list.
 */
export function isPublicResearchTool(toolName: string): boolean {
  const name = (toolName.split("__").pop() ?? toolName)
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/^(tavily_mcp_tavily|tavily_mcp|tavily|exa)_/, "")
    .replace(/_exa$/, "");
  return PUBLIC_RESEARCH_TOOLS.has(name);
}

/** Whether an MCP endpoint is a public research server, matched by https host. */
export function isPublicResearchEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUBLIC_RESEARCH_HOSTS.includes(url.host);
  } catch {
    return false;
  }
}
