import { randomUUID } from "node:crypto";
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
import { buildTriagePrompt, parseTriageResponse, TRIAGE_INSTRUCTIONS } from "@rakazo/core";
import type { UsageAttribution } from "@rakazo/db";
import { formatCurrentTimeInstruction } from "./current-time.js";

export interface LlmInboxClassifierOptions {
  runtime: AgentRuntime;
  model: AgentRunModel;
  botId?: string;
  /** Called with each usage event and the attribution that goes with it. */
  onUsage?: (
    usage: Extract<AgentRuntimeEvent, { type: "usage" }>,
    attribution: UsageAttribution,
  ) => Promise<unknown>;
}

/**
 * The default classifier: the user's model reads the same metadata and snippets and writes the
 * full triage item, including reason, to-do and due date. Throws when the answer has no usable
 * JSON, so the job fails and retries as it always has.
 */
export class LlmInboxClassifier implements InboxClassifierProvider {
  constructor(private readonly options: LlmInboxClassifierOptions) {}

  describe(): AdapterDescriptor<InboxClassifierCapabilities> {
    return {
      id: "llm",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { offline: false, keyless: false },
    };
  }

  async classify(
    messages: InboxClassifierMessage[],
    { spaceId, userId, signal }: AdapterContext,
  ): Promise<InboxClassifyResult> {
    const { runtime, model, botId, onUsage } = this.options;
    const runId = `triage:${randomUUID()}`;
    const attribution: UsageAttribution = {
      spaceId,
      userId,
      ...(botId ? { botId } : {}),
      operationId: runId,
      operationKind: "triage",
    };
    let text = "";
    for await (const event of runtime.run(
      {
        botId: botId ?? "inbox-triage",
        threadId: runId,
        runId,
        usageOperationKind: "triage",
        onUsage: async (usage) => {
          await onUsage?.(usage, attribution);
        },
        prompt: buildTriagePrompt(messages),
        instructions: [formatCurrentTimeInstruction(), TRIAGE_INSTRUCTIONS].join("\n\n"),
        history: [],
        tools: [],
        model,
      },
      { operationId: runId, traceId: runId, spaceId, userId, signal },
    )) {
      if (event.type === "usage" && !event.accounted) await onUsage?.(event, attribution);
      if (event.type === "done" && event.text) text = event.text;
    }
    const items = parseTriageResponse(
      text,
      messages.map((m) => m.id),
    ).map((item) => ({ ...item, signals: [], confidence: 1 }));
    return { model: `${model.provider}/${model.id}`, items };
  }
}
