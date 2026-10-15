import type { ParsedStatement, StatementFormat } from "@rakazo/contracts";

/** An uploaded file. `text` is the extracted text of a PDF; the registry fills it lazily. */
export interface StatementInput {
  fileName: string;
  bytes: Uint8Array;
  text: string | null;
}

export interface StatementDeps {
  /** Reads structured JSON out of statement text; backs the model-read PDF fallback. */
  extract?: (text: string, schema: object) => Promise<unknown>;
  /** Extracts layout-preserving text from PDF bytes. Defaults to `extractPdfText`. */
  pdfText?: (bytes: Uint8Array) => Promise<string>;
}

export interface StatementParser {
  id: string;
  format: StatementFormat;
  /** `false`/0 means "not mine"; higher numbers win. `true` counts as 1. */
  detect(input: StatementInput): boolean | number;
  parse(input: StatementInput, deps: StatementDeps): Promise<ParsedStatement>;
}
