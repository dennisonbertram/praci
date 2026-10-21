import type { CompanyExtraction, MailSignals } from "@rakazo/contracts";
import { CompanyExtractionSchema } from "@rakazo/contracts";

const instruction =
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|(?:system|developer)\s+(?:message|prompt)|\b(?:send_mail|spawn_bot|execute_tool)\b|mark\s+all\s+.*confirmed/i;
const privateData =
  /\b(?:salary|compensation|performance review|immigration|passport|home address|personal phone|medical|diagnosis|health condition|birthday)\b/i;

export function prepareCompanyDocument(input: { title: string; text: string }) {
  const untrusted = instruction.test(`${input.title}\n${input.text}`);
  const clean = (text: string) =>
    text
      .split(/\r?\n/)
      .filter((line) => !instruction.test(line) && !privateData.test(line))
      .join("\n");
  return { title: clean(input.title), text: clean(input.text), untrusted };
}

export function validateCompanyExtraction(
  raw: unknown,
  document: { title: string; text: string },
): CompanyExtraction {
  const parsed = CompanyExtractionSchema.parse(raw);
  const safe = prepareCompanyDocument(document);
  const quotedSource = `${safe.title}\n${safe.text}`;
  for (const fact of [...parsed.entities, ...parsed.edges, ...parsed.events]) {
    if (
      !quotedSource.includes(fact.quote) ||
      instruction.test(fact.quote) ||
      privateData.test(fact.quote)
    )
      throw new Error("company_extraction_invalid_quote");
  }
  if (!safe.untrusted) return parsed;
  return {
    entities: parsed.entities.map((fact) => ({
      ...fact,
      entity: { ...fact.entity, confidence: Math.min(fact.entity.confidence, 0.49) },
    })),
    edges: parsed.edges.map((fact) => ({ ...fact, confidence: Math.min(fact.confidence, 0.49) })),
    events: parsed.events.map((fact) => ({ ...fact, confidence: Math.min(fact.confidence, 0.49) })),
  };
}

export function skipCompanyMail(input: {
  labelIds: string[];
  signals?: MailSignals;
  category?: string | null;
  skipSender?: boolean;
}) {
  return Boolean(
    input.skipSender ||
      ["newsletter", "bulk", "notification", "spam"].includes(input.category ?? "") ||
      input.labelIds.some((label) =>
        [
          "SPAM",
          "TRASH",
          "CATEGORY_PROMOTIONS",
          "CATEGORY_SOCIAL",
          "CATEGORY_UPDATES",
          "CATEGORY_FORUMS",
        ].includes(label),
      ) ||
      input.signals?.bulk ||
      input.signals?.autoSubmitted ||
      input.signals?.listId ||
      input.signals?.listUnsubscribe.length,
  );
}
