import type { ParsedStatement, StatementCheck } from "@rakazo/contracts";
import { ParsedStatementSchema } from "@rakazo/contracts";
import { checkStatement } from "./check.js";
import { csvParser } from "./csv.js";
import { modelPdfParser } from "./model-pdf.js";
import { ofxParser } from "./ofx.js";
import { extractPdfText } from "./pdf-text.js";
import type { StatementDeps, StatementInput, StatementParser } from "./types.js";
import { wellsFargoParser } from "./wells-fargo.js";

export { checkStatement } from "./check.js";
export { createRuntimeExtract } from "./model-pdf.js";
export { normalizeStem } from "./money.js";
export { extractPdfText } from "./pdf-text.js";
export type { StatementDeps, StatementInput, StatementParser } from "./types.js";

/** Add a bank's parser here; the most confident `detect` wins. */
export const STATEMENT_PARSERS: StatementParser[] = [
  ofxParser,
  wellsFargoParser,
  csvParser,
  modelPdfParser,
];

const isPdf = (bytes: Uint8Array) => new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";

/**
 * Picks the best parser for the file, runs it, validates the result and checks the balances.
 * Throws a readable Error when no parser fits, the file is unreadable, or the output is invalid.
 */
export async function parseStatement(
  file: { fileName: string; bytes: Uint8Array },
  deps: StatementDeps = {},
): Promise<{ statement: ParsedStatement; check: StatementCheck }> {
  const text = isPdf(file.bytes) ? await (deps.pdfText ?? extractPdfText)(file.bytes) : null;
  const input: StatementInput = { ...file, text };
  const ranked = STATEMENT_PARSERS.map((parser) => ({
    parser,
    score: Number(parser.detect(input)),
  }))
    .filter((c) => c.score > 0 && (c.parser.format === "pdf") === (text !== null))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.parser;
  if (!best)
    throw new Error("This file type is not supported. Upload a CSV, OFX/QFX or PDF statement.");
  const valid = ParsedStatementSchema.safeParse(await best.parse(input, deps));
  if (!valid.success) {
    throw new Error(
      `The statement could not be read: ${valid.error.issues[0]?.path.join(".")} ${valid.error.issues[0]?.message}`,
    );
  }
  const statement = valid.data;
  return { statement, check: checkStatement(statement) };
}
