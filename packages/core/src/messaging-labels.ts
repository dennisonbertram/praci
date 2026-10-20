import type { MessageBlock } from "@rakazo/contracts";

const PROVIDER_LABELS: Record<string, string> = {
  sendblue: "iMessage",
  bluebubbles: "iMessage",
  photon: "iMessage",
  slack: "Slack",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  lark: "Feishu",
};

/** User-facing name of a messaging provider (falls back to the raw id). */
export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/** Per-message provider label, narrowed to a recognized transport when available. */
export function messageProviderLabel(provider: string, transport?: string): string {
  if (provider === "sendblue" && ["iMessage", "SMS", "RCS"].includes(transport ?? "")) {
    return transport!;
  }
  return providerLabel(provider);
}

/** One channel message as plain text: "Slack · Ada: hello". */
export function channelMessageLine(block: {
  provider: string;
  transport?: string;
  fromLabel: string;
  text: string;
}): string {
  return `${messageProviderLabel(block.provider, block.transport)} · ${block.fromLabel}: ${block.text}`;
}

/** The message's text exactly as written (text, ask, progress, channel messages), for selection. */
export function selectableMessageText(message: { blocks: readonly MessageBlock[] }): string {
  return message.blocks
    .map((block) => {
      if (block.kind === "channel_message") return channelMessageLine(block);
      if (block.kind === "text" || block.kind === "progress" || block.kind === "ask") {
        return block.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
