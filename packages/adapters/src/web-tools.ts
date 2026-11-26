import type { AdapterContext, WebFetchProvider, WebSearchProvider } from "@rakazo/adapter-kit";
import { botWallInstruction } from "./bot-wall.js";
import { clampMaxChars, clampMaxResults } from "./web-limits.js";

export async function webSearchFromTool(
  search: WebSearchProvider,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required" };
  try {
    const results = await search.search(
      {
        query,
        maxResults: clampMaxResults(args.maxResults),
        signal: context.signal,
      },
      context,
    );
    return { results };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function webFetchFromTool(
  fetchProvider: WebFetchProvider,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  const url = String(args.url ?? "").trim();
  if (!url) return { error: "url is required" };
  try {
    const result = await fetchProvider.fetch(
      {
        url,
        maxChars: clampMaxChars(args.maxChars),
        signal: context.signal,
      },
      context,
    );
    if (result.wall) {
      const { kind, status, reason } = result.wall;
      return {
        url: result.url,
        blocked: { kind, status, reason },
        instruction: botWallInstruction(kind),
      };
    }
    return result;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
