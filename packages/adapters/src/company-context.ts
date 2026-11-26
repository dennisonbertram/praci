import type { AdapterContext, MemoryStore } from "@rakazo/adapter-kit";
import { buildCompanyContextIndex, companySectionLink, parseCompanySection } from "@rakazo/core";

const MAX_LOOKUP_RESULTS = 2;

/** The index of the owner's company context, read from the database on every call. */
export async function loadCompanyContextIndex(
  memory: MemoryStore,
  context: AdapterContext,
  redact: (text: string) => string = (text) => text,
): Promise<string | undefined> {
  const { documents } = await memory.read({ scope: "company" }, context);
  // Redact the source text: escaping first would turn a secret containing & < > into text the
  // exact-match redaction no longer finds.
  return buildCompanyContextIndex(
    documents.map((doc) => ({ path: doc.path, content: redact(doc.content) })),
  );
}

/** Up to two sections whose name or text mentions `name`, names first. */
export async function lookupCompanyContext(
  memory: MemoryStore,
  context: AdapterContext,
  name: unknown,
) {
  const query = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (query.length < 2) return { error: "Give the name to look up." };
  const { documents } = await memory.read({ scope: "company" }, context);
  const sections = documents
    .map((doc) => {
      const parsed = parseCompanySection(doc.content);
      const inTitle = parsed.title.toLowerCase().includes(query);
      return { doc, parsed, rank: inTitle ? 0 : parsed.body.toLowerCase().includes(query) ? 1 : 2 };
    })
    .filter((item) => item.rank < 2)
    .sort((a, b) => a.rank - b.rank || a.parsed.title.localeCompare(b.parsed.title))
    .slice(0, MAX_LOOKUP_RESULTS)
    .map(({ doc, parsed }) => ({
      title: parsed.title,
      text: parsed.body,
      link: companySectionLink(doc.path),
      revision: doc.revision,
    }));
  return { sections };
}
