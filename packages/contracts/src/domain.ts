import * as z from "zod";
import { AGENT_SECRET_NAME_PATTERN } from "./agent-secret-name.js";
import { BotAppControlSchema, UpdateBotAppControlSchema } from "./app-control.js";
import { BotAvatarValueSchema } from "./bot-avatar.js";
import { commandVariableProblem } from "./bot-secrets.js";
import { DisabledBuiltinToolsSchema } from "./builtin-tools.js";
import {
  CLOUDFLARE_AI_GATEWAY_CONFIG_MESSAGE,
  cloudflareGatewayRoutingId,
  isCloudflareAiGatewayProvider,
} from "./cloudflare-ai-gateway.js";
import { ThreadMessageSchema } from "./events.js";
import { Id, MemoryScope, RunStatus, SandboxKind } from "./ids.js";
import { McpHeadersSchema, McpRemoteEndpointSchema, McpTransportSchema } from "./mcp.js";
import { MeetingRecordingPolicySchema } from "./meetings.js";
import {
  PageWatchSpecSchema,
  RoutineManagedKindSchema,
  RoutineStatusSchema,
  WatchSpecSchema,
} from "./routines.js";
import { RunTriggerSchema } from "./runs.js";

export const ComputerModeSchema = z.enum(["team", "dedicated"]);
/** Where commands run: the sandbox, or the host computer. */
export const ComputerHostSchema = z.enum(["docker", "this-mac"]);
export type ComputerMode = z.infer<typeof ComputerModeSchema>;
export type ComputerHost = z.infer<typeof ComputerHostSchema>;

export const MemoryScopeSchema = z.enum(["isolated", "shared"]);
export type MemoryScopeValue = z.infer<typeof MemoryScopeSchema>;

export const AvatarStyleSchema = z.enum(["robot", "organic"]);

/** True for an IANA timezone this runtime can format in, such as "Pacific/Auckland". */
export function isValidTimeZone(value: string): boolean {
  // Intl also accepts fixed offsets, which are not IANA timezone names.
  if (/^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const TimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, { message: "Unknown timezone" });
export type AvatarStyle = z.infer<typeof AvatarStyleSchema>;
export const DEFAULT_AVATAR_STYLE: AvatarStyle = "organic";

export const ThinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;

export { AGENT_SECRET_NAME_PATTERN };

export const AgentSecretSchema = z.object({
  id: Id,
  name: z.string().regex(AGENT_SECRET_NAME_PATTERN),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentSecret = z.infer<typeof AgentSecretSchema>;

export const AgentSecretInputSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(AGENT_SECRET_NAME_PATTERN)
    .refine((n) => commandVariableProblem(n) === undefined, {
      message: "Reserved environment variable name",
    }),
  value: z
    .string()
    .min(1)
    .max(16_384)
    .refine((v) => !v.includes("\0"), { message: "Value cannot contain a NUL character" }),
});
export type AgentSecretInput = z.infer<typeof AgentSecretInputSchema>;

/**
 * What a live run is waiting on before its tools and text take over. `name` is the service
 * (connecting), the model (model_wait) or the reason (retrying). `since` and `count` belong to a
 * requeue streak: when it began and how many requeues it has had.
 */
export const RunPhaseSchema = z.object({
  kind: z.enum([
    "computer_wait",
    "computer_start",
    "connecting",
    "model_wait",
    "thinking",
    "retrying",
  ]),
  name: z.string().optional(),
  at: z.string(),
  since: z.string().optional(),
  count: z.number().int().positive().optional(),
});
export type RunPhase = z.infer<typeof RunPhaseSchema>;

/** Internal bots serve the owner; external bots talk to people outside the company. */
/** How much the owner is asked before an agent acts. Stored per space and user, overridable per agent. */
export const PermissionLevelSchema = z.enum(["open", "ask_changes", "ask_everything"]);
export type PermissionLevel = z.infer<typeof PermissionLevelSchema>;

export const PermissionSettingsSchema = z.object({
  /** The owner's stored choice; null follows the deployment default. */
  level: PermissionLevelSchema.nullable(),
  effectiveDefault: PermissionLevelSchema,
});
export type PermissionSettings = z.infer<typeof PermissionSettingsSchema>;

export const BotAudienceSchema = z.enum(["internal", "external"]);
export type BotAudience = z.infer<typeof BotAudienceSchema>;

/** How far an agent goes beyond the request. Only the owner's settings set it; it never changes approvals. */
export const BotProactivitySchema = z.enum(["low", "medium", "high"]);
export type BotProactivity = z.infer<typeof BotProactivitySchema>;

/** Only a bot the owner made can be external; page and integration agents hold private data by design. */
/** A page the person asked for by hand: the server picks this key, so a client cannot claim it. */
export const customPageSpawnKey = (id: string) => `custom-page:${id}`;

export const isCustomPageSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(customPageSpawnKey("")));

/** What the web sends as the instructions of a new page agent; the server compares against it for upgrades. */
export const NEW_PAGE_INSTRUCTIONS =
  "You build and keep this page. Ask the user what the page should show, then name yourself after the page with update_bot and write it with page_write: lead with what matters, use charts and tables where they help, and keep it current when asked. Keep chat replies short and put the substance on the page.";

export const botAudienceEditable = (spawnKey: string | null | undefined) => !spawnKey;

export const BotSchema = z.object({
  id: Id,
  spaceId: Id,
  name: z.string(),
  title: z.string(),
  description: z.string(),
  instructions: z.string(),
  color: z.string(),
  notifyOnFinish: z.boolean(),
  pinned: z.boolean(),
  sectionId: Id.nullable(),
  /** Order within its folder; bots and groups share one scale. Null: not ordered by hand yet. */
  position: z.number().int().nullable().optional(),
  archivedAt: z.string().nullable(),
  /** Left out of the sidebar chat list by the person; the bot keeps working. */
  hiddenAt: z.string().nullable().optional(),
  unread: z.boolean(),
  parentBotId: Id.nullable(),
  memoryScope: MemoryScopeSchema.nullable(),
  threadId: Id,
  preview: z.string(),
  status: z.string(),
  /** The active run's phase, for the sidebar's status line. */
  runPhase: RunPhaseSchema.nullable().default(null),
  runErrorId: Id.nullable().default(null),
  computerMode: ComputerModeSchema,
  /** Null follows the deployment default. */
  runsOn: ComputerHostSchema.nullable().optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
  voiceId: z.string().nullable(),
  autoSpeak: z.boolean(),
  modelProvider: z.string().nullable(),
  modelId: z.string().nullable(),
  /** The model connection this bot runs on; null follows the space default. */
  modelCredentialId: Id.nullable().optional(),
  thinkingLevel: ThinkingLevelSchema.nullable(),
  teamChatAmbientEnabled: z.boolean(),
  teamChatRules: z.string(),
  crossSpaceCommunication: z.boolean().optional(),
  /** Local desktop control; only the deployment owner can change it. */
  appControl: BotAppControlSchema.optional(),
  disabledBuiltinTools: z.array(z.string()).default([]),
  audience: BotAudienceSchema.default("internal"),
  /** Agent firewall: everything the agent reads is untrusted. Only the owner's settings set it. */
  firewall: z.boolean().default(false),
  /** Overrides the space permission level; null follows the space. Only the owner's settings set it. */
  permissionLevel: PermissionLevelSchema.nullable().optional(),
  /** Capabilities a firewalled agent may ask to use (each use still asks). Owner-only. */
  firewallAskCapabilities: z.array(z.string()).default([]),
  proactivity: BotProactivitySchema.default("medium"),
  /** An external bot may message only these internal bots. */
  externalMessageTargets: z.array(Id).default([]),
  /** An external bot has the browser and computer tools only when this is on. */
  externalComputerTools: z.boolean().default(false),
  webhookConfigured: z.boolean(),
  /** Present when created with an idempotency key (e.g. onboarding:first). */
  spawnKey: z.string().nullable(),
});
export type Bot = z.infer<typeof BotSchema>;

export const ReorderBotsInput = z.object({
  botIds: z
    .array(Id)
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, { error: "botIds must be distinct" }),
});
export type ReorderBotsInput = z.infer<typeof ReorderBotsInput>;

export const GroupMemberSchema = z.object({
  botId: Id,
  name: z.string(),
  color: z.string(),
  status: z.string().optional(),
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

/** Selected-text excerpt carried by a reply; capped so a quote stays a quote. */
export const REPLY_QUOTE_MAX_LENGTH = 2_000;
/** Longest message text a person can send; bigger pastes belong in a file. */
export const THREAD_MESSAGE_MAX_LENGTH = 100_000;

/** Cap an excerpt at the quote limit without splitting a surrogate pair. */
export function truncateReplyQuote(value: string): string {
  const truncated = value.slice(0, REPLY_QUOTE_MAX_LENGTH);
  const last = truncated.charCodeAt(truncated.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? truncated.slice(0, -1) : truncated;
}

export const GROUP_MEMBER_MIN = 2;
export const GROUP_MEMBER_MAX = 6;
export const GROUP_NAME_MAX = 80;

export const GroupSchema = z.object({
  id: Id,
  spaceId: Id,
  name: z.string(),
  pinned: z.boolean(),
  sectionId: Id.nullable(),
  position: z.number().int().nullable().optional(),
  archivedAt: z.string().nullable(),
  members: z.array(GroupMemberSchema),
  threadId: Id,
  preview: z.string(),
  unread: z.boolean(),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type Group = z.infer<typeof GroupSchema>;

const GroupBotIds = z
  .array(Id)
  .min(GROUP_MEMBER_MIN)
  .max(GROUP_MEMBER_MAX)
  .refine((ids) => new Set(ids).size === ids.length, { error: "botIds must be distinct" });

export const CreateGroupInput = z.object({
  name: z.string().trim().min(1).max(GROUP_NAME_MAX),
  botIds: GroupBotIds,
});
export type CreateGroupInput = z.infer<typeof CreateGroupInput>;

export const UpdateGroupInput = z.object({
  groupId: Id,
  name: z.string().trim().min(1).max(GROUP_NAME_MAX).optional(),
  botIds: GroupBotIds.optional(),
  pinned: z.boolean().optional(),
  sectionId: Id.nullable().optional(),
});
export type UpdateGroupInput = z.infer<typeof UpdateGroupInput>;

export const GroupDetailSchema = GroupSchema.extend({
  messages: z.array(ThreadMessageSchema).optional(),
});
export type GroupDetail = z.infer<typeof GroupDetailSchema>;

export const BotSectionSchema = z.object({
  id: Id,
  name: z.string(),
  position: z.number().int().nonnegative(),
  collapsed: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BotSection = z.infer<typeof BotSectionSchema>;

/**
 * A space is a real privacy boundary, not just sidebar organization.
 * Bots are included so clients can keep every space visible without granting
 * those bots access to the currently active space.
 */
export const SpaceBotSchema = BotSchema.pick({
  id: true,
  spaceId: true,
  name: true,
  title: true,
  color: true,
  notifyOnFinish: true,
  pinned: true,
  hiddenAt: true,
  sectionId: true,
  position: true,
  unread: true,
  parentBotId: true,
  spawnKey: true,
  preview: true,
  status: true,
  runPhase: true,
  runErrorId: true,
  updatedAt: true,
});
export type SpaceBot = z.infer<typeof SpaceBotSchema>;

export const SpaceGroupSchema = GroupSchema.pick({
  id: true,
  spaceId: true,
  name: true,
  pinned: true,
  sectionId: true,
  position: true,
  members: true,
  preview: true,
  unread: true,
  updatedAt: true,
});
export type SpaceGroup = z.infer<typeof SpaceGroupSchema>;

export const TEAM_CHAT_RULES_MAX_LENGTH = 4000;
export const AutomatedSenderPolicyModeSchema = z.enum(["ignore", "rollup", "action", "user"]);
export type AutomatedSenderPolicyMode = z.infer<typeof AutomatedSenderPolicyModeSchema>;

export const AutomatedSenderPolicySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    mode: AutomatedSenderPolicyModeSchema,
    rollupHours: z.number().int().min(1).max(720).optional(),
  })
  .superRefine((policy, ctx) => {
    if (policy.mode === "rollup" && policy.rollupHours === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Rollup policies require a frequency",
        path: ["rollupHours"],
      });
    }
  });
export type AutomatedSenderPolicy = z.infer<typeof AutomatedSenderPolicySchema>;

export const AutomatedSenderPoliciesSchema = z
  .record(z.string().trim().min(1).max(200), AutomatedSenderPolicySchema)
  .refine((policies) => Object.keys(policies).length <= 50, {
    message: "At most 50 automated sender policies are allowed",
  });
export type AutomatedSenderPolicies = z.infer<typeof AutomatedSenderPoliciesSchema>;

export const AutomatedSenderSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
});
export type AutomatedSender = z.infer<typeof AutomatedSenderSchema>;

export const ExternalConversationPolicySchema = z.object({
  teamChatAmbientEnabled: z.boolean().nullable(),
  teamChatRules: z.string().max(TEAM_CHAT_RULES_MAX_LENGTH).nullable(),
  automatedSenderPolicies: AutomatedSenderPoliciesSchema,
});
export type ExternalConversationPolicy = z.infer<typeof ExternalConversationPolicySchema>;

export const UpdateExternalConversationPolicyInput = ExternalConversationPolicySchema.extend({
  externalConversationId: Id,
});
export type UpdateExternalConversationPolicyInput = z.infer<
  typeof UpdateExternalConversationPolicyInput
>;

export const ExternalConversationSchema = z.object({
  id: Id,
  spaceId: Id,
  botId: Id,
  provider: z.string(),
  displayName: z.string().nullable(),
  participantNames: z.array(z.string()),
  teamChatAmbientEnabled: z.boolean().nullable(),
  teamChatRules: z.string().nullable(),
  automatedSenderPolicies: AutomatedSenderPoliciesSchema,
  automatedSenders: z.array(AutomatedSenderSchema),
  threadId: Id,
  preview: z.string(),
  unread: z.boolean(),
  updatedAt: z.string(),
});
export type ExternalConversation = z.infer<typeof ExternalConversationSchema>;

export const SpaceSchema = z.object({
  id: Id,
  name: z.string(),
  isDefault: z.boolean(),
  /** True when the space has any bot or group, including archived. */
  hasContent: z.boolean(),
  /** True only when the current member owns the space and may rename it. */
  canRename: z.boolean().optional(),
  /** True only when the current member may delete this non-default space. */
  canDelete: z.boolean().optional(),
  /** Members of the space, so the sidebar can drop the heading of a space that is only the caller's. */
  memberCount: z.number().int().positive().optional(),
  /** Whether meetings may be recorded in this space. */
  meetingRecording: MeetingRecordingPolicySchema.optional(),
  /** True only when the current member is an owner or admin and may change `meetingRecording`. */
  canSetMeetingRecording: z.boolean().optional(),
  bots: z.array(SpaceBotSchema),
  groups: z.array(SpaceGroupSchema),
  externalConversations: z.array(ExternalConversationSchema),
  botSections: z.array(BotSectionSchema),
});
export type Space = z.infer<typeof SpaceSchema>;

export const SpaceNavigationSchema = z.object({
  current: z.object({
    id: Id,
    name: z.string(),
    bots: z.array(BotSchema),
    groups: z.array(GroupSchema),
    externalConversations: z.array(ExternalConversationSchema),
    botSections: z.array(BotSectionSchema),
  }),
  spaces: z.array(SpaceSchema),
});
export type SpaceNavigation = z.infer<typeof SpaceNavigationSchema>;

export const BOT_NAME_MAX_LENGTH = 80;
export const BOT_TITLE_MAX_LENGTH = 500;
export const BOT_DESCRIPTION_MAX_LENGTH = 4000;
export const BOT_INSTRUCTIONS_MAX_LENGTH = 20000;

export const CreateBotInput = z.object({
  name: z.string().trim().min(1).max(BOT_NAME_MAX_LENGTH),
  title: z.string().max(BOT_TITLE_MAX_LENGTH).default(""),
  description: z.string().max(BOT_DESCRIPTION_MAX_LENGTH).default(""),
  instructions: z.string().max(BOT_INSTRUCTIONS_MAX_LENGTH).default(""),
  notifyOnFinish: z.boolean().default(true),
  color: BotAvatarValueSchema.optional(),
  computerMode: ComputerModeSchema.default("team"),
  /** Idempotency key within a space (unique with spaceId). */
  spawnKey: z.string().trim().min(1).max(120).optional(),
  /** Makes a page agent: the server gives it a reserved custom-page key. */
  page: z.boolean().optional(),
});
export type CreateBotInput = z.infer<typeof CreateBotInput>;

export function normalizeCreateBotProfile(
  input: Pick<CreateBotInput, "name" | "title" | "description">,
) {
  const description = input.description.trim();
  return {
    name: input.name.trim().slice(0, BOT_NAME_MAX_LENGTH),
    title: input.title.trim().slice(0, BOT_TITLE_MAX_LENGTH),
    description: description.slice(0, BOT_DESCRIPTION_MAX_LENGTH),
    instructions: description.slice(0, BOT_INSTRUCTIONS_MAX_LENGTH),
  };
}

export const UpdateBotInput = z
  .object({
    botId: Id,
    name: z.string().trim().min(1).max(BOT_NAME_MAX_LENGTH).optional(),
    title: z.string().trim().max(BOT_TITLE_MAX_LENGTH).optional(),
    description: z.string().trim().max(BOT_DESCRIPTION_MAX_LENGTH).optional(),
    instructions: z.string().trim().max(BOT_INSTRUCTIONS_MAX_LENGTH).optional(),
    notifyOnFinish: z.boolean().optional(),
    color: BotAvatarValueSchema.optional(),
    pinned: z.boolean().optional(),
    /** Leaves the bot out of the sidebar chat list (or puts it back). */
    hidden: z.boolean().optional(),
    memoryScope: MemoryScopeSchema.nullable().optional(),
    sectionId: Id.nullable().optional(),
    voiceId: z.string().max(120).nullable().optional(),
    autoSpeak: z.boolean().optional(),
    modelProvider: z.string().trim().min(1).max(80).nullable().optional(),
    modelId: z.string().trim().min(1).max(200).nullable().optional(),
    /** Pins the bot to one of the caller's own model connections; null follows the space default. */
    modelCredentialId: Id.nullable().optional(),
    thinkingLevel: ThinkingLevelSchema.nullable().optional(),
    teamChatAmbientEnabled: z.boolean().optional(),
    teamChatRules: z.string().max(TEAM_CHAT_RULES_MAX_LENGTH).optional(),
    crossSpaceCommunication: z.boolean().optional(),
    appControl: UpdateBotAppControlSchema.optional(),
    disabledBuiltinTools: DisabledBuiltinToolsSchema.optional(),
    audience: BotAudienceSchema.optional(),
    firewall: z.boolean().optional(),
    permissionLevel: PermissionLevelSchema.nullable().optional(),
    firewallAskCapabilities: z.array(z.string().max(64)).max(20).optional(),
    proactivity: BotProactivitySchema.optional(),
    externalMessageTargets: z.array(Id).max(200).optional(),
    externalComputerTools: z.boolean().optional(),
    runsOn: ComputerHostSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const providerProvided = value.modelProvider !== undefined;
    const modelProvided = value.modelId !== undefined;
    if (!providerProvided && !modelProvided) return;
    // Reject partial shapes like `{ modelId: null }` (provider omitted) so a
    // clear cannot succeed without updating both persisted fields.
    if (providerProvided !== modelProvided) {
      ctx.addIssue({
        code: "custom",
        message: "Model provider and model id must both be set or both cleared",
        path: ["modelId"],
      });
      return;
    }
    const bothNull = value.modelProvider === null && value.modelId === null;
    const bothSet = Boolean(value.modelProvider) && Boolean(value.modelId);
    if (!bothNull && !bothSet) {
      ctx.addIssue({
        code: "custom",
        message: "Model provider and model id must both be set or both cleared",
        path: ["modelId"],
      });
    }
  });

/**
 * A routine's model is optional, but provider and id only mean something together,
 * and a thinking level belongs to a model this routine actually names.
 */
export function routineModelIssues(
  value: {
    modelProvider?: string | null;
    modelId?: string | null;
    thinkingLevel?: string | null;
  },
  ctx: { addIssue: (issue: { code: "custom"; message: string; path: string[] }) => void },
) {
  const providerProvided = value.modelProvider !== undefined && value.modelProvider !== null;
  const modelProvided = value.modelId !== undefined && value.modelId !== null;
  if (providerProvided !== modelProvided) {
    ctx.addIssue({
      code: "custom",
      message: "Model provider and model id must both be set or both cleared",
      path: ["modelId"],
    });
    return;
  }
  if (value.thinkingLevel && !providerProvided) {
    ctx.addIssue({
      code: "custom",
      message: "Pick a model for this routine first",
      path: ["thinkingLevel"],
    });
  }
}

export const RoutineSchema = z.object({
  id: Id,
  botId: Id,
  name: z.string(),
  prompt: z.string(),
  crons: z.array(z.string()),
  timezone: z.string(),
  active: z.boolean(),
  notify: z.boolean(),
  webhookEnabled: z.boolean(),
  githubEnabled: z.boolean(),
  messageProvider: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9._-]+$/i)
    .nullable(),
  /** Null runs this routine on its bot's model. */
  modelProvider: z.string().nullable(),
  modelId: z.string().nullable(),
  /** The owner's connection this routine's own model runs on; null uses the bot's pin or the default. */
  modelCredentialId: Id.nullable().optional(),
  thinkingLevel: ThinkingLevelSchema.nullable(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  /** Only message the user when something needs them; the server adds the silent-reply guidance. */
  quiet: z.boolean(),
  watch: WatchSpecSchema.nullable(),
  /** "check_in" for a bot's managed check-in routine (editable only via Active). */
  managedKind: RoutineManagedKindSchema.nullable(),
  /** The taught skill this routine runs (its current playbook), or null. */
  taughtSkill: z.object({ id: Id, name: z.string() }).nullable().optional(),
  status: RoutineStatusSchema,
  createdAt: z.string(),
});
export type Routine = z.infer<typeof RoutineSchema>;

export const CreateRoutineInput = z
  .object({
    botId: Id,
    name: z.string().min(1).max(80),
    /** Required unless `taughtSkillId` is set; then the skill's current playbook is the prompt. */
    prompt: z.string().default(""),
    /** A saved taught skill on this bot. */
    taughtSkillId: Id.nullable().default(null),
    crons: z.array(z.string().min(1)).default([]),
    /** Defaults to the user's stored time zone, then UTC. */
    timezone: TimeZoneSchema.optional(),
    notify: z.boolean().default(true),
    active: z.boolean().default(false),
    webhookEnabled: z.boolean().default(false),
    githubEnabled: z.boolean().default(false),
    messageProvider: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9._-]+$/i)
      .nullable()
      .default(null),
    modelProvider: z.string().trim().min(1).max(80).nullable().default(null),
    modelId: z.string().trim().min(1).max(200).nullable().default(null),
    modelCredentialId: Id.nullable().default(null),
    thinkingLevel: ThinkingLevelSchema.nullable().default(null),
    /** Defaults to on for a watch and off otherwise. */
    quiet: z.boolean().optional(),
    watch: PageWatchSpecSchema.nullable().default(null),
  })
  .superRefine((value, ctx) => {
    routineModelIssues(value, ctx);
    if (!value.taughtSkillId && !value.prompt.trim()) {
      ctx.addIssue({ code: "custom", message: "Add an instruction", path: ["prompt"] });
    }
    if (
      value.crons.length === 0 &&
      !value.watch &&
      !value.webhookEnabled &&
      !value.githubEnabled &&
      !value.messageProvider
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Add a schedule, webhook, GitHub, or message trigger",
        path: ["crons"],
      });
    }
  });

export const ScratchpadItemStatusSchema = z.enum(["open", "parked", "done"]);
export type ScratchpadItemStatus = z.infer<typeof ScratchpadItemStatusSchema>;

export const ScratchpadCategorySchema = z.enum([
  "goal",
  "research",
  "draft",
  "public_post",
  "create_account",
  "outbound_email",
]);
export type ScratchpadCategory = z.infer<typeof ScratchpadCategorySchema>;

export const ScratchpadChannelSchema = z.enum([
  "x",
  "linkedin",
  "threads",
  "bluesky",
  "reddit",
  "hn",
  "producthunt",
  "directory",
  "email",
]);
export type ScratchpadChannel = z.infer<typeof ScratchpadChannelSchema>;

export const ScratchpadDateTimeSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid ISO datetime");

export const ScratchpadItemSchema = z.object({
  id: Id,
  botId: Id,
  title: z.string(),
  status: ScratchpadItemStatusSchema,
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  category: ScratchpadCategorySchema.nullish(),
  channel: ScratchpadChannelSchema.nullish(),
  target: z.string().max(200).nullish(),
  scheduledFor: ScratchpadDateTimeSchema.nullish(),
  proof: z.string().max(2_000).nullish(),
  approvedAt: ScratchpadDateTimeSchema.nullish(),
  approvedBy: z.enum(["user", "policy"]).nullish(),
  dueAt: ScratchpadDateTimeSchema.nullish(),
  waitingOn: z.string().max(200).nullish(),
  resolvedReason: z.string().max(500).nullish(),
  /** The provider message id of the mail thread this item tracks; mail_get takes it. */
  mailMessageId: z.string().nullish(),
});
export type ScratchpadItem = z.infer<typeof ScratchpadItemSchema>;

/** An open item, across the user's bots, that waits on the user or is past due. */
export const WaitingOnYouItemSchema = z.object({
  id: Id,
  botId: Id,
  botName: z.string(),
  title: z.string(),
  waitingOn: z.string().nullable(),
  dueAt: ScratchpadDateTimeSchema.nullable(),
});
export type WaitingOnYouItem = z.infer<typeof WaitingOnYouItemSchema>;

export const CreateScratchpadItemInput = z.object({
  botId: Id,
  title: z.string().min(1).max(200),
  status: ScratchpadItemStatusSchema.optional(),
  notes: z.string().max(4_000).default(""),
  category: ScratchpadCategorySchema.optional(),
  channel: ScratchpadChannelSchema.optional(),
  target: z.string().max(200).optional(),
  scheduledFor: ScratchpadDateTimeSchema.optional(),
  dueAt: ScratchpadDateTimeSchema.optional(),
  waitingOn: z.string().max(200).optional(),
});

export const TaughtSkillStatusSchema = z.enum(["recording", "drafting", "draft", "saved"]);
export type TaughtSkillStatus = z.infer<typeof TaughtSkillStatusSchema>;

export const SkillPlaybookSchema = z.object({
  whenToUse: z.string(),
  inputs: z.array(z.string()),
  steps: z.array(z.string()),
  howToCheck: z.string(),
  whatToReturn: z.string(),
  approvalBoundaries: z.string(),
  failureHandling: z.string(),
});
export type SkillPlaybook = z.infer<typeof SkillPlaybookSchema>;

export const TeachRecordingEventSchema = z.object({
  at: z.string(),
  kind: z.enum(["pointer", "key", "clipboard", "snapshot", "scroll", "window", "file", "command"]),
  x: z.number().optional(),
  y: z.number().optional(),
  button: z.string().optional(),
  type: z.string().optional(),
  key: z.string().optional(),
  text: z.string().optional(),
  summary: z.string().optional(),
  sensitive: z.boolean().optional(),
  /** Label of the field the input went to (for example "Password"); names a protected step. */
  field: z.string().max(120).optional(),
  /** Which protected value this event belongs to; the server sets it. */
  segment: z.number().int().optional(),
  /** window: the window title and the app it belongs to. */
  title: z.string().max(300).optional(),
  app: z.string().max(120).optional(),
  /** file: the path that was written, never its content. */
  path: z.string().max(500).optional(),
  /** command: the command line, with secrets removed. */
  command: z.string().max(1000).optional(),
});
export type TeachRecordingEvent = z.infer<typeof TeachRecordingEventSchema>;

export const TeachSnapshotSchema = z.object({
  at: z.string(),
  summary: z.string(),
  hash: z.string().optional(),
});
export type TeachSnapshot = z.infer<typeof TeachSnapshotSchema>;

export const TeachRecordingSchema = z.object({
  events: z.array(TeachRecordingEventSchema),
  snapshots: z.array(TeachSnapshotSchema),
  controlLeaseId: z.string().optional(),
});
export type TeachRecording = z.infer<typeof TeachRecordingSchema>;

export const TeachTestOutcomeSchema = z.enum(["worked", "stopped"]);
export type TeachTestOutcome = z.infer<typeof TeachTestOutcomeSchema>;

/** A password the user typed while teaching. Until they save or skip it, the server holds the value. */
export const TeachLoginPromptSchema = z.object({
  stepIndex: z.number().int().min(0),
  field: z.string(),
  /** The username typed just before the password, offered for the user to confirm. */
  username: z.string().optional(),
});
export type TeachLoginPrompt = z.infer<typeof TeachLoginPromptSchema>;

export const TaughtSkillSchema = z.object({
  id: Id,
  botId: Id,
  name: z.string(),
  goal: z.string(),
  status: TaughtSkillStatusSchema,
  playbook: SkillPlaybookSchema,
  recording: TeachRecordingSchema,
  startedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  stoppedAt: z.string().nullable(),
  /** When a chat, routine or test run last used this skill. */
  lastRunAt: z.string().nullable().optional(),
  /** Result of the latest Test run; null while it runs or before any test. */
  lastTestOutcome: TeachTestOutcomeSchema.nullable().optional(),
  lastTestNote: z.string().nullable().optional(),
  /** Steps that wait for "Save as login" or "Skip". Empty once every value is saved or skipped. */
  loginPrompts: z.array(TeachLoginPromptSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaughtSkill = z.infer<typeof TaughtSkillSchema>;

/** One row of `taughtSkills.list`. */
export const TaughtSkillSummarySchema = z.object({
  id: Id,
  name: z.string(),
  goal: z.string(),
  lastRunAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type TaughtSkillSummary = z.infer<typeof TaughtSkillSummarySchema>;

export const AgentSkillSourceSchema = z.enum(["user", "builtin", "plugin"]);
export type AgentSkillSource = z.infer<typeof AgentSkillSourceSchema>;

export const AgentSkillOriginSchema = z.enum(["user", "agent"]);
export type AgentSkillOrigin = z.infer<typeof AgentSkillOriginSchema>;

export const AgentSkillSchema = z.object({
  id: Id,
  name: z.string(),
  description: z.string(),
  content: z.string(),
  source: AgentSkillSourceSchema,
  /** Who wrote it. Agent-written skills carry a badge in settings. */
  origin: AgentSkillOriginSchema.optional(),
  readOnly: z.boolean(),
  /** True when the skill carries a sandboxed tool script (see tool_run). */
  tool: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentSkill = z.infer<typeof AgentSkillSchema>;

export const AgentSkillCatalogEntrySchema = AgentSkillSchema.pick({
  id: true,
  name: true,
  description: true,
  source: true,
  origin: true,
  readOnly: true,
  tool: true,
});
export type AgentSkillCatalogEntry = z.infer<typeof AgentSkillCatalogEntrySchema>;

/** A catalog entry with this bot's switch. A skill with no stored setting is on. */
export const BotAgentSkillSchema = AgentSkillCatalogEntrySchema.extend({ enabled: z.boolean() });
export type BotAgentSkill = z.infer<typeof BotAgentSkillSchema>;

/** The tool a bot proposes with a skill. The owner approves exactly this source, pinned by its hash. */
export const AgentSkillToolDraftSchema = z.object({
  source: z.string(),
  /** sha256 of `source`; approving with this value fails if the source changed since it was shown. */
  hash: z.string(),
  /** What the bot says the tool reads and writes. The bot's words, not checked. */
  reads: z.string().optional(),
  writes: z.string().optional(),
  sampleInput: z.unknown().optional(),
  sampleOutput: z.unknown().optional(),
});
export type AgentSkillToolDraft = z.infer<typeof AgentSkillToolDraftSchema>;

/** An agent-written skill (new, or a revision of an active one) waiting for the owner. */
export const AgentSkillDraftSchema = z.object({
  id: Id,
  name: z.string(),
  description: z.string(),
  /** The proposed SKILL.md. */
  content: z.string(),
  /** True when it changes an active skill; false when the skill is new. */
  revision: z.boolean(),
  tool: AgentSkillToolDraftSchema.optional(),
});
export type AgentSkillDraft = z.infer<typeof AgentSkillDraftSchema>;

export const CreateAgentSkillInput = z
  .object({
    content: z.string().min(1).max(100_000).optional(),
    name: z.string().min(1).max(80).optional(),
    description: z.string().min(1).max(2000).optional(),
    body: z.string().max(100_000).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.content?.trim()) return;
    if (!input.name?.trim() || !input.description?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Provide content (SKILL.md) or name + description (+ optional body)",
        path: ["content"],
      });
    }
  });

export const UpdateAgentSkillInput = z
  .object({
    skillId: Id,
    content: z.string().min(1).max(100_000).optional(),
    name: z.string().min(1).max(80).optional(),
    description: z.string().min(1).max(2000).optional(),
    body: z.string().max(100_000).optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.content === undefined &&
      input.name === undefined &&
      input.description === undefined &&
      input.body === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Provide at least one field to update",
        path: ["content"],
      });
    }
  });

export const MemoryDocumentSchema = z.object({
  id: Id,
  scope: MemoryScope,
  botId: Id.nullable(),
  path: z.string(),
  content: z.string(),
  revision: z.number().int(),
  updatedAt: z.string(),
  source: z
    .object({
      kind: z.enum(["routine", "chat", "other"]),
      label: z.string().nullable(),
    })
    .nullable()
    .optional(),
});
export type MemoryDocument = z.infer<typeof MemoryDocumentSchema>;

/** One company context section: a memory document of scope "company". */
export const CompanyContextSectionSchema = z.object({
  id: Id,
  /** Stable slug; it does not change when the section is renamed. */
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  text: z.string(),
  revision: z.number().int(),
  updatedAt: z.string(),
});
export type CompanyContextSection = z.infer<typeof CompanyContextSectionSchema>;

export const CompanyContextRevisionSchema = z.object({
  revision: z.number().int(),
  title: z.string(),
  text: z.string(),
  createdAt: z.string(),
});
export type CompanyContextRevision = z.infer<typeof CompanyContextRevisionSchema>;

export const ConnectionSchema = z.object({
  id: Id,
  connectorId: z.string(),
  provider: z.string(),
  displayName: z.string(),
  /** The account's own address (the mailbox), when known: what tells two accounts of one app apart. */
  account: z.string().optional(),
  status: z.enum(["pending", "connected", "revoked", "error"]),
  /** Short user-safe reason when status is "error"; null otherwise. */
  error: z.string().nullable(),
  /** Mail accounts only: the provider refused the sign-in on the last sync, so it must be signed in again. */
  needsReconnect: z.boolean().optional(),
  writesEnabled: z.boolean().optional().default(false),
  agentBotId: Id.nullable().optional(),
  capabilities: z.array(z.string()),
  createdAt: z.string(),
});
export type Connection = Omit<z.infer<typeof ConnectionSchema>, "writesEnabled"> & {
  writesEnabled?: boolean;
};

export const ConnectionCategorySchema = z.enum([
  "email_calendar",
  "chat",
  "docs_files",
  "finance",
  "developer",
  "sales_crm",
  "other",
]);
export type ConnectionCategory = z.infer<typeof ConnectionCategorySchema>;

export const ConnectionCatalogItemSchema = z.object({
  connectorId: z.string(),
  slug: z.string(),
  name: z.string(),
  logo: z.string().nullable(),
  connected: z.boolean(),
  noAuth: z.boolean(),
  /** One line on what an agent can do with the app; null for apps not in the directory. */
  description: z.string().nullable(),
  category: ConnectionCategorySchema,
});
export type ConnectionCatalogItem = z.infer<typeof ConnectionCatalogItemSchema>;

// Apps Praci's own Google connector offers, compared by slug without case or punctuation.
const NATIVE_GOOGLE_APPS = new Set(["gmail", "googlecalendar", "googledrive"]);
const nativeGoogleKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * One entry per Google app (Gmail, Calendar, Drive) per surface. With native Google configured and
 * usable, it replaces the managed (Composio, Pipedream) entry for the same app. Where native Google
 * cannot work (a desktop shell that cannot open the system browser, mobile's session-less browser) it
 * is hidden and the managed entry stays.
 */
export function preferNativeGoogle(
  items: ConnectionCatalogItem[],
  { nativeGoogle }: { nativeGoogle: boolean },
): ConnectionCatalogItem[] {
  if (!nativeGoogle) return items.filter((item) => item.connectorId !== "google");
  const native = new Set(
    items.filter((item) => item.connectorId === "google").map((item) => nativeGoogleKey(item.slug)),
  );
  // A connected managed entry stays listed so it can still be disconnected.
  return items.filter(
    (item) =>
      item.connectorId === "google" ||
      item.connected ||
      !NATIVE_GOOGLE_APPS.has(nativeGoogleKey(item.slug)) ||
      !native.has(nativeGoogleKey(item.slug)),
  );
}

export const ActionApprovalEffectSchema = z.enum(["always_allow", "require_approval", "block"]);
export const ActionApprovalRuleSchema = z.object({
  id: Id,
  effect: ActionApprovalEffectSchema,
  matchKind: z.enum(["tool", "connector", "category", "site"]),
  matchValue: z.string(),
  /** null for a space-wide rule; a bot id for that bot's override. */
  botId: Id.nullable().optional(),
  /** Set on an "Always for this routine" rule, with the routine's name. */
  routineId: Id.nullable().optional(),
  routineName: z.string().optional(),
  /** Set on an agent's "Allow all sites" rule, with the agent's name. */
  botName: z.string().optional(),
  createdAt: z.string(),
});
export type ActionApprovalRule = z.infer<typeof ActionApprovalRuleSchema>;

/** The three choices of the approvals table, as the person sees them: Allow, Ask, Block. */
export const ApprovalChoiceSchema = z.enum(["allow", "ask", "block"]);
export type ApprovalChoice = z.infer<typeof ApprovalChoiceSchema>;

export const APPROVAL_ACTION_TYPE_IDS = [
  "send_email",
  "organize_mail",
  "spend_money",
  "connected_apps_write",
  "calendar_changes",
  "files_and_commands",
  "use_computer",
  "delete_data",
  "message_outside",
  "use_credentials",
] as const;
export const ApprovalActionTypeSchema = z.enum(APPROVAL_ACTION_TYPE_IDS);
export type ApprovalActionType = z.infer<typeof ApprovalActionTypeSchema>;

export const ApprovalTableRowSchema = z.object({
  actionType: ApprovalActionTypeSchema,
  /** What applies for this scope: the bot override if there is one, else the space row, else the default. */
  effect: ApprovalChoiceSchema,
  spaceEffect: ApprovalChoiceSchema,
  /** null when the bot has no override ("Same as all bots"); always null without a botId. */
  botEffect: ApprovalChoiceSchema.nullable(),
  primary: z.boolean(),
});
export type ApprovalTableRow = z.infer<typeof ApprovalTableRowSchema>;

export const ActionAutoReviewSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Also judge calls in background runs that read nothing from outside. */
  background: z.boolean(),
  checkerAvailable: z.boolean(),
});
export type ActionAutoReviewSettings = z.infer<typeof ActionAutoReviewSettingsSchema>;

export const ActionAutoReviewRecentSchema = z.object({
  id: z.string(),
  tool: z.string(),
  reason: z.string().nullable(),
  at: z.string(),
  botName: z.string(),
});
export type ActionAutoReviewRecent = z.infer<typeof ActionAutoReviewRecentSchema>;

/** A call approved without a card, for "Approved automatically". */
export const AutoApprovalSchema = z.object({
  id: z.string(),
  tool: z.string(),
  botName: z.string(),
  /** What the call acted on, in plain words, when the log can name it. */
  target: z.string().nullable(),
  at: z.string(),
  /** False when the tool has no undo path here. */
  undoable: z.boolean(),
  undone: z.boolean(),
});
export type AutoApproval = z.infer<typeof AutoApprovalSchema>;

export const CapabilityInstallSchema = z.object({
  id: Id,
  kind: z.enum(["skill", "plugin", "mcp", "api", "graphql", "connection"]),
  name: z.string(),
  source: z.string(),
  version: z.string().nullable(),
  digest: z.string().nullable(),
  secretConfigured: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  /** Tool sources (MCP, API, GraphQL) only: the source's own agent and who else may use it. */
  agentBotId: Id.nullable().optional(),
  allAgents: z.boolean().optional(),
  agentShared: z.boolean().optional(),
  writesEnabled: z.boolean().optional(),
  /** Agents that can really use the source, and the ones among them allowed to make changes. */
  usableBotIds: z.array(Id).optional(),
  writeBotIds: z.array(Id).optional(),
});
export type CapabilityInstall = z.infer<typeof CapabilityInstallSchema>;

export const IntegrationCatalogSurfaceSchema = z.object({
  kind: z.enum(["mcp", "openapi", "graphql", "cli"]),
  slug: z.string(),
  source: z.string().nullable(),
  auth: z
    .object({
      type: z.enum(["none", "bearer", "header"]),
      headerName: z.string().nullable(),
      note: z.string().nullable(),
    })
    .nullable(),
});
export type IntegrationCatalogSurface = z.infer<typeof IntegrationCatalogSurfaceSchema>;

export const IntegrationCatalogResultSchema = z.object({
  domain: z.string(),
  name: z.string(),
  description: z.string(),
  pageUrl: z.string().nullable(),
  surfaces: z.array(IntegrationCatalogSurfaceSchema),
});
export type IntegrationCatalogResult = z.infer<typeof IntegrationCatalogResultSchema>;

export type { McpTransport } from "./mcp.js";

const McpServerBaseInput = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).default(""),
  enabled: z.boolean().default(true),
  /** Update-only: drop the stored static credential (secret/env/headers).
   * OAuth state survives so a connected server stays connected. */
  clearCredential: z.boolean().optional(),
});
export const McpServerConfigInput = z.discriminatedUnion("transport", [
  McpServerBaseInput.extend({
    transport: z.literal("streamable_http"),
    endpoint: McpRemoteEndpointSchema,
    headers: McpHeadersSchema.default({}),
    secret: z.string().max(16384).optional(),
  }),
  McpServerBaseInput.extend({
    transport: z.literal("sse"),
    endpoint: McpRemoteEndpointSchema,
    headers: McpHeadersSchema.default({}),
    secret: z.string().max(16384).optional(),
  }),
  McpServerBaseInput.extend({
    transport: z.literal("stdio"),
    command: z.string().min(1).max(512),
    args: z.array(z.string().max(2048)).max(64).default([]),
    env: z
      .record(z.string().regex(/^[A-Z_][A-Z0-9_]*$/), z.string().max(4096))
      .superRefine((value, ctx) => {
        if (Object.keys(value).length > 32) {
          ctx.addIssue({ code: "custom", message: "At most 32 environment variables are allowed" });
        }
      })
      .default({}),
    secret: z.string().max(16384).optional(),
  }),
]);
export type McpServerConfigInput = z.infer<typeof McpServerConfigInput>;

export const McpServerSchema = z.object({
  id: Id,
  spaceId: Id,
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  transport: McpTransportSchema,
  endpoint: z.string().url().nullable(),
  command: z.string().nullable(),
  args: z.array(z.string()),
  envKeys: z.array(z.string()),
  headerKeys: z.array(z.string()),
  hasSecret: z.boolean(),
  oauthStatus: z.enum(["none", "connected", "reconnect"]),
  /** False when the connector would never send the token (plain-HTTP loopback). */
  oauthSupported: z.boolean(),
  /** A browser sign-in was started and has not finished (its session is still open). */
  oauthAttempted: z.boolean(),
  enabled: z.boolean(),
  /** Whether the server's write tools may be used by its agent. Off by default. */
  writesEnabled: z.boolean(),
  /** The server's integration agent (a bot), or null. Defaults let handlers omit it until they set it. */
  agentBotId: Id.nullable().default(null),
  /** While true, only the agent may use the server's tools. Ignored without an agent. */
  agentExclusive: z.boolean().default(false),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type McpServer = z.infer<typeof McpServerSchema>;

export const BotMcpServerSchema = z.object({
  id: Id,
  botId: Id,
  serverId: Id,
  allowAllTools: z.boolean(),
  allowedTools: z.array(z.string().min(1).max(200)),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BotMcpServer = z.infer<typeof BotMcpServerSchema>;

export const ArtifactSchema = z.object({
  id: Id,
  botId: Id.nullable(),
  groupId: Id.nullable(),
  runId: Id.nullable(),
  name: z.string(),
  description: z.string().nullable(),
  mimeType: z.string(),
  size: z.number().int(),
  version: z.number().int(),
  createdAt: z.string(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

export const ArtifactVersionSchema = z.object({
  id: Id,
  version: z.number().int(),
  name: z.string(),
  createdAt: z.string(),
});

export type ArtifactVersion = z.infer<typeof ArtifactVersionSchema>;

/** The live link of an artifact: which version it shows and when it stops working. Never the token. */
export const ArtifactShareSchema = z.object({
  artifactId: z.string(),
  version: z.number().int(),
  expiresAt: z.string(),
});
export type ArtifactShare = z.infer<typeof ArtifactShareSchema>;

/** What the public share endpoint returns: one artifact version, nothing about its owner. */
export const SharedArtifactSchema = z.object({
  name: z.string(),
  mimeType: z.string(),
  contentBase64: z.string(),
});
export type SharedArtifact = z.infer<typeof SharedArtifactSchema>;

export const ArtifactWithContentSchema = ArtifactSchema.extend({
  contentBase64: z.string(),
});
export type ArtifactWithContent = z.infer<typeof ArtifactWithContentSchema>;

export const SPREADSHEET_PREVIEW_DEFAULT_LIMIT = 200;
export const SPREADSHEET_PREVIEW_MAX_LIMIT = 1000;

/** A spreadsheet is in an artifact or in a Data room item, never both. */
export const SpreadsheetPreviewInputSchema = z.object({
  source: z.union([
    z.object({ artifactId: Id }),
    z.object({ dataRoomItemId: Id }),
    /** An attachment of the caller's own cached mail message. */
    z.object({
      mailAttachment: z.object({ messageId: Id, attachmentId: z.string().min(1).max(500) }),
    }),
  ]),
  /** Defaults to the first sheet. */
  sheet: z.string().min(1).max(200).optional(),
  /** Data rows to skip after the header row. */
  offset: z.number().int().min(0).default(0),
  limit: z
    .number()
    .int()
    .min(1)
    .max(SPREADSHEET_PREVIEW_MAX_LIMIT)
    .default(SPREADSHEET_PREVIEW_DEFAULT_LIMIT),
});

const SpreadsheetCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const SpreadsheetPreviewSchema = z.discriminatedUnion("status", [
  /** Legacy .xls, a file that is not a spreadsheet, or one that cannot be read. */
  z.object({ status: z.literal("unsupported"), message: z.string() }),
  z.object({
    status: z.literal("ready"),
    sheets: z.array(z.object({ name: z.string(), dimension: z.string().nullable() })),
    sheet: z.string(),
    /** Column letters, one per cell. */
    columns: z.array(z.string()),
    /** The first row of the sheet with values; its sheet row number is headerRow. */
    headerRow: z.number().int().nullable(),
    header: z.array(SpreadsheetCellSchema),
    /** Dates are ISO strings and numbers are raw; cells are cached values, not formulas. */
    rows: z.array(z.object({ row: z.number().int(), cells: z.array(SpreadsheetCellSchema) })),
    /** More rows exist than this page holds (or the page was cut short). */
    truncated: z.boolean(),
    note: z.string().optional(),
  }),
]);
export type SpreadsheetPreviewInput = z.input<typeof SpreadsheetPreviewInputSchema>;
export type SpreadsheetPreview = z.infer<typeof SpreadsheetPreviewSchema>;

export const UsageRecordSchema = z.object({
  id: Id,
  botId: Id.nullable(),
  runId: Id.nullable(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  cacheReadTokens: z.number().int().nullable().optional(),
  cacheWriteTokens: z.number().int().nullable().optional(),
  cacheWrite1hTokens: z.number().int().nullable().optional(),
  reasoningTokens: z.number().int().nullable().optional(),
  totalTokens: z.number().int().nullable().optional(),
  costUsd: z.number().nonnegative().nullable().optional(),
  costSource: z.string().nullable().optional(),
  pricingVersion: z.string().nullable().optional(),
  usageSource: z.string().nullable().optional(),
  callId: z.string().nullable().optional(),
  operationId: z.string().nullable().optional(),
  operationKind: z
    .enum([
      "answer",
      "setup",
      "retrieval",
      "subagent",
      "compaction",
      "triage",
      "company_import",
      "goal_check",
    ])
    .optional(),
  parentRunId: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const COMPUTER_UPDATE_STAGES = [
  "preparing",
  "saving",
  "recreating",
  "restoring",
  "reconnecting",
] as const;
export const ComputerUpdateSchema = z.object({
  canReleaseReservation: z.boolean().optional(),
  action: z.enum(["update", "recover"]),
  id: Id,
  botId: Id,
  name: z.string(),
  mode: ComputerModeSchema,
  status: z.enum(["queued", "running", "interrupted", "completed", "failed"]),
  stage: z.enum(COMPUTER_UPDATE_STAGES),
});
export type ComputerUpdate = z.infer<typeof ComputerUpdateSchema>;

export const ComputerStatusSchema = z.object({
  botId: Id,
  mode: ComputerModeSchema,
  kind: SandboxKind,
  state: z.enum(["stopped", "booting", "running", "suspended", "error"]),
  controlHolder: z.enum(["bot", "user", "none"]),
  controlBotId: Id.nullable(),
  takeoverRequested: z.boolean(),
  screenAvailable: z.boolean(),
  screenWidth: z.number().int().positive(),
  screenHeight: z.number().int().positive(),
  homeRevision: z.string().nullable(),
  busyBotName: z.string().nullable(),
  canUpdate: z.boolean(),
  terminalAvailable: z.boolean(),
});
export type ComputerStatus = z.infer<typeof ComputerStatusSchema>;

export const ComputerReleaseReasonSchema = z.enum(["done", "skipped"]);
export type ComputerReleaseReason = z.infer<typeof ComputerReleaseReasonSchema>;

export const MessagingLinkedIdentitySchema = z.object({
  id: Id,
  provider: z.string(),
  address: z.string(),
  botId: Id,
  botName: z.string(),
});
export type MessagingLinkedIdentity = z.infer<typeof MessagingLinkedIdentitySchema>;

export const MessagingStatusSchema = z.object({
  enabled: z.boolean(),
  /** Messaging platforms mounted on this deployment (sendblue, slack, …). */
  providers: z.array(z.string()),
  /** True when unknown senders auto-provision their own accounts. */
  openSignup: z.boolean(),
  /** The caller's linked chat apps, one entry per (provider, address). */
  identities: z.array(MessagingLinkedIdentitySchema),
});
export type MessagingStatus = z.infer<typeof MessagingStatusSchema>;

export const MessagingChannelMembershipSchema = z.object({
  /** One row per linked identity: the same group can hold two of the caller's. */
  id: Id,
  channelId: Id,
  /** Which of the caller's linked chat apps this membership belongs to. */
  identityId: Id,
  provider: z.string(),
  name: z.string().nullable(),
  status: z.enum(["invited", "approved", "declined", "left"]),
  memberCount: z.number().int().nonnegative(),
});
export type MessagingChannelMembership = z.infer<typeof MessagingChannelMembershipSchema>;

export const MessagingAgentConnectionSchema = z.object({
  id: Id,
  peerBotName: z.string(),
  peerOwnerLabel: z.string(),
  status: z.enum(["pending", "approved", "declined", "revoked"]),
  /** true when the caller's bot is the target (only the target can respond). */
  incoming: z.boolean(),
});
export type MessagingAgentConnection = z.infer<typeof MessagingAgentConnectionSchema>;

export const RunSchema = z.object({
  id: Id,
  /** The user the run acts for; clients use it to show a credential request only to them. */
  userId: Id.optional(),
  botId: Id,
  threadId: Id,
  taskId: Id,
  status: RunStatus,
  trigger: RunTriggerSchema,
  routineId: Id.nullable(),
  modelProvider: z.string().nullable(),
  modelId: z.string().nullable(),
  error: z.string().nullable(),
  phase: RunPhaseSchema.nullable().optional(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Run = z.infer<typeof RunSchema>;

// Stored as a failed-run error, not an assistant message: asking the user to continue would
// store that sentence as the reply, and the next "continue" misses a final answer again.
export const MISSING_TOOL_FINAL_RESPONSE_ERROR = "This agent could not finish. Try again.";

/** Resumed without its saved turn, the model did not call the action the user approved. */
export const APPROVED_ACTION_NOT_RUN_ERROR =
  "The model did not run the approved action. Try again.";

export const ThreadMessagePageSchema = z.object({
  threadId: Id,
  messages: z.array(ThreadMessageSchema),
  olderCursor: z.number().int().nonnegative().nullable(),
  coveredThroughSeq: z.number().int().nonnegative().optional(),
});
export type ThreadMessagePage = z.infer<typeof ThreadMessagePageSchema>;

/** The open goal (active or paused) of a bot's thread; ended goals are not sent. */
export const ThreadGoalSchema = z.object({
  id: Id,
  text: z.string(),
  status: z.enum(["active", "paused", "met", "blocked", "stopped", "cleared"]),
  stopReason: z
    .enum(["runs", "time", "spend", "stalled", "owner", "check_failed", "model_error"])
    .nullable(),
  /** Why the latest check said what it said; null before the first check. */
  lastReason: z.string().nullable(),
  continuations: z.number().int().nonnegative(),
  startedAt: z.string(),
});
export type ThreadGoal = z.infer<typeof ThreadGoalSchema>;

export const ThreadSnapshotSchema = z.object({
  threadId: Id,
  cursor: z.number().int().min(-1),
  messages: z.array(ThreadMessageSchema),
  olderCursor: z.number().int().nonnegative().nullable(),
  /** Highest message seq the caller had read when the snapshot was taken; -1 before any. */
  lastReadSeq: z.number().int().min(-1).optional(),
  botId: Id.optional(),
  groupId: Id.optional(),
  groupName: z.string().optional(),
  members: z.array(GroupMemberSchema).optional(),
  run: RunSchema.nullable(),
  activeRuns: z.array(RunSchema).optional(),
  /** Messages of this thread whose agent waits for the owner's approval; empty or absent when none. */
  delegatePending: z.array(z.string()).optional(),
  /** The agents behind delegatePending, named by the server so they do not depend on loaded messages. */
  delegatePendingAgents: z
    .array(z.object({ messageId: z.string(), id: Id, name: z.string() }))
    .optional(),
  computer: ComputerStatusSchema.optional(),
  goal: ThreadGoalSchema.nullable().optional(),
});
export type ThreadSnapshot = z.infer<typeof ThreadSnapshotSchema>;

/** Default maximum number of completion tokens for an OpenAI-compatible connection. */
export const DEFAULT_MODEL_MAX_TOKENS = 4_096;

/** Largest completion-token limit exposed by model settings. */
export const MAX_MODEL_MAX_TOKENS = 131_072;

/** Default context window for an OpenAI-compatible connection. */
export const DEFAULT_MODEL_CONTEXT_WINDOW = 32_768;

/** Largest context window exposed by model settings. */
export const MAX_MODEL_CONTEXT_WINDOW = 2_147_483_647;
/** Parse the optional per-connection image limit entered in model settings. */
export function parseModelMaxImagesPerPrompt(
  value: string,
  supportsImages = true,
): number | undefined {
  if (!supportsImages) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000 ? parsed : undefined;
}

/** Parse the optional completion-token limit entered in model settings. */
export function parseModelMaxTokens(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_MODEL_MAX_TOKENS
    ? parsed
    : undefined;
}

/** Parse the optional context-window limit entered in model settings. */
export function parseModelContextWindow(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_MODEL_CONTEXT_WINDOW
    ? parsed
    : undefined;
}

/**
 * JS null/undefined stringifies to the literals "null" / "undefined". Those
 * are not catalog ids; treat them (and blank values) as unset.
 */
export function usableModelId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

/** Connection-declared capabilities; omission means unknown, not a provider default. */
export const CacheCapabilitiesSchema = z.object({
  retentionMs: z.number().int().positive().max(2147483647).optional(),
  minimumTokens: z.number().int().nonnegative().max(2147483647).optional(),
  scope: z.enum(["account", "connection"]),
  retentionMode: z.enum(["none", "short", "long"]).optional(),
  inputCostPerMillion: z.number().nonnegative().optional(),
  readCostPerMillion: z.number().nonnegative().optional(),
  writeCostPerMillion: z.number().nonnegative().optional(),
});
export type CacheCapabilities = z.infer<typeof CacheCapabilitiesSchema>;

export const ModelContextLimitsSchema = z.object({
  cacheCapabilities: CacheCapabilitiesSchema.optional(),
  contextWindow: z.number().int().min(1).max(MAX_MODEL_CONTEXT_WINDOW).optional(),
});
export type ModelContextLimits = z.infer<typeof ModelContextLimitsSchema>;

/** A completion limit must leave capacity for at least one input token. */
export function modelOutputLeavesInputRoom(
  maxTokens: number | null | undefined,
  contextWindow: number | undefined,
): boolean {
  return typeof maxTokens !== "number" || contextWindow === undefined || maxTokens < contextWindow;
}

export const ModelCredentialSchema = z.object({
  ...ModelContextLimitsSchema.shape,
  id: Id,
  provider: z.string(),
  label: z.string(),
  hasKey: z.boolean(),
  isDefault: z.boolean(),
  baseUrl: z.string().optional(),
  accountId: z.string().optional(),
  gatewayId: z.string().optional(),
  modelId: z.string().optional(),
  reasoning: z.boolean().optional(),
  thinkingLevel: ThinkingLevelSchema.nullable().optional(),
  maxTokens: z.number().int().min(1).max(MAX_MODEL_MAX_TOKENS).optional(),
  supportsImages: z.boolean().optional(),
  maxImagesPerPrompt: z.number().int().min(1).max(1000).optional(),
  thinkingLevels: z.array(ThinkingLevelSchema).optional(),
  /** Stored secret kind. Absent when the secret could not be read. */
  authKind: z.enum(["api_key", "oauth", "openai_compatible"]).optional(),
});
export type ModelCredential = z.infer<typeof ModelCredentialSchema>;

export const MAX_MODEL_BACKUPS = 10;
export const ModelBackupChoiceSchema = z.object({
  provider: z.string().trim().min(1).max(128),
  modelId: z.string().trim().min(1).max(512),
});
export type ModelBackupChoice = z.infer<typeof ModelBackupChoiceSchema>;
export const ModelBackupListSchema = z
  .array(ModelBackupChoiceSchema)
  .max(MAX_MODEL_BACKUPS)
  .superRefine((choices, ctx) => {
    const seen = new Set<string>();
    for (const [index, choice] of choices.entries()) {
      const key = JSON.stringify([choice.provider, choice.modelId]);
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Backup models must be unique",
          path: [index],
        });
      }
      seen.add(key);
    }
  });

export const OPENAI_COMPATIBLE_PROVIDER_ID = "openai-compatible";

/** The max-tokens input text for a provider: compatible endpoints default, others stay blank. */
export function connectionMaxTokensField(providerId: string, stored: number | undefined): string {
  if (providerId === OPENAI_COMPATIBLE_PROVIDER_ID) {
    return String(stored ?? DEFAULT_MODEL_MAX_TOKENS);
  }
  return stored !== undefined ? String(stored) : "";
}

export const ModelConnectInputSchema = z
  .object({
    ...ModelContextLimitsSchema.shape,
    provider: z.string(),
    apiKey: z.string().optional(),
    accountId: z.string().optional(),
    gatewayId: z.string().optional(),
    baseUrl: z.string().optional(),
    label: z.string().optional(),
    modelId: z.string().optional(),
    reasoning: z.boolean().optional(),
    thinkingLevel: ThinkingLevelSchema.nullable().optional(),
    maxTokens: z.number().int().min(1).max(MAX_MODEL_MAX_TOKENS).nullable().optional(),
    supportsImages: z.boolean().optional(),
    maxImagesPerPrompt: z.number().int().min(1).max(1000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!modelOutputLeavesInputRoom(value.maxTokens, value.contextWindow)) {
      ctx.addIssue({
        code: "custom",
        message: "Maximum output tokens must leave room for input",
        path: ["maxTokens"],
      });
    }
    if (isCloudflareAiGatewayProvider(value.provider)) {
      if (value.accountId !== undefined && !cloudflareGatewayRoutingId(value.accountId)) {
        ctx.addIssue({
          code: "custom",
          message: CLOUDFLARE_AI_GATEWAY_CONFIG_MESSAGE,
          path: ["accountId"],
        });
      }
      if (value.gatewayId !== undefined && !cloudflareGatewayRoutingId(value.gatewayId)) {
        ctx.addIssue({
          code: "custom",
          message: CLOUDFLARE_AI_GATEWAY_CONFIG_MESSAGE,
          path: ["gatewayId"],
        });
      }
    }
    if (value.provider === OPENAI_COMPATIBLE_PROVIDER_ID) {
      if (!value.baseUrl?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Base URL is required for OpenAI-compatible models",
          path: ["baseUrl"],
        });
      }
      if (!value.modelId?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Model id is required for OpenAI-compatible models",
          path: ["modelId"],
        });
      }
      return;
    }
    const apiKey = value.apiKey?.trim() ?? "";
    if (apiKey.length > 0 && apiKey.length < 8) {
      ctx.addIssue({
        code: "custom",
        message: "API key must contain at least 8 characters",
        path: ["apiKey"],
      });
    }
    // An existing connection can update its output limit without a new key.
    if (!apiKey && value.maxTokens === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "API key must contain at least 8 characters",
        path: ["apiKey"],
      });
    }
  });
export type ModelConnectInput = z.infer<typeof ModelConnectInputSchema>;

export const ModelOAuthSignInModeSchema = z.enum(["device-code", "auth-url"]);
export type ModelOAuthSignInMode = z.infer<typeof ModelOAuthSignInModeSchema>;

const ModelOAuthBeginBaseSchema = z.object({
  loginId: z.string(),
  provider: z.string(),
  verificationUri: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), "Expected an HTTPS authorization URL"),
  expiresInSeconds: z.number().int().positive(),
});

export const ModelOAuthBeginSchema = z.discriminatedUnion("mode", [
  ModelOAuthBeginBaseSchema.extend({
    mode: z.literal("device-code"),
    userCode: z.string().min(1),
  }),
  ModelOAuthBeginBaseSchema.extend({ mode: z.literal("auth-url") }),
]);
export type ModelOAuthBegin = z.infer<typeof ModelOAuthBeginSchema>;

export const SpaceMemoryConfigSchema = z.object({
  provider: z.string(),
  settings: z.record(z.string(), z.string()),
  defaultMemoryScope: MemoryScopeSchema,
  updatedAt: z.string(),
});
export type SpaceMemoryConfig = z.infer<typeof SpaceMemoryConfigSchema>;

export const ModelCatalogEntrySchema = z.object({
  provider: z.string(),
  providerName: z.string().optional(),
  id: z.string(),
  label: z.string(),
  billing: z.string(),
  auth: z.enum(["api-key", "oauth", "both"]).optional(),
  oauthLabel: z.string().optional(),
  authHint: z.string().optional(),
  subscription: z.boolean().optional(),
  signIn: ModelOAuthSignInModeSchema.optional(),
  reasoning: z.boolean().optional(),
  thinkingLevels: z.array(ThinkingLevelSchema).optional(),
  /** Catalog stand-in so a provider appears before the user enters a real model id. */
  placeholder: z.boolean().optional(),
  /** Models share one pinned HTTPS models-list URL that can be probed. */
  catalogProbe: z.boolean().optional(),
});
export type ModelCatalogEntry = z.infer<typeof ModelCatalogEntrySchema>;

export const VoiceCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  transcribe: z.boolean(),
  /** Can speak. Absent means yes. */
  speech: z.boolean().optional(),
});
export type VoiceCatalogEntry = z.infer<typeof VoiceCatalogEntrySchema>;

export const VoiceInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});
export type VoiceInfo = z.infer<typeof VoiceInfoSchema>;

export const VoiceCredentialSchema = z.object({
  id: Id,
  provider: z.string(),
  hasKey: z.boolean(),
  isDefault: z.boolean(),
  voiceId: z.string(),
  /** Fish speech-model override. Empty uses the deployment default. */
  speechModel: z.string(),
  transcribe: z.boolean(),
});
export type VoiceCredential = z.infer<typeof VoiceCredentialSchema>;

export const VoiceStatusSchema = z.object({
  configured: z.boolean(),
  ready: z.boolean(),
  transcribe: z.boolean(),
  provider: z.string().nullable(),
  voiceId: z.string(),
  /** The provider selected only for transcription, or null when speech and transcription share a provider. */
  transcriptionProvider: z.string().nullable(),
  /** True once the selected transcription provider can be used for dictation. Always false until S3b. */
  transcriptionReady: z.boolean(),
  /** This user has agreed, in this space, to send audio to the provider that would transcribe it. Absent on older servers. */
  transcriptionConsented: z.boolean().optional(),
});
export type VoiceStatus = z.infer<typeof VoiceStatusSchema>;

export const DeploymentSettingsSchema = z.object({
  ownerUserId: Id.nullable(),
  signupsEnabled: z.boolean(),
  signupAllowlist: z.array(z.string()),
  hasDeploymentModelCredential: z.boolean(),
  defaultProvider: z.string().nullable(),
  defaultModel: z.string().nullable(),
  computerHost: z.enum(["docker", "this-mac"]).nullable(),
  canChooseHostComputer: z.boolean(),
  sandboxProvider: z.string(),
});

export const ServerUpdateSourceSchema = z.object({
  repoUrl: z.string().max(400),
  branch: z.string().max(200),
  official: z.boolean(),
});
export type ServerUpdateSource = z.infer<typeof ServerUpdateSourceSchema>;

export const ServerUpdateStepSchema = z.object({
  id: z.string().max(40),
  label: z.string().max(200),
  ok: z.boolean(),
  exitCode: z.number().int().nullable(),
  output: z.string().max(8_001),
});

/** How an update reaches new code: published images, a build on the server, or a git checkout. */
export const ServerUpdateStrategySchema = z.enum(["pull", "build", "checkout"]);
export type ServerUpdateStrategy = z.infer<typeof ServerUpdateStrategySchema>;

/** `sidecar` is the Compose deployment; `checkout` is a supervised source install. */
export const ServerUpdateModeSchema = z.enum(["sidecar", "checkout", "unavailable"]);
export type ServerUpdateMode = z.infer<typeof ServerUpdateModeSchema>;

/**
 * What Settings should render for a deployment owner.
 * `sidecar`: Check / Update / Rollback through the updater sidecar.
 * `compose`: Compose install without a reachable sidecar; show host pull/up commands.
 * `source`: git checkout / `pnpm dev`; show terminal commands, never a fake Apply.
 */
export const ServerUpdateInstallKindSchema = z.enum(["sidecar", "compose", "source"]);
export type ServerUpdateInstallKind = z.infer<typeof ServerUpdateInstallKindSchema>;

export const ServerUpdateRunSchema = z.object({
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  ok: z.boolean(),
  fromCommit: z.string().nullable(),
  toCommit: z.string().nullable(),
  fromTag: z.string().nullable(),
  toTag: z.string().nullable(),
  strategy: ServerUpdateStrategySchema.nullable(),
  repoUrl: z.string().max(400),
  branch: z.string().max(200),
  /**
   * `recreated` means the updater sidecar replaced the containers and no restart is owed.
   * `supervised` means the process exited and its supervisor is bringing it back.
   */
  restart: z.enum(["recreated", "supervised", "manual", "not-required"]),
  restartAdvice: z.string(),
  error: z.string().nullable(),
  steps: z.array(ServerUpdateStepSchema),
});
export type ServerUpdateRun = z.infer<typeof ServerUpdateRunSchema>;

export const ServerUpdateStatusSchema = z.object({
  supported: z.boolean(),
  unsupportedReason: z.string().nullable(),
  installKind: ServerUpdateInstallKindSchema,
  /** Host commands to run when `installKind` is not `sidecar`. Empty when the sidecar applies. */
  manualCommands: z.array(z.string()),
  mode: ServerUpdateModeSchema,
  strategy: ServerUpdateStrategySchema.nullable(),
  strategyNote: z.string().nullable(),
  version: z.string(),
  revision: z.string().nullable(),
  commit: z.string().nullable(),
  branch: z.string().nullable(),
  remoteUrl: z.string().nullable(),
  dirty: z.boolean(),
  dirtyPaths: z.array(z.string()),
  image: z.string().nullable(),
  imageTag: z.string().nullable(),
  previousImageTag: z.string().nullable(),
  canRollback: z.boolean(),
  source: ServerUpdateSourceSchema,
  officialRepoUrl: z.string(),
  restartSupervisor: z.enum(["systemd", "pm2", "declared", "none"]),
  restartAdvice: z.string(),
  running: z.boolean(),
  lastRun: ServerUpdateRunSchema.nullable(),
});
export type ServerUpdateStatus = z.infer<typeof ServerUpdateStatusSchema>;

export const ServerUpdateCheckSchema = z.object({
  status: z.enum(["unavailable", "dirty", "up-to-date", "available"]),
  reason: z.string().nullable(),
  changed: z.array(z.string()),
  commit: z.string().nullable(),
  targetCommit: z.string().nullable(),
  targetTag: z.string().nullable(),
  behindBy: z.number().int().nonnegative(),
});
export type ServerUpdateCheck = z.infer<typeof ServerUpdateCheckSchema>;

export const ServerUpdateRequestSchema = z.object({
  repoUrl: z.string().max(400).optional(),
  branch: z.string().max(200).optional(),
});
export type ServerUpdateRequest = z.infer<typeof ServerUpdateRequestSchema>;

export const MeSchema = z.object({
  ticketBoardEnabled: z.boolean(),
  userId: Id,
  email: z.string().email(),
  name: z.string(),
  spaceId: Id,
  isDeploymentOwner: z.boolean(),
  needsModel: z.boolean(),
  defaultProvider: z.string().nullable(),
  defaultModel: z.string().nullable(),
  /** Provider the active default runs on with the server's own credentials, without a key. */
  hostCredentialProvider: z.string().nullable(),
  /** Kind of those credentials, e.g. "AWS IAM"; set with hostCredentialProvider. */
  hostCredentialSource: z.string().nullable(),
  computerHost: z.enum(["docker", "this-mac"]).nullable(),
  canChooseHostComputer: z.boolean(),
  sandboxProvider: z.string(),
  /** Whether this deployment runs stdio MCP servers. Absent from older servers. */
  mcpStdioEnabled: z.boolean().optional(),
  avatarStyle: AvatarStyleSchema,
  /** IANA time zone last reported by one of the user's clients; null before the first report. */
  timezone: z.string().nullable(),
  /** True once the user has finished or skipped the first-run tour. */
  tourSeen: z.boolean(),
  /** Sidebar page keys this user hid; the pages stay reachable by URL and search. */
  hiddenPages: z.array(z.string()).optional(),
  /** True when this user chose to mask money figures. */
  hideAmounts: z.boolean().optional(),
  /** True when this deployment bills and the user is not the deployment owner. */
  billingEnabled: z.boolean(),
});
export type Me = z.infer<typeof MeSchema>;

export const BillingStatusSchema = z.object({
  access: z.boolean(),
  /** Only organization owners start checkout or open the billing portal. */
  canManage: z.boolean(),
  trialAvailable: z.boolean(),
  trialDays: z.number().int().nonnegative(),
  state: z.enum(["none", "trialing", "active", "past_due", "incomplete", "canceled"]),
  price: z
    .object({
      amount: z.number().int().nonnegative(),
      currency: z.string(),
      interval: z.enum(["day", "week", "month", "year"]),
      intervalCount: z.number().int().positive(),
    })
    .nullable(),
  seats: z.number().int().nonnegative(),
  trialEndsAt: z.string().nullable(),
  currentPeriodEndsAt: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  hasCustomer: z.boolean(),
});
export type BillingStatus = z.infer<typeof BillingStatusSchema>;

export const AppBootstrapSchema = z.object({
  me: MeSchema,
  bots: z.array(BotSchema),
  groups: z.array(GroupSchema),
  botSections: z.array(BotSectionSchema),
  archivedBots: z.array(BotSchema),
  archivedGroups: z.array(GroupSchema),
  thread: ThreadSnapshotSchema.nullable(),
  routines: z.array(RoutineSchema),
  spaces: z.array(SpaceSchema),
});
export type AppBootstrap = z.infer<typeof AppBootstrapSchema>;

export const ExportManifestSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  bot: BotSchema.pick({ name: true, title: true, description: true, instructions: true }),
  memory: z.array(z.object({ path: z.string(), content: z.string() })),
  routines: z.array(RoutineSchema.pick({ name: true, prompt: true, crons: true, timezone: true })),
  files: z.array(
    z.object({ path: z.string(), content: z.string(), encoding: z.literal("base64").optional() }),
  ),
  history: z.array(ThreadMessageSchema),
});
export type ExportManifest = z.infer<typeof ExportManifestSchema>;

/** The failed-run message when a bot's pinned connection is signed out or removed. */
export const PINNED_CONNECTION_LOST_MESSAGE = "This bot's connection is signed out or removed.";
