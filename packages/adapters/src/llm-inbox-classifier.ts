import type {
  AdapterContext,
  AdapterDescriptor,
  AgentRunModel,
  AgentRuntime,
  AgentRuntimeEvent,
  InboxClassifierCapabilities,
  InboxClassifierMessage,
  InboxClassifierProvider,
  InboxClassifyResult,
} from "@rakazo/adapter-kit";
import type { UsageAttribution } from "@rakazo/db";

export interface LlmInboxClassifierOptions {
  runtime: AgentRuntime;
  model: AgentRunModel;
  botId?: string;
  onUsage?: (
    usage: Extract<AgentRuntimeEvent, { type: "usage" }>,
    attribution: UsageAttribution,
  ) => Promise<unknown>;
}

export class LlmInboxClassifier implements InboxClassifierProvider {
  constructor(readonly options: LlmInboxClassifierOptions) {}

  describe(): AdapterDescriptor<InboxClassifierCapabilities> {
    return {
      id: "llm",
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
