import type {
  AdapterContext,
  AdapterDescriptor,
  InboxClassification,
  InboxClassifierCapabilities,
  InboxClassifierMessage,
  InboxClassifierProvider,
  InboxClassifyResult,
} from "@rakazo/adapter-kit";

export const TYPESAFE_CLASSIFIER_ID = "typesafe";

export interface TypesafeAnswers {
  category: string;
  categoryConfidence: number;
  needsResponse: number;
  newsletter: number;
  phishing: number;
  junk: number;
  brandMismatch: number;
  priority: number;
}

export interface TypesafeInboxClassifierOptions {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  model?: string;
  retries?: number;
  retryDelayMs?: number;
}

export function fromDomain(_from: string): string {
  return "";
}

export function mapTypesafeAnswers(
  _answers: TypesafeAnswers,
): Omit<InboxClassification, "id" | "reason" | "todo" | "due"> | null {
  return null;
}

export class TypesafeInboxClassifier implements InboxClassifierProvider {
  constructor(readonly options: TypesafeInboxClassifierOptions) {}

  describe(): AdapterDescriptor<InboxClassifierCapabilities> {
    return {
      id: TYPESAFE_CLASSIFIER_ID,
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { offline: false, keyless: false },
    };
  }

  async classify(
    _messages: InboxClassifierMessage[],
    _context: AdapterContext,
  ): Promise<InboxClassifyResult> {
    return { model: "", items: [] };
  }
}
