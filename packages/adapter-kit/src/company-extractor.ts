import type { CompanyExtraction } from "@rakazo/contracts";
import type { CompanyImportWorkerContext } from "./types.js";

export interface CompanyExtractionDocument {
  title: string;
  text: string;
}

export interface CompanyExtractor {
  relevant(input: CompanyExtractionDocument, context: CompanyImportWorkerContext): Promise<boolean>;
  extract(
    input: CompanyExtractionDocument,
    context: CompanyImportWorkerContext,
  ): Promise<{
    extraction: CompanyExtraction;
    model: { provider: string; model: string };
  }>;
}
