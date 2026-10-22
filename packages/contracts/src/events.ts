import * as z from "zod";
import { botSecretDestinationSchema } from "./bot-secrets.js";
import { ChartDataSchema, ChartSpecSchema, refineChartRows } from "./chart.js";
import { Id } from "./ids.js";
import { MAX_COMPOSE_BODY } from "./inbox.js";
import { McpTransportSchema } from "./mcp.js";

export const ProductEventType = z.enum([
  "thread.message.created",
  "thread.cleared",
  "thread.message.updated",
  "thread.message.reaction",
  "thread.progress",
  "thread.artifact",
  "thread.ask",
  "thread.choice",
  "thread.meta",
  "thread.computer",
  "thread.subagent",
  "thread.cloud_agent",
  /** payload: { pending: string[] } messages of this thread whose delegate waits for approval */
  "thread.delegate_pending",
  "thread.call.ended",
  "run.started",
  "run.checkpointed",
  /** payload: RunPhase */
  "run.phase",
  "run.waiting_input",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "computer.status",
  "computer.takeover.requested",
  "computer.takeover.granted",
  "computer.takeover.released",
  "computer.command",
  "memory.revised",
  /** payload: { revision, updatedBy } */
  "page.updated",
  /** payload: { revision, updatedBy } */
  "pins.updated",
  "routine.created",
  "routine.updated",
  "routine.fired",
  "skill.teaching.started",
  "skill.teaching.stopped",
  "skill.draft.created",
  "skill.saved",
  "effect.recorded",
  "agent.tool.called",
  "agent.tool.completed",
  "effect.reconciled",
  "usage.recorded",
  "bot.spawned",
  "bot.updated",
  "bot.archived",
  "bot.deleted",
  "group.created",
  "group.updated",
  "group.handoff",
  /** Liveness only: never persisted, never applied to a snapshot, always seq 0. */
  "heartbeat",
]);
export type ProductEventType = z.infer<typeof ProductEventType>;

export const MessageRole = z.enum(["user", "bot", "system"]);
export const BotMessageIntent = z.enum(["request", "result", "question", "status", "fyi"]);
export type BotMessageIntent = z.infer<typeof BotMessageIntent>;

export { MAX_CHART_DATA_ROWS } from "./chart.js";

const ChartBlock = z
  .object({
    kind: z.literal("chart"),
    name: z.string(),
    /** Declarative Observable Plot spec, validated by render_plot before publish.
        z.any keeps the inferred type JSON-assignable for persistence. */
    spec: ChartSpecSchema,
    data: ChartDataSchema,
  })
  .superRefine(refineChartRows);

export const SecretAskPurpose = z.enum(["otp", "password", "api_key"]);
export type SecretAskPurpose = z.infer<typeof SecretAskPurpose>;

export const MAX_EMAIL_CARDS = 20;

/** How soon a cited message needs attention; the chat groups cards by it. */
export const EmailUrgency = z.enum(["today", "within_3_days", "this_week", "later"]);
export type EmailUrgency = z.infer<typeof EmailUrgency>;

/** A snapshot of one cached mail message; `id` is the CachedMailMessage id the Inbox opens. */
export const EmailCardSchema = z.object({
  id: Id,
  urgency: EmailUrgency,
  from: z.string(),
  subject: z.string(),
  snippet: z.string(),
  receivedAt: z.string(),
  /** Absent when the count could not be read. */
  attachments: z.number().int().nonnegative().optional(),
});
export type EmailCard = z.infer<typeof EmailCardSchema>;

const FinanceCents = z.number().int();
const FinanceCardRow = z.object({ key: z.string(), label: z.string(), cents: FinanceCents });

/** What a finance tool looked at, so the chat can show a preview. Rows are already trimmed to what the card shows. */
export const FinanceCardSchema = z.discriminatedUnion("card", [
  z.object({
    card: z.literal("overview"),
    cashCents: FinanceCents,
    burnCents: FinanceCents,
    /** Null when burn is zero or negative. */
    runwayMonths: z.number().nullable(),
    monthSpendCents: FinanceCents,
  }),
  z.object({
    card: z.literal("breakdown"),
    by: z.enum(["category", "vendor"]),
    /** Human range, e.g. "Last 90 days". */
    range: z.string(),
    totalCents: FinanceCents,
    rows: z.array(FinanceCardRow).max(5),
  }),
  z.object({
    card: z.literal("transactions"),
    /** The inclusive days the lookup asked for; absent when it was not limited. */
    from: z.string().optional(),
    to: z.string().optional(),
    count: z.number().int().nonnegative(),
    totalCents: FinanceCents,
    rows: z
      .array(
        z.object({
          id: Id,
          day: z.string(),
          label: z.string(),
          cents: FinanceCents,
        }),
      )
      .max(5),
  }),
  z.object({
    card: z.literal("recurring"),
    monthlyCents: FinanceCents,
    upcomingCents: FinanceCents,
    rows: z.array(FinanceCardRow).max(5),
  }),
]);
export type FinanceCard = z.infer<typeof FinanceCardSchema>;

/** The mail a mail_draft or mail_send approval would act on, for the inline approval card. */
export const MailApprovalSchema = z.object({
  tool: z.enum(["mail_draft", "mail_send"]),
  /** Connected account address, when the call named one. */
  account: z.string().optional(),
  to: z.array(z.string()),
  cc: z.array(z.string()),
  bcc: z.array(z.string()),
  subject: z.string(),
  body: z.string(),
  /** The message answers another one. */
  reply: z.boolean().optional(),
  /** Replaces a saved draft, which the card cannot edit; it can only be approved or discarded. */
  locked: z.boolean().optional(),
  /** Set after the person edited it and sent it themselves: how that ended. */
  outcome: z.enum(["sent", "saved", "unknown", "failed"]).optional(),
  /** With a failed outcome: the connection the composer should open on. */
  connectionId: z.string().optional(),
  /** With a failed outcome: why, in words the person can act on. */
  error: z.string().max(300).optional(),
});
export type MailApproval = z.infer<typeof MailApprovalSchema>;

/** What a person may change on a mail approval card. Recipients are comma-separated text. */
export const MailEditsSchema = z
  .object({
    /** The connected account to send from, by address; the server finds it among the caller's own. */
    account: z.string().max(320),
    to: z.string().max(4_000),
    cc: z.string().max(4_000),
    bcc: z.string().max(4_000),
    subject: z.string().max(998),
    body: z.string().max(MAX_COMPOSE_BODY),
  })
  .partial()
  .strict();
export type MailEdits = z.infer<typeof MailEditsSchema>;

/** The effect kind of a bot-to-bot message held for the owner before it reaches an external bot. */
export const BOT_SHARE_EFFECT_KIND = "bot_message_share";
/** Server-written replies to the external bot; never model text. */
export const BOT_SHARE_HELD_MESSAGE = "This needs the owner's approval before it can be shared.";
export const BOT_SHARE_DECLINED_MESSAGE = "That isn't available.";

export const MessageBlock = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({
    kind: z.literal("card"),
    lines: z.array(z.object({ k: z.string(), v: z.string() })),
  }),
  z.object({
    kind: z.literal("ask"),
    text: z.string(),
    approvalEffectId: Id.optional(),
    detail: z.string().optional(),
    /** Show `detail` behind a "Details" disclosure (raw tool arguments), not open on the card. */
    detailFolded: z.boolean().optional(),
    /** The service that must still approve a money request on its own side after the person allows it. */
    waitsFor: z.string().optional(),
    mail: MailApprovalSchema.optional(),
    /**
     * A held message from one bot to an external bot: Allow delivers exactly the text on the card,
     * once. It is answered without a waiting run.
     */
    share: z.boolean().optional(),
    /** An AI data sharing request: the card's Allow records consent for the disclosure `version`. */
    consent: z.object({ version: z.string() }).optional(),
    input: z.enum(["text", "secret"]).optional(),
    /** Why the secret is needed; drives field label on the masked card. */
    purpose: SecretAskPurpose.optional(),
    // Records what the runtime could produce under either deployment mode, so
    // an ask persisted before an owner toggles the private-HTTP flag still
    // validates on replay.
    credential: botSecretDestinationSchema({ allowPrivateHttpOrigin: true }).optional(),
    status: z.enum(["pending", "answered"]).optional(),
    answer: z.string().optional(),
    actions: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          outcome: z.enum(["created", "cancelled"]).optional(),
        }),
      )
      .optional(),
  }),
  z.object({
    kind: z.literal("choice"),
    question: z.string(),
    subtitle: z.string().optional(),
    options: z.array(z.object({ id: z.string(), letter: z.string(), label: z.string() })),
    /** Set once the user picks an option; renders the picker as answered. */
    answerId: z.string().optional(),
  }),
  z.object({
    /** Inline app authorization card (Composio-backed): logo, name, one-line
        description, and an Authorize button that flips to connected. */
    kind: z.literal("app_connect"),
    connectorId: z.string().optional(),
    provider: z.string(),
    name: z.string(),
    description: z.string(),
    logo: z.string().nullable(),
    status: z.enum(["pending", "connected"]),
  }),
  z.object({
    kind: z.literal("connect"),
    name: z.string(),
    initial: z.string(),
    color: z.string(),
    status: z.enum(["pending", "connected"]),
  }),
  z.object({
    kind: z.literal("computer"),
    state: z.string(),
    text: z.string(),
  }),
  z.object({
    /** Transcript card left in the thread when the bot hangs up a voice call. */
    kind: z.literal("voice_call"),
    /** Absent when the call had no client nonce to derive an id from. */
    callId: z.string().optional(),
    title: z.string(),
    farewell: z.string(),
  }),
  z.object({ kind: z.literal("meta"), text: z.string() }),
  z.object({
    kind: z.literal("progress"),
    text: z.string(),
    /** Provider-generated tool status rather than assistant-authored narration. */
    activity: z.literal(true).optional(),
    pendingToolNames: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal("steps"),
    steps: z.array(
      z.object({
        label: z.string(),
        count: z.number().int().positive(),
        /** One-line result of the call, such as "Searched mail · 23 found". */
        summary: z.string().optional(),
        /** What the tool did, in order. A failed line keeps its reason. */
        lines: z
          .array(z.object({ text: z.string(), failed: z.literal(true).optional() }))
          .optional(),
      }),
    ),
    durationMs: z.number().int().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal("subagent"),
    agentId: z.string(),
    name: z.string(),
    task: z.string(),
    status: z.enum(["running", "completed", "failed"]),
    progress: z.string().optional(),
    result: z.string().optional(),
  }),
  z.object({
    kind: z.literal("child_bot"),
    botId: z.string(),
    name: z.string(),
    title: z.string().optional(),
    status: z.enum(["created", "archived", "deleted"]),
  }),
  z.object({
    /** Compact card for a remote cloud coding agent (not the bot computer). */
    kind: z.literal("cloud_agent"),
    agentId: z.string(),
    title: z.string(),
    status: z.enum(["running", "finished", "failed", "cancelled"]),
    url: z.string(),
    branch: z.string().optional(),
    prUrl: z.string().optional(),
    latestRunId: z.string().optional(),
  }),
  z.object({
    kind: z.literal("skill_draft"),
    skillId: Id,
    name: z.string(),
    goal: z.string(),
    playbook: z.object({
      whenToUse: z.string(),
      inputs: z.array(z.string()),
      steps: z.array(z.string()),
      howToCheck: z.string(),
      whatToReturn: z.string(),
      approvalBoundaries: z.string(),
      failureHandling: z.string(),
    }),
    status: z.enum(["draft", "saved"]),
  }),
  ChartBlock,
  z.object({
    /** Approval card for an agent-created MCP server. The user completes the
        OAuth popup (or confirms no authorization is needed) in the UI. The
        status persists so the card renders its decision after a remount. */
    kind: z.literal("mcp_approval"),
    name: z.string(),
    serverId: Id,
    transport: McpTransportSchema,
    endpoint: z.string().nullable(),
    needsOAuth: z.boolean(),
    status: z.enum(["pending", "connected", "dismissed"]).default("pending"),
  }),
  z.object({
    /** Mail messages the bot cited, shown as cards grouped by urgency. */
    kind: z.literal("emails"),
    emails: z.array(EmailCardSchema).min(1).max(MAX_EMAIL_CARDS),
  }),
  z.object({
    /**
     * A mail conversation handed to an agent as context. The chat shows it as a collapsed card;
     * the model reads `messages` only after the owner has allowed AI data sharing for mail.
     */
    kind: z.literal("mail_thread"),
    subject: z.string(),
    messages: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          cc: z.string().optional(),
          date: z.string(),
          text: z.string(),
          attachments: z.array(z.string()).optional(),
        }),
      )
      .min(1),
  }),
  z.object({ kind: z.literal("finance"), card: FinanceCardSchema }),
  z.object({
    kind: z.literal("image"),
    artifactId: Id,
    mimeType: z.string(),
    name: z.string(),
    /** Set by show_image: text for screen readers and the failed-load state. */
    alt: z.string().max(500).optional(),
    caption: z.string().max(500).optional(),
  }),
  z.object({
    kind: z.literal("file"),
    artifactId: Id,
    mimeType: z.string(),
    name: z.string(),
    size: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("handoff"),
    fromBotId: Id,
    toBotId: Id,
    text: z.string(),
    /** Links ownership transfers in one user-started group turn. */
    hop: z.number().int().positive().optional(),
  }),
  z.object({
    /** A group-chat message delivered into a member bot's own thread. */
    kind: z.literal("channel_message"),
    provider: z.string(),
    /** Per-message network when a provider spans multiple transports. */
    transport: z.string().optional(),
    channelId: Id,
    fromAddress: z.string(),
    fromLabel: z.string(),
    text: z.string(),
    hop: z.number().int().nonnegative().optional(),
  }),
  z.object({
    /** Shown in the sending bot's own chat, so the user can see what it sent. */
    kind: z.literal("bot_message_sent"),
    toBotId: Id,
    toBotName: z.string(),
    text: z.string(),
    intent: BotMessageIntent.optional(),
  }),
  z.object({
    /** Delivered into the receiving bot's own chat as the prompt that woke it. */
    kind: z.literal("bot_message_received"),
    fromBotId: Id,
    fromBotName: z.string(),
    text: z.string(),
    intent: BotMessageIntent.optional(),
    /** Sender-thread echo this delivery answers, when applicable. */
    returnToMessageId: Id.optional(),
    /** Links in a bot-started chain; absent when a person started it. */
    hop: z.number().int().nonnegative().optional(),
    /** The chain began in a background run: every bot in it may message only owner agents. */
    backgroundOrigin: z.boolean().optional(),
    /** Every hop of the chain began with the bot owner in a direct chat. Absent means unknown, so not trusted. */
    ownerOrigin: z.boolean().optional(),
    /**
     * The chain began with an external bot (or another Space's agent). Set by the server from the
     * sender's stored audience or the incoming chain, only ever added along a chain, never from message text.
     */
    externalOrigin: z.boolean().optional(),
    /** Name of the bot that started an external chain, from stored data, for the notice. */
    externalOriginName: z.string().max(200).optional(),
  }),
]);
export type MessageBlock = z.infer<typeof MessageBlock>;

/**
 * Something the bot did on its computer, shown in the terminal's Activity view: a shell
 * command (with a redacted output tail) or a file/app action, whose `command` is the path or
 * app name.
 */
export const COMPUTER_COMMAND_OUTPUT_MAX_CHARS = 16_000;
export const ComputerCommandKind = z.enum([
  "shell",
  "write_file",
  "attach_file",
  "open_path",
  "launch_app",
]);
export type ComputerCommandKind = z.infer<typeof ComputerCommandKind>;
export const ComputerCommandSchema = z.object({
  executionId: z.string(),
  kind: ComputerCommandKind,
  command: z.string(),
  cwd: z.string(),
  status: z.enum(["running", "done"]),
  exitCode: z.number().int().nullable(),
  output: z.string(),
  /** Size written by write_file. */
  bytes: z.number().int().nonnegative().optional(),
});
export type ComputerCommand = z.infer<typeof ComputerCommandSchema>;

/**
 * Collapse running/done events into one entry per command, in start order. A finished
 * command stays finished, so history and live events can be merged in either order.
 */
export function foldComputerCommands<T extends ComputerCommand>(events: T[]): T[] {
  const byId = new Map<string, T>();
  for (const event of events) {
    if (byId.get(event.executionId)?.status === "done" && event.status === "running") continue;
    byId.set(event.executionId, event);
  }
  return [...byId.values()];
}

export const ProductEventSchema = z.object({
  id: Id,
  spaceId: Id,
  threadId: Id,
  botId: Id,
  seq: z.number().int().nonnegative(),
  type: ProductEventType,
  runId: Id.optional(),
  createdAt: z.string(),
  payload: z.record(z.string(), z.unknown()),
});
export type ProductEvent = z.infer<typeof ProductEventSchema>;

export const ReplyPreviewSchema = z.object({
  role: MessageRole,
  botId: Id.optional(),
  text: z.string(),
  attachment: z
    .object({
      kind: z.enum(["image", "file"]),
      artifactId: Id,
      mimeType: z.string(),
      name: z.string(),
    })
    .optional(),
});
export type ReplyPreview = z.infer<typeof ReplyPreviewSchema>;

export const ThreadMessageSchema = z.object({
  id: Id,
  threadId: Id,
  seq: z.number().int().nonnegative(),
  role: MessageRole,
  blocks: z.array(MessageBlock),
  botId: Id.optional(),
  replyToMessageId: Id.optional(),
  replyQuote: z.string().optional(),
  replyPreview: ReplyPreviewSchema.nullable().optional(),
  runId: Id.optional(),
  /** Set when the message was sent from a live voice call; groups one call's transcript. */
  callId: z.string().optional(),
  createdAt: z.string(),
});
export type ThreadMessage = z.infer<typeof ThreadMessageSchema>;

export function canReactToThreadMessage(message: Pick<ThreadMessage, "id" | "blocks">): boolean {
  return (
    !message.id.startsWith("progress:") &&
    !message.id.startsWith("subagent:") &&
    !message.blocks.some((block) => block.kind === "channel_message")
  );
}
