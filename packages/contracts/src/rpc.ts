import { eventIterator, oc } from "@orpc/contract";
import * as z from "zod";
import { AiConsentQuerySchema, AiConsentStatusSchema } from "./ai-consent.js";
import {
  ARTIFACT_DESCRIPTION_MAX_LENGTH,
  ARTIFACT_NAME_MAX_LENGTH,
  ATTACHMENT_MAX_BASE64_LENGTH,
  ATTACHMENT_MAX_COUNT,
} from "./attachments.js";
import {
  BoardEventSchema,
  BoardSchema,
  CommentTicketInput,
  CreateTicketInput,
  GetTicketInput,
  ListTicketsInput,
  ListTicketsOutput,
  MoveTicketInput,
  RenameBoardInput,
  TicketCommentSchema,
  TicketSchema,
  UpdateTicketInput,
} from "./board.js";
import { BotSecretMetadata, BotSecretPutInput, StoredBotSecretName } from "./bot-secrets.js";
import { CapTableStateSchema } from "./carta.js";
import { ContactListInputSchema, ContactSaveInputSchema, ContactSchema } from "./contacts.js";
import {
  DataRoomApiBoxListInputSchema,
  DataRoomApiBoxListOutputSchema,
  DataRoomApiDriveListInputSchema,
  DataRoomApiDriveListOutputSchema,
  DataRoomApiEmailImportedInputSchema,
  DataRoomApiEmailImportedOutputSchema,
  DataRoomApiFacetValuesSchema,
  DataRoomApiFiltersSchema,
  DataRoomApiFolderSchema,
  DataRoomApiImportBoxInputSchema,
  DataRoomApiImportBoxOutputSchema,
  DataRoomApiImportDriveInputSchema,
  DataRoomApiImportDriveOutputSchema,
  DataRoomApiImportEmailInputSchema,
  DataRoomApiImportEmailOutputSchema,
  DataRoomApiImportSchema,
  DataRoomApiItemListInputSchema,
  DataRoomApiItemListOutputSchema,
  DataRoomApiItemSchema,
  DataRoomApiName,
  DataRoomApiProcessingSchema,
  DataRoomApiSearchInputSchema,
  DataRoomApiSearchOutputSchema,
  DataRoomApiStatsSchema,
  DataRoomConsentGrantInputSchema,
  DataRoomConsentStatusSchema,
} from "./data-room-api.js";
import {
  AutoSortApplyInputSchema,
  AutoSortApplyOutputSchema,
  AutoSortPlanSchema,
  AutoSortUndoOutputSchema,
} from "./data-room-autosort.js";
import { DevinAgentOutputSchema, DevinKeyInputSchema, DevinSessionsOutputSchema } from "./devin.js";
import {
  ActionApprovalRuleSchema,
  ActionAutoReviewSettingsSchema,
  AgentSecretInputSchema,
  AgentSecretSchema,
  AgentSkillCatalogEntrySchema,
  AgentSkillDraftSchema,
  AgentSkillSchema,
  AppBootstrapSchema,
  ArtifactSchema,
  ArtifactVersionSchema,
  ArtifactWithContentSchema,
  AvatarStyleSchema,
  BillingStatusSchema,
  BotAgentSkillSchema,
  BotMcpServerSchema,
  BotSchema,
  BotSectionSchema,
  CapabilityInstallSchema,
  ComputerModeSchema,
  ComputerReleaseReasonSchema,
  ComputerStatusSchema,
  ComputerUpdateSchema,
  ConnectionCatalogItemSchema,
  ConnectionSchema,
  CreateAgentSkillInput,
  CreateBotInput,
  CreateGroupInput,
  CreateRoutineInput,
  CreateScratchpadItemInput,
  DeploymentSettingsSchema,
  ExportManifestSchema,
  ExternalConversationPolicySchema,
  GroupDetailSchema,
  GroupSchema,
  IntegrationCatalogResultSchema,
  McpServerConfigInput,
  McpServerSchema,
  MemoryDocumentSchema,
  MemoryScopeSchema,
  MeSchema,
  MessagingAgentConnectionSchema,
  MessagingChannelMembershipSchema,
  MessagingLinkedIdentitySchema,
  MessagingStatusSchema,
  ModelBackupChoiceSchema,
  ModelBackupListSchema,
  ModelCatalogEntrySchema,
  ModelConnectInputSchema,
  ModelCredentialSchema,
  ModelOAuthBeginSchema,
  REPLY_QUOTE_MAX_LENGTH,
  ReorderBotsInput,
  RoutineSchema,
  ScratchpadItemSchema,
  ScratchpadItemStatusSchema,
  ServerUpdateCheckSchema,
  ServerUpdateRequestSchema,
  ServerUpdateRunSchema,
  ServerUpdateStatusSchema,
  SkillPlaybookSchema,
  SpaceMemoryConfigSchema,
  SpaceNavigationSchema,
  SpaceSchema,
  SpreadsheetPreviewInputSchema,
  SpreadsheetPreviewSchema,
  TaughtSkillSchema,
  TeachRecordingEventSchema,
  ThinkingLevelSchema,
  ThreadMessagePageSchema,
  ThreadSnapshotSchema,
  UpdateAgentSkillInput,
  UpdateBotInput,
  UpdateExternalConversationPolicyInput,
  UpdateGroupInput,
  UsageRecordSchema,
  VoiceCatalogEntrySchema,
  VoiceCredentialSchema,
  VoiceInfoSchema,
  VoiceStatusSchema,
} from "./domain.js";
import { ComputerCommandSchema, MailEditsSchema, ProductEventSchema } from "./events.js";
import {
  BalanceSeriesInputSchema,
  BalanceSeriesOutputSchema,
  FinanceAccountOutputSchema,
  FinanceAccountsOutputSchema,
  FinanceBurnOutputSchema,
  FinanceCategoryOutputSchema,
  FinanceConnectInputSchema,
  FinanceConnectOutputSchema,
  FinanceCryptoConnectInputSchema,
  FinanceCryptoConnectOutputSchema,
  FinanceCryptoHistoryInputSchema,
  FinanceCryptoHistoryOutputSchema,
  FinanceCryptoOutputSchema,
  FinanceCryptoProviderConnectInputSchema,
  FinanceCryptoProviderRemoveInputSchema,
  FinanceExchangeConnectInputSchema,
  FinanceExchangeRemoveInputSchema,
  FinanceExchangeSchema,
  FinanceExchangesOutputSchema,
  FinanceMonthOutputSchema,
  FinanceOverviewSchema,
  FinancePreferencesSchema,
  FinanceReceiptUrlOutputSchema,
  FinanceRecurringOutputSchema,
  FinanceRunwayOutputSchema,
  FinanceSpendInputSchema,
  FinanceSpendOutputSchema,
  FinanceTransactionOutputSchema,
  FinanceVendorOutputSchema,
  FinanceWalletAddInputSchema,
  FinanceWalletRemoveInputSchema,
  FinanceWalletSchema,
  FinanceWalletsOutputSchema,
  FinanceWalletUpdateInputSchema,
  SpendPeriodSchema,
} from "./finance.js";
import {
  FinanceStatementAccountRenameInputSchema,
  FinanceStatementConfirmInputSchema,
  FinanceStatementDiscardInputSchema,
  FinanceStatementSchema,
  FinanceStatementsOutputSchema,
  FinanceStatementUploadInputSchema,
} from "./finance-statements.js";
import { Id, IsoDate } from "./ids.js";
import {
  CleanupArchiveInputSchema,
  CleanupArchiveOutputSchema,
  CleanupForgetInputSchema,
  CleanupListInputSchema,
  CleanupListOutputSchema,
  ComposeClientId,
  ComposeFieldsSchema,
  ComposePrefillInputSchema,
  ComposePrefillOutputSchema,
  ComposeResultSchema,
  InboxBulkInputSchema,
  InboxBulkResultSchema,
  InboxFeedbackInputSchema,
  InboxFeedbackOutputSchema,
  InboxListInputSchema,
  InboxListOutputSchema,
  InboxMarkReadInputSchema,
  InboxMessageSchema,
  InboxMoveInputSchema,
  InboxMoveOutputSchema,
  InboxRefreshInputSchema,
  InboxRefreshOutputSchema,
  InboxScopeInputSchema,
  InboxTodoSchema,
  InboxTodosOutputSchema,
  MailActionsListOutputSchema,
  MailActionUndoInputSchema,
  MailActionUndoOutputSchema,
  UnsubscribeInputSchema,
  UnsubscribeOutputSchema,
} from "./inbox.js";
import {
  IntegrationProviderConfigSchema,
  IntegrationSetupStateSchema,
} from "./integration-settings.js";
import {
  LegalDeadlineSchema,
  LegalGraphSchema,
  LegalItemLinksSchema,
  LegalOverviewSchema,
  LegalScanNowOutputSchema,
  LegalUpdateDeadlineInputSchema,
} from "./legal.js";
import { McpOauthClientSchema } from "./mcp.js";
import {
  MeetingConnectInputSchema,
  MeetingsStatusSchema,
  StoredMeetingsPageSchema,
} from "./meetings.js";
import {
  MessagingSetupSaveSchema,
  MessagingSetupStateSchema,
  MessagingSetupTestResultSchema,
} from "./messaging-setup.js";
import {
  NotificationKindSchema,
  NotificationSchema,
  NotificationSignalSchema,
} from "./notification.js";
import {
  BotPageGetInputSchema,
  BotPageSaveInputSchema,
  BotPageSaveOutputSchema,
  BotPageSchema,
} from "./pages.js";
import {
  BotPinsGetInputSchema,
  BotPinsRefreshInputSchema,
  BotPinsRefreshOutputSchema,
  BotPinsSaveInputSchema,
  BotPinsSaveOutputSchema,
  BotPinsSchema,
} from "./pins.js";
import { MessageReactionSchema } from "./reactions.js";
import { RoutineHistorySchema, RoutineRunCursorSchema, RunsListOutputSchema } from "./runs.js";
import { SearchQueryOutputSchema } from "./search.js";
import {
  MoveSidebarFolderInput,
  MoveSidebarItemInput,
  SidebarSnapshotSchema,
} from "./sidebar-folders.js";
import { SidebarPageInputSchema, SidebarPagesStateSchema } from "./sidebar-pages.js";

const botId = z.object({ botId: Id });
const groupId = z.object({ groupId: Id });

const threadTarget = z
  .object({
    botId: Id.optional(),
    groupId: Id.optional(),
  })
  .superRefine((input, ctx) => {
    const hasBot = Boolean(input.botId);
    const hasGroup = Boolean(input.groupId);
    if (hasBot === hasGroup) {
      ctx.addIssue({
        code: "custom",
        message: "Provide exactly one of botId or groupId",
        path: ["botId"],
      });
    }
  });

const structuredMentionTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bot"), id: Id }),
  z.object({ kind: z.literal("group"), id: Id }),
  z.object({ kind: z.literal("routine"), id: Id }),
  z.object({ kind: z.literal("connector"), id: Id }),
]);

const threadSendInput = threadTarget
  .safeExtend({
    text: z.string().optional(),
    artifactIds: z.array(Id).max(ATTACHMENT_MAX_COUNT).optional(),
    /** Data room files sent by reference, to a bot thread only; the agent opens them by id. */
    dataRoomItemIds: z.array(Id).max(ATTACHMENT_MAX_COUNT).optional(),
    /** Bare bot ids (legacy) or typed mention chips from the composer. */
    mentions: z
      .array(z.union([Id, structuredMentionTarget]))
      .max(64)
      .optional(),
    replyToMessageId: Id.optional(),
    replyQuote: z.string().trim().min(1).max(REPLY_QUOTE_MAX_LENGTH).optional(),
    clientNonce: z.string().min(1).max(200).optional(),
  })
  .superRefine((input, ctx) => {
    const text = input.text?.trim() ?? "";
    const artifactIds = input.artifactIds ?? [];
    if (!text && artifactIds.length === 0 && !input.dataRoomItemIds?.length) {
      ctx.addIssue({
        code: "custom",
        message: "Provide text or at least one attachment",
        path: ["text"],
      });
    }
    if (input.replyQuote && !input.replyToMessageId) {
      ctx.addIssue({
        code: "custom",
        message: "replyQuote requires replyToMessageId",
        path: ["replyQuote"],
      });
    }
  });

const ConnectionAccessSchema = z.object({ allAgents: z.boolean(), botIds: z.array(Id) });
/** Who can really use each connection, computed by the server with the executor's rules. */
const EffectiveAccessSchema = z.record(
  Id,
  z.object({ shared: z.enum(["all", "some", "none"]), botIds: z.array(Id) }),
);

/** "browser" is the client's own permission; "push" is the phone. A missing key means on. */
const NotificationChannelsSchema = z
  .object({
    push: z.boolean().optional(),
    browser: z.boolean().optional(),
    imessage: z.boolean().optional(),
  })
  .strict();
export const NotificationPreferencesSchema = z.object({
  finish: z.boolean(),
  help: z.boolean(),
  takeover: z.boolean(),
  channels: NotificationChannelsSchema,
  /** The user has at least one registered phone push endpoint. */
  hasPhone: z.boolean(),
  /** The user has a linked, verified iMessage identity. */
  hasImessage: z.boolean(),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

/** The user's own "Export my data" zip. It is downloadable at /api/account/exports/{id}/download once ready. */
export const AccountExportSchema = z.object({
  id: Id,
  status: z.enum(["pending", "running", "ready", "failed"]),
  /** 0 to 100. */
  progress: z.number().int().min(0).max(100),
  /** When the zip is deleted. */
  expiresAt: IsoDate,
});
export type AccountExport = z.infer<typeof AccountExportSchema>;

const spaceName = z.string().trim().min(1).max(60);

export const appContract = {
  aiConsent: {
    status: oc.input(AiConsentQuerySchema).output(AiConsentStatusSchema),
    allow: oc
      .input(
        z.object({
          scope: z.string(),
          version: z.string(),
          keys: z.array(z.string()).min(1).max(200),
        }),
      )
      .output(AiConsentStatusSchema),
    revoke: oc.input(z.object({ key: z.string().nullable() })).output(AiConsentStatusSchema),
  },
  health: oc.output(z.object({ ok: z.literal(true), version: z.string() })),
  me: oc.output(MeSchema),
  billing: {
    status: oc.output(BillingStatusSchema),
    checkout: oc.output(z.object({ url: z.string().url() })),
    portal: oc.output(z.object({ url: z.string().url() })),
  },
  preferences: {
    update: oc
      .input(
        z.object({
          avatarStyle: AvatarStyleSchema.optional(),
          timezone: z.string().min(1).max(64).optional(),
          /** true records the tour as seen; false clears it so the tour can run again. */
          tourSeen: z.boolean().optional(),
          hiddenPages: z.array(z.string().min(1).max(64)).max(100).optional(),
        }),
      )
      .output(MeSchema),
  },
  spaces: {
    list: oc.output(SpaceNavigationSchema),
    create: oc.input(z.object({ name: spaceName })).output(SpaceSchema),
    rename: oc
      .input(z.object({ spaceId: Id, name: spaceName }))
      .output(z.object({ id: Id, name: z.string() })),
    remove: oc
      .input(z.object({ spaceId: Id }))
      .output(z.object({ ok: z.literal(true), activeSpaceId: Id })),
  },
  bootstrap: oc.input(z.object({ botId: Id.optional() })).output(AppBootstrapSchema),
  deployment: {
    get: oc.output(DeploymentSettingsSchema),
    update: oc
      .input(
        z.object({
          signupsEnabled: z.boolean().optional(),
          signupAllowlist: z.array(z.string()).optional(),
          computerHost: z.enum(["docker", "this-mac"]).nullable().optional(),
        }),
      )
      .output(DeploymentSettingsSchema),
  },
  /**
   * Deployment-owner product updates. When the Compose updater sidecar is reachable, these proxy
   * to its `/state` `/plan` `/apply` contract. Rollback stays on the sidecar for ops only and is
   * not exposed here. Never git-fetch from the API process.
   */
  updater: {
    status: oc.output(ServerUpdateStatusSchema),
    check: oc.input(ServerUpdateRequestSchema).output(ServerUpdateCheckSchema),
    apply: oc.input(ServerUpdateRequestSchema).output(ServerUpdateRunSchema),
  },
  models: {
    list: oc.output(z.array(ModelCatalogEntrySchema)),
    credentials: oc.output(z.array(ModelCredentialSchema)),
    backups: oc.output(z.array(ModelBackupChoiceSchema)),
    /** The Data room embedding model on the default connection; null when unset. */
    embeddingModel: oc.output(z.object({ modelId: z.string().nullable() })),
    setEmbeddingModel: oc
      .input(z.object({ modelId: z.string().trim().max(200).nullable() }))
      .output(z.object({ modelId: z.string().nullable() })),
    /** Whether new mail attachments are filed into the Data room automatically. */
    autoFileEmail: oc.output(z.object({ enabled: z.boolean() })),
    setAutoFileEmail: oc
      .input(z.object({ enabled: z.boolean() }))
      .output(z.object({ enabled: z.boolean() })),
    setBackups: oc.input(ModelBackupListSchema).output(z.object({ ok: z.literal(true) })),
    connect: oc.input(ModelConnectInputSchema).output(ModelCredentialSchema),
    probeOpenAiCompatible: oc
      .input(
        z.object({
          baseUrl: z.string(),
          apiKey: z.string().optional(),
        }),
      )
      .output(z.object({ models: z.array(z.string()) })),
    probeCatalog: oc
      .input(
        z.object({
          provider: z.string().trim().min(1),
          apiKey: z.string().trim().min(8),
        }),
      )
      .output(z.object({ models: z.array(z.string()) })),
    beginOAuth: oc
      .input(
        z.object({
          provider: z.string(),
          label: z.string().optional(),
          modelId: z.string().optional(),
          thinkingLevel: ThinkingLevelSchema.nullable().optional(),
        }),
      )
      .output(ModelOAuthBeginSchema),
    submitOAuthCode: oc
      .input(z.object({ loginId: z.string(), code: z.string().trim().min(1).max(8_192) }))
      .output(z.object({ ok: z.literal(true) })),
    completeOAuth: oc
      .input(z.object({ loginId: z.string() }))
      .output(
        z.discriminatedUnion("status", [
          z.object({ status: z.literal("pending") }),
          z.object({ status: z.literal("ready") }),
          z.object({ status: z.literal("error"), error: z.string() }),
        ]),
      ),
    finishOAuth: oc.input(z.object({ loginId: z.string() })).output(ModelCredentialSchema),
    beginOpenRouterOAuth: oc
      .input(z.object({ redirectUri: z.string().url() }))
      .output(z.object({ authorizationUrl: z.string().url() })),
    completeOpenRouterOAuth: oc
      .input(z.object({ code: z.string().min(1).max(2_048), state: z.string().min(1).max(256) }))
      .output(ModelCredentialSchema),
    cancelOAuth: oc
      .input(z.object({ loginId: z.string() }))
      .output(z.object({ ok: z.literal(true) })),
    setDefault: oc
      .input(
        z.object({
          provider: z.string(),
          modelId: z.string(),
          thinkingLevel: ThinkingLevelSchema.nullable().optional(),
        }),
      )
      .output(z.object({ ok: z.literal(true) })),
    disconnect: oc
      .input(z.object({ provider: z.string().trim().min(1) }))
      .output(z.object({ ok: z.literal(true) })),
  },
  bots: {
    list: oc.output(z.array(BotSchema)),
    listArchived: oc.output(z.array(BotSchema)),
    get: oc.input(botId).output(BotSchema),
    create: oc.input(CreateBotInput).output(BotSchema),
    duplicate: oc.input(botId).output(BotSchema),
    reorder: oc.input(ReorderBotsInput).output(z.object({ ok: z.literal(true) })),
    update: oc.input(UpdateBotInput).output(BotSchema),
    setComputer: oc.input(z.object({ botId: Id, mode: ComputerModeSchema })).output(BotSchema),
    archive: oc.input(botId).output(z.object({ ok: z.literal(true) })),
    restore: oc.input(botId).output(z.object({ ok: z.literal(true) })),
    remove: oc
      .input(z.object({ botId: Id, deleteMemories: z.boolean().default(false) }))
      .output(z.object({ ok: z.literal(true) })),
    rotateWebhookSecret: oc.input(botId).output(
      z.object({
        secret: z.string(),
        path: z.string(),
        webhookConfigured: z.literal(true),
      }),
    ),
  },
  groups: {
    create: oc.input(CreateGroupInput).output(GroupSchema),
    list: oc.output(z.array(GroupSchema)),
    listArchived: oc.output(z.array(GroupSchema)),
    get: oc.input(groupId).output(GroupDetailSchema),
    duplicate: oc.input(groupId).output(GroupSchema),
    update: oc.input(UpdateGroupInput).output(GroupSchema),
    archive: oc.input(groupId).output(z.object({ ok: z.literal(true) })),
    restore: oc.input(groupId).output(z.object({ ok: z.literal(true) })),
    remove: oc.input(groupId).output(z.object({ ok: z.literal(true) })),
  },
  botSections: {
    list: oc.output(z.array(BotSectionSchema)),
    create: oc
      .input(threadTarget.safeExtend({ name: z.string().trim().min(1).max(60) }))
      .output(BotSectionSchema),
    update: oc
      .input(z.object({ sectionId: Id, name: z.string().trim().min(1).max(60) }))
      .output(BotSectionSchema),
    /** An empty folder; `create` also files a bot or group into the new one. */
    add: oc.input(z.object({ name: z.string().trim().min(1).max(60) })).output(BotSectionSchema),
    /** Items in the folder move to the root; nothing else is deleted. */
    remove: oc.input(z.object({ sectionId: Id })).output(z.object({ ok: z.literal(true) })),
    setCollapsed: oc
      .input(z.object({ sectionId: Id, collapsed: z.boolean() }))
      .output(BotSectionSchema),
  },
  sidebar: {
    move: oc.input(MoveSidebarItemInput).output(z.object({ ok: z.literal(true) })),
    moveFolder: oc.input(MoveSidebarFolderInput).output(z.object({ ok: z.literal(true) })),
    autoGroup: oc.output(SidebarSnapshotSchema),
    restore: oc.input(SidebarSnapshotSchema).output(z.object({ ok: z.literal(true) })),
  },
  threads: {
    head: oc.input(threadTarget).output(
      z.object({
        threadId: Id,
        cursor: z.number().int().min(-1),
      }),
    ),
    get: oc.input(threadTarget).output(ThreadSnapshotSchema),
    messages: oc
      .input(
        threadTarget.safeExtend({
          before: z.number().int().nonnegative().optional(),
          includePeerRuns: z.boolean().optional(),
          includePeerReceipts: z.boolean().optional(),
          around: z
            .object({
              messageId: Id.optional(),
              seq: z.number().int().nonnegative().optional(),
            })
            .optional(),
        }),
      )
      .output(ThreadMessagePageSchema),
    subscribe: oc
      .input(threadTarget.safeExtend({ cursor: z.number().int().min(-1) }))
      .output(eventIterator(ProductEventSchema)),
    send: oc.input(threadSendInput).output(
      z.object({
        taskId: Id,
        runId: Id,
        seq: z.number().int(),
        runIds: z.array(Id).optional(),
      }),
    ),
    react: oc
      .input(
        threadTarget.safeExtend({
          messageId: Id,
          reaction: MessageReactionSchema,
          clientNonce: z.string().min(1).max(200),
        }),
      )
      .output(z.object({ ok: z.literal(true) })),
    remember: oc
      .input(threadTarget.safeExtend({ messageId: Id }))
      .output(z.object({ ok: z.literal(true) })),
    remembered: oc.input(threadTarget).output(z.object({ messageIds: z.array(Id) })),
    stop: oc.input(threadTarget).output(z.object({ ok: z.literal(true) })),
    followUp: oc
      .input(
        threadTarget.safeExtend({
          text: z.string().min(1),
          /** Carries the call id, so a turn taken mid-run stays in the call's card. */
          clientNonce: z.string().min(1).max(200).optional(),
        }),
      )
      .output(z.object({ ok: z.literal(true) })),
    /** The client hung up: close the call card and let the bot finish what was asked on it. */
    endCall: oc
      // ":" separates the call id from the nonce suffix, so it can never appear inside one.
      .input(
        botId.safeExtend({
          callId: z
            .string()
            .min(1)
            .max(200)
            .regex(/^[^:]+$/),
        }),
      )
      .output(z.object({ ok: z.literal(true) })),
    clear: oc.input(threadTarget).output(z.object({ ok: z.literal(true) })),
    answer: oc
      .input(
        threadTarget.safeExtend({
          runId: Id,
          messageId: Id,
          answer: z.string().min(1),
          /** Carries the call id for an answer spoken during a call. */
          clientNonce: z.string().min(1).max(200).optional(),
          /** Only for a login card; `answer` carries its password. */
          username: z.string().min(1).max(512).optional(),
          /** Only with "allow" on a mail approval: fields the person changed. Recipients are comma-separated text. */
          mail: MailEditsSchema.optional(),
        }),
      )
      .output(z.object({ ok: z.literal(true) })),
    /**
     * Moves the read boundary forward to the message `upToMessageId` (the newest when omitted);
     * never backward, and an unknown id changes nothing. `toEnd` says the reader reached the end of
     * the latest page, which clears the unread flag even when newer stored messages are hidden.
     */
    markRead: oc
      .input(
        threadTarget.safeExtend({ upToMessageId: Id.optional(), toEnd: z.boolean().optional() }),
      )
      .output(z.object({ ok: z.literal(true) })),
    markUnread: oc.input(threadTarget).output(z.object({ ok: z.literal(true) })),
  },
  computer: {
    status: oc.input(botId).output(ComputerStatusSchema),
    boot: oc.input(botId).output(ComputerStatusSchema),
    stop: oc.input(botId).output(ComputerStatusSchema),
    recover: oc.input(botId).output(ComputerUpdateSchema),
    reset: oc.input(botId).output(ComputerStatusSchema),
    update: oc.input(botId).output(ComputerUpdateSchema),
    updates: oc.output(z.array(ComputerUpdateSchema)),
    releaseInterrupted: oc
      .input(z.object({ id: Id, workersStopped: z.literal(true) }))
      .output(z.object({ ok: z.literal(true) })),
    dismissUpdate: oc.input(z.object({ id: Id })).output(z.object({ ok: z.literal(true) })),
    takeover: oc.input(botId).output(z.object({ leaseId: Id, expiresAt: z.string() })),
    release: oc
      .input(
        z.object({
          botId: Id,
          reason: ComputerReleaseReasonSchema.optional(),
        }),
      )
      .output(z.object({ ok: z.literal(true) })),
    input: oc
      .input(
        z.object({
          botId: Id,
          kind: z.enum(["key", "pointer", "clipboard", "scroll"]),
          payload: z.record(z.string(), z.unknown()),
        }),
      )
      .output(z.object({ ok: z.literal(true) })),
    files: oc
      .input(z.object({ botId: Id, path: z.string().default("/") }))
      .output(
        z.array(z.object({ path: z.string(), kind: z.enum(["file", "dir"]), size: z.number() })),
      ),
    readFile: oc
      .input(z.object({ botId: Id, path: z.string() }))
      .output(z.object({ path: z.string(), content: z.string() })),
    downloadFile: oc
      .input(z.object({ botId: Id, path: z.string().min(1) }))
      .output(z.object({ path: z.string(), contentBase64: z.string() })),
    uploadFile: oc
      .input(
        z.object({
          botId: Id,
          path: z.string().min(1),
          contentBase64: z.string().max(ATTACHMENT_MAX_BASE64_LENGTH),
        }),
      )
      .output(z.object({ ok: z.literal(true) })),
    terminalUrl: oc.input(botId).output(z.object({ url: z.string().nullable() })),
    commands: oc
      .input(botId)
      .output(z.array(ComputerCommandSchema.extend({ createdAt: z.string() }))),
    screenUrl: oc.input(botId).output(z.object({ url: z.string().nullable() })),
    heartbeat: oc.input(botId).output(z.object({ ok: z.literal(true) })),
  },
  memory: {
    list: oc
      .input(z.object({ botId: Id.optional(), scope: z.enum(["bot", "user"]).optional() }))
      .output(z.array(MemoryDocumentSchema)),
    update: oc
      .input(z.object({ documentId: Id, content: z.string() }))
      .output(MemoryDocumentSchema),
    exportMarkdown: oc.input(z.object({ botId: Id.optional() })).output(z.string()),
    providerConfig: oc.output(SpaceMemoryConfigSchema.nullable()),
    connectProvider: oc
      .input(
        z.object({
          provider: z.string().min(1),
          settings: z.record(z.string(), z.string()),
          credentials: z.record(z.string(), z.string()),
          defaultMemoryScope: MemoryScopeSchema.default("isolated"),
        }),
      )
      .output(SpaceMemoryConfigSchema),
    setDefaultScope: oc
      .input(z.object({ defaultMemoryScope: MemoryScopeSchema }))
      .output(SpaceMemoryConfigSchema),
    disconnectProvider: oc.output(z.object({ ok: z.literal(true) })),
  },
  pages: {
    get: oc.input(BotPageGetInputSchema).output(BotPageSchema.nullable()),
    save: oc.input(BotPageSaveInputSchema).output(BotPageSaveOutputSchema),
  },
  pins: {
    get: oc.input(BotPinsGetInputSchema).output(BotPinsSchema.nullable()),
    save: oc.input(BotPinsSaveInputSchema).output(BotPinsSaveOutputSchema),
    refresh: oc.input(BotPinsRefreshInputSchema).output(BotPinsRefreshOutputSchema),
  },
  routines: {
    list: oc.input(botId).output(z.array(RoutineSchema)),
    history: oc
      .input(z.object({ routineId: Id, before: RoutineRunCursorSchema.optional() }))
      .output(RoutineHistorySchema),
    create: oc.input(CreateRoutineInput).output(RoutineSchema),
    update: oc
      .input(
        z
          .object({
            routineId: Id,
            name: z.string().optional(),
            prompt: z.string().optional(),
            crons: z.array(z.string().min(1)).optional(),
            timezone: z.string().optional(),
            active: z.boolean().optional(),
            notify: z.boolean().optional(),
            webhookEnabled: z.boolean().optional(),
            githubEnabled: z.boolean().optional(),
            messageProvider: z
              .string()
              .min(1)
              .max(50)
              .regex(/^[a-z0-9._-]+$/i)
              .nullable()
              .optional(),
            /** Null clears the routine's own model and runs it on the bot's. */
            modelProvider: z.string().trim().min(1).max(80).nullable().optional(),
            modelId: z.string().trim().min(1).max(200).nullable().optional(),
            thinkingLevel: ThinkingLevelSchema.nullable().optional(),
            /** ISO datetime to arm a never-run one-shot. */
            runAt: IsoDate.optional(),
          })
          .superRefine((value, ctx) => {
            if (
              value.crons &&
              value.crons.length === 0 &&
              value.webhookEnabled === false &&
              value.githubEnabled === false &&
              value.messageProvider === null
            ) {
              ctx.addIssue({
                code: "custom",
                message: "Add a schedule, webhook, GitHub, or message trigger",
                path: ["crons"],
              });
            }
          }),
      )
      .output(RoutineSchema),
    remove: oc.input(z.object({ routineId: Id })).output(z.object({ ok: z.literal(true) })),
    testRun: oc
      .input(
        z.object({
          routineId: Id,
          clientNonce: z.string().min(1).max(200).optional(),
        }),
      )
      .output(z.object({ runId: Id })),
  },
  scratchpad: {
    list: oc
      .input(
        z.object({
          botId: Id,
          status: ScratchpadItemStatusSchema.optional(),
          includeDone: z.boolean().optional(),
        }),
      )
      .output(z.array(ScratchpadItemSchema)),
    create: oc.input(CreateScratchpadItemInput).output(ScratchpadItemSchema),
    update: oc
      .input(
        z.object({
          itemId: Id,
          title: z.string().min(1).max(200).optional(),
          status: ScratchpadItemStatusSchema.optional(),
          notes: z.string().max(4_000).optional(),
        }),
      )
      .output(ScratchpadItemSchema),
    remove: oc.input(z.object({ itemId: Id })).output(z.object({ ok: z.literal(true) })),
  },
  boards: {
    list: oc.output(z.array(BoardSchema)),
    get: oc.output(BoardSchema),
    rename: oc.input(RenameBoardInput).output(BoardSchema),
    subscribe: oc.output(eventIterator(BoardEventSchema)),
  },
  tickets: {
    list: oc.input(ListTicketsInput).output(ListTicketsOutput),
    get: oc.input(GetTicketInput).output(TicketSchema),
    create: oc.input(CreateTicketInput).output(TicketSchema),
    update: oc.input(UpdateTicketInput).output(TicketSchema),
    move: oc.input(MoveTicketInput).output(TicketSchema),
    comment: oc.input(CommentTicketInput).output(TicketCommentSchema),
    comments: oc.input(z.object({ ticketId: Id })).output(z.array(TicketCommentSchema)),
  },
  skills: {
    list: oc.input(botId).output(z.array(TaughtSkillSchema)),
    get: oc.input(z.object({ skillId: Id })).output(TaughtSkillSchema),
    start: oc
      .input(z.object({ botId: Id, goal: z.string().min(1).max(4000) }))
      .output(TaughtSkillSchema),
    appendEvent: oc
      .input(z.object({ skillId: Id, event: TeachRecordingEventSchema }))
      .output(TaughtSkillSchema),
    snapshot: oc.input(z.object({ skillId: Id })).output(TaughtSkillSchema),
    stop: oc.input(z.object({ skillId: Id })).output(TaughtSkillSchema),
    updateDraft: oc
      .input(
        z.object({
          skillId: Id,
          name: z.string().optional(),
          playbook: SkillPlaybookSchema,
        }),
      )
      .output(TaughtSkillSchema),
    save: oc
      .input(z.object({ skillId: Id, name: z.string().optional() }))
      .output(TaughtSkillSchema),
    testRun: oc
      .input(z.object({ skillId: Id, prompt: z.string().optional() }))
      .output(z.object({ runId: Id })),
    remove: oc.input(z.object({ skillId: Id })).output(z.object({ ok: z.literal(true) })),
  },
  /** Claude Agent Skills (SKILL.md recipes) shared across assistants (not taught/demo skills). Pi already understands this format; we persist and inject them. */
  agentSkills: {
    list: oc.output(z.array(AgentSkillCatalogEntrySchema)),
    get: oc
      .input(
        z
          .object({ skillId: Id.optional(), name: z.string().min(1).max(80).optional() })
          .superRefine((input, ctx) => {
            if (!input.skillId && !input.name?.trim()) {
              ctx.addIssue({
                code: "custom",
                message: "Provide skillId or name",
                path: ["skillId"],
              });
            }
          }),
      )
      .output(AgentSkillSchema),
    create: oc.input(CreateAgentSkillInput).output(AgentSkillSchema),
    update: oc.input(UpdateAgentSkillInput).output(AgentSkillSchema),
    remove: oc.input(z.object({ skillId: Id })).output(z.object({ ok: z.literal(true) })),
    /** Agent-written skills and revisions waiting for the owner. */
    drafts: oc.output(z.array(AgentSkillDraftSchema)),
    approveDraft: oc.input(z.object({ skillId: Id })).output(AgentSkillSchema),
    discardDraft: oc.input(z.object({ skillId: Id })).output(z.object({ ok: z.literal(true) })),
    /** The catalog with this bot's on/off switch per skill. */
    forBot: oc.input(botId).output(z.array(BotAgentSkillSchema)),
    setEnabled: oc
      .input(z.object({ botId: Id, skillKey: z.string().min(1).max(200), enabled: z.boolean() }))
      .output(z.object({ ok: z.literal(true) })),
    /** Fetch a public GitHub or raw SKILL.md and store it as a user skill. */
    importFromUrl: oc
      .input(z.object({ url: z.string().trim().url().max(2048) }))
      .output(AgentSkillSchema),
  },
  capabilities: {
    list: oc.output(z.array(CapabilityInstallSchema)),
    catalogSearch: oc
      .input(
        z.object({
          query: z.string().trim().max(253).default(""),
          usePublicCatalog: z.boolean().default(false),
        }),
      )
      .output(
        z.object({
          enabled: z.boolean(),
          results: z.array(IntegrationCatalogResultSchema),
        }),
      ),
    install: oc
      .input(
        z.object({
          kind: z.enum(["skill", "plugin", "mcp", "api", "graphql"]),
          name: z.string().min(1).max(120),
          source: z.string().min(1).max(2048),
          config: z.record(z.string(), z.unknown()).default({}),
          credential: z.string().max(16_384).optional(),
        }),
      )
      .output(CapabilityInstallSchema),
    remove: oc.input(z.object({ id: Id })).output(z.object({ ok: z.literal(true) })),
  },
  integrationAgents: {
    /** Idempotent: returns the server's agent bot, creating it on first call. */
    create: oc
      .input(z.object({ serverId: Id }))
      .output(z.object({ server: McpServerSchema, botId: Id })),
    /** Only the agent may use the server. Reversible; no assignment rows are deleted. */
    setExclusive: oc
      .input(z.object({ serverId: Id, exclusive: z.boolean() }))
      .output(McpServerSchema),
  },
  mcp: {
    servers: {
      list: oc.output(z.array(McpServerSchema)),
      create: oc.input(McpServerConfigInput).output(McpServerSchema),
      update: oc
        .input(
          z.union([
            z.object({ id: Id, config: McpServerConfigInput }),
            z.object({ id: Id, secret: z.string().min(1).max(16384) }),
          ]),
        )
        .output(McpServerSchema),
      /** Name-only edit: unlike update, never rewrites stored credentials. */
      rename: oc
        .input(z.object({ id: Id, name: z.string().trim().min(1).max(120) }))
        .output(McpServerSchema),
      remove: oc.input(z.object({ id: Id })).output(z.object({ ok: z.literal(true) })),
      /** Turns the server's write tools on or off (Carta, or any server that has an agent). */
      setWrites: oc.input(z.object({ id: Id, enabled: z.boolean() })).output(McpServerSchema),
    },
    assignments: {
      list: oc.input(botId).output(z.array(BotMcpServerSchema)),
      all: oc.output(z.array(BotMcpServerSchema)),
      approve: oc
        .input(z.object({ botId: Id, serverId: Id, threadId: Id.optional() }))
        .output(BotMcpServerSchema),
      dismiss: oc
        .input(z.object({ botId: Id, serverId: Id, threadId: Id.optional() }))
        .output(z.object({ ok: z.literal(true) })),
      replace: oc
        .input(
          z.object({
            botId: Id,
            assignments: z.array(
              z.object({
                serverId: Id,
                allowAllTools: z.boolean().default(true),
                allowedTools: z.array(z.string().min(1).max(200)).max(500).default([]),
              }),
            ),
          }),
        )
        .output(z.array(BotMcpServerSchema)),
    },
    oauth: {
      begin: oc
        .input(
          z.object({
            serverId: Id,
            redirectUri: z.string().url(),
            /** Ask the user to sign in again even though a token is stored. The old
             * token stays until the new authorization completes. */
            reauthorize: z.boolean().optional(),
            /** Stored with the server and reused on later sign-ins. */
            oauthClient: McpOauthClientSchema.optional(),
          }),
        )
        .output(
          z.discriminatedUnion("status", [
            z.object({
              status: z.literal("authorization_required"),
              sessionId: Id,
              authorizationUrl: z.string().url(),
            }),
            z.object({
              status: z.enum(["already_connected", "authorization_not_requested"]),
            }),
          ]),
        ),
      complete: oc
        .input(z.object({ sessionId: Id, code: z.string().min(1), state: z.string().min(1) }))
        .output(z.object({ ok: z.literal(true) })),
      disconnect: oc.input(z.object({ serverId: Id })).output(z.object({ ok: z.literal(true) })),
    },
  },
  onboarding: {
    /** Seed the first-run greeting into the bot's thread (focus card is separate). */
    start: oc.input(z.object({ botId: Id })).output(z.object({ ok: z.literal(true) })),
    /** Post the focus choice card when the thread is still idle. */
    promptFocus: oc.input(z.object({ botId: Id })).output(z.object({ ok: z.literal(true) })),
    /** Answer the focus choice; posts the app cards. Does not rename the bot. */
    choose: oc
      .input(z.object({ botId: Id, optionId: z.string() }))
      .output(z.object({ ok: z.literal(true) })),
    /** Dismiss the unanswered focus card without choosing an option. */
    dismissFocus: oc.input(z.object({ botId: Id })).output(z.object({ ok: z.literal(true) })),
    /** Flip an app_connect card to connected after authorization completes. */
    appConnected: oc
      .input(
        z.object({ botId: Id, provider: z.string(), connectorId: z.string().default("composio") }),
      )
      .output(z.object({ ok: z.literal(true) })),
  },
  integrationSetup: {
    get: oc.output(IntegrationSetupStateSchema),
    save: oc.input(IntegrationProviderConfigSchema).output(z.object({ ok: z.literal(true) })),
  },
  connections: {
    catalog: oc
      .input(z.object({ query: z.string().optional(), connectorId: z.string().optional() }))
      .output(z.array(ConnectionCatalogItemSchema)),
    featured: oc.output(z.array(ConnectionCatalogItemSchema)),
    list: oc.output(z.array(ConnectionSchema)),
    begin: oc
      .input(
        z.object({
          connectorId: z.string().default("composio"),
          provider: z.string(),
          displayName: z.string(),
          /** `desktop`: Google returns to the app's loopback listener instead of the web callback. */
          redirect: z.literal("desktop").optional(),
          /** Reconnect: the account of this connection may sign in again and takes its place. */
          replacesConnectionId: Id.optional(),
          /** Native Google only: also ask for permission to manage Gmail filters. */
          permission: z.literal("mail_rules").optional(),
        }),
      )
      .output(z.object({ connectionId: Id, authorizationUrl: z.string().nullable() })),
    /** Poll with `connectionId`, or finish a native OAuth callback with `state` and `code`. */
    complete: oc
      .input(
        z
          .object({
            connectionId: Id.optional(),
            state: z.string().min(1).max(512).optional(),
            code: z.string().optional(),
          })
          .refine(
            (input) =>
              (input.connectionId === undefined) !== (input.state === undefined) &&
              (input.state === undefined || Boolean(input.code)),
            "Provide connectionId, or state with code",
          ),
      )
      .output(ConnectionSchema),
    rename: oc
      .input(z.object({ connectionId: Id, displayName: z.string().trim().min(1).max(80) }))
      .output(ConnectionSchema),
    revoke: oc.input(z.object({ connectionId: Id })).output(z.object({ ok: z.literal(true) })),
    /** Which agents may use this connection's tools. */
    access: oc.input(z.object({ connectionId: Id })).output(ConnectionAccessSchema),
    /** The agents that can really use each of the caller's connections, in one call. */
    effectiveAccess: oc.output(EffectiveAccessSchema),
    setAccess: oc
      .input(z.object({ connectionId: Id, allAgents: z.boolean(), botIds: z.array(Id).max(500) }))
      .output(ConnectionAccessSchema),
    createAgent: oc.input(z.object({ connectionId: Id })).output(z.object({ botId: Id })),
    setWrites: oc
      .input(z.object({ connectionId: Id, enabled: z.boolean() }))
      .output(ConnectionSchema),
    setExclusive: oc
      .input(z.object({ connectionId: Id, exclusive: z.boolean() }))
      .output(ConnectionSchema),
    /** Tools the connected provider exposes. Read-only; no per-tool allowlist yet. */
    tools: oc.input(z.object({ connectorId: z.string(), provider: z.string() })).output(
      z.array(
        z.object({
          name: z.string(),
          description: z.string(),
        }),
      ),
    ),
  },
  /** External messaging surface: link state, group channels, agent connections. */
  messagingSetup: {
    get: oc.output(MessagingSetupStateSchema),
    save: oc.input(MessagingSetupSaveSchema).output(z.object({ ok: z.literal(true) })),
    test: oc
      .input(z.object({ provider: z.enum(["bluebubbles", "photon"]) }))
      .output(MessagingSetupTestResultSchema),
  },
  messaging: {
    status: oc.output(MessagingStatusSchema),
    link: {
      /** Issue a short-lived code the user sends to the line from a chat app. */
      start: oc
        .input(z.object({ botId: Id }))
        .output(z.object({ code: z.string(), expiresAt: z.string() })),
    },
    identities: {
      setBot: oc
        .input(z.object({ identityId: Id, botId: Id }))
        .output(MessagingLinkedIdentitySchema),
      unlink: oc.input(z.object({ identityId: Id })).output(z.object({ ok: z.literal(true) })),
    },
    channels: {
      list: oc.output(z.array(MessagingChannelMembershipSchema)),
      // Addressed by membership, not channel: one user can have two linked
      // chat apps in the same group, and each answers for its own agent.
      respond: oc
        .input(z.object({ membershipId: Id, accept: z.boolean() }))
        .output(MessagingChannelMembershipSchema),
      leave: oc.input(z.object({ membershipId: Id })).output(z.object({ ok: z.literal(true) })),
    },
    connections: {
      list: oc.output(z.array(MessagingAgentConnectionSchema)),
      respond: oc
        .input(z.object({ connectionId: Id, accept: z.boolean() }))
        .output(MessagingAgentConnectionSchema),
      revoke: oc.input(z.object({ connectionId: Id })).output(z.object({ ok: z.literal(true) })),
    },
  },
  approvalRules: {
    list: oc.output(z.array(ActionApprovalRuleSchema)),
    set: oc
      .input(
        z.object({
          effect: z.enum(["always_allow", "require_approval"]),
          matchKind: z.enum(["tool", "connector", "category"]),
          matchValue: z.string().min(1),
        }),
      )
      .output(ActionApprovalRuleSchema),
    remove: oc.input(z.object({ id: Id })).output(z.object({ ok: z.literal(true) })),
  },
  autoReview: {
    get: oc.output(ActionAutoReviewSettingsSchema),
    set: oc.input(z.object({ enabled: z.boolean() })).output(ActionAutoReviewSettingsSchema),
  },
  artifacts: {
    list: oc.input(botId).output(z.array(ArtifactSchema)),
    listSpace: oc
      .input(
        z.object({
          botId: Id.optional(),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(60).optional(),
        }),
      )
      .output(
        z.object({
          items: z.array(ArtifactSchema.extend({ versionCount: z.number().int() })),
          nextCursor: z.string().nullable(),
        }),
      ),
    listVersions: oc.input(z.object({ familyId: Id })).output(z.array(ArtifactVersionSchema)),
    create: oc
      .input(
        threadTarget.and(
          z.object({
            name: z.string().min(1).max(ARTIFACT_NAME_MAX_LENGTH),
            description: z.string().max(ARTIFACT_DESCRIPTION_MAX_LENGTH).optional(),
            mimeType: z.string().min(1),
            contentBase64: z.string().min(1).max(ATTACHMENT_MAX_BASE64_LENGTH),
            /** Unique per upload; a retry with the same nonce returns the artifact it created. */
            clientNonce: z.string().min(1).max(200).optional(),
          }),
        ),
      )
      .output(ArtifactSchema),
    get: oc.input(threadTarget.and(z.object({ artifactId: Id }))).output(ArtifactWithContentSchema),
    getById: oc.input(z.object({ artifactId: Id })).output(ArtifactWithContentSchema),
    remove: oc.input(z.object({ artifactId: Id })).output(z.object({ ok: z.literal(true) })),
  },
  files: {
    /** One page of a spreadsheet (.xlsx, .xlsm, .csv, .tsv) from an artifact or a Data room item. */
    spreadsheetPreview: oc.input(SpreadsheetPreviewInputSchema).output(SpreadsheetPreviewSchema),
  },
  usage: {
    list: oc.output(z.array(UsageRecordSchema)),
    summary: oc.output(
      z.object({
        inputTokens: z.number().nullable(),
        outputTokens: z.number().nullable(),
        totalTokens: z.number().nullable().optional(),
        modelCalls: z.number().optional(),
        runs: z.number(),
      }),
    ),
  },
  account: {
    /** Starts an export, or returns the one already running. */
    exportRequest: oc.output(AccountExportSchema),
    /** The newest export that is running or not yet expired, if any. */
    exportLatest: oc.output(AccountExportSchema.nullable()),
  },
  export: {
    bot: oc.input(botId).output(ExportManifestSchema),
  },
  notifications: {
    registerPush: oc
      // No whitespace: the token store keeps the registering session on the next line.
      .input(
        z.object({
          token: z.string().min(8).max(512).regex(/^\S+$/),
          /** This device's previous token, removed when the token rotated. */
          replacesToken: z.string().min(8).max(512).regex(/^\S+$/).optional(),
        }),
      )
      .output(z.object({ ok: z.literal(true) })),
    unregisterPush: oc.output(z.object({ ok: z.literal(true) })),
    preferences: oc.output(NotificationPreferencesSchema),
    updatePreferences: oc
      .input(
        z.object({
          finish: z.boolean().optional(),
          help: z.boolean().optional(),
          takeover: z.boolean().optional(),
          channels: NotificationChannelsSchema.optional(),
        }),
      )
      .output(NotificationPreferencesSchema),
    list: oc
      // Oldest first. Pass `nextCursor` back until it is null to catch up completely.
      .input(
        z.object({
          since: z.string().datetime().optional(),
          cursor: z.string().max(200).optional(),
        }),
      )
      .output(
        z.object({
          notifications: z.array(NotificationSchema),
          nextCursor: z.string().nullable(),
        }),
      ),
    markSeen: oc
      // `id` or `threadId` narrows it to one notification or one thread on the surface. `botId`
      // alone marks everything from that agent seen, whatever its surface.
      .input(
        z
          .object({
            surface: z.string().min(1).max(64).optional(),
            botId: z.string().min(1).optional(),
            id: z.string().min(1).optional(),
            threadId: z.string().min(1).optional(),
          })
          .refine((v) => v.surface || v.botId, "surface or botId is required"),
      )
      .output(z.object({ count: z.number() })),
    markShown: oc.input(z.object({ id: z.string().min(1) })).output(z.object({ ok: z.boolean() })),
    unseenCounts: oc.output(z.object({ counts: z.record(z.string(), z.number()) })),
    /** What each sidebar row shows beside its name; null when not available. One call for the space. */
    glance: oc.output(
      z.object({
        financeRunwayMonths: z.number().nullable(),
        legalDueSoon: z.number().int(),
        /** Devin sessions that need a person (waiting or failed) on the space's active connection. */
        devinNeedsYou: z.number().int(),
        dataRoomWaiting: z.number().int(),
        /** Per agent with unseen notifications, the highest-priority kind. */
        botKinds: z.record(z.string(), NotificationKindSchema),
      }),
    ),
    subscribe: oc.output(eventIterator(NotificationSignalSchema)),
  },
  search: {
    query: oc.input(z.object({ q: z.string().max(200) })).output(SearchQueryOutputSchema),
  },
  links: {
    /**
     * The site icon for a link's origin as a small data URL, resolved and cached by the server.
     * `retry` means the server was too busy to look; the origin may still have an icon.
     */
    favicon: oc
      // The longest origin: a scheme, a 253-character host name and a port.
      .input(z.object({ origin: z.string().max("https://".length + 253 + ":65535".length) }))
      .output(z.object({ icon: z.string().nullable(), retry: z.boolean().optional() })),
  },
  runs: {
    list: oc.input(z.object({ filter: z.enum(["active", "recent"]) })).output(RunsListOutputSchema),
  },
  /** Names that help a transcription provider spell: built per request, never stored. */
  dictation: {
    vocabulary: oc.output(z.array(z.string())),
  },
  voice: {
    agent: oc.output(BotSchema),
    catalog: oc.output(z.array(VoiceCatalogEntrySchema)),
    status: oc.output(VoiceStatusSchema),
    credentials: oc.output(z.array(VoiceCredentialSchema)),
    /** Select a transcription provider with its own key. The key is never returned. */
    setTranscription: oc
      .input(z.object({ provider: z.string().min(1), apiKey: z.string().min(8) }))
      .output(z.object({ provider: z.string() })),
    clearTranscription: oc.output(z.object({ ok: z.literal(true) })),
    connect: oc
      .input(
        z.object({
          provider: z.string(),
          apiKey: z.string().min(8),
          voiceId: z.string().max(120).optional(),
          speechModel: z.string().max(64).optional(),
        }),
      )
      .output(VoiceCredentialSchema),
    disconnect: oc
      .input(z.object({ provider: z.string().min(1) }))
      .output(z.object({ ok: z.literal(true) })),
    setVoice: oc
      .input(z.object({ voiceId: z.string().min(1).max(120), provider: z.string().optional() }))
      .output(VoiceStatusSchema),
    setSpeechModel: oc
      .input(z.object({ provider: z.string().min(1), speechModel: z.string().max(64) }))
      .output(VoiceCredentialSchema),
    voices: oc
      .input(z.object({ provider: z.string().optional() }))
      .output(z.array(VoiceInfoSchema)),
    prepare: oc
      .input(
        z.object({
          text: z.string().max(20000),
          voiceId: z.string().max(120).optional(),
          botId: Id.optional(),
        }),
      )
      .output(z.object({ ready: z.boolean(), utterances: z.array(z.string()) })),
  },
  externalConversations: {
    updatePolicy: oc
      .input(UpdateExternalConversationPolicyInput)
      .output(ExternalConversationPolicySchema),
  },
  agentSecrets: {
    list: oc.output(z.array(AgentSecretSchema)),
    put: oc.input(AgentSecretInputSchema).output(AgentSecretSchema),
    remove: oc.input(z.object({ id: Id })).output(z.object({ ok: z.literal(true) })),
  },
  inbox: {
    agent: oc.output(BotSchema),
    /** Idempotent per mail conversation: opens the agent made for the message's thread, with the thread as context. */
    askAgent: oc.input(z.object({ messageId: Id })).output(BotSchema),
    list: oc.input(InboxListInputSchema).output(InboxListOutputSchema),
    refresh: oc.input(InboxRefreshInputSchema).output(InboxRefreshOutputSchema),
    get: oc.input(z.object({ messageId: Id })).output(InboxMessageSchema),
    unreadCount: oc.output(z.object({ count: z.number().int() })),
    feedback: oc.input(InboxFeedbackInputSchema).output(InboxFeedbackOutputSchema),
    markRead: oc.input(InboxMarkReadInputSchema).output(z.object({ ok: z.literal(true) })),
    archive: oc.input(z.object({ messageId: Id })).output(z.object({ ok: z.literal(true) })),
    unarchive: oc.input(z.object({ messageId: Id })).output(z.object({ ok: z.literal(true) })),
    archiveMany: oc.input(InboxBulkInputSchema).output(InboxBulkResultSchema),
    unarchiveMany: oc.input(InboxBulkInputSchema).output(InboxBulkResultSchema),
    moveMany: oc.input(InboxMoveInputSchema).output(InboxMoveOutputSchema),
    unsubscribe: oc.input(UnsubscribeInputSchema).output(UnsubscribeOutputSchema),
    cleanup: {
      list: oc.input(CleanupListInputSchema).output(CleanupListOutputSchema),
      archive: oc.input(CleanupArchiveInputSchema).output(CleanupArchiveOutputSchema),
      forget: oc.input(CleanupForgetInputSchema).output(z.object({ ok: z.literal(true) })),
    },
    actions: {
      list: oc.input(z.object({})).output(MailActionsListOutputSchema),
      undo: oc.input(MailActionUndoInputSchema).output(MailActionUndoOutputSchema),
    },
    compose: {
      prefill: oc.input(ComposePrefillInputSchema).output(ComposePrefillOutputSchema),
      draftSave: oc.input(ComposeFieldsSchema).output(ComposeResultSchema),
      send: oc.input(ComposeFieldsSchema).output(ComposeResultSchema),
      discard: oc
        .input(z.object({ clientId: ComposeClientId }))
        .output(z.object({ ok: z.literal(true) })),
    },
    todos: {
      list: oc.input(InboxScopeInputSchema).output(InboxTodosOutputSchema),
      setDone: oc.input(z.object({ id: Id, done: z.boolean() })).output(InboxTodoSchema),
    },
  },
  dataRoom: {
    /** Idempotent: creates the Data room agent; returns the bot to open in the side panel. */
    agent: oc.output(BotSchema),
    folders: oc.output(z.array(DataRoomApiFolderSchema)),
    /** Omit folderId for every folder; null for items outside any folder. */
    /** Each facet's values given the other filters, so no pick combines into nothing. */
    facetValues: oc.input(DataRoomApiFiltersSchema).output(DataRoomApiFacetValuesSchema),
    /** Counts and sizes of the documents the filters match, grouped for the Stats view. */
    stats: oc.input(DataRoomApiFiltersSchema).output(DataRoomApiStatsSchema),
    folderCreate: oc
      .input(z.object({ name: DataRoomApiName, parentId: Id.nullable().optional() }))
      .output(DataRoomApiFolderSchema),
    folderRename: oc
      .input(z.object({ id: Id, name: DataRoomApiName }))
      .output(DataRoomApiFolderSchema),
    folderMove: oc
      .input(z.object({ id: Id, parentId: Id.nullable() }))
      .output(DataRoomApiFolderSchema),
    folderDelete: oc.input(z.object({ id: Id })).output(z.object({ ok: z.literal(true) })),
    items: {
      list: oc.input(DataRoomApiItemListInputSchema).output(DataRoomApiItemListOutputSchema),
    },
    item: oc.input(z.object({ id: Id })).output(DataRoomApiItemSchema),
    itemRename: oc.input(z.object({ id: Id, name: DataRoomApiName })).output(DataRoomApiItemSchema),
    itemMove: oc.input(z.object({ id: Id, folderId: Id.nullable() })).output(DataRoomApiItemSchema),
    itemDelete: oc.input(z.object({ id: Id })).output(z.object({ ok: z.literal(true) })),
    /** Reads a failed item again from the start. */
    itemRetry: oc.input(z.object({ id: Id })).output(DataRoomApiItemSchema),
    importEmail: oc
      .input(DataRoomApiImportEmailInputSchema)
      .output(DataRoomApiImportEmailOutputSchema),
    emailImported: oc
      .input(DataRoomApiEmailImportedInputSchema)
      .output(DataRoomApiEmailImportedOutputSchema),
    driveList: oc.input(DataRoomApiDriveListInputSchema).output(DataRoomApiDriveListOutputSchema),
    importDrive: oc
      .input(DataRoomApiImportDriveInputSchema)
      .output(DataRoomApiImportDriveOutputSchema),
    /** The caller's imports that are running, or finished in the last few minutes. */
    imports: oc.output(z.array(DataRoomApiImportSchema)),
    /** Counts of items still in each pipeline step, for the Data room status strip. */
    processing: oc.output(DataRoomApiProcessingSchema),
    boxList: oc.input(DataRoomApiBoxListInputSchema).output(DataRoomApiBoxListOutputSchema),
    importBox: oc.input(DataRoomApiImportBoxInputSchema).output(DataRoomApiImportBoxOutputSchema),
    search: oc.input(DataRoomApiSearchInputSchema).output(DataRoomApiSearchOutputSchema),
    consent: oc.output(DataRoomConsentStatusSchema),
    consentGrant: oc.input(DataRoomConsentGrantInputSchema).output(DataRoomConsentStatusSchema),
    autoSort: {
      /** A proposed tidy-up; changes nothing. */
      plan: oc.output(AutoSortPlanSchema),
      apply: oc.input(AutoSortApplyInputSchema).output(AutoSortApplyOutputSchema),
      undo: oc.input(z.object({ batchId: Id })).output(AutoSortUndoOutputSchema),
    },
  },
  meetings: {
    /** Checks the Granola key with one list call, stores it, connects, provisions the agent and queues a sync. Trims the key. Errors: "Granola rejected this key", "Could not reach Granola". */
    connect: oc.input(MeetingConnectInputSchema).output(z.object({ ok: z.literal(true) })),
    /** The caller's key route; null before a key was pasted. Never returns the key. */
    status: oc.output(MeetingsStatusSchema),
    /** Deletes the stored key and stops the sync; stored meetings and to-dos stay. */
    disconnect: oc.output(z.object({ ok: z.literal(true) })),
    /** Asks for a sync now (throttled). */
    refresh: oc.output(z.object({ ok: z.literal(true) })),
    /** The caller's stored meetings, newest first; a plain query that works with consent off and after disconnect. */
    list: oc
      .input(z.object({ cursor: z.string().max(200).optional() }))
      .output(StoredMeetingsPageSchema),
    /** Deletes one of the caller's meetings with its to-dos; sync does not bring it back. */
    delete: oc.input(z.object({ meetingId: Id })).output(z.object({ ok: z.literal(true) })),
  },
  devin: {
    /** Any member reads the space's cached sessions; a read older than a minute refreshes them first. */
    sessions: oc.output(DevinSessionsOutputSchema),
    /** The connector's agent (created once), or null for every other member. */
    agent: oc.output(DevinAgentOutputSchema),
    /** Space owners only. Checks the key before anything is kept. */
    connect: oc.input(DevinKeyInputSchema).output(z.object({ ok: z.literal(true) })),
    /** Space owners only. The old rows and key go; the acting owner becomes the connector. */
    replaceKey: oc.input(DevinKeyInputSchema).output(z.object({ ok: z.literal(true) })),
    disconnect: oc.output(z.object({ ok: z.literal(true) })),
  },
  legal: {
    /** Idempotent: creates the Legal agent and its daily scan routine; returns the bot to open in the side panel. */
    agent: oc.output(BotSchema),
    overview: oc.output(LegalOverviewSchema),
    graph: oc.output(LegalGraphSchema),
    updateDeadline: oc.input(LegalUpdateDeadlineInputSchema).output(LegalDeadlineSchema),
    /** Queues one scan run in the Legal agent's thread (returns the active run if one is already going). */
    scanNow: oc.output(LegalScanNowOutputSchema),
    /** The Legal records deleting this Data room item would remove with it (read-only; never creates the agent). */
    itemLinks: oc.input(z.object({ itemId: Id })).output(LegalItemLinksSchema),
    /** Data Room consent for the Legal agent's own model; same shapes as dataRoom.consent. */
    consent: oc.output(DataRoomConsentStatusSchema),
    consentGrant: oc.input(DataRoomConsentGrantInputSchema).output(DataRoomConsentStatusSchema),
  },
  carta: {
    agent: oc.output(BotSchema),
    /** The Cap Table page's snapshot and whether the Carta agent is refreshing it. */
    capTable: oc.output(CapTableStateSchema),
    /** Starts a Carta agent run that refreshes the snapshot and the investor contacts. */
    refresh: oc.output(z.object({ ok: z.literal(true) })),
  },
  contacts: {
    list: oc.input(ContactListInputSchema).output(z.array(ContactSchema)),
    save: oc.input(ContactSaveInputSchema).output(ContactSchema),
    delete: oc.input(z.object({ id: Id })).output(z.object({ ok: z.literal(true) })),
  },
  sidebarPages: {
    list: oc.output(SidebarPagesStateSchema),
    add: oc.input(SidebarPageInputSchema).output(SidebarPagesStateSchema),
    remove: oc.input(SidebarPageInputSchema).output(SidebarPagesStateSchema),
  },
  finance: {
    agent: oc.output(BotSchema),
    overview: oc.output(FinanceOverviewSchema),
    refresh: oc.output(z.object({ ok: z.literal(true) })),
    connect: oc.input(FinanceConnectInputSchema).output(FinanceConnectOutputSchema),
    accounts: oc.output(FinanceAccountsOutputSchema),
    balanceSeries: oc.input(BalanceSeriesInputSchema).output(BalanceSeriesOutputSchema),
    account: oc.input(z.object({ id: Id })).output(FinanceAccountOutputSchema),
    burn: oc.output(FinanceBurnOutputSchema),
    month: oc
      .input(z.object({ month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/) }))
      .output(FinanceMonthOutputSchema),
    runway: oc.output(FinanceRunwayOutputSchema),
    preferences: oc.output(FinancePreferencesSchema),
    setPreferences: oc.input(FinancePreferencesSchema).output(FinancePreferencesSchema),
    cryptoHistory: oc
      .input(FinanceCryptoHistoryInputSchema)
      .output(FinanceCryptoHistoryOutputSchema),
    spend: oc.input(FinanceSpendInputSchema).output(FinanceSpendOutputSchema),
    category: oc
      .input(
        z.object({
          slug: z.string().min(1).max(200),
          /** The dashboard period the category was opened from; without it, the last 90 days. */
          period: SpendPeriodSchema.optional(),
          /** A calendar month (YYYY-MM), from the month page. */
          month: z
            .string()
            .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/)
            .optional(),
        }),
      )
      .output(FinanceCategoryOutputSchema),
    recurring: oc
      .input(z.object({ key: z.string().min(1).max(200) }))
      .output(FinanceRecurringOutputSchema),
    vendor: oc
      .input(z.object({ key: z.string().min(1).max(200) }))
      .output(FinanceVendorOutputSchema),
    transaction: oc.input(z.object({ id: Id })).output(FinanceTransactionOutputSchema),
    receiptUrl: oc.input(z.object({ transactionId: Id })).output(FinanceReceiptUrlOutputSchema),
    wallets: oc.output(FinanceWalletsOutputSchema),
    walletAdd: oc.input(FinanceWalletAddInputSchema).output(FinanceWalletSchema),
    walletUpdate: oc.input(FinanceWalletUpdateInputSchema).output(FinanceWalletSchema),
    walletRemove: oc
      .input(FinanceWalletRemoveInputSchema)
      .output(z.object({ ok: z.literal(true) })),
    crypto: oc.output(FinanceCryptoOutputSchema),
    cryptoConnect: oc
      .input(FinanceCryptoConnectInputSchema)
      .output(FinanceCryptoConnectOutputSchema),
    exchanges: oc.output(FinanceExchangesOutputSchema),
    exchangeConnect: oc.input(FinanceExchangeConnectInputSchema).output(FinanceExchangeSchema),
    exchangeRemove: oc
      .input(FinanceExchangeRemoveInputSchema)
      .output(z.object({ ok: z.literal(true) })),
    cryptoProviderConnect: oc
      .input(FinanceCryptoProviderConnectInputSchema)
      .output(z.object({ ok: z.literal(true) })),
    cryptoProviderRemove: oc
      .input(FinanceCryptoProviderRemoveInputSchema)
      .output(z.object({ ok: z.literal(true) })),
    statements: oc.output(FinanceStatementsOutputSchema),
    statementUpload: oc.input(FinanceStatementUploadInputSchema).output(FinanceStatementSchema),
    statementConfirm: oc.input(FinanceStatementConfirmInputSchema).output(FinanceStatementSchema),
    statementDiscard: oc
      .input(FinanceStatementDiscardInputSchema)
      .output(z.object({ ok: z.literal(true) })),
    statementAccountRename: oc
      .input(FinanceStatementAccountRenameInputSchema)
      .output(z.object({ ok: z.literal(true) })),
  },
  botSecrets: {
    list: oc.input(z.object({ botId: Id })).output(z.array(BotSecretMetadata)),
    put: oc.input(BotSecretPutInput).output(BotSecretMetadata),
    remove: oc
      .input(z.object({ botId: Id, name: StoredBotSecretName }))
      .output(z.object({ ok: z.literal(true) })),
  },
};

export type AppContract = typeof appContract;
