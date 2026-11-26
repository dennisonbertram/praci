import type { Message, ToolCall } from "@earendil-works/pi-ai";
import type { AgentRunModel } from "@rakazo/adapter-kit";

/** Internal, versioned transcript; never a client event payload. */
export interface TurnCheckpoint {
  version: 1;
  provider: string;
  model: string;
  systemPrompt: string;
  pendingToolCallId: string;
  messages: Message[];
  historyMessageIds?: string[];
  /** Executor-assigned occurrences include canonical arguments and the paused call. */
  effectOccurrences?: Array<{ executionId: string; fingerprint: string; occurrence: number }>;
  /** Only explicit sequential checkpoints guarantee an unstarted tail. */
  executionMode?: "parallel" | "sequential";
}

export function serializeTurnCheckpoint(checkpoint: TurnCheckpoint): string {
  return JSON.stringify(checkpoint);
}

export function restoreTurnCheckpoint(
  blob: string,
  model: Pick<AgentRunModel, "provider" | "id">,
): TurnCheckpoint {
  const checkpoint = JSON.parse(blob) as TurnCheckpoint;
  if (
    checkpoint.version !== 1 ||
    typeof checkpoint.systemPrompt !== "string" ||
    typeof checkpoint.provider !== "string" ||
    typeof checkpoint.model !== "string" ||
    typeof checkpoint.pendingToolCallId !== "string" ||
    !Array.isArray(checkpoint.messages)
  ) {
    throw new Error("Unsupported turn checkpoint");
  }
  const messages = [...checkpoint.messages];
  while (messages.at(-1)?.role === "assistant") {
    const tail = messages.at(-1)!;
    if (tail.role !== "assistant" || (tail.stopReason !== "aborted" && tail.stopReason !== "error"))
      break;
    messages.pop();
  }
  return {
    ...checkpoint,
    messages:
      checkpoint.provider === model.provider && checkpoint.model === model.id
        ? messages
        : withoutThinking(messages),
  };
}

/** Match results in transcript order: wire IDs may repeat in later responses. */
export function unresolvedTurnCheckpointCalls(messages: Message[]): ToolCall[] {
  const pending = new Map<string, ToolCall>();
  for (const message of messages) {
    if (message.role === "assistant") {
      for (const call of message.content) if (call.type === "toolCall") pending.set(call.id, call);
    } else if (message.role === "toolResult") {
      pending.delete(message.toolCallId);
    }
  }
  return [...pending.values()];
}

/** Thinking signatures only verify against the model that wrote them; another model gets none. */
function withoutThinking(messages: Message[]): Message[] {
  return messages.map((message) =>
    message.role === "assistant"
      ? { ...message, content: message.content.filter((block) => block.type !== "thinking") }
      : message,
  );
}
