import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Router } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import type {
  AdapterContext,
  ConnectorCatalogItem,
  SandboxProvider,
  UsageOperationKind,
} from "@rakazo/adapter-kit";
import {
  computerControlExpireJobKey,
  dataRoomBlobDeleteJob,
  MEMORY_REVISION_CONFLICT_ERROR,
  messagingDeliverJob,
  routineJobKey,
  routineWakeupJob,
  runContinueJob,
  runJobKey,
  SecretStoreUnavailableError,
} from "@rakazo/adapter-kit";
import type {
  CodexLiveCatalog,
  ComputerExecutionLease,
  getBotSecretMetadata,
  McpStdioPolicy,
} from "@rakazo/adapters";
import {
  acquireComputerExecutionLease,
  addScratchpadItemFromTool,
  answerBotShare,
  answerPageSourceApproval,
  applyCodexLiveCatalog,
  applyPendingSenderRules,
  applyTeachingDesktopInput,
  archiveBot,
  assertSafeRemoteUrl,
  boxAccessToken,
  buildMcpCredentialBlob,
  buildModelConnectPlaintext,
  CHATGPT_OAUTH_PROVIDER,
  CodexCatalogCache,
  ComputerBusyError,
  calendarAgenda,
  cancelComputerRunWork,
  checkpointAndRecordComputerWorkspace,
  clearInactiveUserComputerControl,
  codexLiveCatalogsForSpace,
  codexLiveListsModel,
  commentTicket,
  computerSupportsTerminal,
  computerSupportsUpdate,
  computerUpdateView,
  createBotPage,
  createDevinCallTool,
  createFaviconResolver,
  createMeetingSourceRegistry,
  createTicket,
  createVoiceProvider,
  defaultCatalogModelId,
  deleteContactPhotosForConnection,
  deleteMailConnectionData,
  deleteMailSearches,
  deploymentAutoReviewDefault,
  destroyBot,
  displayBotWorkspacePath,
  enqueueTakeoverContinuation,
  ensureComputerWorkspaceLayout,
  expireComputerControl,
  expireSupersededRoutineRuns,
  findBotShareEffect,
  findInvestorsAgent,
  findPageSourceApproval,
  forgetBotSecret,
  getBotPage,
  getBotPins,
  hasActiveComputerControl,
  hostCredentialSource,
  isAutoReviewCheckerConfigured,
  isComputerScreenUnavailable,
  isMailConnection,
  isSandboxGoneError,
  kickModelCredentialRefresh,
  latestAccountExport,
  latestAuditMessageId,
  listAvailablePiCatalog,
  listBotPages,
  listBotSecretMetadata,
  listCalendarAccounts,
  listOmiSegments,
  listPageSources,
  listPiCatalog,
  listRecentOmiSegments,
  listScratchpadItems,
  McpOAuthBroker,
  mcpStdioAvailable,
  mcpStdioRefusal,
  modelCredentialAuthKindsForSpace,
  modelCredentialDto,
  moveOmiSegment,
  normalizeSecretDestination,
  PageConflictError,
  PageValidationError,
  PinsValidationError,
  pageChartSvgs,
  pageShareStatus,
  parseModelSecret,
  persistPreparedSecret,
  personCalendarMeetings,
  pickReusableConnection,
  planLiveConnectionSync,
  postPauseMessage,
  prepareApiInstall,
  prepareGraphqlInstall,
  prepareManagedConnectorForTransaction,
  prepareStoredModelAuth,
  probeCatalogProviderModels,
  probeOpenAiCompatibleModels,
  provisionComputer,
  queueComputerUpdate,
  refreshBotPins,
  refreshPageSource,
  refreshPageSources,
  releaseComputerExecutionLease,
  removeBotPage,
  removePageSource,
  removeScratchpadItemFromUser,
  renameBotPage,
  replaceComputer,
  requestAccountExport,
  requestContactPhotos,
  requeueOmiTranscriptions,
  resolveAutoReviewChecker,
  resolveBotUploadPath,
  resolveBotWorkspaceCwd,
  resolveBotWorkspacePath,
  resolveDataRoomAi,
  resolvePageData,
  revokeScreenControl,
  routineRunModelPin,
  sanitizeComposioError,
  saveBotPage,
  saveBotPins,
  scheduleComputerControlExpiry,
  scheduleComputerSleep,
  scheduleReadyScans,
  screenLeaseIdForRun,
  scriptedCatalogEntry,
  selectDefaultCredentialId,
  selectTranscriptionTarget,
  serializeModelSecret,
  sharePageSnapshot,
  startAuditDraftRun,
  stopMailWatch,
  storeBotSecret,
  takeoverLeaseMs,
  taughtSkillPromptForRoutine,
  toComputerRef,
  touchRunningComputer,
  UNAVAILABLE_MODEL_FOR_AUTH_MESSAGE,
  updatePageSourceByOwner,
  updateScratchpadItemFromUser,
  updateTicket,
  validateConnectedModelChoice,
  validateModelAuthAvailability,
  validateStoredModelAuth,
  verifyMcpInstall,
  waitForComputerReady,
} from "@rakazo/adapters";
import type {
  Actor,
  AppContract,
  Bot,
  BotSecretMetadata,
  ComposeFields,
  ComputerReleaseReason,
  ComputerStatus,
  ExportManifest,
  McpServer,
  Me,
  MeetingRecordingPolicy,
  NotificationDto,
  Routine,
  SpaceNavigation,
  UpdateBotAppControl,
  WatchPausedReason,
} from "@rakazo/contracts";
import {
  ATTACHMENT_MAX_BYTES,
  actorScope,
  BotSecretAuth,
  botAudienceEditable,
  ComputerCommandSchema,
  customPageSpawnKey,
  encodeLoginSecret,
  FIRST_BOT_SPAWN_KEY,
  foldComputerCommands,
  GOOGLE_DESKTOP_REDIRECT_URI,
  GRANOLA_API_CONNECTOR_ID,
  GTM_WORK_ROUTINE_NAME,
  HEX_CONNECTOR_ID,
  IntegrationProviderIdSchema,
  integrationAgentSpawnKey,
  integrationPresetForEndpoint,
  isBrexCardsEndpoint,
  isCartaAgentSpawnKey,
  isCartaEndpoint,
  isCompanyAgentSpawnKey,
  isCompanyImporterSpawnKey,
  isCustomPageSpawnKey,
  isDataRoomAgentSpawnKey,
  isDeniedApp,
  isFinanceAgentSpawnKey,
  isGranolaEndpoint,
  isGtmAgentSpawnKey,
  isInboxAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  isInvestorsAgentSpawnKey,
  isLegalAgentSpawnKey,
  isMailThreadAgentSpawnKey,
  isRetiredVoiceAgentSpawnKey,
  isScannerAgentSpawnKey,
  isShareableArtifactMimeType,
  isVoiceAgentSpawnKey,
  isZernioEndpoint,
  mcpOAuthSupported,
  NOTIFICATION_CATCH_UP_ID,
  NOTIFICATION_HEARTBEAT_ID,
  notificationKindOf,
  OMI_CLOUD_CONNECTOR_ID,
  OMI_CONNECTOR_ID,
  OPENAI_COMPATIBLE_PROVIDER_ID,
  PermissionLevelSchema,
  usableModelId,
  WatchSpecSchema,
} from "@rakazo/contracts";
import {
  ACTIVE_RUN_STATUSES,
  ALWAYS_ASK_ACTION_TYPES,
  AttachmentValidationError,
  actionTypeFromCategory,
  CALL_CLIENT_NONCE_PREFIX,
  callClientNonce,
  clampCatalogThinkingLevel,
  containsSecret,
  dedupeCatalogBySlug,
  deploymentPermissionDefault,
  effectiveAccessByConnection,
  expandSkillReferencesInPrompt,
  hasMixedOneShotSchedule,
  isOneShotRoutineCrons,
  isValidTimezone,
  MESSAGING_PHOTON_BLOCKED_MESSAGE,
  matchFeaturedConnectorId,
  messagingProviderBlocksBot,
  newRunUnattended,
  nextCronDateAcrossStrict,
  parseGoalCommand,
  resolvePermissionLevel,
  stableJsonText,
  withAppDirectory,
} from "@rakazo/core";
import { hostSite, urlSite } from "@rakazo/core/egress";
import type { Notification, PrismaClient } from "@rakazo/db";
import {
  AnswerTooLongError,
  addSidebarBotPage,
  addSidebarFolder,
  addSidebarPage,
  appendEventInTransaction,
  approvalTable,
  assignSafe,
  autoGroupSidebar,
  BotSectionNameConflictError,
  CannotDeleteDefaultSpaceError,
  CannotDeleteLastSpaceError,
  CannotDeleteSpaceAsNonOwnerError,
  CannotRenameSpaceAsNonOwnerError,
  CapTableSourceError,
  CompanyPrivacyBusinessError,
  ContactEmailTakenError,
  cancelQueuedRoutineRuns,
  changeCapTableSource,
  claimAuditDraft,
  claimEmptySpaceDeletionForMember,
  claimShareRequest,
  clearApprovalRule,
  closeAuditRequest,
  closeRound,
  companyForActor,
  companyWriter,
  completeShareRequest,
  contactDetail,
  createArtifactShare,
  createDataRoomRepos,
  createExternalConversationRepos,
  createGroupRepos,
  createRepos,
  createSpaceForMember,
  createThreadMessageInTransaction,
  crossSpaceCommunicationAllowed,
  defaultModelCredentialCandidates,
  deleteContact,
  deleteEmptySpaceForMember,
  deleteInvestorUpdate,
  deletePushTokens,
  deleteSafe,
  deleteUnreferencedCredentialSecret,
  duplicateInvestorUpdate,
  ensureBoard,
  equityLedgerHasData,
  equityLedgerSnapshot,
  FundraiseRoundOpenError,
  findBotModelCredential,
  findDefaultModelCredential,
  findDefaultVoiceCredential,
  findModelCredential,
  findSpaceMemoryConfig,
  findTicket,
  formatMessagingLinkCode,
  getArtifactShare,
  getAuditRequest,
  getCapTableSnapshot,
  getCheckInCadence,
  getContact,
  getInvestorUpdate,
  getNotificationPreferences,
  InvalidSpaceNameError,
  InvestorUpdateLockedError,
  IsolationError,
  isRecordNotFound,
  issueMessagingLinkCode,
  isUniqueViolation,
  linkedContact,
  linkedImessageIdentities,
  listApprovalRules,
  listAuditRequests,
  listContacts,
  listInvestorUpdates,
  listNotifications,
  listPushEndpoints,
  listShareContactIds,
  listSidebarPages,
  listSpaceBackupModels,
  listTicketComments,
  listWaitingOnYouItems,
  loadSpacePermissionLevel,
  logCall,
  markInvestorUpdateDelivered,
  markSafe,
  markSeen,
  markShown,
  markWaiting,
  mintPortalTokenFor,
  moveSidebarFolder,
  moveSidebarItem,
  NotificationValidationError,
  newestModelCredentialOrder,
  newestVoiceCredentialOrder,
  notSent,
  PinnedConnectionLostError,
  PipelineInputError,
  PortalBlockedError,
  Prisma,
  ProspectEmailRequiredError,
  PushSessionEndedError,
  parseComputerMode,
  pushSessionExpiresAt,
  releaseAuditDraft,
  releaseShareRequest,
  releaseSpaceDeletionClaim,
  removeSidebarBotPage,
  removeSidebarFolder,
  removeSidebarPage,
  renameSpaceForMember,
  renewSpaceDeletionClaim,
  reopenRound,
  replaceSpaceBackupModels,
  restoreBotUnderComputerQuota,
  restoreSidebar,
  resumeWatch,
  revokeArtifactShare,
  revokePortal,
  runAsSystem,
  runAsSystemInTransaction,
  runAsTenant,
  SafeActiveError,
  SafeCapRequiredError,
  SafeStateError,
  ShareRequestConflictError,
  SidebarPageError,
  SPACE_DELETION_CLAIM_TIMEOUT_MS,
  SpaceDeletionInProgressError,
  SpaceHasCapTableError,
  SpaceLimitError,
  SpaceNotEmptyError,
  SpaceNotFoundError,
  saveCapTableSnapshot,
  saveContact,
  saveInvestorUpdate,
  saveProspect,
  savePushToken,
  saveRound,
  saveSafe,
  selectSpaceModelPreference,
  selectSpaceVoicePreference,
  setActionTypeChoice,
  setApprovalRule,
  setSidebarFolderCollapsed,
  shareDocuments,
  syncWatchState,
  THREAD_LOCK_TRANSACTION_OPTIONS,
  toTicketCommentDto,
  toTicketDto,
  UnshareableArtifactError,
  unassignSafe,
  unblockPortal,
  undoAutoChange,
  undoCall,
  undoCapTableSource,
  unseenBotKinds,
  unseenCounts,
  unshareDocument,
  updateNotificationPreferences,
  upsertCheckInRoutine,
  watchLimitError,
  withContactPhotos,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { createAgentSkillsService } from "./agent-skills.js";
import { aiConsentStatus, allowAiConsent, revokeAiConsent } from "./ai-consent.js";
import {
  ArtifactListCursorError,
  createOwnedArtifact,
  deleteArtifactFamily,
  getOwnedArtifact,
  getSpaceArtifact,
  getSpaceArtifactById,
  listArtifactVersions,
  listSpaceArtifacts,
} from "./artifacts.js";
import { listAutoApprovalRows, undoAutoApproval } from "./auto-approvals.js";
import {
  dismissInstructionsUpgrade,
  instructionsUpgrade,
  upgradeInstructions,
} from "./bot-instructions-upgrade.js";
import { botProfileLabelsChanged, commitBotUpdate } from "./bot-update.js";
import type { BrexCardsDeps } from "./brex-cards.js";
import {
  brexCardsCards,
  brexCardsConnect,
  brexCardsGetControls,
  brexCardsReplaceToken,
  brexCardsSetControls,
} from "./brex-cards.js";
import {
  brexCardsAccounts,
  brexCardsActivity,
  brexCardsExpenses,
  brexCardsLimits,
  brexCardsOverview,
  brexCardsPeople,
  brexCardsSpending,
  brexCardsTrips,
  brexCardsView,
} from "./brex-cards-read-model.js";
import type { CartaSyncDeps } from "./carta-agent.js";
import {
  assignToExistingCartaAgent,
  ensureCartaAgent,
  isCartaSyncing,
  onMcpServerConnected,
  startCartaSync,
} from "./carta-agent.js";
import { ensureCompanyAgent, ensureCompanyImporter } from "./company-agent.js";
import { companyCalendar } from "./company-calendar.js";
import {
  companyContextHistory,
  listCompanyContext,
  removeCompanyContext,
  restoreCompanyContext,
  saveCompanyContext,
} from "./company-context.js";
import { companyFact, companyPage } from "./company-page.js";
import {
  executionBlocksUserTakeover,
  resolveBusyBotName,
  toComputerStatus,
} from "./computer-status.js";
import {
  completeNativeOAuth,
  connectionError,
  connectionFailureMessage,
} from "./connection-oauth.js";
import { createDataRoomService } from "./data-room.js";
import { ensureDataRoomAgent } from "./data-room-agent.js";
import type { DevinDeps } from "./devin.js";
import {
  assertNoOtherDevinConnection,
  devinAgent,
  devinConnect,
  devinConnected,
  devinDisconnect,
  devinNeedsYouCount,
  devinReplaceKey,
  devinSessions,
  requireOwnerForActiveDevinRow,
} from "./devin.js";
import { dictationVocabulary } from "./dictation-vocabulary.js";
import { isAllowedMcpOAuthRedirect, pickReturnOrigin } from "./env.js";
import { createEquityRoutes } from "./equity/index.js";
import {
  financeAccountDetail,
  financeAccounts,
  financeAgent,
  financeBalanceSeries,
  financeBurn,
  financeCategory,
  financeChartNoteAdd,
  financeChartNoteDelete,
  financeChartNotes,
  financeConnect,
  financeCryptoHistory,
  financeMonth,
  financeOverview,
  financePreferences,
  financeReceiptUrl,
  financeRecurring,
  financeRefresh,
  financeRunway,
  financeRunwayMonths,
  financeSetPreferences,
  financeSpend,
  financeTransaction,
  financeVendor,
  onFinanceServerReconnected,
} from "./finance.js";
import {
  financeCrypto,
  financeCryptoConnect,
  financeCryptoProviderConnect,
  financeCryptoProviderRemove,
  financeWalletAdd,
  financeWalletRemove,
  financeWallets,
  financeWalletUpdate,
} from "./finance-crypto.js";
import {
  financeExchangeConnect,
  financeExchangeRemove,
  financeExchanges,
} from "./finance-exchange.js";
import {
  financeStatementAccountRename,
  financeStatementConfirm,
  financeStatementDiscard,
  financeStatements,
  financeStatementUpload,
} from "./finance-statements.js";
import { fundraisingOverview, fundraisingRefresh, safesList } from "./fundraising.js";
import { gtmNeedsYouCount, gtmOverview, gtmPostingCapability, gtmQueue } from "./gtm.js";
import { ensureGtmAgent, ensureGtmBot } from "./gtm-agent.js";
import {
  checkMailConnection,
  inboxFeedbackSet,
  inboxGet,
  inboxList,
  inboxNoReply,
  inboxRefresh,
  inboxTodoSetDone,
  inboxTodosList,
  inboxUnreadCount,
  mailContext,
} from "./inbox.js";
import { inboxActionsList, inboxActionsUndo } from "./inbox-actions.js";
import { ensureInboxAgent } from "./inbox-agent.js";
import { inboxReviewAttachment } from "./inbox-attachment-review.js";
import { inboxCleanupArchive, inboxCleanupForget, inboxCleanupList } from "./inbox-cleanup.js";
import {
  accountOut,
  inboxComposeDiscard,
  inboxComposeDraftSave,
  inboxComposePrefill,
  inboxComposeSend,
} from "./inbox-compose.js";
import {
  inboxArchive,
  inboxArchiveMany,
  inboxMarkRead,
  inboxMarkReadMany,
  inboxMoveMany,
  inboxUnarchive,
  inboxUnarchiveMany,
} from "./inbox-modify.js";
import type { PersonContextDeps } from "./inbox-person-context.js";
import { inboxPersonContext, inboxPersonSummary } from "./inbox-person-context.js";
import { inboxAskAgent } from "./inbox-thread-agent.js";
import { inboxTrack, inboxUntrack } from "./inbox-track.js";
import { inboxUnsubscribe } from "./inbox-unsubscribe.js";
import {
  connectionAgentSpawnKeys,
  ensureConnectedAppAgent,
  ensureIntegrationAgent,
  provisionConnectionAgent,
  setConnectedAppExclusive,
  setConnectedAppWrites,
  setIntegrationAgentWrites,
  setIntegrationExclusive,
} from "./integration-agent.js";
import { searchIntegrationCatalog } from "./integration-catalog.js";
import {
  deliverPortalLinks,
  postInvestorUpdate,
  startInvestorUpdateRetry,
  startInvestorUpdateSend,
} from "./investor-send.js";
import {
  cadenceOf,
  ensureInvestorsAgent,
  INVESTOR_UPDATE_ROUTINE_NAME,
  setInvestorsReminder,
} from "./investors-agent.js";
import { sheetReadState, startSheetRead } from "./investors-sheet-sync.js";
import {
  legalAgent,
  legalConsent,
  legalConsentGrant,
  legalDoneDeadlines,
  legalDueSoonCount,
  legalGraph,
  legalItemLinks,
  legalOverview,
  legalSafeCount,
  legalScanNow,
  legalUpdateDeadline,
} from "./legal.js";
import { answerEditedMailApproval } from "./mail-approval-edit.js";
import { sendSavedMailDraft } from "./mail-draft-send.js";
import {
  mailBatchRowToComposer,
  previewMailBatch,
  readMailBatch,
  retryMailBatch,
  sendMailBatch,
} from "./mail-reply-batch.js";
import {
  dismissMcpServerApprovals,
  resolveMcpApprovalCards,
  revertConnectedMcpApprovals,
} from "./mcp-approval.js";
import { buildMcpUpdateMaterial, mcpOrigin } from "./mcp-material.js";
import {
  activeCapture,
  appendCaptureText,
  discardCapture,
  finishCapture,
  setMeetingRecording,
  startCapture,
} from "./meeting-captures.js";
import type { MeetingsDeps } from "./meetings.js";
import {
  connectGranola,
  deleteStoredMeeting,
  disconnectGranola,
  getStoredMeeting,
  granolaStatus,
  listStoredMeetings,
  mergeStoredMeeting,
  refreshGranola,
} from "./meetings.js";
import { connectLocal, disconnectLocal, importLocal, localStatus } from "./meetings-local.js";
import {
  disconnectMemoryProvider,
  persistMemoryProviderConfig,
  serializeSpaceMemoryConfig,
  updateMemoryProviderDefaultScope,
} from "./memory-provider-config.js";
import { modelConnectionErrorMessage, savedModelKey } from "./model-connection-error.js";
import { connectReturnUrl } from "./native-return.js";
import { connectOmi, deleteOmiRecordingsFor, disconnectOmi, omiStatus } from "./omi.js";
import { connectOmiCloud, disconnectOmiCloud, omiCloudStatus } from "./omi-cloud.js";
import {
  chooseFocus,
  dismissFocus,
  markAppConnected,
  promptFocus,
  SETUP_OPTIONS,
  seedBlankBotGreeting,
  startOnboarding,
} from "./onboarding.js";
import {
  beginOpenRouterOAuth,
  completeOpenRouterOAuth,
  OPENROUTER_OAUTH_PROVIDER,
  OpenRouterOAuthError,
} from "./openrouter-oauth.js";
import { applyPipelineImport, readPipelineImport } from "./pipeline-import.js";
import { rememberedMessageIds, rememberThreadMessage } from "./remember-message.js";
import { createAgentSecretsRoutes } from "./routes/agent-secrets.js";
import { createBillingRoutes } from "./routes/billing.js";
import type { RouteAuthContext, RouterDeps } from "./routes/context.js";
import { asNotFound, asTenant, createRouteContext } from "./routes/context.js";
import { createMcpConnectionsRoutes } from "./routes/mcp-connections.js";
import { createUpdaterRoutes } from "./routes/updater.js";
import { listRoutineRuns } from "./routine-runs.js";
import { listPendingApprovalNotifications, listSpaceRuns } from "./runs.js";
import { ensureScannerAgent } from "./scanner-agent.js";
import { addScreenProxyCapability } from "./screen-proxy.js";
import { querySpaceSearch } from "./search.js";
import { withSerializableRetry } from "./serializable-retry.js";
import {
  ensureSourceAgent,
  listCapabilities,
  provisionMissingSourceAgents,
  provisionSourceAgent,
  renameSource,
  setSourceAgentAccess,
  setSourceAllAgents,
  setSourceExclusive,
  setSourceWrites,
} from "./source-agent.js";
import { isSpaceOwnerOrAdminRole, isSpaceOwnerRole, requireSpaceOwner } from "./space-owner.js";
import { spreadsheetPreview } from "./spreadsheet-preview.js";
import { HEARTBEAT, withHeartbeat } from "./stream.js";
import { assertTeachingSendAllowed, createTaughtSkillsService } from "./taught-skills.js";
import {
  isBackgroundRun,
  isPeerRun,
  loadAllMessages,
  loadMessagePage,
  shouldForwardBackgroundThreadEvent,
  shouldForwardPeerThreadEvent,
} from "./thread-message-pages.js";
import {
  clearThreadGoal,
  markThreadUnreadFrom,
  reactToThreadMessage,
  resolveThreadTarget,
  sendThreadMessage,
  setThreadUnreadState,
  stopThreadRuns,
  threadHead,
  threadSnapshotForReader,
} from "./thread-target.js";
import {
  clearTranscription,
  disconnectVoiceCredential,
  findTranscriptionSelection,
  listVoiceCatalog,
  loadDefaultVoiceCredential,
  loadVoiceCredential,
  persistVoiceCredential,
  prepareVoice,
  setTranscription,
  toVoiceCredential,
  toVoiceStatus,
  updateVoiceSpeechModel,
  voiceContext,
} from "./voice.js";
import { ensureVoiceAgent } from "./voice-agent.js";

export type { RouterDeps } from "./routes/context.js";

const MAX_COMPUTER_TEXT_FILE_BYTES = 2 * 1024 * 1024;
/** Each command writes a running and a done event, so this keeps about 100 commands. */
const COMPUTER_COMMAND_HISTORY_EVENTS = 200;
const THREAD_MESSAGE_PAGE_SIZE = 100;
/** Silence longer than this on a thread stream is indistinguishable from a dead socket. */
export const HEARTBEAT_MS = 20_000;
/** A thread stream re-checks its session at least this often while it delivers. */
export const SESSION_RECHECK_MS = 10_000;
const EXPORT_MESSAGE_PAGE_SIZE = 500;

async function reconcilePendingConnections(
  prisma: PrismaClient,
  owner: Pick<Actor, "spaceId" | "userId">,
  connectorId: string,
  connectedProviders: string[],
): Promise<void> {
  const connectedProviderKeys = new Set(
    connectedProviders.map((provider) => provider.trim().toLowerCase()),
  );
  const rows = (
    await prisma.connection.findMany({
      where: {
        spaceId: owner.spaceId,
        userId: owner.userId,
        connectorId,
        status: { in: ["pending", "connected"] },
      },
      select: { id: true, provider: true, displayName: true, status: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })
  ).filter((row: { provider: string }) =>
    connectedProviderKeys.has(row.provider.trim().toLowerCase()),
  );
  const sync = planLiveConnectionSync(rows, connectedProviders);
  const updates = [
    ...(sync.connectIds.length > 0
      ? [
          (tx: Prisma.TransactionClient) =>
            tx.connection.updateMany({
              where: {
                id: { in: sync.connectIds },
                spaceId: owner.spaceId,
                userId: owner.userId,
                status: "pending",
              },
              data: { status: "connected" },
            }),
        ]
      : []),
    ...(sync.revokeIds.length > 0
      ? [
          (tx: Prisma.TransactionClient) =>
            tx.connection.updateMany({
              where: {
                id: { in: sync.revokeIds },
                spaceId: owner.spaceId,
                userId: owner.userId,
                status: "pending",
              },
              data: { status: "revoked" },
            }),
        ]
      : []),
  ];
  // Interactive rather than a batch: a batch cannot carry the request's database context.
  if (updates.length > 0)
    await prisma.$transaction(async (tx) => {
      for (const update of updates) await update(tx);
    });
}

/** Serialize begin/revoke for one user+provider so slug-wide remote deletes cannot race a new connect. */

/** A provider saying the remote account does not exist: it is already gone, so revoke is done. */
/** Page validation and duplicate-title errors become 400 and 409; anything else is rethrown. */
/** Tells the owner's other tabs and devices a chat's read state changed, so they reload their lists. */
function notifyThreadReadChanged(deps: RouterDeps, actor: Actor) {
  return deps.notificationEvents.notify(
    { spaceId: actor.spaceId, userId: actor.userId },
    { id: NOTIFICATION_CATCH_UP_ID, surface: "threads", importance: "info" },
  );
}

function pageError(error: unknown): unknown {
  if (error instanceof PageValidationError) {
    return new ORPCError("BAD_REQUEST", { message: error.message });
  }
  if (error instanceof PageConflictError) {
    return new ORPCError("CONFLICT", { message: error.message });
  }
  return error;
}

const shareJson = (share: { artifactId: string; version: number; expiresAt: Date } | null) =>
  share && { ...share, expiresAt: share.expiresAt.toISOString() };

function isRemoteAccountGone(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = error as { status?: unknown; statusCode?: unknown };
  if (status.status === 404 || status.statusCode === 404) return true;
  const message = error instanceof Error ? error.message : "";
  return /^404\b|HTTP 404\b|ResourceNotFound/.test(message.trim());
}

function isAmbiguousRemoteRevokeFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|aborted|network|ECONNRESET|ECONNREFUSED|fetch failed/i.test(message);
}

/** True when a connector failed before issuing any remote DELETE. */
function isRemoteRevokePreDeleteFailure(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "remoteRevokePreDelete" in error &&
      (error as { remoteRevokePreDelete?: boolean }).remoteRevokePreDelete === true,
  );
}

function shouldRestoreLocalAfterRemoteRevokeFailure(error: unknown): boolean {
  // Pre-delete list/network failures never reached DELETE — always keep retry state.
  // Post-delete timeouts stay ambiguous and leave the row revoked.
  return isRemoteRevokePreDeleteFailure(error) || !isAmbiguousRemoteRevokeFailure(error);
}

/**
 * Concrete account ids still referenced by active local rows. When any row still
 * only has the provider slug (or no ref), orphan cleanup must not run — a sibling
 * may have created its remote account before persisting the concrete id.
 */
function concreteKeepAccountIds(
  refs: Array<string | null | undefined>,
  provider: string,
): { keepIds: string[]; canRevokeUnreferenced: boolean } {
  const keepIds: string[] = [];
  let canRevokeUnreferenced = true;
  for (const ref of refs) {
    const value = ref?.trim();
    if (!value || value === provider) {
      canRevokeUnreferenced = false;
      continue;
    }
    keepIds.push(value);
  }
  return { keepIds, canRevokeUnreferenced };
}

async function lockProviderConnectionScope(
  tx: Prisma.TransactionClient,
  owner: Pick<Actor, "spaceId" | "userId">,
  connectorId: string,
  provider: string,
): Promise<void> {
  // Avoid NUL separators in the lock key; text params may truncate at a zero byte and break begin.
  const scope = `space:${owner.spaceId}|user:${owner.userId}|connector:${connectorId}|provider:${provider}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('connection-provider'), hashtext(${scope}))`;
}

function computerContext(actor: Actor, botId: string, operationId: string): AdapterContext {
  return {
    operationId,
    traceId: operationId,
    spaceId: actor.spaceId,
    userId: actor.userId,
    botId,
    signal: new AbortController().signal,
  };
}

const EXCLUSIVE_SERVER_MESSAGE = "This integration is used only by its agent.";
const RECONNECT_DEVIN_MESSAGE = "Use Reconnect on the Devin page to replace the key.";
const REPLACE_BREX_TOKEN_MESSAGE = "Use Replace token on the Brex cards page to change the token.";

function approvalRuleDto(row: {
  id: string;
  effect: string;
  matchKind: string;
  matchValue: string;
  botId: string | null;
  routineId?: string | null;
  routineName?: string;
  botName?: string;
  createdAt: Date;
}) {
  return {
    ...(row.routineId ? { routineId: row.routineId, routineName: row.routineName } : {}),
    ...(row.botName ? { botName: row.botName } : {}),
    id: row.id,
    effect: row.effect as "always_allow" | "require_approval" | "block",
    matchKind: row.matchKind as "tool" | "connector" | "category" | "site",
    matchValue: row.matchValue,
    botId: row.botId,
    createdAt: row.createdAt.toISOString(),
  };
}

function mcpServerDto(
  row: {
    id: string;
    spaceId: string;
    slug: string;
    name: string;
    description: string;
    transport: string;
    endpoint: string | null;
    command: string | null;
    args: unknown;
    env: unknown;
    headers: unknown;
    secretId: string | null;
    enabled: boolean;
    writesEnabled: boolean;
    agentBotId: string | null;
    agentExclusive: boolean;
    oauthReauthAt?: Date | null;
    revision: number;
    createdAt: Date;
    updatedAt: Date;
  },
  oauthStatus: McpServer["oauthStatus"] = "none",
  oauthAttempted = false,
): McpServer {
  const args = Array.isArray(row.args)
    ? row.args.filter((item): item is string => typeof item === "string")
    : [];
  const envKeys =
    row.env && typeof row.env === "object" && !Array.isArray(row.env) ? Object.keys(row.env) : [];
  const headerKeys =
    row.headers && typeof row.headers === "object" && !Array.isArray(row.headers)
      ? Object.keys(row.headers)
      : [];
  return {
    id: row.id,
    spaceId: row.spaceId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    transport: row.transport as McpServer["transport"],
    endpoint: row.endpoint,
    command: row.command,
    args,
    envKeys,
    headerKeys,
    hasSecret: row.secretId !== null,
    // A refused sign-in is recorded when the connector fails; tokens may still be stored.
    oauthStatus: oauthStatus === "connected" && row.oauthReauthAt ? "reconnect" : oauthStatus,
    oauthSupported: mcpOAuthSupported(row.endpoint),
    oauthAttempted,
    enabled: row.enabled,
    writesEnabled: row.writesEnabled,
    agentBotId: row.agentBotId,
    agentExclusive: row.agentExclusive,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function connectionAccess(prisma: PrismaClient, actor: Actor, connectionId: string) {
  const row = await prisma.connection.findFirst({
    where: { id: connectionId, spaceId: actor.spaceId, userId: actor.userId },
    select: {
      allAgents: true,
      agentShared: true,
      agentBotId: true,
      botAccess: {
        where: { spaceId: actor.spaceId, userId: actor.userId },
        select: { botId: true, canWrite: true, supportLabel: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!row) throw new IsolationError();
  const botIds = row.botAccess.map((entry) => entry.botId);
  return {
    allAgents: row.allAgents,
    botIds,
    writeBotIds: row.botAccess.filter((entry) => entry.canWrite).map((entry) => entry.botId),
    supportLabels: supportLabelsOf(row.botAccess),
    // Shared once anyone else has access, and it stays shared when they are all switched off.
    agentShared: row.agentShared || row.allAgents || botIds.some((id) => id !== row.agentBotId),
  };
}

type AccessConnection = {
  allAgents: boolean;
  agentBotId: string | null;
  botAccess: { botId: string; canWrite?: boolean }[];
  /** Needed to tell a mailbox from another kind of connection, which alone takes a support label. */
  status?: string;
  provider?: string;
  providerRef?: string | null;
};
type DecidedAccess = {
  allAgents: boolean;
  botIds: string[];
  /** Agents whose "allow changes" is set or cleared by this change; every other grant keeps its setting. */
  canWrite?: Record<string, boolean>;
  /** The support label this change sets (null clears it); a grant not named here keeps its stored label. */
  supportLabels?: Record<string, string | null>;
};

/** Only the agents a label actually limits, so an unlabelled connection stays small on the wire. */
const supportLabelsOf = (rows: { botId: string; supportLabel?: string | null }[]) =>
  Object.fromEntries(
    rows
      .filter((entry): entry is { botId: string; supportLabel: string } =>
        Boolean(entry.supportLabel),
      )
      .map((entry) => [entry.botId, entry.supportLabel]),
  );
type AccessBot = { id: string; audience: string; firewall: boolean };

/** Agents the Firewall or an external audience excludes: "all agents" never reaches them, only an explicit grant does. */
const restrictedBot = (bot: AccessBot) => bot.audience === "external" || bot.firewall === true;

/**
 * The access after switching one agent. Turning one off while access is "all agents" lists every
 * agent that was really on (restricted agents were not); turning a restricted agent on adds an
 * explicit grant, since "all agents" does not reach it. The connection's own agent stays on.
 */
export function toggleAgentAccess(
  connection: AccessConnection,
  bots: AccessBot[],
  botId: string,
  on: boolean,
  canWrite?: boolean,
  supportLabel?: string | null,
): DecidedAccess {
  const target = bots.find((bot) => bot.id === botId);
  if (!target) throw new IsolationError();
  // A support label only means something on a mailbox, for an agent that is on and firewalled.
  if (supportLabel !== undefined) {
    if (!on) throw new ORPCError("BAD_REQUEST", { message: "Turn the agent on to set a label" });
    if (
      !isMailConnection({
        status: connection.status ?? "",
        provider: connection.provider ?? "",
        providerRef: connection.providerRef ?? null,
      })
    )
      throw new ORPCError("BAD_REQUEST", { message: "Only a mail connection takes a label" });
    if (!target.firewall)
      throw new ORPCError("BAD_REQUEST", { message: "Only a firewalled agent takes a label" });
  }
  if (canWrite === true && on) {
    if (connection.agentBotId === null)
      throw new ORPCError("BAD_REQUEST", { message: "This connection has no changes to allow" });
    if (target.audience === "external")
      throw new ORPCError("BAD_REQUEST", { message: "External agents cannot make changes" });
  }
  const isOwner = botId === connection.agentBotId;
  // The owner's changes follow the connection's own switch, and a new grant starts read-only.
  const write: Record<string, boolean> | undefined = isOwner
    ? undefined
    : {
        [botId]: on
          ? (canWrite ??
            connection.botAccess.some((entry) => entry.botId === botId && entry.canWrite === true))
          : false,
      };
  const granted = new Set(connection.botAccess.map((entry) => entry.botId));
  const ids = new Set(
    connection.allAgents
      ? [...bots.filter((bot) => !restrictedBot(bot)).map((bot) => bot.id), ...granted]
      : granted,
  );
  if (on) ids.add(botId);
  else if (botId !== connection.agentBotId) ids.delete(botId);
  const all = bots.every((bot) => restrictedBot(bot) || ids.has(bot.id));
  // With "all agents", only restricted agents need a row of their own.
  return {
    allAgents: all,
    botIds: all
      ? bots.filter((bot) => restrictedBot(bot) && ids.has(bot.id)).map((bot) => bot.id)
      : [...ids],
    ...(write ? { canWrite: write } : {}),
    ...(supportLabel !== undefined ? { supportLabels: { [botId]: supportLabel } } : {}),
  };
}

/** Saves a connection's access under its row lock; `decide` reads the locked state and returns the access to store. */
async function saveConnectionAccess(
  prisma: PrismaClient,
  actor: Actor,
  connectionId: string,
  decide: (connection: AccessConnection, bots: AccessBot[]) => DecidedAccess,
) {
  await prisma.$transaction(async (tx) => {
    // Connection row first, then bots and grants: the same order as every other path.
    await tx.$queryRaw`SELECT id FROM connections WHERE id = ${connectionId} FOR UPDATE`;
    const connection = await tx.connection.findFirst({
      where: { id: connectionId, spaceId: actor.spaceId, userId: actor.userId },
      select: {
        id: true,
        connectorId: true,
        provider: true,
        status: true,
        providerRef: true,
        agentBotId: true,
        privateByDefault: true,
        agentShared: true,
        allAgents: true,
        botAccess: { select: { botId: true, canWrite: true } },
      },
    });
    if (!connection) throw new IsolationError();
    const scopedBots = await tx.bot.findMany({
      where: { spaceId: actor.spaceId, userId: actor.userId, archivedAt: null },
      select: { id: true, audience: true, firewall: true },
    });
    const decided = decide(connection, scopedBots);
    let botIds = [...new Set(decided.botIds)];
    // "Allow changes" survives every save for agents that stay on; only an explicit change or None clears it.
    const writeIds = new Set(
      connection.agentBotId === null
        ? []
        : connection.botAccess.filter((entry) => entry.canWrite).map((entry) => entry.botId),
    );
    for (const [id, value] of Object.entries(decided.canWrite ?? {})) {
      if (value) writeIds.add(id);
      else writeIds.delete(id);
    }
    // Under "all agents" a grant row is otherwise redundant, but it is where the write setting lives.
    if (decided.allAgents) botIds = [...new Set([...botIds, ...writeIds])];
    // Sharing is on once anyone besides the agent has access, and None does not turn it off.
    const agentShared =
      connection.agentShared ||
      connection.allAgents ||
      connection.botAccess.some((entry) => entry.botId !== connection.agentBotId) ||
      decided.allAgents ||
      botIds.some((id) => id !== connection.agentBotId);
    const standalone = Boolean(connection.agentBotId || connection.privateByDefault);
    if (connection.agentBotId) {
      const activeAgent = await tx.bot.updateMany({
        where: {
          id: connection.agentBotId,
          spaceId: actor.spaceId,
          userId: actor.userId,
          spawnKey: { in: connectionAgentSpawnKeys(actor, connection) },
          archivedAt: null,
        },
        data: { updatedAt: new Date() },
      });
      if (!activeAgent.count)
        throw new ORPCError("CONFLICT", {
          message: "The connection agent is no longer active",
        });
    }
    // The connection's agent always keeps access, even when a client saved without it.
    if (connection.agentBotId) botIds = [...new Set([...botIds, connection.agentBotId])];
    const bots = await tx.bot.count({
      where: { id: { in: botIds }, spaceId: actor.spaceId, userId: actor.userId },
    });
    if (bots !== botIds.length) throw new IsolationError();
    const siblings = standalone
      ? [{ id: connection.id }]
      : await tx.connection.findMany({
          where: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            connectorId: connection.connectorId,
            provider: connection.provider,
            agentBotId: null,
            privateByDefault: false,
          },
          select: { id: true },
        });
    const ids = siblings.map((row) => row.id);
    if (ids.length === 0)
      throw new ORPCError("CONFLICT", { message: "The connection changed; retry" });
    const updated = await tx.connection.updateMany({
      where: {
        id: { in: ids },
        spaceId: actor.spaceId,
        userId: actor.userId,
        agentBotId: connection.agentBotId,
        // A sibling provisioned or archived since it was listed is never shared with it.
        privateByDefault: connection.privateByDefault,
      },
      data: { allAgents: decided.allAgents, ...(connection.agentBotId ? { agentShared } : {}) },
    });
    if (updated.count !== ids.length)
      throw new ORPCError("CONFLICT", { message: "The connection changed; retry" });
    // A firewalled agent's label scope is part of its grant: keep it for every grant that stays.
    const labels = new Map(
      (
        await tx.botConnectionAccess.findMany({
          where: { connectionId: { in: ids }, spaceId: actor.spaceId, userId: actor.userId },
          select: { connectionId: true, botId: true, supportLabel: true },
        })
      ).map((row) => [`${row.connectionId}:${row.botId}`, row.supportLabel]),
    );
    await tx.botConnectionAccess.deleteMany({
      where: {
        connectionId: { in: ids },
        spaceId: actor.spaceId,
        userId: actor.userId,
      },
    });
    if (botIds.length > 0) {
      await tx.botConnectionAccess.createMany({
        data: ids.flatMap((connectionId) =>
          botIds.map((botId) => ({
            connectionId,
            botId,
            spaceId: actor.spaceId,
            userId: actor.userId,
            canWrite: writeIds.has(botId) && botId !== connection.agentBotId,
            // An explicit label belongs to the connection being edited; a sibling grouped with it
            // under the same change keeps the scope it already had.
            supportLabel:
              connectionId === connection.id && decided.supportLabels?.[botId] !== undefined
                ? decided.supportLabels[botId]
                : (labels.get(`${connectionId}:${botId}`) ?? null),
          })),
        ),
      });
    }
  });
}

/** The stored access of every live connection of the caller. */
async function allConnectionAccess(prisma: PrismaClient, actor: Actor) {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const rows = await prisma.connection.findMany({
    where: { ...scope, status: { not: "revoked" } },
    select: {
      id: true,
      allAgents: true,
      agentShared: true,
      agentBotId: true,
      botAccess: {
        where: scope,
        select: { botId: true, canWrite: true, supportLabel: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return Object.fromEntries(
    rows.map((row) => {
      const botIds = row.botAccess.map((entry) => entry.botId);
      return [
        row.id,
        {
          allAgents: row.allAgents,
          botIds,
          writeBotIds: row.botAccess.filter((entry) => entry.canWrite).map((entry) => entry.botId),
          supportLabels: supportLabelsOf(row.botAccess),
          agentShared:
            row.agentShared || row.allAgents || botIds.some((id) => id !== row.agentBotId),
        },
      ];
    }),
  );
}

/** Every connection of the caller with the agents that can really use it, in one pass. */
async function allEffectiveAccess(prisma: PrismaClient, actor: Actor) {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const [rows, bots] = await Promise.all([
    prisma.connection.findMany({
      where: { ...scope, status: { not: "revoked" } },
      select: {
        id: true,
        connectorId: true,
        provider: true,
        status: true,
        allAgents: true,
        agentBotId: true,
        privateByDefault: true,
        botAccess: { where: scope, select: { botId: true } },
      },
    }),
    prisma.bot.findMany({
      where: { ...scope, archivedAt: null },
      select: {
        id: true,
        spawnKey: true,
        archivedAt: true,
        audience: true,
        firewall: true,
      },
    }),
  ]);
  return effectiveAccessByConnection(rows, bots);
}

/** Runs a transaction again once if Postgres picked it as the victim of a deadlock. */
async function retryOnDeadlock<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "P2034" || /deadlock/i.test(String((error as Error)?.message))) return run();
    throw error;
  }
}

function connectionDto(row: {
  id: string;
  connectorId: string;
  provider: string;
  displayName: string;
  status: string;
  createdAt: Date;
  writesEnabled: boolean;
  agentBotId: string | null;
  metadata?: unknown;
  mailSyncState?: { needsReconnect: boolean; lastErrorAt: Date | null } | null;
}) {
  const stored = row.metadata as { mailAddress?: unknown; accountAddress?: unknown } | null;
  const account = [stored?.mailAddress, stored?.accountAddress].find(
    (value): value is string => typeof value === "string" && value !== "",
  );
  return {
    id: row.id,
    connectorId: row.connectorId,
    provider: row.provider,
    displayName: row.displayName,
    ...(account ? { account } : {}),
    status: row.status as "pending" | "connected" | "revoked" | "error",
    error: connectionError(row),
    ...(row.mailSyncState?.needsReconnect && row.mailSyncState.lastErrorAt
      ? { needsReconnect: true }
      : {}),
    writesEnabled: row.writesEnabled,
    agentBotId: row.agentBotId,
    capabilities: [],
    createdAt: row.createdAt.toISOString(),
  };
}

function connectionContext(
  actor: Pick<Actor, "spaceId" | "userId">,
  operationId: string,
  signal?: AbortSignal,
): AdapterContext {
  return {
    operationId,
    traceId: operationId,
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: signal ?? new AbortController().signal,
  };
}

/** Loopback / LAN / Docker-network endpoints: the deployment owner, or everyone under the flag. */
function mayUsePrivateEndpoint(actor: Actor, deps: Pick<RouterDeps, "env">): boolean {
  return actor.isDeploymentOwner || deps.env.mcpAllowPrivateEndpoint === true;
}

function mcpStdioPolicy(deps: Pick<RouterDeps, "env">): McpStdioPolicy {
  return {
    stdioEnabled: deps.env.mcpStdioEnabled,
    allowedCommands: deps.env.mcpStdioAllowedCommands,
  };
}

/** Refuse a stdio server this deployment would never run. */
function assertMcpStdioCommand(command: string, deps: Pick<RouterDeps, "env">): void {
  const refusal = mcpStdioRefusal(command, mcpStdioPolicy(deps));
  if (refusal) throw new ORPCError("BAD_REQUEST", { message: refusal });
}

async function assertMcpRemoteEndpoint(
  endpoint: string | null | undefined,
  actor: Actor,
  deps: Pick<RouterDeps, "remoteConnectors" | "env">,
): Promise<void> {
  if (!endpoint) return;
  try {
    await assertSafeRemoteUrl(endpoint, deps.remoteConnectors?.resolveHostname, {
      allowPrivateEndpoint: mayUsePrivateEndpoint(actor, deps),
    });
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", {
      message: error instanceof Error ? error.message : "MCP endpoint is invalid",
    });
  }
}

function mcpAssignmentDto(row: {
  id: string;
  botId: string;
  serverId: string;
  allowAllTools: boolean;
  allowedTools: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    botId: row.botId,
    serverId: row.serverId,
    allowAllTools: row.allowAllTools,
    allowedTools: Array.isArray(row.allowedTools)
      ? row.allowedTools.filter((item): item is string => typeof item === "string")
      : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toNotificationDto(row: Notification): NotificationDto {
  return {
    id: row.id,
    botId: row.botId,
    surface: row.surface,
    threadId: row.threadId,
    title: row.title,
    body: row.body,
    link: row.link,
    importance: row.importance,
    kind: notificationKindOf(row),
    createdAt: row.createdAt.toISOString(),
    seenAt: row.seenAt?.toISOString() ?? null,
    shownAt: row.shownAt?.toISOString() ?? null,
  };
}

/** Bound for one provider sandbox destroy during Space deletion. Providers may
 * ignore the request abort signal, so without a deadline a hung destroy would
 * keep the deletion claim renewed forever and block stale-claim recovery. */
const SPACE_TEARDOWN_TIMEOUT_MS = 120_000;

/** The card is closed by a marker; the run that follows finishes whatever the call left open. */
/** Deterministic nonce for a call's marker message. The unique (threadId, clientNonce)
 * index makes it the hang-up idempotency key, and the "call:" prefix lets clients derive
 * the marker's callId. User turns carry a uuid suffix, so they never collide. */
export function callMarkerClientNonce(callId: string): string {
  return `${CALL_CLIENT_NONCE_PREFIX}${callId}:marker`;
}

const HANG_UP_PROMPT =
  "The voice call just ended because the user hung up. First call end_call with a short title for the call (leave farewell empty). Then, if anything the user asked for during the call is still unfinished, complete it now as a normal chat reply with full formatting. If nothing is pending, reply with one short sentence.";

function spaceTeardownTimeoutMs(): number {
  const override = Number(process.env.SPACE_TEARDOWN_TIMEOUT_MS ?? "");
  return Number.isFinite(override) && override > 0 ? override : SPACE_TEARDOWN_TIMEOUT_MS;
}

/** A cap table write from a stale copy or a source that no longer owns the table is a conflict. */
function capTableConflict(error: unknown): never {
  if (error instanceof CapTableSourceError)
    throw new ORPCError("CONFLICT", { message: error.message });
  throw error;
}

function sidebarPageError(error: unknown): never {
  if (error instanceof SidebarPageError) {
    throw new ORPCError(error.code === "owner_only" ? "FORBIDDEN" : "BAD_REQUEST", {
      message: error.message,
    });
  }
  throw error;
}

function investorUpdateError(error: unknown): never {
  if (error instanceof InvestorUpdateLockedError)
    throw new ORPCError("CONFLICT", { message: error.message });
  if (error instanceof PortalBlockedError || error instanceof ShareRequestConflictError)
    throw new ORPCError("CONFLICT", { message: error.message });
  return contactNotFound(error);
}

function fundraisingError(error: unknown): never {
  if (error instanceof IsolationError) throw new ORPCError("NOT_FOUND", { message: error.message });
  if (error instanceof SafeActiveError || error instanceof SafeStateError) {
    throw new ORPCError("CONFLICT", { message: error.message });
  }
  if (
    error instanceof SafeCapRequiredError ||
    error instanceof ProspectEmailRequiredError ||
    error instanceof PipelineInputError
  ) {
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  }
  if (error instanceof FundraiseRoundOpenError) {
    throw new ORPCError("CONFLICT", { message: error.message });
  }
  throw error;
}

function contactNotFound(error: unknown): never {
  if (error instanceof IsolationError) throw new ORPCError("NOT_FOUND", { message: error.message });
  if (error instanceof ContactEmailTakenError) {
    throw new ORPCError("CONFLICT", { message: error.message });
  }
  throw error;
}

const BOT_SECRET_INPUT_ERRORS = [
  "Invalid credential destination",
  "Invalid credential length",
  "Credential cannot be used with this authentication method",
  "Remove the existing credential before changing its destination",
  "Credential limit reached",
];

/** A credential the user typed that cannot be stored, as a bad request. Never echoes the value. */
function mapBotSecretInputError(error: unknown): unknown {
  if (
    error instanceof Error &&
    BOT_SECRET_INPUT_ERRORS.some((prefix) => error.message.startsWith(prefix))
  ) {
    return new ORPCError("BAD_REQUEST", { message: error.message });
  }
  return error;
}

/** Map credential validation failures to a bad request without echoing the submitted value. */
function mapBotSecretStoreError(error: unknown): unknown {
  if (error instanceof ORPCError) return error;
  const mapped = mapBotSecretInputError(error);
  if (mapped !== error) return mapped;
  // Login decoding failures: a JSON parse message can quote the submitted value, so never forward it.
  if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
    return new ORPCError("BAD_REQUEST", {
      message: "A website login needs a username and password",
    });
  }
  return error;
}

function botSecretScope(actor: Actor, botId: string) {
  return { userId: actor.userId, spaceId: actor.spaceId, botId };
}

function botSecretMetadataDto(row: {
  name: string;
  origin: string;
  auth: unknown;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  needsAttentionAt: Date | null;
}): BotSecretMetadata {
  // Unreadable or no-longer-storable destinations become auth:null so the owner UI stays remove-only.
  const parsed = BotSecretAuth.safeParse(row.auth);
  let auth: BotSecretMetadata["auth"] = null;
  if (parsed.success) {
    try {
      normalizeSecretDestination({ name: row.name, origin: row.origin, auth: parsed.data });
      auth = parsed.data;
    } catch {
      auth = null;
    }
  }
  return {
    name: row.name,
    origin: row.origin,
    auth,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    needsAttentionAt: row.needsAttentionAt?.toISOString() ?? null,
  };
}

const BOT_INTRO_PROMPT =
  "You were just created. In one reply, say what you understood your role to be from your title, description and instructions, and ask for anything you need to get started.";

/**
 * A freshly created bot otherwise sits silent until someone hands it real work,
 * so a misunderstood role goes unnoticed until it costs a run. Queue one
 * invisible-prompt turn (like a routine or skill test run) so its first
 * message states how it read its own instructions. The executor gives the
 * "created" trigger no tools (see executor.ts), so this turn can only speak.
 */
export async function enqueueBotIntroRun(
  deps: RouterDeps,
  actor: Actor,
  bot: Bot,
  options: { delayMs?: number } = {},
): Promise<boolean> {
  const threadId = bot.threadId;
  if (!threadId) return false;
  // Scripted is the deterministic test/eval runtime, not a real deployment: an
  // extra automatic run there competes with whatever response a test or eval
  // harness queued next, for a bot it doesn't otherwise get to opt out of.
  if (deps.env.agentRuntime === "scripted") return false;
  if ((await modelSetup(deps, actor)).needsModel) return false;
  const delayed = options.delayMs !== undefined;
  const run = await deps.prisma.$transaction(async (tx) => {
    // A delayed intro follows edits to the profile. Reuse the intro run still waiting for its
    // delay so a burst of edits becomes one run, pushed back each time.
    const waiting = delayed
      ? await tx.run.findFirst({
          where: {
            spaceId: actor.spaceId,
            botId: bot.id,
            threadId,
            trigger: "created",
            status: "queued",
          },
          select: { id: true },
        })
      : null;
    if (waiting) return waiting;
    const task = await tx.task.create({
      data: {
        spaceId: actor.spaceId,
        botId: bot.id,
        threadId,
        userId: actor.userId,
        prompt: BOT_INTRO_PROMPT,
        status: "queued",
      },
    });
    return tx.run.create({
      data: {
        spaceId: actor.spaceId,
        botId: bot.id,
        threadId,
        taskId: task.id,
        userId: actor.userId,
        status: "queued",
        trigger: "created",
        unattended: newRunUnattended({ trigger: "created" }),
      },
      select: { id: true },
    });
  });
  // Same job key as every continue of this run, so a later call replaces the pending job and its delay.
  await deps.jobs.enqueue({
    ...runContinueJob(run.id),
    ...(delayed ? { availableAt: new Date(Date.now() + options.delayMs!) } : {}),
  });
  return true;
}

/** How long profile edits settle before a bot that nobody has talked to yet introduces itself again. */
const BOT_REINTRO_DELAY_MS = 4000;

/**
 * Until the user sends a first message, the greeting a bot was created with can go stale as they
 * fill in its settings. Replace it with a fresh introduction that reflects the new profile.
 */
export async function reintroduceUnansweredBot(
  deps: RouterDeps,
  actor: Actor,
  bot: Bot,
): Promise<void> {
  if (!bot.threadId || bot.spawnKey) return;
  const asked = await deps.prisma.message.count({
    where: { threadId: bot.threadId, role: "user" },
  });
  if (asked > 0) return;
  if (!(await enqueueBotIntroRun(deps, actor, bot, { delayMs: BOT_REINTRO_DELAY_MS }))) return;
  // The setup question no longer applies once the bot has been set up by hand.
  await dismissFocus(
    { prisma: deps.prisma, events: deps.events, connectors: deps.connectors },
    actor,
    bot.id,
  );
}

/**
 * Runs `fn` scoped to another of the actor's Spaces. Membership is checked first,
 * so a client-supplied Space id never opens that Space's rows on its own.
 */
async function asMemberOf<T>(
  prisma: PrismaClient,
  actor: Actor,
  spaceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const member = await prisma.spaceMember.findFirst({
    where: { spaceId, userId: actor.userId },
    select: { id: true },
  });
  if (!member) throw new ORPCError("NOT_FOUND", { message: new SpaceNotFoundError().message });
  return runAsTenant({ spaceId, userId: actor.userId }, fn);
}

// Named so declaration emit does not spell out the whole router, which no longer fits.
export type AppRouter = Router<AppContract, RouteAuthContext>;

export function createRouter(deps: RouterDeps): AppRouter {
  const routeContext = createRouteContext(deps);
  const { os, authed, ownerOnly } = routeContext;
  const repos = createRepos(deps.prisma);
  /**
   * Moves a bot to another computer (or onto the same one under a different provider) while it is
   * idle: claims the bot, refuses during a run or screen control, parks a dedicated computer, then
   * applies the change.
   */
  const relocateBotComputer = async <T>(
    actor: Actor,
    bot: Awaited<ReturnType<typeof repos.getBot>>,
    apply: () => Promise<T>,
  ): Promise<T> => {
    if (!bot.computer) throw new IsolationError();
    const claimed = await deps.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM computers WHERE id = ${bot.computerId} FOR UPDATE`;
      return tx.bot.updateMany({
        where: { id: bot.id, computerSwitching: false, computer: { maintenanceId: null } },
        data: { computerSwitching: true },
      });
    }, THREAD_LOCK_TRANSACTION_OPTIONS);
    if (claimed.count !== 1) throw new ORPCError("CONFLICT");
    try {
      const active = await deps.prisma.run.findFirst({
        where: { botId: bot.id, status: { in: [...ACTIVE_RUN_STATUSES] } },
        select: { id: true },
      });
      if (active) {
        throw new ORPCError("BAD_REQUEST", { message: "Stop the bot first" });
      }
      if (bot.computer.controlBotId === bot.id && hasActiveComputerControl(bot.computer)) {
        throw new ORPCError("BAD_REQUEST", { message: "Release the computer first" });
      }
      if (bot.computer.scope === "dedicated" && bot.computer.providerRef) {
        const ctx = computerContext(actor, bot.id, "computer.switch");
        const ref = toComputerRef(bot.computer);
        if (bot.computer.state === "running") {
          try {
            await checkpointAndRecordComputerWorkspace(deps, bot.computer, ref, ctx);
            await deps.sandbox.stop(ref, ctx);
          } catch (error) {
            // The sandbox is already gone: nothing left to checkpoint or stop.
            if (!isSandboxGoneError(error)) throw error;
          }
        }
        await deps.prisma.computerExecutionLease.deleteMany({
          where: { computerId: bot.computer.id, botId: bot.id },
        });
        await deps.prisma.computer.update({
          where: { id: bot.computer.id },
          data: {
            state: "stopped",
            controlHolder: "none",
            controlLeaseId: null,
            controlLeaseExpiresAt: null,
            controlBotId: null,
            controlRunId: null,
            executionRunId: null,
            executionBotId: null,
            executionLeaseExpiresAt: null,
          },
        });
      }
      return await apply();
    } finally {
      await deps.prisma.bot.updateMany({
        where: { id: bot.id },
        data: { computerSwitching: false },
      });
    }
  };
  const provisionForActor = (actor: Actor, connectionId: string) =>
    provisionConnectionAgent(
      { prisma: deps.prisma, repos, archiveBot: (botId) => archiveActorBot(actor, botId) },
      actor,
      connectionId,
    );
  const meetingSources = deps.meetingSources ?? createMeetingSourceRegistry();
  const meetingsFor = (actor: Actor): MeetingsDeps => ({
    router: deps,
    registry: meetingSources,
    agent: { prisma: deps.prisma, repos, archiveBot: (botId) => archiveActorBot(actor, botId) },
  });
  const archiveActorBot = async (actor: Actor, botId: string) => {
    const bot = await repos.getBot(actor, botId, { includeArchived: true });
    await archiveBot(
      {
        prisma: deps.prisma,
        sandbox: deps.sandbox,
        home: deps.home,
        jobs: deps.jobs,
        artifacts: deps.artifacts,
        dataDir: deps.dataDir,
      },
      bot,
      computerContext(actor, bot.id, "archive"),
    );
  };
  const restoreActorBot = async (actor: Actor, botId: string) => {
    const bot = await repos.getBot(actor, botId, { includeArchived: true });
    if (!bot.archivedAt) return;
    if (isRetiredVoiceAgentSpawnKey(bot.spawnKey)) {
      throw new ORPCError("BAD_REQUEST", { message: "This voice agent was replaced" });
    }
    if (bot.computer) {
      await restoreBotUnderComputerQuota(deps.prisma, {
        userId: actor.userId,
        botId: bot.id,
        computerId: bot.computer.id,
      });
    } else {
      await deps.prisma.bot.update({ where: { id: bot.id }, data: { archivedAt: null } });
    }
  };
  const sourceAgentDeps = (actor: Actor) => ({
    prisma: deps.prisma,
    repos,
    archiveBot: (botId: string) => archiveActorBot(actor, botId),
  });
  const oneCapability = async (actor: Actor, id: string) => {
    const found = (await listCapabilities(sourceAgentDeps(actor), actor)).find(
      (entry) => entry.id === id,
    );
    if (!found) throw new ORPCError("NOT_FOUND", { message: "Source not found" });
    return found;
  };
  /**
   * Creates a server's integration agent and, in one step, makes the server exclusive to it and
   * read-only, and only while the agent is active: an archive in between would otherwise leave a
   * marked server shared. Writes stay off for every new server; the owner turns them on, and each
   * call then needs its card.
   */
  const provisionExclusiveAgent = async (actor: Actor, serverId: string) => {
    const { bot } = await ensureIntegrationAgent(
      { prisma: deps.prisma, repos, archiveBot: (botId) => archiveActorBot(actor, botId) },
      actor,
      serverId,
    );
    const server = await deps.prisma.$transaction(async (tx) => {
      const active = await tx.bot.updateMany({
        where: { id: bot.id, ...actorScope(actor), archivedAt: null },
        data: { updatedAt: new Date() },
      });
      const marked = active.count
        ? await tx.mcpServer.updateMany({
            where: { id: serverId, ...actorScope(actor), agentBotId: bot.id },
            data: { agentExclusive: true, agentProvisionedAt: new Date(), writesEnabled: false },
          })
        : { count: 0 };
      if (!marked.count) throw new ORPCError("CONFLICT", { message: "The agent changed; retry" });
      return tx.mcpServer.findFirstOrThrow({ where: { id: serverId, ...actorScope(actor) } });
    });
    return { bot, server };
  };
  const devinDeps: DevinDeps = {
    prisma: deps.prisma,
    jobs: deps.jobs,
    secrets: deps.secrets,
    mcp: deps.mcp ?? {
      listServerTools: () => Promise.reject(new Error("MCP is not available")),
    },
    callTool:
      deps.devinCallTool ??
      (deps.mcp
        ? createDevinCallTool(deps.prisma, deps.mcp)
        : () => Promise.reject(new Error("MCP is not available"))),
    provisionAgent: async (actor, serverId) => (await provisionExclusiveAgent(actor, serverId)).bot,
    archiveBot: archiveActorBot,
    notificationEvents: deps.notificationEvents,
  };
  const brexCardsDeps: BrexCardsDeps = {
    prisma: deps.prisma,
    secrets: deps.secrets,
    mcp: deps.mcp ?? {
      callServerTool: () => Promise.reject(new Error("MCP is not available")),
    },
    ...(deps.brexApi ? { brexApi: deps.brexApi } : {}),
    provisionAgent: async (actor, serverId) => (await provisionExclusiveAgent(actor, serverId)).bot,
    archiveBot: archiveActorBot,
  };
  const onboardingDeps = { prisma: deps.prisma, events: deps.events, connectors: deps.connectors };
  const mcpOAuth = deps.mcpOAuth ?? new McpOAuthBroker(deps.prisma, deps.secrets);
  const cartaSyncDeps: CartaSyncDeps = {
    prisma: deps.prisma,
    repos,
    hasModel: async (actor) => !(await modelSetup(deps, actor)).needsModel,
    enqueueRun: (runId) => deps.jobs.enqueue(runContinueJob(runId)),
  };
  const capTableState = async (actor: Actor) => {
    // Once the cap table ledger has data it is the record, and the snapshot is derived from it.
    const snapshot =
      (await equityLedgerSnapshot(deps.prisma, actorScope(actor))) ??
      (await getCapTableSnapshot(deps.prisma, actorScope(actor)));
    return {
      snapshot,
      syncing: await isCartaSyncing(deps.prisma, actor),
      ...(snapshot?.source === "sheet"
        ? await sheetReadState(deps.prisma, actor, snapshot.updatedAt)
        : { reading: false, lastReadFailed: false }),
    };
  };
  /** Starts the sheet read and turns its refusals into the messages the page shows. */
  const readSheet = async (actor: Actor) => {
    const result = await startSheetRead(
      { ...cartaSyncDeps, prisma: deps.prisma, jobs: deps.jobs },
      actor,
    );
    if (result === "no_model")
      throw new ORPCError("BAD_REQUEST", { message: "Add a model before reading the sheet" });
    if (result === "other_source")
      throw new ORPCError("BAD_REQUEST", { message: "The cap table is not read from a sheet" });
  };
  const beginMcpOAuth = (
    input: {
      serverId: string;
      spaceId: string;
      userId: string;
      redirectUri: string;
      reauthorize?: boolean;
      oauthClient?: { clientId: string; clientSecret?: string; scope?: string };
    },
    requestHeaders?: Headers,
  ) => {
    if (!isAllowedMcpOAuthRedirect(deps.env, requestHeaders, input.redirectUri)) {
      throw new Error("MCP OAuth redirect URI is not allowed");
    }
    return mcpOAuth.begin(input);
  };
  const fundraisingDeps = {
    prisma: deps.prisma,
    mcpOAuth,
    ...(deps.safeCallToolFor ? { safeCallToolFor: deps.safeCallToolFor } : {}),
  };
  // A failed enqueue only delays the photos to the next visit, so it must not fail the page.
  const queueContactPhotos = (scope: { spaceId: string; userId: string }) => {
    requestContactPhotos({ prisma: deps.prisma, jobs: deps.jobs }, scope).catch((error) =>
      getLogger().warn("contact photos enqueue failed", {
        reason: error instanceof Error ? error.name : "error",
      }),
    );
  };
  const financeDeps = {
    prisma: deps.prisma,
    jobs: deps.jobs,
    repos,
    mcpOAuth,
    beginMcpOAuth,
    callToolFor: deps.financeCallToolFor,
    secrets: deps.secrets,
    crypto: deps.financeCrypto,
    parseStatement: deps.parseStatement,
    ...(deps.exchangeFetch ? { exchangeFetch: deps.exchangeFetch } : {}),
  };
  const investorSendDeps = {
    prisma: deps.prisma,
    mailWritesDisabled: deps.env.mailWritesDisabled,
    compose: (actor: Actor, fields: ComposeFields) =>
      inboxComposeSend({ ...deps, mailWritesDisabled: deps.env.mailWritesDisabled }, actor, fields),
    gmailConnectionIds: async (actor: Actor) =>
      (
        await deps.mail.listAccounts(
          { spaceId: actor.spaceId, userId: actor.userId },
          mailContext(actor, "investors.updates.send"),
        )
      ).map((account) => account.id),
    email: deps.email,
    portalLink: async (actor: Actor, contactId: string) => {
      const { token, email } = await mintPortalTokenFor(deps.prisma, actor, contactId);
      return { link: `${deps.env.webOrigin}/portal/open#${token}`, email };
    },
  };
  const legalDeps = {
    prisma: deps.prisma,
    jobs: deps.jobs,
    artifacts: deps.artifacts,
    repos,
    // The Legal agent's own model decides who receives Data Room text, not the space default.
    resolveAi: (actor: Actor, botId: string) =>
      resolveDataRoomAi(
        {
          prisma: deps.prisma,
          resolveModel: deps.resolveModel
            ? (scope) => deps.resolveModel!({ ...scope, botId })
            : undefined,
        },
        actor,
      ),
  };
  const codexCatalog = deps.codexCatalog ?? new CodexCatalogCache();
  const favicons = deps.favicons ?? createFaviconResolver();
  const refreshExpiredCredential =
    deps.refreshExpiredModelCredential ??
    ((scope: { userId: string; spaceId: string }, secretId: string, provider: string) =>
      kickModelCredentialRefresh(deps.prisma, deps.secrets, scope, secretId, provider));
  const liveCatalogFor = async (actor: Actor) => {
    const auth = await modelCredentialAuthKindsForSpace(deps.prisma, deps.secrets, actor);
    const available = listAvailablePiCatalog(auth.byProvider, auth.byModel);
    const live = await codexLiveCatalogsForSpace(
      deps.prisma,
      deps.secrets,
      actor,
      auth,
      codexCatalog,
      {
        // An expired bearer yields no catalog this round; kick the runtime's
        // locked refresh so the next read can see the account's real list.
        onExpiredToken: (secretId) =>
          refreshExpiredCredential(actor, secretId, CHATGPT_OAUTH_PROVIDER),
      },
    );
    return {
      auth,
      catalog: live.size > 0 ? applyCodexLiveCatalog(available, auth, live) : available,
    };
  };
  const groupRepos = createGroupRepos(deps.prisma);
  /**
   * Stops cancelled group runs: their jobs and per-computer run work and screens, then expires
   * the leases. Expiring only after teardown keeps other runs off these screens until then.
   */
  const tearDownGroupRuns = async (
    actor: Actor,
    teardown: {
      cancelledRunIds: string[];
      computers: Awaited<ReturnType<typeof groupRepos.archiveGroup>>["computers"];
    },
  ) => {
    await Promise.all(
      teardown.cancelledRunIds.map((runId) =>
        deps.jobs.cancel(runJobKey(runId)).catch(() => undefined),
      ),
    );
    await Promise.all(
      teardown.computers.map(async (computer) => {
        if (!computer.providerRef) return;
        const adapterContext = {
          operationId: "stop",
          traceId: "stop",
          spaceId: actor.spaceId,
          userId: actor.userId,
          botId: computer.botId,
          runId: computer.runId,
          screenLeaseId: screenLeaseIdForRun(
            { runId: computer.runId, fence: computer.fence },
            computer.runId,
          ),
          cancelRunWork: true,
          signal: new AbortController().signal,
        };
        const ref = toComputerRef(computer);
        await cancelComputerRunWork(deps.sandbox, ref, computer.id, computer.runId, adapterContext);
        await deps.sandbox.releaseScreen?.(ref, adapterContext).catch(() => undefined);
      }),
    );
    await groupRepos.releaseArchivedRunLeases(teardown.cancelledRunIds);
  };
  const taughtSkills = createTaughtSkillsService({
    prisma: deps.prisma,
    events: deps.events,
    jobs: deps.jobs,
    sandbox: deps.sandbox,
    home: deps.home,
    dataDir: deps.dataDir,
    secrets: deps.secrets,
    describeSteps: deps.describeTeachSteps,
    putLogin: async (actor, botId, login) => {
      try {
        await storeBotSecret({
          prisma: deps.prisma,
          secretStore: deps.secrets,
          scope: botSecretScope(actor, botId),
          destination: { name: login.name, origin: login.site, auth: { type: "login" } },
          plaintext: encodeLoginSecret({ username: login.username, password: login.password }),
        });
      } catch (error) {
        throw mapBotSecretStoreError(error);
      }
    },
  });
  const agentSkills = createAgentSkillsService(deps.prisma, {
    resolveHostname: deps.remoteConnectors?.resolveHostname,
  });
  const dataRoom = createDataRoomService({
    prisma: deps.prisma,
    artifacts: deps.artifacts,
    jobs: deps.jobs,
    mail: deps.mail,
    connectors: deps.connectors,
    box: {
      accessToken: boxAccessToken(mcpOAuth),
      ...(deps.boxFetch ? { fetch: deps.boxFetch } : {}),
    },
    resolveAi: (scope) =>
      resolveDataRoomAi({ prisma: deps.prisma, resolveModel: deps.resolveModel }, scope),
    proposeSort: deps.proposeSort,
  });

  const dataRoomRepo = createDataRoomRepos(deps.prisma);
  const personContextDeps: PersonContextDeps = {
    prisma: deps.prisma,
    searchDataRoom: async (actor, query) =>
      (await dataRoomRepo.searchPage(actor, { query, limit: 5 })).results.map((hit) => ({
        id: hit.item.id,
        name: hit.item.name,
      })),
    calendarMeetings: async (actor, email, signal) => {
      const scope = actorScope(actor);
      const accounts = await listCalendarAccounts(deps.prisma, scope);
      return accounts.length
        ? personCalendarMeetings(
            { connectors: deps.connectors },
            accounts,
            connectionContext(scope, `person-context:${randomUUID()}`, signal),
            email,
          )
        : [];
    },
    summarize: deps.summarizePerson,
  };

  const boardEnabled = os
    .use(async ({ next }) => {
      if (!deps.env?.ticketBoardEnabled) throw new ORPCError("NOT_FOUND");
      return next();
    })
    .use(async ({ context, next }) => {
      const actor = context.actor;
      if (!actor) throw new ORPCError("UNAUTHORIZED");
      try {
        return await asTenant(actor, () => next({ context: { ...context, actor } }));
      } catch (error) {
        asNotFound(error);
      }
    });
  const ticketDeps = {
    prisma: deps.prisma,
    ticketBoardEnabled: deps.env?.ticketBoardEnabled,
    onTicketChange: deps.ticketChanges,
  };

  return os.router({
    aiConsent: {
      status: authed.aiConsent.status.handler(({ context, input }) =>
        aiConsentStatus(deps, context.actor, input),
      ),
      allow: authed.aiConsent.allow.handler(({ context, input }) =>
        allowAiConsent(deps, context.actor, input),
      ),
      revoke: authed.aiConsent.revoke.handler(async ({ context, input }) => {
        await revokeAiConsent(deps.prisma, context.actor, input.key);
        return aiConsentStatus(deps, context.actor);
      }),
    },
    health: os.health.handler(async () => ({ ok: true as const, version: "0.1.0" })),
    me: authed.me.handler(async ({ context }): Promise<Me> => meDto(deps, context.actor)),
    billing: createBillingRoutes(routeContext),
    /** The cap table ledger: apps/api/src/equity. */
    equity: createEquityRoutes(routeContext),
    mcpConnections: createMcpConnectionsRoutes(routeContext),
    preferences: {
      update: authed.preferences.update.handler(async ({ context, input }): Promise<Me> => {
        if (input.timezone !== undefined && !isValidTimezone(input.timezone)) {
          throw new ORPCError("BAD_REQUEST", { message: "Unknown time zone" });
        }
        await deps.prisma.user.update({
          where: { id: context.actor.userId },
          data: {
            avatarStyle: input.avatarStyle,
            timezone: input.timezone,
            tourSeenAt:
              input.tourSeen === undefined ? undefined : input.tourSeen ? new Date() : null,
            hideAmounts: input.hideAmounts,
            // A tab open across the cap-table rename may still send the old key.
            hiddenPages: input.hiddenPages && [
              ...new Set(input.hiddenPages.map((key) => (key === "cap-table" ? "investors" : key))),
            ],
          },
        });
        return meDto(deps, context.actor);
      }),
    },
    spaces: {
      list: authed.spaces.list.handler(async ({ context }) =>
        spaceNavigationDto(deps, context.actor, repos, groupRepos),
      ),
      // Seeds a Space whose id does not exist yet; the member limit is checked inside.
      create: authed.spaces.create.handler(({ context, input }) =>
        runAsSystem("create a Space for its member", async () => {
          let space: { id: string; name: string };
          try {
            space = await createSpaceForMember(deps.prisma, {
              currentSpaceId: context.actor.spaceId,
              userId: context.actor.userId,
              name: input.name,
            });
          } catch (error) {
            if (error instanceof SpaceLimitError || error instanceof InvalidSpaceNameError) {
              throw new ORPCError("BAD_REQUEST", { message: error.message });
            }
            throw error;
          }
          return {
            id: space.id,
            name: space.name,
            isDefault: false,
            hasContent: false,
            canRename: true,
            canDelete: true,
            bots: [],
            groups: [],
            externalConversations: [],
            botSections: [],
          };
        }),
      ),
      // Renames another of the member's Spaces; membership is checked first.
      rename: authed.spaces.rename.handler(({ context, input }) =>
        asMemberOf(deps.prisma, context.actor, input.spaceId, async () => {
          try {
            return await renameSpaceForMember(deps.prisma, {
              currentSpaceId: context.actor.spaceId,
              userId: context.actor.userId,
              spaceId: input.spaceId,
              name: input.name,
            });
          } catch (error) {
            if (error instanceof SpaceNotFoundError) {
              throw new ORPCError("NOT_FOUND", { message: error.message });
            }
            if (error instanceof CannotRenameSpaceAsNonOwnerError) {
              throw new ORPCError("FORBIDDEN", { message: error.message });
            }
            if (error instanceof InvalidSpaceNameError) {
              throw new ORPCError("BAD_REQUEST", { message: error.message });
            }
            if (error instanceof SpaceDeletionInProgressError) {
              throw new ORPCError("CONFLICT", { message: error.message });
            }
            if (error instanceof SpaceHasCapTableError) {
              throw new ORPCError("CONFLICT", { message: error.message });
            }
            throw error;
          }
        }),
      ),
      setMeetingRecording: authed.spaces.setMeetingRecording.handler(({ context, input }) =>
        setMeetingRecording(deps, context.actor, input.policy),
      ),
      // Acts on the Space being deleted, not the current one, so its emptiness check and
      // teardown see that Space's rows. Membership is checked first.
      remove: authed.spaces.remove.handler(({ context, input }) =>
        asMemberOf(deps.prisma, context.actor, input.spaceId, async () => {
          let claimId: string | null = null;
          let claimActive = false;
          let claimHealthy = true;
          let claimReleasable = false;
          let claimRenewal: ReturnType<typeof setInterval> | null = null;
          const deleteInput = {
            currentSpaceId: context.actor.spaceId,
            userId: context.actor.userId,
            spaceId: input.spaceId,
          };
          try {
            // Claim emptiness before external teardown. Bot and group creation
            // take the same lifecycle lock and reject the Space until deletion
            // finishes or this claim is released.
            const claim = await claimEmptySpaceDeletionForMember(deps.prisma, deleteInput);
            claimId = claim.claimId;
            claimActive = true;
            // A recovered worker can safely finish deletion, but cannot know
            // whether the previous worker still has provider teardown in flight.
            // Keep the Space claimed on failure so content cannot reuse it.
            claimReleasable = !claim.recovered;
            const claimedInput = { ...deleteInput, claimId };
            const assertClaim = async () => {
              if (!claimHealthy) throw new SpaceDeletionInProgressError();
              try {
                const renewed = await renewSpaceDeletionClaim(deps.prisma, claimedInput);
                if (!renewed) {
                  claimHealthy = false;
                  claimReleasable = false;
                  throw new SpaceDeletionInProgressError();
                }
              } catch (error) {
                claimHealthy = false;
                claimReleasable = false;
                throw error;
              }
            };
            claimRenewal = setInterval(() => {
              void assertClaim().catch((renewalError) => {
                if (claimActive) {
                  getLogger().error("space deletion claim renewal failed", renewalError);
                }
              });
            }, SPACE_DELETION_CLAIM_TIMEOUT_MS / 5);
            const adapterContext = connectionContext(
              context.actor,
              "spaces.remove",
              context.signal,
            );
            for (const computer of claim.computers) {
              await assertClaim();
              // Provider errors are ambiguous: teardown may have reached the
              // remote service. From this point, only successful deletion may
              // unblock content creation; a stale recovery must finish it.
              claimReleasable = false;
              let teardownTimer: ReturnType<typeof setTimeout> | undefined;
              try {
                await Promise.race([
                  deps.sandbox.destroy(toComputerRef(computer), {
                    ...adapterContext,
                    botId: computer.homeKey,
                  }),
                  new Promise<never>((_, reject) => {
                    teardownTimer = setTimeout(() => {
                      // Stop renewal so the claim goes stale and a later
                      // worker can recover; never release after teardown
                      // started, since the hung destroy may still complete.
                      claimHealthy = false;
                      claimReleasable = false;
                      reject(new Error("Space sandbox teardown timed out"));
                    }, spaceTeardownTimeoutMs());
                  }),
                ]);
              } finally {
                if (teardownTimer !== undefined) clearTimeout(teardownTimer);
              }
              // Never clear a provider handle after this worker loses its claim.
              await assertClaim();
              await deps.prisma.computer.updateMany({
                where: {
                  spaceId: input.spaceId,
                  homeKey: computer.homeKey,
                  providerRef: computer.providerRef,
                  space: { deletionClaimId: claimId },
                },
                data: { state: "stopped", providerRef: null },
              });
            }
            await assertClaim();
            claimActive = false;
            if (claimRenewal) {
              clearInterval(claimRenewal);
              claimRenewal = null;
            }
            const fallback = await deleteEmptySpaceForMember(deps.prisma, claimedInput);
            for (const storageKey of fallback.dataRoomStorageKeys) {
              await deps.jobs
                .enqueue(dataRoomBlobDeleteJob(input.spaceId, storageKey))
                .catch((jobError) => getLogger().error("data room blob cleanup", jobError));
            }
            for (const { homeKey, ...deletedRow } of fallback.homes) {
              await deps.home
                .remove(
                  homeKey,
                  {
                    operationId: `space-delete-home:${homeKey}`,
                    traceId: `space-delete-home:${homeKey}`,
                    spaceId: input.spaceId,
                    userId: context.actor.userId,
                    signal: new AbortController().signal,
                  },
                  deletedRow,
                )
                .catch((homeError) => getLogger().error("agent home cleanup", homeError));
            }
            return { ok: true as const, activeSpaceId: fallback.id };
          } catch (error) {
            if (context.signal?.aborted) claimReleasable = false;
            if (claimId && claimReleasable) {
              await releaseSpaceDeletionClaim(deps.prisma, { ...deleteInput, claimId }).catch(
                (releaseError) => {
                  getLogger().error("space deletion claim release failed", releaseError);
                },
              );
            }
            if (error instanceof SpaceNotFoundError) {
              throw new ORPCError("NOT_FOUND", { message: error.message });
            }
            if (error instanceof CannotDeleteSpaceAsNonOwnerError) {
              throw new ORPCError("FORBIDDEN", { message: error.message });
            }
            if (error instanceof SpaceDeletionInProgressError) {
              throw new ORPCError("CONFLICT", { message: error.message });
            }
            if (error instanceof SpaceHasCapTableError) {
              throw new ORPCError("CONFLICT", { message: error.message });
            }
            if (
              error instanceof CannotDeleteDefaultSpaceError ||
              error instanceof CannotDeleteLastSpaceError ||
              error instanceof SpaceNotEmptyError
            ) {
              throw new ORPCError("BAD_REQUEST", { message: error.message });
            }
            throw error;
          } finally {
            claimActive = false;
            if (claimRenewal) clearInterval(claimRenewal);
          }
        }),
      ),
    },
    bootstrap: authed.bootstrap.handler(async ({ context, input }) => {
      const actor = context.actor;
      const [me, navigation, archivedBots, archivedGroups] = await Promise.all([
        meDto(deps, actor),
        spaceNavigationDto(deps, actor, repos, groupRepos),
        repos.listBots(actor, { archived: true }),
        groupRepos.listGroups(actor, { archived: true }),
      ]);
      const { bots, groups, botSections } = navigation.current;
      const active = bots.find((bot) => bot.id === input.botId) ?? bots[0];
      const [thread, routines] = active
        ? await Promise.all([
            resolveThreadTarget(deps.prisma, actor, { botId: active.id }).then((target) =>
              threadSnapshotForReader(deps, actor, target),
            ),
            listRoutinesDto(deps, actor, active.id),
          ])
        : [null, []];
      return {
        me,
        bots,
        groups,
        botSections,
        archivedBots,
        archivedGroups,
        thread,
        routines,
        spaces: navigation.spaces,
      };
    }),
    appControl: {
      status: authed.appControl.status.handler(async ({ context }) => {
        const none = { available: false, accessibility: "unknown", platform: null } as const;
        if (!deps.appControl || !context.actor.isDeploymentOwner) return none;
        try {
          const status = await deps.appControl.status(
            connectionContext(context.actor, randomUUID()),
          );
          return {
            available: status.available,
            accessibility: status.accessibility,
            platform: status.platform ?? null,
            ...(status.installed === false ? { needsInstall: true } : {}),
          };
        } catch {
          return none;
        }
      }),
      apps: authed.appControl.apps.handler(async ({ context }) => {
        if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
        if (!deps.appControl) {
          throw new ORPCError("PRECONDITION_FAILED", { message: "App control is not set up" });
        }
        const apps = await deps.appControl.listApps(connectionContext(context.actor, randomUUID()));
        return { apps: apps.filter((app) => !isDeniedApp(app)) };
      }),
    },
    deployment: {
      get: authed.deployment.get.handler(async ({ context }) => {
        if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
        return deploymentDto(deps.prisma, deps.env.sandboxProvider);
      }),
      update: authed.deployment.update.handler(async ({ context, input }) => {
        if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
        if (input.computerHost === "this-mac" && deps.env.sandboxProvider !== "docker") {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "This Mac mode is only available when SANDBOX_PROVIDER=docker on a personal local app.",
          });
        }
        await deps.prisma.deploymentSettings.upsert({
          where: { id: "default" },
          create: {
            id: "default",
            ownerUserId: context.actor.userId,
            signupsEnabled: input.signupsEnabled ?? true,
            signupAllowlist: (input.signupAllowlist ?? []).join(","),
            signupPolicyInitialized: true,
            computerHost: input.computerHost ?? undefined,
          },
          update: {
            ...(input.signupsEnabled === undefined ? {} : { signupsEnabled: input.signupsEnabled }),
            ...(input.signupAllowlist ? { signupAllowlist: input.signupAllowlist.join(",") } : {}),
            ...(input.signupsEnabled === undefined && input.signupAllowlist === undefined
              ? {}
              : { signupPolicyInitialized: true }),
            ...(input.computerHost === undefined ? {} : { computerHost: input.computerHost }),
          },
        });
        return deploymentDto(deps.prisma, deps.env.sandboxProvider);
      }),
    },
    updater: createUpdaterRoutes(routeContext),
    models: {
      embeddingModel: authed.models.embeddingModel.handler(({ context }) =>
        dataRoom.embeddingModel(context.actor),
      ),
      autoFileEmail: authed.models.autoFileEmail.handler(({ context }) =>
        dataRoom.autoFileEmail(context.actor),
      ),
      setAutoFileEmail: authed.models.setAutoFileEmail.handler(({ context, input }) =>
        dataRoom.setAutoFileEmail(context.actor, input),
      ),
      setEmbeddingModel: authed.models.setEmbeddingModel.handler(({ context, input }) =>
        dataRoom.setEmbeddingModel(context.actor, input),
      ),
      list: authed.models.list.handler(async ({ context }) => {
        const { catalog } = await liveCatalogFor(context.actor);
        // The scripted fixture only exists to drive the scripted runtime; a real
        // runtime cannot execute it, so it stays out of the user-facing catalog.
        return deps.env.agentRuntime === "scripted" ? [...catalog, scriptedCatalogEntry] : catalog;
      }),
      credentials: authed.models.credentials.handler(async ({ context }) => {
        const rows = await deps.prisma.userModelCredential.findMany({
          where: { userId: context.actor.userId },
          include: {
            preferences: {
              where: { userId: context.actor.userId, spaceId: context.actor.spaceId },
            },
          },
          orderBy: newestModelCredentialOrder,
        });
        const secrets = rows.length
          ? await deps.prisma.secret.findMany({
              where: {
                id: { in: rows.map((row) => row.secretId) },
                userId: context.actor.userId,
                spaceId: null,
              },
              select: { id: true, ciphertext: true },
            })
          : [];
        const ciphertextById = new Map(secrets.map((secret) => [secret.id, secret.ciphertext]));
        return Promise.all(
          rows.map(async (row) => {
            const preference = row.preferences[0];
            const selected = {
              ...row,
              isDefault: preference?.isDefault ?? false,
              defaultModel: preference?.modelId ?? null,
              thinkingLevel: preference?.thinkingLevel ?? null,
            };
            const ciphertext = ciphertextById.get(row.secretId);
            if (!ciphertext) return modelCredentialDto(selected);
            try {
              return modelCredentialDto(
                selected,
                await deps.secrets.load(ciphertext, row.secretId),
              );
            } catch (error) {
              if (error instanceof SecretStoreUnavailableError)
                throw new ORPCError("SERVICE_UNAVAILABLE", { cause: error });
              return modelCredentialDto(selected);
            }
          }),
        );
      }),
      backups: authed.models.backups.handler(async ({ context }) =>
        listSpaceBackupModels(deps.prisma, context.actor),
      ),
      setBackups: authed.models.setBackups.handler(async ({ context, input }) => {
        if (input.length > 0) {
          const { catalog } = await liveCatalogFor(context.actor);
          for (const choice of input) {
            const credential = await findModelCredential(
              deps.prisma,
              context.actor,
              choice.provider,
              choice.modelId,
            );
            if (!credential) {
              throw new ORPCError("BAD_REQUEST", {
                message: "Connect that model provider first",
              });
            }
            if (
              catalog.some(
                (entry) => entry.provider === choice.provider && entry.id === choice.modelId,
              )
            )
              continue;
            const error = await validateConnectedModelChoice(
              deps.prisma,
              context.actor,
              choice.provider,
              choice.modelId,
            );
            if (error || choice.provider !== OPENAI_COMPATIBLE_PROVIDER_ID) {
              throw new ORPCError("BAD_REQUEST", {
                message: error ?? "That model is not available for this connection",
              });
            }
          }
        }
        await replaceSpaceBackupModels(deps.prisma, context.actor, input);
        return { ok: true as const };
      }),
      connect: authed.models.connect.handler(async ({ context, input }) => {
        let plaintext: string;
        // What the request carries, then the saved key it may reuse, once that is read.
        const attempted = [input.apiKey];
        try {
          let previousPlaintext: string | undefined;
          let omitVisionModelIds = false;
          const credential = await findModelCredential(deps.prisma, context.actor, input.provider);
          if (credential) {
            const secret = await deps.prisma.secret.findFirst({
              where: { id: credential.secretId, userId: context.actor.userId, spaceId: null },
              select: { ciphertext: true },
            });
            if (secret) {
              try {
                previousPlaintext = await deps.secrets.load(secret.ciphertext, credential.secretId);
                attempted.push(savedModelKey(previousPlaintext));
              } catch (error) {
                // Explicit key replacement must still succeed when the prior
                // ciphertext is unreadable. For OpenAI-compatible connections,
                // omit visionModelIds so a partial one-model list does not wipe
                // other enabled models; DB supportsImages + defaultModel remain
                // the legacy fallback.
                if (input.apiKey === undefined) throw error;
                if (input.provider === OPENAI_COMPATIBLE_PROVIDER_ID) {
                  omitVisionModelIds = true;
                }
              }
            }
          }
          plaintext = buildModelConnectPlaintext(input, previousPlaintext, {
            omitVisionModelIds,
          });
        } catch (error) {
          throw new ORPCError("BAD_REQUEST", {
            message: modelConnectionErrorMessage(error, "Invalid model connection", attempted),
          });
        }
        return persistModelCredential(
          deps,
          context.actor,
          {
            provider: input.provider,
            plaintext,
            label: input.label,
            modelId: input.modelId,
            // openai-compatible keeps its effort inside the stored endpoint
            // secret; catalog providers store it on the space preference.
            thinkingLevel:
              input.provider === OPENAI_COMPATIBLE_PROVIDER_ID ? undefined : input.thinkingLevel,
            supportsImages: input.supportsImages,
            signal: context.signal,
          },
          codexCatalog,
        );
      }),
      probeOpenAiCompatible: authed.models.probeOpenAiCompatible.handler(
        async ({ context, input }) => {
          try {
            const models = await probeOpenAiCompatibleModels(input, undefined, context.signal);
            return { models };
          } catch (error) {
            throw new ORPCError("BAD_REQUEST", {
              message: modelConnectionErrorMessage(error, "Could not list models", [input.apiKey]),
            });
          }
        },
      ),
      probeCatalog: authed.models.probeCatalog.handler(async ({ context, input }) => {
        try {
          const models = await probeCatalogProviderModels(
            { provider: input.provider, apiKey: input.apiKey },
            undefined,
            context.signal,
          );
          return { models };
        } catch (error) {
          throw new ORPCError("BAD_REQUEST", {
            message: modelConnectionErrorMessage(error, "Could not list models", [input.apiKey]),
          });
        }
      }),
      beginOAuth: authed.models.beginOAuth.handler(async ({ context, input }) => {
        return deps.oauthLogins.begin({
          userId: context.actor.userId,
          spaceId: context.actor.spaceId,
          provider: input.provider,
          modelId: input.modelId,
          thinkingLevel: input.thinkingLevel,
          label: input.label,
          signal: context.signal,
        });
      }),
      submitOAuthCode: authed.models.submitOAuthCode.handler(async ({ context, input }) => {
        try {
          return deps.oauthLogins.submit(input.loginId, context.actor, input.code);
        } catch (error) {
          if (error instanceof ORPCError) throw error;
          throw new ORPCError("BAD_REQUEST", {
            message: modelConnectionErrorMessage(error, "Could not finish sign-in", [input.code]),
          });
        }
      }),
      completeOAuth: authed.models.completeOAuth.handler(async ({ context, input }) => {
        const result = await deps.oauthLogins.complete(input.loginId, {
          userId: context.actor.userId,
          spaceId: context.actor.spaceId,
        });
        return result.status === "connected" ? { status: "ready" as const } : result;
      }),
      finishOAuth: authed.models.finishOAuth.handler(async ({ context, input }) => {
        context.signal?.throwIfAborted();
        const result = await deps.oauthLogins.finish(
          input.loginId,
          context.actor,
          async (login) => {
            return persistModelCredential(
              deps,
              context.actor,
              {
                provider: login.provider,
                plaintext: serializeModelSecret({ kind: "oauth", credential: login.credential }),
                label:
                  login.label ??
                  listPiCatalog().find((entry) => entry.provider === login.provider)?.providerName,
                modelId: login.modelId,
                thinkingLevel: login.thinkingLevel,
                signal: login.signal,
              },
              codexCatalog,
            );
          },
        );
        if (result.status === "pending") {
          throw new ORPCError("CONFLICT", { message: "Sign-in has not finished yet." });
        }
        if (result.status === "error") {
          throw new ORPCError("NOT_FOUND", { message: result.error });
        }
        return result.value;
      }),
      beginOpenRouterOAuth: authed.models.beginOpenRouterOAuth.handler(
        async ({ context, input }) => {
          try {
            return await beginOpenRouterOAuth({
              prisma: deps.prisma,
              secrets: deps.secrets,
              scope: { userId: context.actor.userId, spaceId: context.actor.spaceId },
              webOrigin: deps.env.webOrigin,
              redirectUri: input.redirectUri,
            });
          } catch (error) {
            throw new ORPCError("BAD_REQUEST", {
              message:
                error instanceof OpenRouterOAuthError ? error.message : "Could not start sign-in",
            });
          }
        },
      ),
      completeOpenRouterOAuth: authed.models.completeOpenRouterOAuth.handler(
        async ({ context, input }) => {
          let apiKey: string;
          try {
            apiKey = await completeOpenRouterOAuth({
              prisma: deps.prisma,
              secrets: deps.secrets,
              scope: { userId: context.actor.userId, spaceId: context.actor.spaceId },
              state: input.state,
              code: input.code,
            });
          } catch (error) {
            throw new ORPCError("BAD_REQUEST", {
              message:
                error instanceof OpenRouterOAuthError ? error.message : "Could not finish sign-in",
            });
          }
          // Stored exactly like a pasted key; the key never leaves the server.
          return persistModelCredential(
            deps,
            context.actor,
            {
              provider: OPENROUTER_OAUTH_PROVIDER,
              plaintext: buildModelConnectPlaintext({
                provider: OPENROUTER_OAUTH_PROVIDER,
                apiKey,
              }),
              label: "OpenRouter",
              signal: context.signal,
            },
            codexCatalog,
          );
        },
      ),
      cancelOAuth: authed.models.cancelOAuth.handler(async ({ context, input }) => {
        await deps.oauthLogins.cancel(input.loginId, context.actor);
        return { ok: true as const };
      }),
      setDefault: authed.models.setDefault.handler(async ({ context, input }) => {
        const loadSpaceModelState = async (
          client: Pick<PrismaClient, "spaceModelPreference" | "userModelCredential">,
        ) => {
          const [preferences, credentials] = await Promise.all([
            client.spaceModelPreference.findMany({
              where: {
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
                credential: { provider: input.provider },
              },
              include: { credential: true },
            }),
            client.userModelCredential.findMany({
              where: { userId: context.actor.userId, provider: input.provider },
            }),
          ]);
          return {
            preferences,
            candidates: defaultModelCredentialCandidates({
              provider: input.provider,
              modelId: input.modelId,
              preferences,
              credentials,
            }),
          };
        };
        await withSerializableRetry(async () => {
          const preparedState = await loadSpaceModelState(deps.prisma);
          const preparedAuth = new Map(
            await Promise.all(
              preparedState.candidates.map(
                async (candidate) =>
                  [
                    candidate.secretId,
                    await prepareStoredModelAuth(
                      deps.prisma,
                      deps.secrets,
                      context.actor.userId,
                      candidate.secretId,
                      input.provider,
                      input.modelId,
                      codexCatalog,
                      {
                        onExpiredToken: () =>
                          refreshExpiredCredential(
                            context.actor,
                            candidate.secretId,
                            input.provider,
                          ),
                      },
                    ),
                  ] as const,
              ),
            ),
          );
          const needsThinking =
            input.thinkingLevel === undefined
              ? preparedState.preferences.some(
                  (preference) =>
                    preference.modelId === usableModelId(input.modelId) &&
                    Boolean(preference.thinkingLevel),
                )
              : Boolean(input.thinkingLevel);
          const thinking = needsThinking
            ? await prepareAllowedThinkingLevels(deps, context.actor, input.provider, input.modelId)
            : { allowed: undefined, secret: undefined };
          return deps.prisma.$transaction(
            async (tx) => {
              const { preferences, candidates } = await loadSpaceModelState(tx);
              if (candidates.length === 0) {
                throw new ORPCError("NOT_FOUND", {
                  message: `No model credential is connected for ${input.provider}.`,
                });
              }
              if (thinking.secret) {
                const current = await tx.secret.findFirst({
                  where: { id: thinking.secret.id, userId: context.actor.userId, spaceId: null },
                  select: { ciphertext: true },
                });
                if (current?.ciphertext !== thinking.secret.ciphertext) {
                  throw new ORPCError("CONFLICT", { message: "Model credentials changed; retry." });
                }
              }
              const savedModelId = new Map(
                preferences.map((preference) => [preference.credential.id, preference.modelId]),
              );
              const readyIds: string[] = [];
              let authFailure: string | undefined;
              let sawReadable = false;
              for (const candidate of candidates) {
                const prepared = preparedAuth.get(candidate.secretId);
                const current = await tx.secret.findFirst({
                  where: { id: candidate.secretId, userId: context.actor.userId, spaceId: null },
                  select: { id: true, ciphertext: true },
                });
                if (!prepared || (current?.ciphertext ?? null) !== prepared.ref) {
                  throw new ORPCError("CONFLICT", { message: "Model credentials changed; retry." });
                }
                const auth = prepared.auth;
                if (auth.status === "unreadable") continue;
                sawReadable = true;
                if (auth.status === "rejected") {
                  authFailure ??= auth.message;
                  continue;
                }
                readyIds.push(candidate.id);
              }
              const chosenId = selectDefaultCredentialId({
                provider: input.provider,
                modelId: input.modelId,
                orderedIds: candidates.map((candidate) => candidate.id),
                readyIds,
                savedModelId: (credentialId) => savedModelId.get(credentialId),
              });
              const fallbackId = !sawReadable ? candidates[0]?.id : undefined;
              const credentialId = chosenId ?? fallbackId;
              if (!credentialId) {
                throw new ORPCError("BAD_REQUEST", {
                  message: authFailure ?? UNAVAILABLE_MODEL_FOR_AUTH_MESSAGE,
                });
              }
              let thinkingLevel: string | null | undefined = input.thinkingLevel;
              if (thinkingLevel === undefined) {
                // The level belongs to the preference's modelId — keep it only when the
                // stored choice already names this model.
                const existing = preferences.find(
                  (preference) => preference.credential.id === credentialId,
                );
                thinkingLevel =
                  existing?.modelId === usableModelId(input.modelId)
                    ? existing.thinkingLevel
                    : null;
              }
              if (thinkingLevel) {
                if (!needsThinking) {
                  throw new ORPCError("CONFLICT", { message: "Model preferences changed; retry." });
                }
                thinkingLevel = clampCatalogThinkingLevel(thinkingLevel, thinking.allowed);
              }
              await selectSpaceModelPreference(
                tx,
                context.actor,
                credentialId,
                input.modelId,
                thinkingLevel,
              );
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
        }).catch((error: unknown) => {
          if (error instanceof SecretStoreUnavailableError)
            throw new ORPCError("SERVICE_UNAVAILABLE", { cause: error });
          throw error;
        });
        return { ok: true as const };
      }),
      disconnect: authed.models.disconnect.handler(async ({ context, input }) => {
        // Retire pending sign-ins in every space first — the credentials are
        // account-wide, so a finishing OAuth session anywhere could otherwise
        // re-persist a credential the delete below just removed.
        await deps.oauthLogins.cancelProvider({
          userId: context.actor.userId,
          provider: input.provider,
        });
        await withSerializableRetry(() =>
          deps.prisma.$transaction(
            async (tx) => {
              await tx.spaceBackupModel.deleteMany({
                where: { userId: context.actor.userId, provider: input.provider },
              });
              const existing = await tx.userModelCredential.findMany({
                where: { userId: context.actor.userId, provider: input.provider },
              });
              if (existing.length === 0) return;
              const ids = existing.map((row) => row.id);
              // Credentials belong to the account, not the space — disconnecting
              // removes them everywhere, matching voice.disconnect. Linked
              // preferences in other spaces go with their credential.
              await tx.spaceModelPreference.deleteMany({
                where: { userId: context.actor.userId, credentialId: { in: ids } },
              });
              await tx.userModelCredential.deleteMany({
                where: { userId: context.actor.userId, id: { in: ids } },
              });
              // The owner chose to disconnect, so what was pinned goes back to the default.
              // An automatic sign-out never runs this and leaves the pin to fail by name.
              const pinned = { userId: context.actor.userId, modelCredentialId: { in: ids } };
              // Bots and routines are row-secured by Space; the ids come from the owner's
              // own credentials and `pinned` filters by userId, so the bypass only reaches
              // the owner's pins in their other Spaces.
              await runAsSystemInTransaction(
                tx,
                "clear the owner's pins to a disconnected model connection in every Space",
                async () => {
                  await tx.bot.updateMany({ where: pinned, data: { modelCredentialId: null } });
                  await tx.routine.updateMany({ where: pinned, data: { modelCredentialId: null } });
                },
              );
              for (const row of existing) {
                await deleteUnreferencedCredentialSecret(tx, {
                  credentialKind: "model",
                  credentialId: row.id,
                  secretId: row.secretId,
                });
              }
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          ),
        );
        return { ok: true as const };
      }),
    },
    bots: {
      list: authed.bots.list.handler(async ({ context }) => repos.listBots(context.actor)),
      listArchived: authed.bots.listArchived.handler(async ({ context }) =>
        repos.listBots(context.actor, { archived: true }),
      ),
      get: authed.bots.get.handler(async ({ context, input }) => {
        const found = (await repos.listBots(context.actor)).find((bot) => bot.id === input.botId);
        if (!found) throw new IsolationError();
        return found;
      }),
      create: authed.bots.create.handler(async ({ context, input }) => {
        // inbox.agent is the only way to create an Inbox agent; reserve its key prefix.
        if (
          isInboxAgentSpawnKey(input.spawnKey) ||
          isMailThreadAgentSpawnKey(input.spawnKey) ||
          isFinanceAgentSpawnKey(input.spawnKey) ||
          isLegalAgentSpawnKey(input.spawnKey) ||
          isInvestorsAgentSpawnKey(input.spawnKey) ||
          isDataRoomAgentSpawnKey(input.spawnKey) ||
          isScannerAgentSpawnKey(input.spawnKey) ||
          isCompanyAgentSpawnKey(input.spawnKey) ||
          isCompanyImporterSpawnKey(input.spawnKey) ||
          isCartaAgentSpawnKey(input.spawnKey) ||
          isGtmAgentSpawnKey(input.spawnKey) ||
          isIntegrationAgentSpawnKey(input.spawnKey) ||
          isVoiceAgentSpawnKey(input.spawnKey) ||
          isCustomPageSpawnKey(input.spawnKey)
        ) {
          throw new ORPCError("BAD_REQUEST", { message: "Reserved spawn key" });
        }
        const { page, ...fields } = input;
        const bot = await repos.createBot(
          context.actor,
          page ? { ...fields, spawnKey: customPageSpawnKey(randomUUID()) } : fields,
        );
        // A bot with no profile has no role to restate, and the onboarding bot introduces itself
        // before the focus card: both greet with a fixed message instead of a model run.
        const first = bot.spawnKey === FIRST_BOT_SPAWN_KEY;
        const blank =
          first ||
          (!bot.spawnKey &&
            !bot.description.trim() &&
            !bot.instructions.trim() &&
            !bot.title.trim());
        await (blank
          ? seedBlankBotGreeting(onboardingDeps, context.actor, bot, { first })
          : enqueueBotIntroRun(deps, context.actor, bot)
        ).catch((error) => {
          getLogger().error("bot intro", error);
        });
        return bot;
      }),
      duplicate: authed.bots.duplicate.handler(async ({ context, input }) => {
        const source = await repos.getBot(context.actor, input.botId);
        const duplicate = await repos.createBot(context.actor, {
          name: duplicateBotName(source.name),
          title: source.title,
          description: source.description,
          instructions: source.instructions,
          notifyOnFinish: source.notifyOnFinish,
          color: source.color,
          computerMode: source.computer?.scope === "dedicated" ? "dedicated" : "team",
          modelProvider: source.modelProvider,
          modelId: source.modelId,
          thinkingLevel: source.thinkingLevel,
          disabledBuiltinTools: source.disabledBuiltinTools,
          audience: source.audience === "external" ? "external" : "internal",
          firewall: source.firewall,
          proactivity:
            source.proactivity === "low" || source.proactivity === "high"
              ? source.proactivity
              : "medium",
          externalMessageTargets: source.externalMessageTargets,
          externalComputerTools: source.externalComputerTools,
        });
        const assignments = await deps.prisma.botMcpServer.findMany({
          where: {
            botId: source.id,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          },
        });
        // An exclusive server belongs to its agent; the copy never gets it.
        const exclusive = new Set(
          (
            await deps.prisma.mcpServer.findMany({
              where: {
                id: { in: assignments.map((assignment) => assignment.serverId) },
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
                agentExclusive: true,
              },
              select: { id: true },
            })
          ).map((server) => server.id),
        );
        const copied = assignments.filter((assignment) => !exclusive.has(assignment.serverId));
        if (copied.length) {
          await deps.prisma.botMcpServer.createMany({
            data: copied.map((assignment) => ({
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              botId: duplicate.id,
              serverId: assignment.serverId,
              allowAllTools: assignment.allowAllTools,
              allowedTools: assignment.allowedTools as Prisma.InputJsonValue,
            })),
          });
        }
        return duplicate;
      }),
      reorder: authed.bots.reorder.handler(async ({ context, input }) => {
        await repos.reorderBots(context.actor, input.botIds);
        return { ok: true as const };
      }),
      update: authed.bots.update.handler(async ({ context, input }) => {
        const existing = await repos.getBot(context.actor, input.botId);
        if (input.sectionId) {
          const section = await deps.prisma.botSection.findFirst({
            where: {
              id: input.sectionId,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
            },
            select: { id: true },
          });
          if (!section) throw new IsolationError();
        }
        // Web settings resend the saved model on every save. Reject an
        // incompatible override only when this request is changing it; a run
        // still rejects a Spark model the subscription sign-in cannot call.
        // The pin is the caller's own connection for the bot's provider. Changing the
        // provider (or clearing the model) drops it unless the request names a new one.
        const providerChanged =
          input.modelProvider !== undefined && input.modelProvider !== existing.modelProvider;
        const pinWrite = connectionPinWrite(input, existing.modelProvider);
        // An unchanged pin is kept as stored, even if its connection has since gone, so a
        // rename or voice change still saves; only a new pin or a new provider is checked.
        if (pinWrite && (pinWrite !== existing.modelCredentialId || providerChanged)) {
          await assertOwnedConnection(
            deps,
            context.actor,
            pinWrite,
            input.modelProvider !== undefined ? input.modelProvider : existing.modelProvider,
          );
        }
        const effectivePin =
          pinWrite === undefined ? (existing.modelCredentialId ?? null) : pinWrite;
        const settingModel =
          input.modelProvider !== undefined &&
          input.modelId !== undefined &&
          (providerChanged ||
            input.modelId !== existing.modelId ||
            effectivePin !== (existing.modelCredentialId ?? null));
        if (settingModel && input.modelProvider && input.modelId) {
          const credential = await findBotModelCredential(deps.prisma, context.actor, {
            modelProvider: input.modelProvider,
            modelId: input.modelId,
            modelCredentialId: effectivePin,
          }).catch((error: unknown) => {
            if (error instanceof PinnedConnectionLostError) {
              throw new ORPCError("BAD_REQUEST", { message: error.message });
            }
            throw error;
          });
          if (!credential) {
            throw new ORPCError("BAD_REQUEST", { message: "Connect that model provider first" });
          }
          const knownModels = [...listPiCatalog(), scriptedCatalogEntry];
          const inCatalog = knownModels.some(
            (item) => item.provider === input.modelProvider && item.id === input.modelId,
          );
          if (!inCatalog && credential.defaultModel !== input.modelId) {
            throw new ORPCError("BAD_REQUEST", { message: "Unknown model for that provider" });
          }
          if (inCatalog) {
            const authError = await validateStoredModelAuth(
              deps.prisma,
              deps.secrets,
              context.actor.userId,
              credential.secretId,
              input.modelProvider,
              input.modelId,
              codexCatalog,
              {
                onExpiredToken: () =>
                  refreshExpiredCredential(
                    context.actor,
                    credential.secretId,
                    input.modelProvider!,
                  ),
              },
            );
            if (authError) throw new ORPCError("BAD_REQUEST", { message: authError });
          }
        }
        const thinkingLevel = input.thinkingLevel;
        if (input.thinkingLevel) {
          const provider =
            input.modelProvider !== undefined ? input.modelProvider : existing.modelProvider;
          const modelId = input.modelId !== undefined ? input.modelId : existing.modelId;
          const me = await meDto(deps, context.actor);
          const effectiveProvider = provider ?? me.defaultProvider;
          const effectiveModelId = modelId ?? me.defaultModel;
          if (effectiveProvider && effectiveModelId) {
            const entry = listPiCatalog().find(
              (item) => item.provider === effectiveProvider && item.id === effectiveModelId,
            );
            let allowed = entry?.thinkingLevels;
            if (effectiveProvider === OPENAI_COMPATIBLE_PROVIDER_ID) {
              allowed = ["off"];
              const credential = await findModelCredential(
                deps.prisma,
                context.actor,
                effectiveProvider,
              );
              if (credential && credential.defaultModel === effectiveModelId) {
                const secret = await deps.prisma.secret.findFirst({
                  where: { id: credential.secretId, userId: context.actor.userId, spaceId: null },
                  select: { ciphertext: true },
                });
                if (secret) {
                  try {
                    allowed =
                      modelCredentialDto(
                        credential,
                        await deps.secrets.load(secret.ciphertext, credential.secretId),
                      ).thinkingLevels ?? allowed;
                  } catch {
                    // Unreadable connections must not advertise reasoning support.
                  }
                }
              }
            }
            if (allowed && !allowed.includes(input.thinkingLevel)) {
              throw new ORPCError("BAD_REQUEST", {
                message: `Thinking level must be one of: ${allowed.join(", ")}`,
              });
            }
          }
        }
        if (!existing.thread) throw new Error("Bot is missing its thread");
        const appControl = await checkAppControlUpdate(deps, context.actor, existing, input);
        // Check the whole request before the computer moves: a rejected save must not stop or move it.
        // Only the signed-in owner reaches this (getBot above is scoped to space and user), and no
        // bot tool can set audience. Agents that hold private data by design stay internal.
        if (input.audience === "external" && !botAudienceEditable(existing.spawnKey)) {
          throw new ORPCError("BAD_REQUEST", { message: "This agent cannot be external" });
        }
        // A voice agent speaks to callers and holds nothing to wall off, so it has no Firewall.
        if (input.firewall === true && isVoiceAgentSpawnKey(existing.spawnKey)) {
          throw new ORPCError("BAD_REQUEST", { message: "This agent cannot use Firewall" });
        }
        const messageTargets =
          input.externalMessageTargets === undefined
            ? undefined
            : [...new Set(input.externalMessageTargets)];
        if (messageTargets?.length) {
          const allowed = await deps.prisma.bot.count({
            where: {
              id: { in: messageTargets, not: input.botId },
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              archivedAt: null,
              audience: "internal",
            },
          });
          if (allowed !== messageTargets.length) throw new IsolationError();
        }
        if (input.runsOn !== undefined && input.runsOn !== (existing.runsOn ?? null)) {
          assertRunsOnAllowed({
            runsOn: input.runsOn,
            sandboxProvider: deps.env.sandboxProvider,
            isDeploymentOwner: context.actor.isDeploymentOwner,
          });
          const defaultHost = await deploymentComputerHost(deps);
          const before = existing.runsOn ?? defaultHost;
          const after = input.runsOn ?? defaultHost;
          if (before !== after && existing.computer) {
            // A team computer follows the default, so a bot that differs gets its own.
            const toDedicated = after !== defaultHost && existing.computer.scope !== "dedicated";
            await relocateBotComputer(context.actor, existing, async () => {
              if (toDedicated) await repos.setBotComputer(context.actor, existing.id, "dedicated");
            });
          }
        }
        await commitBotUpdate({
          prisma: deps.prisma,
          notify: (threadId, seq) => deps.events.notify(threadId, seq),
          spaceId: context.actor.spaceId,
          threadId: existing.thread.id,
          botId: input.botId,
          emitBotUpdated: botProfileLabelsChanged(input),
          data: {
            name: input.name,
            title: input.title,
            description: input.description,
            instructions: input.instructions,
            notifyOnFinish: input.notifyOnFinish,
            color: input.color,
            pinned: input.pinned,
            ...(input.hidden !== undefined ? { hiddenAt: input.hidden ? new Date() : null } : {}),
            memoryScope: input.memoryScope,
            sectionId: input.sectionId,
            voiceId: input.voiceId,
            autoSpeak: input.autoSpeak,
            ...(input.modelProvider !== undefined
              ? { modelProvider: input.modelProvider, modelId: input.modelId ?? null }
              : {}),
            ...(pinWrite !== undefined ? { modelCredentialId: pinWrite } : {}),
            ...(input.thinkingLevel !== undefined ? { thinkingLevel } : {}),
            ...(input.teamChatAmbientEnabled !== undefined
              ? { teamChatAmbientEnabled: input.teamChatAmbientEnabled }
              : {}),
            ...(input.teamChatRules !== undefined ? { teamChatRules: input.teamChatRules } : {}),
            ...(input.crossSpaceCommunication !== undefined
              ? { crossSpaceCommunication: input.crossSpaceCommunication }
              : {}),
            ...(appControl?.enabled !== undefined ? { appControlEnabled: appControl.enabled } : {}),
            ...(appControl?.apps !== undefined ? { appControlApps: appControl.apps } : {}),
            ...(appControl?.headed !== undefined ? { appControlHeaded: appControl.headed } : {}),
            ...(input.disabledBuiltinTools !== undefined
              ? { disabledBuiltinTools: input.disabledBuiltinTools }
              : {}),
            ...(input.runsOn !== undefined ? { runsOn: input.runsOn } : {}),
            ...(input.audience !== undefined ? { audience: input.audience } : {}),
            ...(input.firewall !== undefined ? { firewall: input.firewall } : {}),
            ...(input.permissionLevel !== undefined
              ? { permissionLevel: input.permissionLevel }
              : {}),
            ...(input.firewallAskCapabilities !== undefined
              ? {
                  // Only ids on the closed list that a firewalled agent may hold, and only to remove.
                  firewallAskCapabilities: input.firewallAskCapabilities.filter((id) =>
                    existing.firewallAskCapabilities.includes(id),
                  ),
                }
              : {}),
            ...(input.proactivity !== undefined ? { proactivity: input.proactivity } : {}),
            ...(messageTargets !== undefined ? { externalMessageTargets: messageTargets } : {}),
            ...(input.externalComputerTools !== undefined
              ? { externalComputerTools: input.externalComputerTools }
              : {}),
          },
        });
        const bots = await repos.listBots(context.actor);
        const bot = bots.find((b) => b.id === input.botId);
        if (!bot) throw new IsolationError();
        const profileChanged = (["name", "title", "description", "instructions"] as const).some(
          (key) => input[key] !== undefined && input[key] !== existing[key],
        );
        if (profileChanged) {
          await reintroduceUnansweredBot(deps, context.actor, bot).catch((error) => {
            getLogger().error("bot reintro", error);
          });
        }
        return bot;
      }),
      setComputer: authed.bots.setComputer.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        if (!bot.computer) throw new IsolationError();
        const currentMode = bot.computer.scope === "dedicated" ? "dedicated" : "team";
        if (input.mode === "team") {
          // A team computer follows the deployment default, so a bot that runs elsewhere keeps its own.
          const defaultHost = await deploymentComputerHost(deps);
          if (bot.runsOn && bot.runsOn !== defaultHost) {
            throw new ORPCError("BAD_REQUEST", {
              message:
                "This bot runs somewhere other than the default, so it keeps its own computer",
            });
          }
        }
        if (currentMode === input.mode) {
          return repos.setBotComputer(context.actor, bot.id, input.mode);
        }
        return relocateBotComputer(context.actor, bot, () =>
          repos.setBotComputer(context.actor, bot.id, input.mode),
        );
      }),
      instructionsUpgrade: authed.bots.instructionsUpgrade.handler(({ context, input }) =>
        instructionsUpgrade(deps.prisma, context.actor, input.botId),
      ),
      upgradeInstructions: authed.bots.upgradeInstructions.handler(async ({ context, input }) => {
        await upgradeInstructions(deps.prisma, context.actor, input.botId, input.from);
        const bot = (await repos.listBots(context.actor)).find((b) => b.id === input.botId);
        if (!bot) throw new IsolationError();
        return bot;
      }),
      dismissInstructionsUpgrade: authed.bots.dismissInstructionsUpgrade.handler(
        async ({ context, input }) => {
          await dismissInstructionsUpgrade(deps.prisma, context.actor, input.botId);
          return { ok: true as const };
        },
      ),
      archive: authed.bots.archive.handler(async ({ context, input }) => {
        await archiveActorBot(context.actor, input.botId);
        return { ok: true as const };
      }),
      restore: authed.bots.restore.handler(async ({ context, input }) => {
        await restoreActorBot(context.actor, input.botId);
        return { ok: true as const };
      }),
      remove: authed.bots.remove.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId, { includeArchived: true });
        await destroyBot(
          {
            prisma: deps.prisma,
            sandbox: deps.sandbox,
            home: deps.home,
            jobs: deps.jobs,
            artifacts: deps.artifacts,
            dataDir: deps.dataDir,
          },
          bot,
          {
            operationId: "destroy",
            traceId: "destroy",
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            botId: bot.id,
            signal: new AbortController().signal,
          },
          { deleteMemories: input.deleteMemories },
        );
        return { ok: true as const };
      }),
      rotateWebhookSecret: authed.bots.rotateWebhookSecret.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const plaintext = randomBytes(32).toString("base64url");
        const stored = await deps.secrets.put(plaintext, {
          operationId: "bots.rotateWebhookSecret",
          traceId: "bots.rotateWebhookSecret",
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
          signal: context.signal ?? new AbortController().signal,
        });
        await deps.prisma.$transaction(async (tx) => {
          const previousSecretId = bot.webhookSecretId;
          await tx.secret.create({
            data: {
              id: stored.id,
              userId: context.actor.userId,
              spaceId: context.actor.spaceId,
              kind: "webhook",
              ciphertext: stored.ciphertext,
            },
          });
          await tx.bot.update({
            where: { id: bot.id },
            data: { webhookSecretId: stored.id },
          });
          if (previousSecretId) {
            await tx.secret.deleteMany({
              where: {
                id: previousSecretId,
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
                kind: "webhook",
              },
            });
          }
        });
        return {
          secret: plaintext,
          path: `/api/v1/bots/${bot.id}/webhook`,
          webhookConfigured: true as const,
        };
      }),
    },
    groups: {
      create: authed.groups.create.handler(async ({ context, input }) => {
        return groupRepos.createGroup(context.actor, input);
      }),
      list: authed.groups.list.handler(async ({ context }) => groupRepos.listGroups(context.actor)),
      listArchived: authed.groups.listArchived.handler(async ({ context }) =>
        groupRepos.listGroups(context.actor, { archived: true }),
      ),
      get: authed.groups.get.handler(async ({ context, input }) => {
        const group = await groupRepos.getGroup(context.actor, input.groupId);
        return {
          ...groupRepos.mapGroup(group),
          messages: (
            await loadMessagePage(
              deps.prisma,
              group.thread!.id,
              undefined,
              THREAD_MESSAGE_PAGE_SIZE,
            )
          ).messages,
        };
      }),
      duplicate: authed.groups.duplicate.handler(async ({ context, input }) => {
        const source = await groupRepos.getGroup(context.actor, input.groupId);
        return groupRepos.createGroup(context.actor, {
          name: duplicateBotName(source.name),
          botIds: source.members.map((member) => member.bot.id),
        });
      }),
      update: authed.groups.update.handler(async ({ context, input }) => {
        if (input.sectionId) {
          const section = await deps.prisma.botSection.findFirst({
            where: {
              id: input.sectionId,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
            },
            select: { id: true },
          });
          if (!section) throw new IsolationError();
        }
        const updated = await groupRepos.updateGroup(context.actor, input);
        await tearDownGroupRuns(context.actor, updated);
        return updated.group;
      }),
      archive: authed.groups.archive.handler(async ({ context, input }) => {
        const archived = await groupRepos.archiveGroup(context.actor, input.groupId);
        await tearDownGroupRuns(context.actor, archived);
        return { ok: true as const };
      }),
      restore: authed.groups.restore.handler(async ({ context, input }) => {
        await groupRepos.restoreGroup(context.actor, input.groupId);
        return { ok: true as const };
      }),
      remove: authed.groups.remove.handler(async ({ context, input }) => {
        const removed = await groupRepos.removeGroup(context.actor, input.groupId);
        const cleanup = await Promise.allSettled(
          removed.artifactStorageKeys.map((storageKey) =>
            deps.artifacts.remove(
              storageKey,
              computerContext(context.actor, removed.contextBotId, `group-remove:${input.groupId}`),
            ),
          ),
        );
        for (const result of cleanup) {
          if (result.status === "rejected")
            getLogger().error("group artifact cleanup", result.reason);
        }
        await tearDownGroupRuns(context.actor, removed).catch((error) =>
          getLogger().error("group run teardown", error),
        );
        return { ok: true as const };
      }),
    },
    botSections: {
      list: authed.botSections.list.handler(async ({ context }) =>
        repos.listBotSections(context.actor),
      ),
      create: authed.botSections.create.handler(async ({ context, input }) =>
        repos.createBotSection(context.actor, input),
      ),
      update: authed.botSections.update.handler(async ({ context, input }) => {
        try {
          return await repos.updateBotSection(context.actor, input);
        } catch (error) {
          if (error instanceof BotSectionNameConflictError) {
            throw new ORPCError("CONFLICT", { message: error.message });
          }
          throw error;
        }
      }),
      add: authed.botSections.add.handler(async ({ context, input }) => {
        try {
          return await addSidebarFolder(deps.prisma, context.actor, input.name);
        } catch (error) {
          if (error instanceof BotSectionNameConflictError) {
            throw new ORPCError("CONFLICT", { message: error.message });
          }
          throw error;
        }
      }),
      remove: authed.botSections.remove.handler(async ({ context, input }) => {
        await removeSidebarFolder(deps.prisma, context.actor, input.sectionId);
        return { ok: true as const };
      }),
      setCollapsed: authed.botSections.setCollapsed.handler(({ context, input }) =>
        setSidebarFolderCollapsed(deps.prisma, context.actor, input.sectionId, input.collapsed),
      ),
    },
    sidebar: {
      move: authed.sidebar.move.handler(async ({ context, input }) => {
        await moveSidebarItem(deps.prisma, context.actor, input);
        return { ok: true as const };
      }),
      moveFolder: authed.sidebar.moveFolder.handler(async ({ context, input }) => {
        await moveSidebarFolder(deps.prisma, context.actor, input.folderId, input.beforeFolderId);
        return { ok: true as const };
      }),
      autoGroup: authed.sidebar.autoGroup.handler(({ context }) =>
        autoGroupSidebar(deps.prisma, context.actor),
      ),
      restore: authed.sidebar.restore.handler(async ({ context, input }) => {
        await restoreSidebar(deps.prisma, context.actor, input);
        return { ok: true as const };
      }),
    },
    threads: {
      head: authed.threads.head.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        return threadHead(deps.prisma, target);
      }),
      get: authed.threads.get.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input, {
          includeArchived: true,
        });
        return threadSnapshotForReader(deps, context.actor, target);
      }),
      messages: authed.threads.messages.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input, {
          includeArchived: true,
        });
        return loadMessagePage(
          deps.prisma,
          target.threadId,
          input.before,
          THREAD_MESSAGE_PAGE_SIZE,
          input.around,
          input.includePeerRuns,
          input.includePeerReceipts,
        );
      }),
      subscribe: authed.threads.subscribe.handler(async function* ({ context, input }) {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        const peerRunCache = new Map<string, Promise<boolean>>();
        const backgroundRunCache = new Map<string, Promise<boolean>>();
        const follow = deps.events.follow(target.threadId, input.cursor, context.signal);
        // A half-open stream looks identical to an idle one, so punctuate silence:
        // the client treats any frame as liveness and reconnects once they stop.
        // Auth ran once when the stream opened. withHeartbeat re-checks before delivering more, so a
        // signed-out or revoked session stops within SESSION_RECHECK_MS, or at the next heartbeat when idle.
        for await (const event of withHeartbeat(follow, {
          signal: context.signal,
          stillAuthorized: context.stillAuthorized,
          heartbeatMs: HEARTBEAT_MS,
          recheckMs: SESSION_RECHECK_MS,
        })) {
          if (event === HEARTBEAT) {
            yield {
              id: "heartbeat",
              spaceId: context.actor.spaceId,
              threadId: target.threadId,
              // A bot thread's id is not the bot. Groups have no single bot, so the thread id stands in.
              botId: target.kind === "bot" ? target.botId : target.threadId,
              seq: 0,
              type: "heartbeat",
              createdAt: new Date().toISOString(),
              payload: {},
            };
            continue;
          }
          if (await isPeerRun(deps.prisma, event.runId, peerRunCache)) {
            if (!shouldForwardPeerThreadEvent(event)) continue;
          } else if (await isBackgroundRun(deps.prisma, event.runId, backgroundRunCache)) {
            if (!shouldForwardBackgroundThreadEvent(event)) continue;
          }
          yield event;
        }
      }),
      send: authed.threads.send.handler(async ({ context, input }) => {
        // `/goal` and `/goal clear` start no run, so they work before a model is connected.
        const goalKind = input.replyToMessageId ? null : parseGoalCommand(input.text ?? "")?.kind;
        const startsRun = goalKind !== "show" && goalKind !== "clear";
        if (startsRun && (await modelSetup(deps, context.actor)).needsModel) {
          throw new ORPCError("BAD_REQUEST", { message: "Connect a model to start a run." });
        }
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        if (target.kind === "bot") {
          await assertTeachingSendAllowed(deps.prisma, context.actor.spaceId, target.botId);
        }
        return sendThreadMessage(deps, context.actor, target, input);
      }),
      react: authed.threads.react.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        const result = await reactToThreadMessage(deps, context.actor, target, input);
        if (result.eventSeq != null) {
          await deps.events.notify(target.threadId, result.eventSeq).catch((error) => {
            getLogger().error("thread reaction realtime notification", error);
          });
        }
        return { ok: true as const };
      }),
      remember: authed.threads.remember.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        await rememberThreadMessage(deps, context.actor, target, input.messageId);
        return { ok: true as const };
      }),
      remembered: authed.threads.remembered.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        return { messageIds: await rememberedMessageIds(deps, context.actor, target) };
      }),
      stop: authed.threads.stop.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        await stopThreadRuns(deps, context.actor, target);
        return { ok: true as const };
      }),
      clearGoal: authed.threads.clearGoal.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        if (target.kind !== "bot") throw new IsolationError();
        await clearThreadGoal(deps, context.actor, target);
        return { ok: true as const };
      }),
      clear: authed.threads.clear.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        const contextBotId = target.kind === "bot" ? target.botId : target.memberBotIds[0];
        if (!contextBotId) throw new IsolationError();
        // Stop first: clearThread only expires leases, so the sandbox work and screen of each
        // running run must be torn down before its lease goes.
        const { runIds: stoppedRunIds } = await stopThreadRuns(deps, context.actor, target);
        const { cancelledRunIds, historyCompactionGeneration } = await deps.events.clearThread({
          spaceId: context.actor.spaceId,
          threadId: target.threadId,
          botId: contextBotId,
          ...(target.kind === "group" ? { groupId: target.groupId } : {}),
        });
        const [configuredMemory] = await Promise.all([
          target.kind === "bot"
            ? deps.memoryProviders.resolve(context.actor.spaceId).catch((error) => {
                getLogger().error("semantic memory resolution after thread clear failed", error);
                return null;
              })
            : Promise.resolve(null),
          Promise.all(
            [...new Set([...stoppedRunIds, ...cancelledRunIds])].map((runId) =>
              deps.jobs.cancel(runJobKey(runId)).catch(() => undefined),
            ),
          ),
        ]);
        // Durable memories remain in their Space-private containers. Clear only removes
        // conversation-derived summaries from the previous generation; including the new
        // generation also covers a compaction job that began just after the clear committed.
        if (configuredMemory && target.kind === "bot") {
          // Best effort: the conversation rows are already deleted, so failing the clear here
          // would help nothing — a failed purge only leaves stale summaries recallable.
          try {
            const purged = await configuredMemory.provider.purgeHistory(
              {
                botId: target.botId,
                generations: [
                  Math.max(0, historyCompactionGeneration - 1),
                  historyCompactionGeneration,
                ],
              },
              computerContext(context.actor, target.botId, `thread-clear:${target.threadId}`),
            );
            if (!purged.ok) {
              getLogger().error("semantic memory purge after thread clear failed", purged.error);
            }
          } catch (error) {
            getLogger().error("semantic memory purge after thread clear failed", error);
          }
        }
        return { ok: true as const };
      }),
      followUp: authed.threads.followUp.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        if (target.kind === "bot") {
          await assertTeachingSendAllowed(deps.prisma, context.actor.spaceId, target.botId);
          const sent = await deps.events.sendUserMessage({
            spaceId: context.actor.spaceId,
            threadId: target.threadId,
            botId: target.botId,
            userId: context.actor.userId,
            blocks: [{ kind: "text", text: input.text }],
            prompt: input.text,
            trigger: "follow_up",
            clientNonce: input.clientNonce,
          });
          if (sent.taskId && sent.runId) {
            await deps.jobs.enqueue(runContinueJob(sent.runId)).catch((error) => {
              getLogger().error("follow-up enqueue", error);
            });
          }
          return { ok: true as const };
        }
        await sendThreadMessage(deps, context.actor, target, {
          text: input.text,
          clientNonce: input.clientNonce,
        });
        return { ok: true as const };
      }),
      endCall: authed.threads.endCall.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        if (target.kind !== "bot") throw new IsolationError();
        await assertTeachingSendAllowed(deps.prisma, context.actor.spaceId, target.botId);
        const { botId, threadId } = target;
        const blocks = [
          { kind: "voice_call" as const, callId: input.callId, title: "", farewell: "" },
        ];
        const committed = await deps.prisma
          .$transaction(async (tx) => {
            // A late provider hang-up is harmless when the call never produced a
            // user utterance; do not create a phantom marker or follow-up run.
            const userUtterance = await tx.message.findFirst({
              where: {
                threadId,
                role: "user",
                clientNonce: { startsWith: `${CALL_CLIENT_NONCE_PREFIX}${input.callId}:` },
              },
              select: { id: true },
            });
            if (!userUtterance) return null;
            // The marker's deterministic nonce is the idempotency key: the unique
            // (threadId, clientNonce) index rejects a second hang-up, concurrent or not.
            const message = await createThreadMessageInTransaction(tx, {
              threadId,
              role: "bot",
              botId,
              blocks,
              clientNonce: callMarkerClientNonce(input.callId),
            });
            await appendEventInTransaction(tx, {
              spaceId: context.actor.spaceId,
              threadId,
              botId,
              type: "thread.message.created",
              payload: { messageId: message.id, role: "bot", blocks, callId: input.callId },
            });
            const task = await tx.task.create({
              data: {
                spaceId: context.actor.spaceId,
                botId,
                threadId,
                userId: context.actor.userId,
                prompt: HANG_UP_PROMPT,
                status: "queued",
              },
            });
            const run = await tx.run.create({
              data: {
                spaceId: context.actor.spaceId,
                botId,
                threadId,
                taskId: task.id,
                userId: context.actor.userId,
                status: "queued",
                trigger: "call_end",
                unattended: newRunUnattended({ trigger: "call_end" }),
                clientNonce: callClientNonce(input.callId),
              },
              select: { id: true },
            });
            const ended = await appendEventInTransaction(tx, {
              spaceId: context.actor.spaceId,
              threadId,
              botId,
              type: "thread.call.ended",
              runId: run.id,
              payload: {
                botId,
                threadId,
                callId: input.callId,
                title: "",
                farewell: "",
                messageId: message.id,
              },
            });
            return { runId: run.id, eventSeq: ended.seq };
          })
          .catch((error) => {
            if (!isUniqueViolation(error)) throw error;
            return null;
          });
        if (!committed) return { ok: true as const };
        await deps.events.notify(threadId, committed.eventSeq).catch((error) => {
          getLogger().error("call end realtime notification", error);
        });
        // The queued run is durable; a missed wake is repaired by the reconciler.
        await deps.jobs.enqueue(runContinueJob(committed.runId)).catch((error) => {
          getLogger().error("call end enqueue", error);
        });
        return { ok: true as const };
      }),
      pipelineImport: authed.threads.pipelineImport.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        return readPipelineImport(deps, context.actor, target, input);
      }),
      applyPipelineImport: authed.threads.applyPipelineImport.handler(
        async ({ context, input }) => {
          const target = await resolveThreadTarget(deps.prisma, context.actor, input);
          await applyPipelineImport(deps, context.actor, target, input);
          // The card is answered, so its "needs approval" notification has nothing left to ask.
          await markSeen(deps.prisma, {
            ...context.actor,
            surface: "thread",
            threadId: target.threadId,
          }).catch((error) => getLogger().error("thread pipeline import notification", error));
          return { ok: true as const };
        },
      ),
      mailBatch: authed.threads.mailBatch.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        return readMailBatch(deps, context.actor, target, input);
      }),
      sendMailBatch: authed.threads.sendMailBatch.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        await sendMailBatch(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          target,
          input,
        );
        // The card is answered, so its "needs approval" notification has nothing left to ask.
        await markSeen(deps.prisma, {
          ...context.actor,
          surface: "thread",
          threadId: target.threadId,
        }).catch((error) => getLogger().error("thread mail batch notification", error));
        return { ok: true as const };
      }),
      previewMailBatch: authed.threads.previewMailBatch.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        return previewMailBatch(deps, context.actor, target, input);
      }),
      mailBatchToComposer: authed.threads.mailBatchToComposer.handler(
        async ({ context, input }) => {
          const target = await resolveThreadTarget(deps.prisma, context.actor, input);
          return mailBatchRowToComposer(deps, context.actor, target, input);
        },
      ),
      retryMailBatch: authed.threads.retryMailBatch.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        const count = await retryMailBatch(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          target,
          input,
        );
        return { ok: true as const, count };
      }),
      sendDraft: authed.threads.sendDraft.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        return sendSavedMailDraft(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          target,
          input,
        );
      }),
      answer: authed.threads.answer.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        // The card is answered, so its "needs approval" notification has nothing left to ask. Other
        // tabs read this to drop the toast.
        const clearAsked = () =>
          markSeen(deps.prisma, {
            ...context.actor,
            surface: "thread",
            threadId: target.threadId,
          }).catch((error) => getLogger().error("thread answer notification", error));
        if (input.mail && Object.keys(input.mail).length > 0) {
          if (input.answer !== "allow") {
            throw new ORPCError("BAD_REQUEST", { message: "Edits go with Send" });
          }
          await answerEditedMailApproval(
            { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
            context.actor,
            target,
            { runId: input.runId, messageId: input.messageId, mail: input.mail },
            async () => {
              await clearAsked();
              await deps.jobs.enqueue(runContinueJob(input.runId)).catch((error) => {
                getLogger().error("thread answer enqueue", error);
              });
            },
          );
          return { ok: true as const };
        }
        // A held bot-to-bot message is answered without a waiting run: Share delivers the stored
        // text once, Don't share delivers nothing. The card says which; the client sends no text.
        const scope = {
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
          threadId: target.threadId,
        };
        // A page source card is answered the same way, by server code that checks it still matches
        // the source's call.
        if (await findPageSourceApproval(deps.prisma, scope, input)) {
          const approvalDeps = {
            prisma: deps.prisma,
            events: deps.events,
            ticketBoardEnabled: deps.env?.ticketBoardEnabled,
            mcp: deps.mcp,
            secretStore: deps.secrets,
            network: deps.remoteConnectors,
            notificationEvents: deps.notificationEvents,
          };
          const answered = await answerPageSourceApproval(approvalDeps, scope, input);
          if (!answered) {
            throw new ORPCError("CONFLICT", {
              message: "This prompt is no longer awaiting an answer",
            });
          }
          // The answer is committed, so the notification clears first; a refresh that throws must
          // not fail the RPC or leave it unseen. Allow runs the approved source once now, and a
          // failure is recorded on the source.
          await clearAsked();
          if (answered !== "denied") {
            await refreshPageSource(approvalDeps, answered).catch((error) =>
              getLogger().error("thread answer page source refresh", error),
            );
          }
          return { ok: true as const };
        }
        if (await findBotShareEffect(deps.prisma, scope, input)) {
          const shared = await answerBotShare(deps, scope, input);
          if (!shared) {
            throw new ORPCError("CONFLICT", {
              message: "This prompt is no longer awaiting an answer",
            });
          }
          await clearAsked();
          return { ok: true as const };
        }
        const answered = await deps.events
          .answerRunInput({
            spaceId: context.actor.spaceId,
            threadId: target.threadId,
            runId: input.runId,
            messageId: input.messageId,
            answeredByUserId: context.actor.userId,
            answer: input.answer,
            clientNonce: input.clientNonce,
            username: input.username,
          })
          .catch((error: unknown) => {
            if (error instanceof AnswerTooLongError)
              throw new ORPCError("BAD_REQUEST", { message: error.message });
            // A typed credential its destination cannot carry (e.g. a header with a line break).
            throw mapBotSecretInputError(error);
          });
        if (!answered) {
          throw new ORPCError("CONFLICT", {
            message: "This prompt is no longer awaiting an answer",
          });
        }
        // Before the run continues: its next card must raise a notification this does not clear.
        await clearAsked();
        await deps.jobs.enqueue(runContinueJob(input.runId)).catch((error) => {
          // The answer and queued run are durable; the reconciler repairs a missed immediate wake.
          getLogger().error("thread answer enqueue", error);
        });
        return { ok: true as const };
      }),
      markRead: authed.threads.markRead.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        const changed = await setThreadUnreadState(deps.prisma, context.actor, target, false, {
          upToMessageId: input.upToMessageId,
          toEnd: input.toEnd,
        });
        if (changed) await notifyThreadReadChanged(deps, context.actor);
        return { ok: true as const };
      }),
      markUnread: authed.threads.markUnread.handler(async ({ context, input }) => {
        const target = await resolveThreadTarget(deps.prisma, context.actor, input);
        const changed = input.messageId
          ? await markThreadUnreadFrom(deps.prisma, context.actor, target, input.messageId)
          : await setThreadUnreadState(deps.prisma, context.actor, target, true);
        if (changed) await notifyThreadReadChanged(deps, context.actor);
        return { ok: true as const };
      }),
    },
    computer: {
      status: authed.computer.status.handler(async ({ context, input }) =>
        computerStatus(deps, context.actor, input.botId),
      ),
      boot: authed.computer.boot.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        if (!bot.computer) throw new IsolationError();
        if (bot.computer.state === "running" && bot.computer.providerRef) {
          try {
            await ensureComputerWorkspaceLayout(
              deps.sandbox,
              toComputerRef(bot.computer),
              parseComputerMode(bot.computer.scope),
              bot.id,
              computerContext(context.actor, bot.id, "boot"),
            );
            scheduleComputerSleep(deps.jobs, bot.computer.id);
            return computerStatus(deps, context.actor, input.botId);
          } catch (error) {
            await clearGoneSandbox(deps, bot.computer, error);
          }
        }
        const ctx = computerContext(context.actor, bot.id, "boot");
        const manualRunId = `boot:${randomUUID()}`;
        // A computer going to sleep finishes in moments; wait for it instead of refusing the boot.
        if (bot.computer.state === "suspending") {
          await waitForComputerReady(deps.prisma, bot.computer.id, ctx);
        }
        let lease: ComputerExecutionLease | null;
        try {
          lease = await acquireComputerExecutionLease(deps.prisma, {
            computerId: bot.computer.id,
            runId: manualRunId,
            botId: bot.id,
          });
        } catch (error) {
          if (error instanceof ComputerBusyError) {
            throw new ORPCError("CONFLICT", { message: "Computer is busy" });
          }
          throw error;
        }
        try {
          await provisionComputer(deps, bot.computer.id, {
            ...ctx,
            screenLeaseId: screenLeaseIdForRun(lease, manualRunId),
          });
          scheduleComputerSleep(deps.jobs, bot.computer.id);
        } catch (error) {
          if (error instanceof ComputerBusyError) {
            throw new ORPCError("CONFLICT", { message: "Computer is busy" });
          }
          // The bot was deleted or moved to another computer while this boot waited.
          if (isRecordNotFound(error)) {
            throw new ORPCError("NOT_FOUND", { message: "Computer no longer exists" });
          }
          throw error;
        } finally {
          await releaseComputerExecutionLease(deps.prisma, lease);
        }
        return computerStatus(deps, context.actor, input.botId);
      }),
      stop: authed.computer.stop.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        if (!bot.computer) throw new IsolationError();
        const controlLeaseId = bot.computer.controlLeaseId;
        const now = new Date();
        const claimed = await deps.prisma.computer.updateMany({
          where: {
            id: bot.computer.id,
            state: { not: "suspending" },
            maintenanceId: null,
            executionLeases: {
              none: { botId: { not: bot.id }, expiresAt: { gt: now } },
            },
          },
          data: { state: "suspending" },
        });
        if (claimed.count !== 1) {
          throw new ORPCError("CONFLICT", {
            message: "Other Team bots are still using this computer",
          });
        }
        const otherRun = await deps.prisma.run.findFirst({
          where: {
            botId: { not: bot.id },
            status: { in: [...ACTIVE_RUN_STATUSES] },
            bot: { computerId: bot.computer.id },
          },
          select: { id: true },
        });
        if (otherRun) {
          await deps.prisma.computer.updateMany({
            where: { id: bot.computer.id, state: "suspending" },
            data: { state: bot.computer.state },
          });
          throw new ORPCError("CONFLICT", {
            message: "Other Team bots are still using this computer",
          });
        }
        await deps.prisma.computerExecutionLease.deleteMany({
          where: { computerId: bot.computer.id, botId: bot.id },
        });
        try {
          if (bot.computer.providerRef) {
            const ctx = computerContext(context.actor, bot.id, "stop");
            const ref = toComputerRef(bot.computer);
            try {
              await checkpointAndRecordComputerWorkspace(deps, bot.computer, ref, ctx);
              await deps.sandbox.stop(ref, ctx);
            } catch (error) {
              // The sandbox is already gone: nothing left to checkpoint or stop.
              if (!isSandboxGoneError(error)) throw error;
            }
          }
          await deps.prisma.computer.update({
            where: { id: bot.computer.id },
            data: {
              state: "stopped",
              controlHolder: "none",
              controlLeaseId: null,
              controlLeaseExpiresAt: null,
              controlBotId: null,
              controlRunId: null,
            },
          });
        } catch (error) {
          await deps.prisma.computer
            .updateMany({
              where: { id: bot.computer.id, state: "suspending" },
              data: { state: "error" },
            })
            .catch(() => undefined);
          throw error;
        }
        await deps.jobs.cancel(
          computerControlExpireJobKey(bot.computer.id, controlLeaseId ?? undefined),
        );
        return computerStatus(deps, context.actor, input.botId);
      }),
      recover: authed.computer.recover.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        if (!bot.computer) throw new IsolationError();
        try {
          return await queueComputerUpdate(deps, bot.computer.id, bot.id, "recover");
        } catch (error) {
          if (error instanceof ComputerBusyError)
            throw new ORPCError("CONFLICT", { message: "Computer is busy" });
          throw error;
        }
      }),
      reset: authed.computer.reset.handler(async ({ context, input }) =>
        runComputerReplace(deps, context, input.botId, "reset", "reset"),
      ),
      update: authed.computer.update.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        if (!bot.computer) throw new IsolationError();
        if (!computerSupportsUpdate(bot.computer.kind))
          throw new ORPCError("BAD_REQUEST", {
            message: "Computer update is not available on this device",
          });
        try {
          return await queueComputerUpdate(deps, bot.computer.id, bot.id);
        } catch (error) {
          if (error instanceof ComputerBusyError)
            throw new ORPCError("CONFLICT", { message: "Computer is busy" });
          throw error;
        }
      }),
      updates: authed.computer.updates.handler(async ({ context }) => {
        const rows = await deps.prisma.computerUpdate.findMany({
          where: {
            status: { in: ["queued", "running", "interrupted", "failed"] },
            computer: {
              spaceId: context.actor.spaceId,
              bots: { some: { userId: context.actor.userId, archivedAt: null } },
            },
          },
          include: {
            computer: {
              include: {
                bots: {
                  where: { userId: context.actor.userId, archivedAt: null },
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        return rows.map((row) => computerUpdateView(row, context.actor.isDeploymentOwner));
      }),
      releaseInterrupted: authed.computer.releaseInterrupted.handler(async ({ context, input }) => {
        if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
        // This is an attended lock release, never a heartbeat-based takeover.
        // The contract requires the operator's explicit workersStopped assertion.
        await deps.prisma.$transaction(async (tx) => {
          const update = await tx.computerUpdate.findFirst({
            where: {
              id: input.id,
              status: "interrupted",
              computer: {
                spaceId: context.actor.spaceId,
                bots: { some: { userId: context.actor.userId, archivedAt: null } },
              },
            },
          });
          if (!update) throw new ORPCError("CONFLICT");
          const failed = await tx.computerUpdate.updateMany({
            where: { id: update.id, status: "interrupted" },
            data: { status: "failed" },
          });
          if (failed.count !== 1) throw new ORPCError("CONFLICT");
          const released = await tx.computer.updateMany({
            where: { id: update.computerId, maintenanceId: update.id },
            data: { maintenanceId: null, state: "error" },
          });
          if (released.count !== 1) throw new ORPCError("CONFLICT");
        });
        return { ok: true as const };
      }),
      dismissUpdate: authed.computer.dismissUpdate.handler(async ({ context, input }) => {
        await deps.prisma.computerUpdate.updateMany({
          where: {
            id: input.id,
            status: "failed",
            computer: {
              spaceId: context.actor.spaceId,
              bots: { some: { userId: context.actor.userId, archivedAt: null } },
            },
          },
          data: { status: "dismissed" },
        });
        return { ok: true as const };
      }),
      takeover: authed.computer.takeover.handler(async ({ context, input }) => {
        let bot = await repos.getBot(context.actor, input.botId);
        if (!bot.computer?.providerRef || bot.computer.state !== "running") {
          throw new ORPCError("BAD_REQUEST", { message: "computer must be running" });
        }
        if (hasActiveComputerControl(bot.computer) && bot.computer.controlBotId === bot.id) {
          await bindWaitingTakeoverToControl(deps, {
            spaceId: context.actor.spaceId,
            threadId: bot.thread?.id,
            botId: bot.id,
            computerId: bot.computer.id,
            controlLeaseId: bot.computer.controlLeaseId!,
            controlRunId: bot.computer.controlRunId,
          });
          await scheduleComputerControlExpiry(
            deps.jobs,
            bot.computer.id,
            bot.computer.controlLeaseId!,
            bot.computer.controlLeaseExpiresAt!,
          );
          return {
            leaseId: bot.computer.controlLeaseId!,
            expiresAt: bot.computer.controlLeaseExpiresAt!.toISOString(),
          };
        }
        if (hasActiveComputerControl(bot.computer) && bot.computer.controlBotId !== bot.id) {
          const previousBotId = bot.computer.controlBotId!;
          await revokeScreenControl(
            deps,
            bot.computer,
            computerContext(context.actor, previousBotId, "screen.release"),
            bot.computer.controlLeaseId ?? undefined,
          );
          await deps.prisma.computer.updateMany({
            where: { id: bot.computer.id, controlLeaseId: bot.computer.controlLeaseId },
            data: {
              controlHolder: "none",
              controlLeaseId: null,
              controlLeaseExpiresAt: null,
              controlBotId: null,
              controlRunId: null,
            },
          });
          bot = await repos.getBot(context.actor, input.botId);
          if (!bot.computer) throw new IsolationError();
        }
        if (bot.computer.controlLeaseId) {
          await expireComputerControl(deps, bot.computer.id, bot.computer.controlLeaseId);
          bot = await repos.getBot(context.actor, input.botId);
        }
        if (!bot.computer) throw new IsolationError();
        // Gone-sandbox revoke may have marked the row stopped; do not fall through to the
        // running-state grant and return a confusing "control changed" conflict.
        if (!bot.computer.providerRef || bot.computer.state !== "running") {
          throw new ORPCError("BAD_REQUEST", { message: "computer must be running" });
        }

        const executionLease = await deps.prisma.computerExecutionLease.findUnique({
          where: { computerId_botId: { computerId: bot.computer.id, botId: bot.id } },
        });
        const executionRun = executionLease
          ? await deps.prisma.run.findUnique({
              where: { id: executionLease.runId },
              select: { botId: true, status: true },
            })
          : null;
        const waitingForTakeover =
          executionRun?.botId === bot.id &&
          (executionRun.status === "waiting_takeover" ||
            bot.computer.controlRunId === executionLease?.runId);
        if (
          executionBlocksUserTakeover({
            hasLease: Boolean(executionLease),
            leaseExpiresAt: executionLease?.expiresAt,
            runStatus: executionRun?.status,
            takeoverRequested: waitingForTakeover,
          })
        ) {
          throw new ORPCError("CONFLICT", { message: "Stop the bot first" });
        }
        // Keep an inactive lease as a fencing tombstone. The next run reclaims it
        // with a higher fence, even if this user's screen remains connected.

        const leaseId = randomUUID();
        const expiresAt = new Date(Date.now() + takeoverLeaseMs());
        const granted = await deps.prisma.computer.updateMany({
          where: {
            id: bot.computer.id,
            state: "running",
            maintenanceId: null,
            controlHolder: { not: "user" },
            controlLeaseId: null,
          },
          data: {
            controlHolder: "user",
            controlLeaseId: leaseId,
            controlLeaseExpiresAt: expiresAt,
            controlBotId: bot.id,
            controlRunId: waitingForTakeover ? executionLease?.runId : null,
            state: "running",
          },
        });
        if (granted.count !== 1) {
          const current = await deps.prisma.computer.findUniqueOrThrow({
            where: { id: bot.computer.id },
          });
          if (!hasActiveComputerControl(current) || current.controlBotId !== bot.id) {
            throw new ORPCError("CONFLICT", { message: "Computer control changed; try again" });
          }
          await bindWaitingTakeoverToControl(deps, {
            spaceId: context.actor.spaceId,
            threadId: bot.thread?.id,
            botId: bot.id,
            computerId: current.id,
            controlLeaseId: current.controlLeaseId!,
            controlRunId: current.controlRunId,
          });
          await scheduleComputerControlExpiry(
            deps.jobs,
            current.id,
            current.controlLeaseId!,
            current.controlLeaseExpiresAt!,
          );
          return {
            leaseId: current.controlLeaseId!,
            expiresAt: current.controlLeaseExpiresAt!.toISOString(),
          };
        }
        try {
          await scheduleComputerControlExpiry(deps.jobs, bot.computer.id, leaseId, expiresAt);
        } catch (error) {
          await deps.prisma.computer.updateMany({
            where: { id: bot.computer.id, controlLeaseId: leaseId },
            data: {
              controlHolder: "none",
              controlLeaseId: null,
              controlLeaseExpiresAt: null,
              controlBotId: null,
              controlRunId: null,
            },
          });
          throw error;
        }
        if (bot.thread) {
          await deps.events.append({
            spaceId: context.actor.spaceId,
            threadId: bot.thread.id,
            botId: bot.id,
            type: "computer.takeover.granted",
            payload: { leaseId, takeoverRequested: waitingForTakeover },
          });
        }
        scheduleComputerSleep(deps.jobs, bot.computer.id);
        return { leaseId, expiresAt: expiresAt.toISOString() };
      }),
      release: authed.computer.release.handler(async ({ context, input }) => {
        await releaseComputerControl(deps, context.actor, input.botId, input.reason);
        return { ok: true as const };
      }),
      input: authed.computer.input.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const computer = bot.computer;
        if (!computer || !hasActiveComputerControl(computer) || computer.controlBotId !== bot.id) {
          await expireStaleComputerControl(deps, computer);
          throw new ORPCError("FORBIDDEN");
        }
        if (!computer.providerRef) return { ok: true as const };
        const sensitive = input.payload.sensitive === true;
        const skillId =
          sensitive && typeof input.payload.skillId === "string" && input.payload.skillId
            ? input.payload.skillId
            : undefined;
        const field =
          typeof input.payload.field === "string" && input.payload.field
            ? input.payload.field.slice(0, 120)
            : undefined;
        const mapped = {
          ...(input.kind === "key"
            ? { kind: "key" as const, key: String(input.payload.key ?? ""), sensitive }
            : input.kind === "clipboard"
              ? {
                  kind: "clipboard" as const,
                  text: String(input.payload.text ?? ""),
                  sensitive,
                }
              : input.kind === "scroll"
                ? {
                    kind: "scroll" as const,
                    direction:
                      input.payload.direction === "up" ? ("up" as const) : ("down" as const),
                    amount: Number(input.payload.amount ?? 3),
                    sensitive,
                  }
                : {
                    kind: "pointer" as const,
                    x: Number(input.payload.x ?? 0),
                    y: Number(input.payload.y ?? 0),
                    button: (input.payload.button as "left" | "right" | undefined) ?? "left",
                    type:
                      (input.payload.type as "move" | "down" | "up" | "click" | undefined) ??
                      "click",
                    sensitive,
                  }),
          ...(skillId ? { skillId } : {}),
          ...(field ? { field } : {}),
        };
        const outcome = await taughtSkills.recordInput(context.actor, bot.id, mapped);
        if (outcome === "stale") return { ok: true as const };
        if (outcome !== "recorded") {
          await applyTeachingDesktopInput(
            deps.sandbox,
            computer,
            mapped,
            computerContext(context.actor, bot.id, "input"),
          );
        }
        await deps.prisma.computer.updateMany({
          where: { id: computer.id, state: "running" },
          data: { updatedAt: new Date() },
        });
        scheduleComputerSleep(deps.jobs, computer.id);
        return { ok: true as const };
      }),
      files: authed.computer.files.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        if (!bot.computer) throw new IsolationError();
        const computer = bot.computer;
        const computerMode = parseComputerMode(computer.scope);
        const ctx = computerContext(context.actor, bot.id, "files");
        const storedPath = resolveBotWorkspacePath(computerMode, bot.id, input.path);
        let entries: Awaited<ReturnType<SandboxProvider["listFiles"]>>;
        if (computer.state === "running" && computer.providerRef) {
          await deps.prisma.computer.updateMany({
            where: { id: computer.id, state: "running" },
            data: { updatedAt: new Date() },
          });
          scheduleComputerSleep(deps.jobs, computer.id);
          const ref = toComputerRef(computer);
          await ensureComputerWorkspaceLayout(deps.sandbox, ref, computerMode, bot.id, ctx);
          entries = await deps.sandbox.listFiles(ref, storedPath, ctx);
        } else {
          entries = await deps.home.list(computer.homeKey, storedPath, ctx);
        }
        return entries.map((entry) => ({
          ...entry,
          path: displayBotWorkspacePath(computerMode, bot.id, input.path, entry.path),
        }));
      }),
      readFile: authed.computer.readFile.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        if (!bot.computer) throw new IsolationError();
        const computerMode = parseComputerMode(bot.computer.scope);
        const ctx = computerContext(context.actor, bot.id, "read");
        const storedPath = resolveBotWorkspacePath(computerMode, bot.id, input.path);
        let content: string;
        if (bot.computer.state === "running" && bot.computer.providerRef) {
          await deps.prisma.computer.updateMany({
            where: { id: bot.computer.id, state: "running" },
            data: { updatedAt: new Date() },
          });
          scheduleComputerSleep(deps.jobs, bot.computer.id);
          const bytes = await deps.sandbox.readFile(toComputerRef(bot.computer), storedPath, ctx, {
            maxBytes: MAX_COMPUTER_TEXT_FILE_BYTES,
          });
          content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } else {
          try {
            content = await deps.home.readFile(bot.computer.homeKey, storedPath, ctx, {
              maxBytes: MAX_COMPUTER_TEXT_FILE_BYTES,
            });
          } catch (error) {
            if (error instanceof Error && error.message.startsWith("agent home file exceeds ")) {
              throw new ORPCError("BAD_REQUEST", { message: "file is too large to preview" });
            }
            throw error;
          }
        }
        return { path: input.path, content };
      }),
      downloadFile: authed.computer.downloadFile.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const computer = bot.computer;
        if (!computer) throw new IsolationError();
        // The stopped-computer home store is text-only; binary transfer needs the live machine.
        if (computer.state !== "running" || !computer.providerRef) {
          throw new ORPCError("CONFLICT", { message: "Start the computer first." });
        }
        await keepComputerAwake(deps, computer.id);
        const storedPath = resolveBotWorkspacePath(
          parseComputerMode(computer.scope),
          bot.id,
          input.path,
        );
        const bytes = await deps.sandbox
          .readFile(
            toComputerRef(computer),
            storedPath,
            computerContext(context.actor, bot.id, "download"),
            { maxBytes: ATTACHMENT_MAX_BYTES },
          )
          .catch((error: unknown) => {
            if (error instanceof Error && /exceeds|too large/i.test(error.message)) {
              throw new ORPCError("BAD_REQUEST", { message: "File is too large to download." });
            }
            throw error;
          });
        return { path: input.path, contentBase64: Buffer.from(bytes).toString("base64") };
      }),
      uploadFile: authed.computer.uploadFile.handler(async ({ context, input }) => {
        let bot = await repos.getBot(context.actor, input.botId);
        if (await expireStaleComputerControl(deps, bot.computer)) {
          bot = await repos.getBot(context.actor, input.botId);
        }
        const computer = bot.computer;
        if (!computer) throw new IsolationError();
        if (computer.state !== "running" || !computer.providerRef) {
          throw new ORPCError("CONFLICT", { message: "Start the computer first." });
        }
        if (!hasActiveComputerControl(computer) || computer.controlBotId !== bot.id) {
          throw new ORPCError("FORBIDDEN", { message: "Take control first." });
        }
        const content = Buffer.from(input.contentBase64, "base64");
        if (content.byteLength > ATTACHMENT_MAX_BYTES) {
          throw new ORPCError("BAD_REQUEST", { message: "File is too large to upload." });
        }
        await keepComputerAwake(deps, computer.id);
        let storedPath: string;
        try {
          storedPath = resolveBotUploadPath(parseComputerMode(computer.scope), bot.id, input.path);
        } catch (error) {
          if (error instanceof Error && /escapes/i.test(error.message)) {
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
        await deps.sandbox.writeFile(
          toComputerRef(computer),
          { path: storedPath, content },
          computerContext(context.actor, bot.id, "upload"),
        );
        // Noting the path for a recording must never fail the upload.
        await taughtSkills.recordFile(context.actor, bot.id, input.path).catch(() => undefined);
        return { ok: true as const };
      }),
      commands: authed.computer.commands.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const events = await deps.prisma.event.findMany({
          where: { spaceId: context.actor.spaceId, botId: bot.id, type: "computer.command" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: COMPUTER_COMMAND_HISTORY_EVENTS,
          select: { payload: true, createdAt: true },
        });
        return foldComputerCommands(
          events.reverse().flatMap((event) => {
            const parsed = ComputerCommandSchema.safeParse(event.payload);
            return parsed.success
              ? [{ ...parsed.data, createdAt: event.createdAt.toISOString() }]
              : [];
          }),
        );
      }),
      terminalUrl: authed.computer.terminalUrl.handler(async ({ context, input }) => {
        let bot = await repos.getBot(context.actor, input.botId);
        if (await expireStaleComputerControl(deps, bot.computer)) {
          bot = await repos.getBot(context.actor, input.botId);
        }
        const computer = bot.computer;
        if (
          !computer?.providerRef ||
          computer.state !== "running" ||
          !deps.sandbox.connectTerminal ||
          !computerSupportsTerminal(computer.kind)
        ) {
          return { url: null };
        }
        // Same rule as the interactive screen: only the user holding this bot's control lease.
        if (
          !hasActiveComputerControl(computer) ||
          computer.controlBotId !== bot.id ||
          !computer.controlLeaseId
        ) {
          throw new ORPCError("FORBIDDEN", { message: "Take control first." });
        }
        const session = await deps.sandbox
          .connectTerminal(
            toComputerRef(computer),
            {
              controlToken: computer.controlLeaseId,
              cwd: resolveBotWorkspaceCwd(parseComputerMode(computer.scope), bot.id, undefined),
            },
            await computerScreenContext(
              deps.prisma,
              context.actor,
              computer.id,
              bot.id,
              "terminal",
            ),
          )
          .catch((error: unknown) => clearGoneSandbox(deps, computer, error));
        if (!session) return { url: null };
        await keepComputerAwake(deps, computer.id);
        return {
          url: addScreenProxyCapability(
            withViewOnly(session.url, false),
            deps.env.screenProxySecret,
            deps.env.webOrigin,
            {
              botId: bot.id,
              computerId: computer.id,
              botGeneration: bot.screenGeneration,
              computerGeneration: computer.screenGeneration,
              controlLeaseId: computer.controlLeaseId,
            },
          ),
        };
      }),
      screenUrl: authed.computer.screenUrl.handler(async ({ context, input }) => {
        let bot = await repos.getBot(context.actor, input.botId);
        if (await expireStaleComputerControl(deps, bot.computer)) {
          bot = await repos.getBot(context.actor, input.botId);
        }
        if (
          !bot.computer?.providerRef ||
          (bot.computer.state !== "running" && bot.computer.state !== "booting")
        ) {
          return { url: null };
        }
        const computer = bot.computer;
        const session = await deps.sandbox
          .connectScreen(
            toComputerRef(computer),
            {
              view: "stream",
              interactive: hasActiveComputerControl(computer) && computer.controlBotId === bot.id,
              controlToken:
                computer.controlBotId === bot.id
                  ? (computer.controlLeaseId ?? undefined)
                  : undefined,
            },
            await computerScreenContext(deps.prisma, context.actor, computer.id, bot.id, "screen"),
          )
          .catch(async (error: unknown) => {
            if (isComputerScreenUnavailable(error)) {
              throw new ORPCError("CONFLICT", { message: error.message });
            }
            return clearGoneSandbox(deps, computer, error);
          });
        if (!session?.url) return { url: null };
        scheduleComputerSleep(deps.jobs, bot.computer.id);
        const viewUrl = withViewOnly(
          session.url,
          !(hasActiveComputerControl(bot.computer) && bot.computer.controlBotId === bot.id),
        );
        return {
          url: addScreenProxyCapability(viewUrl, deps.env.screenProxySecret, deps.env.webOrigin, {
            botId: bot.id,
            computerId: computer.id,
            botGeneration: bot.screenGeneration,
            computerGeneration: computer.screenGeneration,
            controlLeaseId: computer.controlLeaseId,
          }),
        };
      }),
      heartbeat: authed.computer.heartbeat.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        if (bot.computer?.state === "running" && bot.computer.providerRef) {
          await deps.prisma.computer.updateMany({
            where: { id: bot.computer.id, state: "running" },
            data: { updatedAt: new Date() },
          });
          await touchRunningComputer(
            { sandbox: deps.sandbox, jobs: deps.jobs },
            {
              id: bot.computer.id,
              homeKey: bot.computer.homeKey,
              providerRef: bot.computer.providerRef,
              kind: bot.computer.kind,
            },
          ).catch(() => undefined);
        }
        return { ok: true as const };
      }),
    },
    companyContext: {
      list: authed.companyContext.list.handler(({ context }) =>
        listCompanyContext(deps, context.actor),
      ),
      save: authed.companyContext.save.handler(({ context, input }) =>
        saveCompanyContext(deps, context.actor, input),
      ),
      history: authed.companyContext.history.handler(({ context, input }) =>
        companyContextHistory(deps, context.actor, input.id),
      ),
      restore: authed.companyContext.restore.handler(({ context, input }) =>
        restoreCompanyContext(deps, context.actor, input),
      ),
      remove: authed.companyContext.remove.handler(({ context, input }) =>
        removeCompanyContext(deps, context.actor, input),
      ),
    },
    memory: {
      list: authed.memory.list.handler(async ({ context, input }) => {
        const docs = await deps.prisma.memoryDocument.findMany({
          where: {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            ...(input.botId ? { botId: input.botId } : {}),
            scope: input.scope ?? { in: ["bot", "user"] },
          },
          // Newest first, so the list is stable instead of coming back in heap order.
          orderBy: [{ updatedAt: "desc" }, { path: "asc" }],
          include: {
            revisions: {
              orderBy: { revision: "desc" },
              take: 1,
              select: { sourceRunId: true },
            },
          },
        });
        const runIds = [...new Set(docs.flatMap((doc) => doc.revisions[0]?.sourceRunId ?? []))];
        const runs = runIds.length
          ? await deps.prisma.run.findMany({
              where: {
                id: { in: runIds },
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
              },
              select: {
                id: true,
                trigger: true,
                routine: { select: { name: true } },
              },
            })
          : [];
        const sourceByRunId = new Map(runs.map((run) => [run.id, run]));
        return docs.map((doc) => ({
          id: doc.id,
          scope: doc.scope as "bot" | "user",
          botId: doc.botId,
          path: doc.path,
          content: doc.content,
          revision: doc.revision,
          updatedAt: doc.updatedAt.toISOString(),
          source: (() => {
            const sourceRunId = doc.revisions[0]?.sourceRunId;
            const run = sourceRunId ? sourceByRunId.get(sourceRunId) : undefined;
            if (!run) return null;
            if (run.trigger === "routine") {
              return { kind: "routine" as const, label: run.routine?.name ?? null };
            }
            // The list groups by agent already, so only a routine's name adds anything.
            if (run.trigger === "user" || run.trigger === "follow_up") {
              return { kind: "chat" as const, label: null };
            }
            return { kind: "other" as const, label: null };
          })(),
        }));
      }),
      update: authed.memory.update.handler(async ({ context, input }) => {
        // Company context sections change only through companyContext.*.
        const doc = await deps.prisma.memoryDocument.findFirst({
          where: {
            id: input.documentId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            scope: { in: ["bot", "user"] },
          },
        });
        if (!doc) throw new IsolationError();
        const updated = await deps.memory
          .commit(
            {
              scope: doc.scope as "bot" | "user",
              botId: doc.botId ?? undefined,
              path: doc.path,
              content: input.content,
              expectedRevision: input.expectedRevision,
              byOwner: true,
            },
            {
              operationId: "mem",
              traceId: "mem",
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              signal: new AbortController().signal,
            },
          )
          .catch((error: unknown) => {
            if (error instanceof Error && error.message === MEMORY_REVISION_CONFLICT_ERROR) {
              throw new ORPCError("CONFLICT", { message: "Memory changed since it was opened" });
            }
            throw error;
          });
        return {
          id: updated.id,
          scope: doc.scope as "bot" | "user",
          botId: doc.botId,
          path: updated.path,
          content: updated.content,
          revision: updated.revision,
          updatedAt: new Date().toISOString(),
        };
      }),
      remove: authed.memory.remove.handler(async ({ context, input }) => {
        const where = {
          id: input.documentId,
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
          scope: { in: ["bot", "user"] },
        };
        // Revisions go with the document (ON DELETE CASCADE).
        const { count } = await deps.prisma.memoryDocument.deleteMany({
          where: { ...where, revision: input.revision },
        });
        if (count === 0) {
          if (!(await deps.prisma.memoryDocument.findFirst({ where }))) throw new IsolationError();
          throw new ORPCError("CONFLICT", { message: "Memory changed since it was opened" });
        }
        return { ok: true as const };
      }),
      providerConfig: authed.memory.providerConfig.handler(async ({ context }) => {
        const config = await findSpaceMemoryConfig(deps.prisma, context.actor.spaceId);
        return config ? serializeSpaceMemoryConfig(config) : null;
      }),
      connectProvider: ownerOnly.memory.connectProvider.handler(async ({ context, input }) =>
        persistMemoryProviderConfig(deps, context.actor, input),
      ),
      setDefaultScope: ownerOnly.memory.setDefaultScope.handler(async ({ context, input }) =>
        updateMemoryProviderDefaultScope(deps, context.actor, input.defaultMemoryScope),
      ),
      disconnectProvider: ownerOnly.memory.disconnectProvider.handler(async ({ context }) =>
        disconnectMemoryProvider(deps, context.actor),
      ),
    },
    pages: {
      get: authed.pages.get.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const page = await getBotPage(deps.prisma, {
          spaceId: bot.spaceId,
          botId: bot.id,
          pageId: input.pageId,
        });
        if (!page || !input.chartSvgs || page.kind === "html") return page;
        const chartSvgs = await pageChartSvgs(deps, { spaceId: bot.spaceId }, page);
        return { ...page, chartSvgs };
      }),
      data: authed.pages.data.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const page = await getBotPage(deps.prisma, {
          spaceId: bot.spaceId,
          botId: bot.id,
          pageId: input.pageId,
        });
        return page ? resolvePageData(deps, { spaceId: bot.spaceId }, page) : null;
      }),
      refresh: authed.pages.refresh.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const page = await getBotPage(deps.prisma, {
          spaceId: bot.spaceId,
          botId: bot.id,
          pageId: input.pageId,
        });
        if (!page) return null;
        const refreshDeps = {
          prisma: deps.prisma,
          events: deps.events,
          ticketBoardEnabled: deps.env?.ticketBoardEnabled,
          mcp: deps.mcp,
          secretStore: deps.secrets,
          network: deps.remoteConnectors,
        };
        const { paused } = await refreshPageSources(refreshDeps, {
          spaceId: bot.spaceId,
          botId: bot.id,
          pageId: page.id,
        });
        if (paused) {
          // The refresh already succeeded; a failed message must not fail it.
          await postPauseMessage(
            { ...refreshDeps, jobs: deps.jobs },
            { spaceId: bot.spaceId, userId: bot.userId, botId: bot.id },
          ).catch((error) => {
            getLogger().error("page source pause message failed", error);
          });
        }
        return resolvePageData(deps, { spaceId: bot.spaceId }, page);
      }),
      share: authed.pages.share.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const page = await getBotPage(deps.prisma, {
          spaceId: bot.spaceId,
          botId: bot.id,
          pageId: input.pageId,
        });
        if (!page) return null;
        const data = await resolvePageData(deps, { spaceId: bot.spaceId }, page);
        const { artifactId, token, expiresAt } = await sharePageSnapshot(
          { prisma: deps.prisma, artifacts: deps.artifacts },
          { spaceId: bot.spaceId, userId: bot.userId, botId: bot.id, page, data },
        );
        return {
          url: `${deps.env.webOrigin}/s#${token}`,
          expiresAt: expiresAt.toISOString(),
          artifactId,
        };
      }),
      shareStatus: authed.pages.shareStatus.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const page = await getBotPage(deps.prisma, {
          spaceId: bot.spaceId,
          botId: bot.id,
          pageId: input.pageId,
        });
        if (!page) return null;
        return pageShareStatus(deps.prisma, {
          spaceId: bot.spaceId,
          userId: bot.userId,
          botId: bot.id,
          pageId: page.id,
        });
      }),
      sources: authed.pages.sources.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const page = await getBotPage(deps.prisma, {
          spaceId: bot.spaceId,
          botId: bot.id,
          pageId: input.pageId,
        });
        if (!page) return [];
        return listPageSources(deps.prisma, {
          spaceId: bot.spaceId,
          botId: bot.id,
          pageId: page.id,
        });
      }),
      removeSource: authed.pages.removeSource.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const removed = await removePageSource(
          { prisma: deps.prisma, events: deps.events },
          { spaceId: bot.spaceId, botId: bot.id },
          { id: input.sourceId },
        );
        if (!removed) throw new ORPCError("NOT_FOUND", { message: "Source not found." });
        return { ok: true as const };
      }),
      setSourceSchedule: authed.pages.setSourceSchedule.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const source = await updatePageSourceByOwner(
          { prisma: deps.prisma, events: deps.events },
          { spaceId: bot.spaceId, botId: bot.id },
          input.sourceId,
          { schedule: input.schedule },
        );
        if (!source) throw new ORPCError("NOT_FOUND", { message: "Source not found." });
        return source;
      }),
      pauseSource: authed.pages.pauseSource.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const source = await updatePageSourceByOwner(
          { prisma: deps.prisma, events: deps.events },
          { spaceId: bot.spaceId, botId: bot.id },
          input.sourceId,
          { action: "pause" },
        );
        if (!source) throw new ORPCError("NOT_FOUND", { message: "Source not found." });
        return source;
      }),
      resumeSource: authed.pages.resumeSource.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const source = await updatePageSourceByOwner(
          { prisma: deps.prisma, events: deps.events },
          { spaceId: bot.spaceId, botId: bot.id },
          input.sourceId,
          { action: "resume" },
        );
        if (!source) throw new ORPCError("NOT_FOUND", { message: "Source not found." });
        return source;
      }),
      save: authed.pages.save.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        try {
          const result = await saveBotPage(
            { prisma: deps.prisma, events: deps.events },
            {
              spaceId: bot.spaceId,
              botId: bot.id,
              userId: bot.userId,
              pageId: input.pageId,
              content: input.content,
              baseRevision: input.baseRevision,
              updatedBy: "user",
              gtmPage: isGtmAgentSpawnKey(bot.spawnKey),
            },
          );
          if (result.ok) return result;
          if (!result.page) {
            // A pageId of another bot or space also lands here: the page is not this bot's.
            throw new ORPCError(input.pageId ? "NOT_FOUND" : "CONFLICT", {
              message: "The page was changed or removed.",
            });
          }
          return { ok: false as const, reason: "conflict" as const, page: result.page };
        } catch (error) {
          throw pageError(error);
        }
      }),
      list: authed.pages.list.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        return listBotPages(deps.prisma, { spaceId: bot.spaceId, botId: bot.id });
      }),
      create: authed.pages.create.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        try {
          return await createBotPage(
            { prisma: deps.prisma, events: deps.events },
            {
              spaceId: bot.spaceId,
              botId: bot.id,
              userId: bot.userId,
              title: input.title,
              kind: input.kind,
            },
          );
        } catch (error) {
          throw pageError(error);
        }
      }),
      rename: authed.pages.rename.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        try {
          const page = await renameBotPage(deps.prisma, {
            spaceId: bot.spaceId,
            botId: bot.id,
            pageId: input.pageId,
            title: input.title,
          });
          if (!page) throw new ORPCError("NOT_FOUND", { message: "Page not found." });
          return page;
        } catch (error) {
          throw pageError(error);
        }
      }),
      remove: authed.pages.remove.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const removed = await removeBotPage(deps.prisma, {
          spaceId: bot.spaceId,
          botId: bot.id,
          pageId: input.pageId,
        });
        if (!removed) throw new ORPCError("NOT_FOUND", { message: "Page not found." });
        return { ok: true as const };
      }),
    },
    pins: {
      get: authed.pins.get.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        return getBotPins(deps.prisma, { spaceId: bot.spaceId, botId: bot.id });
      }),
      save: authed.pins.save.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        try {
          const result = await saveBotPins(
            { prisma: deps.prisma, events: deps.events, mcp: deps.mcp },
            { spaceId: bot.spaceId, botId: bot.id, userId: bot.userId },
            { list: input.list, baseRevision: input.baseRevision, updatedBy: "user" },
          );
          if (result.ok) return result;
          if (!result.pins) {
            throw new ORPCError("CONFLICT", { message: "The pins were changed or removed." });
          }
          return { ok: false as const, reason: "conflict" as const, pins: result.pins };
        } catch (error) {
          if (error instanceof PinsValidationError) {
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      }),
      refresh: authed.pins.refresh.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        await assertTeachingSendAllowed(deps.prisma, bot.spaceId, bot.id);
        const result = await refreshBotPins(
          { prisma: deps.prisma, events: deps.events, jobs: deps.jobs, mcp: deps.mcp },
          { spaceId: bot.spaceId, botId: bot.id, userId: bot.userId },
        );
        if (!result) throw new ORPCError("NOT_FOUND", { message: "This bot has no pins." });
        return result;
      }),
    },
    routines: {
      history: authed.routines.history.handler(async ({ context, input }) =>
        listRoutineRuns(deps.prisma, context.actor, input.routineId, input.before),
      ),
      list: authed.routines.list.handler(async ({ context, input }) => {
        await repos.getBot(context.actor, input.botId);
        return listRoutinesDto(deps, context.actor, input.botId);
      }),
      create: authed.routines.create.handler(async ({ context, input }) => {
        if (hasMixedOneShotSchedule(input.crons)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A one-time schedule can't be combined with other schedules.",
          });
        }
        if (input.active && isOneShotRoutineCrons(input.crons)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "One-shot schedules must be created from chat.",
          });
        }
        const bot = await repos.getBot(context.actor, input.botId);
        await assertRoutineModel(deps, context.actor, input);
        if (input.modelCredentialId && input.modelProvider) {
          await assertOwnedConnection(
            deps,
            context.actor,
            input.modelCredentialId,
            input.modelProvider,
          );
        }
        if (input.taughtSkillId) {
          await assertRoutineTaughtSkill(deps, context.actor, input.botId, input.taughtSkillId);
        }
        if (input.watch) {
          await assertWatchLimits(deps.prisma, context.actor.spaceId, input.botId);
        }
        const timezone =
          input.timezone ??
          (
            await deps.prisma.user.findUnique({
              where: { id: context.actor.userId },
              select: { timezone: true },
            })
          )?.timezone ??
          "UTC";
        // Validate every recurring cron even when inactive; @once and webhook-only have no next date.
        let nextRunAt: Date | null = null;
        if (input.crons.length > 0 && !isOneShotRoutineCrons(input.crons)) {
          const computedNextRunAt = nextRoutineDate(input.crons, timezone);
          nextRunAt = input.active ? computedNextRunAt : null;
        }
        const row = await deps.prisma.routine.create({
          data: {
            spaceId: context.actor.spaceId,
            botId: input.botId,
            userId: context.actor.userId,
            name: input.name,
            prompt: input.prompt,
            taughtSkillId: input.taughtSkillId,
            crons: input.crons,
            timezone,
            notify: input.notify,
            active: input.active,
            webhookEnabled: input.webhookEnabled,
            githubEnabled: input.githubEnabled,
            messageProvider: input.messageProvider,
            modelProvider: input.modelProvider,
            modelId: input.modelId,
            modelCredentialId: input.modelProvider ? input.modelCredentialId : null,
            thinkingLevel: input.thinkingLevel,
            // A watch is quiet by default; everything else keeps today's behavior.
            quiet: input.quiet ?? Boolean(input.watch),
            watch: input.watch ?? undefined,
            nextRunAt,
          },
          include: routineInclude,
        });
        if (input.watch) {
          await syncWatchState(deps.prisma, {
            routineId: row.id,
            spaceId: row.spaceId,
            watch: input.watch,
            watchChanged: true,
            now: new Date(),
          });
        }
        if (bot.thread) {
          await deps.events.append({
            spaceId: context.actor.spaceId,
            threadId: bot.thread.id,
            botId: bot.id,
            type: "routine.created",
            payload: { name: row.name },
          });
        }
        if (row.active && row.nextRunAt) {
          await deps.jobs.enqueue(routineWakeupJob(row.id, row.nextRunAt));
        }
        return mapRoutine(row);
      }),
      update: authed.routines.update.handler(async ({ context, input }) => {
        // Archived bots keep their routines paused, so resolve an active parent before any write.
        const existing = await deps.prisma.routine.findFirst({
          where: {
            id: input.routineId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            bot: { archivedAt: null },
          },
        });
        if (!existing) throw new ORPCError("NOT_FOUND");
        const bot = await repos.getBot(context.actor, existing.botId);
        const active = input.active ?? existing.active;
        const crons = input.crons ?? existing.crons;
        const timezone = input.timezone ?? existing.timezone;
        const webhookEnabled = input.webhookEnabled ?? existing.webhookEnabled;
        const githubEnabled = input.githubEnabled ?? existing.githubEnabled;
        const messageProvider =
          input.messageProvider === undefined ? existing.messageProvider : input.messageProvider;
        const modelProvider =
          input.modelProvider === undefined ? existing.modelProvider : input.modelProvider;
        const modelId = input.modelId === undefined ? existing.modelId : input.modelId;
        const hasModel = Boolean(modelProvider && modelId);
        const modelChanged =
          modelProvider !== existing.modelProvider || modelId !== existing.modelId;
        const pinWrite = connectionPinWrite(input, existing.modelProvider);
        const modelCredentialId = !hasModel
          ? null
          : pinWrite === undefined
            ? existing.modelCredentialId
            : pinWrite;
        const touchesModel =
          input.modelProvider !== undefined ||
          input.modelId !== undefined ||
          input.modelCredentialId !== undefined ||
          input.thinkingLevel !== undefined;
        if (Boolean(modelProvider) !== Boolean(modelId)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Model provider and model id must both be set or both cleared",
          });
        }
        if (input.thinkingLevel && !hasModel) {
          throw new ORPCError("BAD_REQUEST", { message: "Pick a model for this routine first" });
        }
        // A thinking level belongs to a model, so changing the model resets it.
        const thinkingLevel = !hasModel
          ? null
          : input.thinkingLevel === undefined
            ? modelChanged
              ? null
              : existing.thinkingLevel
            : input.thinkingLevel;
        if (modelChanged) {
          await assertRoutineModel(deps, context.actor, { modelProvider, modelId });
        }
        if (modelCredentialId && modelCredentialId !== existing.modelCredentialId) {
          await assertOwnedConnection(deps, context.actor, modelCredentialId, modelProvider);
        }
        if (existing.managedKind) {
          const edited = Object.entries(input).filter(
            ([key, value]) => key !== "routineId" && key !== "active" && value !== undefined,
          );
          if (edited.length > 0) {
            throw new ORPCError("BAD_REQUEST", {
              message: "This routine is managed by the check-in setting.",
            });
          }
        }
        if (input.taughtSkillId) {
          await assertRoutineTaughtSkill(deps, context.actor, existing.botId, input.taughtSkillId);
        }
        const nextTaughtSkillId =
          input.taughtSkillId === undefined ? existing.taughtSkillId : input.taughtSkillId;
        if (
          !existing.managedKind &&
          !nextTaughtSkillId &&
          !(input.prompt ?? existing.prompt).trim()
        ) {
          throw new ORPCError("BAD_REQUEST", { message: "Add an instruction" });
        }
        const watch = input.watch === undefined ? existing.watch : input.watch;
        const watchChanged =
          input.watch !== undefined &&
          stableJsonText(input.watch) !== stableJsonText(existing.watch);
        // Only the bot sets up a connected-app watch, from chat; the editor can send one back unchanged.
        if (input.watch?.kind === "connector" && watchChanged) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A connected-app watch is set up in chat.",
          });
        }
        if (input.watch && !existing.watch) {
          await assertWatchLimits(deps.prisma, context.actor.spaceId, existing.botId);
        }
        if (crons.length === 0 && !watch && !webhookEnabled && !githubEnabled && !messageProvider) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Add a schedule, webhook, GitHub, or message trigger",
          });
        }
        if (hasMixedOneShotSchedule(crons)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A one-time schedule can't be combined with other schedules.",
          });
        }
        if (active && isOneShotRoutineCrons(crons)) {
          if (!isOneShotRoutineCrons(existing.crons)) {
            throw new ORPCError("BAD_REQUEST", {
              message: "One-shot schedules must be created from chat.",
            });
          }
          if (!existing.nextRunAt && existing.lastRunAt) {
            throw new ORPCError("BAD_REQUEST", {
              message: "This one-shot already ran.",
            });
          }
        }
        const scheduleChanged =
          (!existing.active && active) ||
          (input.crons !== undefined &&
            JSON.stringify(input.crons) !== JSON.stringify(existing.crons)) ||
          (input.timezone !== undefined && input.timezone !== existing.timezone);
        const recalculatedNextRunAt =
          crons.length > 0 &&
          !isOneShotRoutineCrons(crons) &&
          (scheduleChanged || (active && !existing.nextRunAt))
            ? nextRoutineDate(crons, timezone)
            : null;
        let armedOneShotAt: Date | null = null;
        if (active && isOneShotRoutineCrons(crons) && !existing.nextRunAt && !existing.lastRunAt) {
          if (!input.runAt) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Add a run time for this one-shot.",
            });
          }
          const parsed = new Date(input.runAt);
          if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Run time must be in the future.",
            });
          }
          armedOneShotAt = parsed;
        } else if (input.runAt !== undefined) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A run time is only for one-shots that have not run yet.",
          });
        }
        const nextRunAt = !active
          ? null
          : crons.length === 0
            ? null
            : isOneShotRoutineCrons(crons)
              ? (armedOneShotAt ?? existing.nextRunAt)
              : (recalculatedNextRunAt ?? existing.nextRunAt);
        // Re-check the parent in the write itself so an archive that lands after the read wins.
        // Model patches must also match the snapshot used to resolve omitted model fields.
        const row = await deps.prisma.routine
          .update({
            where: {
              id: existing.id,
              bot: { archivedAt: null },
              ...(touchesModel
                ? {
                    modelProvider: existing.modelProvider,
                    modelId: existing.modelId,
                    modelCredentialId: existing.modelCredentialId,
                    thinkingLevel: existing.thinkingLevel,
                  }
                : {}),
            },
            data: {
              name: input.name,
              prompt: input.prompt,
              ...(input.taughtSkillId === undefined ? {} : { taughtSkillId: input.taughtSkillId }),
              crons: input.crons,
              timezone: input.timezone,
              active: input.active,
              notify: input.notify,
              webhookEnabled: input.webhookEnabled,
              githubEnabled: input.githubEnabled,
              messageProvider: input.messageProvider,
              quiet: input.quiet,
              ...(input.watch === undefined ? {} : { watch: input.watch ?? Prisma.DbNull }),
              ...(touchesModel ? { modelProvider, modelId, modelCredentialId, thinkingLevel } : {}),
              // Pinning a different connection fixes the reason the row says it is held for credit,
              // so the line goes at once. Following the default or the same pin leaves the pause.
              ...(touchesModel &&
              modelCredentialId &&
              modelCredentialId !== existing.pausedConnectionId
                ? { pausedConnectionId: null }
                : {}),
              nextRunAt,
            },
            include: routineInclude,
          })
          .catch(async (error: unknown) => {
            if (isRecordNotFound(error)) {
              if (
                touchesModel &&
                (await deps.prisma.routine.findFirst({
                  where: {
                    id: existing.id,
                    spaceId: context.actor.spaceId,
                    userId: context.actor.userId,
                    bot: { archivedAt: null },
                  },
                  select: { id: true },
                }))
              ) {
                throw new ORPCError("CONFLICT", { message: "Routine model changed; retry." });
              }
              throw new ORPCError("NOT_FOUND");
            }
            throw error;
          });
        if (bot.thread) {
          await deps.events.append({
            spaceId: context.actor.spaceId,
            threadId: bot.thread.id,
            botId: bot.id,
            type: "routine.updated",
            payload: { routineId: row.id, active: row.active },
          });
        }
        if (existing.active && !row.active) {
          await deps.prisma.$transaction((tx) =>
            cancelQueuedRoutineRuns(
              tx,
              {
                routineId: row.id,
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
              },
              new Date(),
            ),
          );
        }
        if (input.watch !== undefined) {
          await syncWatchState(deps.prisma, {
            routineId: row.id,
            spaceId: row.spaceId,
            watch: input.watch,
            watchChanged,
            now: new Date(),
          });
        } else if (!existing.active && row.active && row.watch) {
          // Turning a paused watch back on checks again now.
          await resumeWatch(deps.prisma, {
            routineId: row.id,
            spaceId: row.spaceId,
            now: new Date(),
          });
        }
        const scheduleNeedsSync =
          existing.active !== row.active ||
          scheduleChanged ||
          (!existing.nextRunAt && !!row.nextRunAt);
        if (scheduleNeedsSync) {
          if (row.active && row.nextRunAt) {
            await deps.jobs.enqueue(routineWakeupJob(row.id, row.nextRunAt));
          } else {
            await deps.jobs.cancel(routineJobKey(row.id));
          }
        }
        return mapRoutine(row, await routineLastRunFailed(deps, row.id));
      }),
      remove: authed.routines.remove.handler(async ({ context, input }) => {
        const existing = await deps.prisma.routine.findFirst({
          where: {
            id: input.routineId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          },
        });
        if (!existing) throw new IsolationError();
        if (existing.managedKind) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Turn off the check-in setting instead.",
          });
        }
        await deps.prisma.$transaction(async (tx) => {
          await cancelQueuedRoutineRuns(
            tx,
            {
              routineId: existing.id,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
            },
            new Date(),
          );
          await tx.routine.delete({ where: { id: existing.id } });
        });
        await deps.jobs.cancel(routineJobKey(existing.id));
        return { ok: true as const };
      }),
      resume: authed.routines.resume.handler(async ({ context, input }) => {
        // Archived bots keep their routines paused, so resolve an active parent before any write.
        const existing = await deps.prisma.routine.findFirst({
          where: {
            id: input.routineId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            bot: { archivedAt: null },
          },
          include: routineInclude,
        });
        if (!existing) throw new IsolationError();
        const watchPaused = existing.watchState?.pausedReason != null;
        const creditPaused =
          existing.pausedConnectionId != null &&
          (existing.connectionPause?.pausedUntil.getTime() ?? 0) > Date.now();
        if (!watchPaused && !creditPaused) {
          throw new ORPCError("BAD_REQUEST", { message: "This routine is not paused." });
        }
        const now = new Date();
        // Re-enabling recomputes the next occurrence from now; resuming does the same. A routine
        // with no repeating schedule keeps whatever run time it had.
        const nextRunAt =
          existing.active && existing.crons.length > 0 && !isOneShotRoutineCrons(existing.crons)
            ? nextRoutineDate(existing.crons, existing.timezone)
            : existing.nextRunAt;
        if (creditPaused && existing.pausedConnectionId) {
          // The hold lives on the connection (it also covers this routine's other routines); a
          // resume drops it the way a run that got through does. onDelete SetNull clears the
          // routine's pointer, so the reason line is gone on the next read.
          await deps.prisma.modelConnectionPause.deleteMany({
            where: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              credentialId: existing.pausedConnectionId,
            },
          });
        }
        if (watchPaused) {
          // The same as turning the watch back on: clears the pause and checks again now.
          await resumeWatch(deps.prisma, {
            routineId: existing.id,
            spaceId: existing.spaceId,
            now,
          });
        }
        const row = await deps.prisma.routine.update({
          where: { id: existing.id },
          data: { nextRunAt, ...(creditPaused ? { pausedConnectionId: null } : {}) },
          include: routineInclude,
        });
        const bot = await repos.getBot(context.actor, existing.botId);
        if (bot.thread) {
          await deps.events.append({
            spaceId: context.actor.spaceId,
            threadId: bot.thread.id,
            botId: bot.id,
            type: "routine.updated",
            payload: { routineId: row.id, active: row.active },
          });
        }
        if (row.active && nextRunAt) {
          await deps.jobs.enqueue(routineWakeupJob(row.id, nextRunAt));
        }
        return mapRoutine(row, await routineLastRunFailed(deps, row.id));
      }),
      testRun: authed.routines.testRun.handler(async ({ context, input }) => {
        const routine = await deps.prisma.routine.findFirst({
          where: {
            id: input.routineId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          },
        });
        if (!routine) throw new IsolationError();
        const bot = await repos.getBot(context.actor, routine.botId);
        if (!bot.thread) throw new Error("Bot is missing its thread");
        const threadId = bot.thread.id;
        const nonce = input.clientNonce ? `routine-test:${input.clientNonce}` : undefined;
        if (nonce) {
          const existing = await deps.prisma.run.findFirst({
            where: { threadId, clientNonce: nonce },
            select: { id: true },
          });
          if (existing) return { runId: existing.id };
        }
        const skillRecords = await agentSkills.listWithContent(context.actor);
        // The saved prompt can still open with its schedule; a test does the work once, now.
        const prompt = `${expandSkillReferencesInPrompt((await taughtSkillPromptForRoutine(deps.prisma, routine)) ?? routine.prompt, skillRecords)}\n\nThis is a test run: do the work above now and post the result here. Ignore any timing in it, and do not create or change schedules.`;
        let run: { id: string };
        try {
          // Task + run must commit together so a nonce collision cannot leave an orphan queued Task.
          run = await deps.prisma.$transaction(async (tx) => {
            if (nonce) {
              const existing = await tx.run.findFirst({
                where: { threadId, clientNonce: nonce },
                select: { id: true },
              });
              if (existing) return existing;
            }
            const task = await tx.task.create({
              data: {
                spaceId: context.actor.spaceId,
                botId: bot.id,
                threadId,
                userId: context.actor.userId,
                prompt,
                status: "queued",
              },
            });
            const currentModel = await tx.routine.findUnique({
              where: { id: routine.id },
              select: {
                modelProvider: true,
                modelId: true,
                modelCredentialId: true,
                thinkingLevel: true,
              },
            });
            if (!currentModel) throw new IsolationError();
            const created = await tx.run.create({
              data: {
                spaceId: context.actor.spaceId,
                botId: bot.id,
                threadId,
                taskId: task.id,
                userId: context.actor.userId,
                status: "queued",
                trigger: "routine",
                unattended: newRunUnattended({ trigger: "routine" }),
                routineId: routine.id,
                ...routineRunModelPin(currentModel),
                clientNonce: nonce,
              },
              select: { id: true },
            });
            // "Last ran" counts a test. A one-shot keeps lastRunAt for "already ran", so it is left alone.
            if (!isOneShotRoutineCrons(routine.crons)) {
              await tx.routine.update({
                where: { id: routine.id },
                data: { lastRunAt: new Date() },
              });
            }
            return created;
          });
        } catch (error) {
          if (nonce) {
            const existing = await deps.prisma.run.findFirst({
              where: { threadId, clientNonce: nonce },
              select: { id: true },
            });
            if (existing) return { runId: existing.id };
          }
          throw error;
        }
        // Keep enqueue outside the nonce-collision catch. The queued run is durable;
        // log enqueue failures and still return success — the reconciler repairs a missed wake.
        await deps.jobs.enqueue(runContinueJob(run.id)).catch((error) => {
          getLogger().error("routine testRun enqueue", error);
        });
        await expireSupersededRoutineRuns(
          { ...deps, now: new Date() },
          { routineId: routine.id, exceptRunId: run.id },
        ).catch(() => undefined);
        return { runId: run.id };
      }),
    },
    checkIn: {
      get: authed.checkIn.get.handler(async ({ context, input }) => {
        await repos.getBot(context.actor, input.botId);
        return {
          cadence: await getCheckInCadence(deps.prisma, {
            spaceId: context.actor.spaceId,
            botId: input.botId,
          }),
        };
      }),
      set: authed.checkIn.set.handler(async ({ context, input }) => {
        await repos.getBot(context.actor, input.botId);
        const user = await deps.prisma.user.findUnique({
          where: { id: context.actor.userId },
          select: { timezone: true },
        });
        const routine = await upsertCheckInRoutine(deps.prisma, {
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
          botId: input.botId,
          cadence: input.cadence,
          timezone: user?.timezone && isValidTimezone(user.timezone) ? user.timezone : "UTC",
        });
        if (routine?.active && routine.nextRunAt) {
          await deps.jobs.enqueue(routineWakeupJob(routine.id, routine.nextRunAt));
        } else if (routine) {
          await deps.jobs.cancel(routineJobKey(routine.id));
        }
        return { cadence: input.cadence };
      }),
    },
    scratchpad: {
      waitingOnYou: authed.scratchpad.waitingOnYou.handler(async ({ context }) => {
        const items = await listWaitingOnYouItems(deps.prisma, {
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
        });
        return items.map((item) => ({
          id: item.id,
          botId: item.botId,
          botName: item.botName,
          title: item.title,
          waitingOn: item.waitingOn,
          dueAt: item.dueAt?.toISOString() ?? null,
        }));
      }),
      list: authed.scratchpad.list.handler(async ({ context, input }) => {
        await repos.getBot(context.actor, input.botId);
        return listScratchpadItems(
          { prisma: deps.prisma },
          {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            botId: input.botId,
            status: input.status,
            includeDone: input.includeDone ?? false,
          },
        );
      }),
      create: authed.scratchpad.create.handler(async ({ context, input }) => {
        await repos.getBot(context.actor, input.botId);
        const result = await addScratchpadItemFromTool(
          { prisma: deps.prisma },
          {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            botId: input.botId,
            title: input.title,
            status: input.status,
            notes: input.notes,
            category: input.category,
            channel: input.channel,
            target: input.target,
            scheduledFor: input.scheduledFor,
            dueAt: input.dueAt,
            waitingOn: input.waitingOn,
          },
        );
        if ("error" in result) {
          throw new ORPCError("BAD_REQUEST", { message: result.error });
        }
        return result.item;
      }),
      update: authed.scratchpad.update.handler(async ({ context, input }) => {
        const existing = await deps.prisma.scratchpadItem.findFirst({
          where: {
            id: input.itemId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          },
        });
        if (!existing) throw new ORPCError("NOT_FOUND");
        await repos.getBot(context.actor, existing.botId);
        // Approving a post only makes sense for a slot the next routine run can publish:
        // gtm-posting refuses anything under ten minutes ahead, so a nearer slot would
        // fail after the founder already approved it.
        const contentFields = ["title", "notes", "target", "scheduledFor"] as const;
        const approves =
          input.reapprove === true ||
          (input.status === "open" && contentFields.every((key) => input[key] === undefined));
        if (existing.category === "public_post" && approves) {
          const routine = await deps.prisma.routine.findFirst({
            where: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              botId: existing.botId,
              name: GTM_WORK_ROUTINE_NAME,
              active: true,
              nextRunAt: { not: null },
            },
            orderBy: [{ nextRunAt: "asc" }, { id: "asc" }],
            select: { nextRunAt: true },
          });
          const now = new Date();
          // An overdue run publishes as soon as it wakes, so the floor never moves into the past.
          const floor = Math.max(now.getTime(), routine?.nextRunAt?.getTime() ?? 0) + 10 * 60_000;
          if (!existing.scheduledFor || existing.scheduledFor.getTime() < floor) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Schedule this post at least ten minutes after the next run.",
            });
          }
        }
        const result = await updateScratchpadItemFromUser(
          { prisma: deps.prisma },
          {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            botId: existing.botId,
            itemId: input.itemId,
            title: input.title,
            status: input.status,
            notes: input.notes,
            target: input.target,
            scheduledFor: input.scheduledFor,
            dueAt: input.dueAt,
            waitingOn: input.waitingOn,
            resolvedReason: input.resolvedReason,
            proof: input.proof,
            updatedAt: input.updatedAt,
            reapprove: input.reapprove,
          },
        );
        if ("conflict" in result) {
          throw new ORPCError("CONFLICT", { message: "Changed, review again" });
        }
        if ("error" in result) {
          throw new ORPCError("BAD_REQUEST", { message: result.error });
        }
        return result.item;
      }),
      remove: authed.scratchpad.remove.handler(async ({ context, input }) => {
        const existing = await deps.prisma.scratchpadItem.findFirst({
          where: {
            id: input.itemId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          },
        });
        if (!existing) throw new IsolationError();
        await repos.getBot(context.actor, existing.botId);
        const result = await removeScratchpadItemFromUser(
          { prisma: deps.prisma },
          {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            botId: existing.botId,
            itemId: existing.id,
          },
        );
        if ("error" in result) throw new ORPCError("BAD_REQUEST", { message: result.error });
        return { ok: true as const };
      }),
    },
    boards: {
      subscribe: boardEnabled.boards.subscribe.handler(async function* ({ context }) {
        const spaceId = context.actor.spaceId;
        const follow = deps.boardEvents.follow(spaceId, context.signal);
        // Board signals are transient, so a heartbeat stands in for liveness and
        // gives the client a periodic catch-up reload if a push was missed.
        for await (const event of withHeartbeat(follow, {
          signal: context.signal,
          stillAuthorized: context.stillAuthorized,
          heartbeatMs: HEARTBEAT_MS,
          recheckMs: SESSION_RECHECK_MS,
        })) {
          yield event === HEARTBEAT ? { spaceId, createdAt: new Date().toISOString() } : event;
        }
      }),
    },
    tickets: {
      list: boardEnabled.tickets.list.handler(async ({ context }) => {
        const board = await ensureBoard(deps.prisma, context.actor.spaceId);
        const rows = await deps.prisma.ticket.findMany({
          where: { spaceId: context.actor.spaceId, boardId: board.id },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        });
        return { tickets: rows.map((row) => toTicketDto(row, board.ticketPrefix)) };
      }),
      create: boardEnabled.tickets.create.handler(async ({ context, input }) => {
        await repos.getBot(context.actor, input.assigneeBotId);
        const result = await createTicket(ticketDeps, {
          ...input,
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
          ownerBotId: input.assigneeBotId,
        });
        if ("error" in result) throw new ORPCError("BAD_REQUEST", { message: result.error });
        return result.ticket;
      }),
      update: boardEnabled.tickets.update.handler(async ({ context, input }) => {
        if (input.assigneeBotId) await repos.getBot(context.actor, input.assigneeBotId);
        const result = await updateTicket(ticketDeps, {
          ...input,
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
          ownerBotId: input.assigneeBotId,
        });
        if ("error" in result) throw new ORPCError("BAD_REQUEST", { message: result.error });
        return result.ticket;
      }),
      move: boardEnabled.tickets.move.handler(async ({ context, input }) => {
        const result = await updateTicket(ticketDeps, {
          ...input,
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
        });
        if ("error" in result) throw new ORPCError("BAD_REQUEST", { message: result.error });
        return result.ticket;
      }),
      comment: boardEnabled.tickets.comment.handler(async ({ context, input }) => {
        const result = await commentTicket(ticketDeps, {
          id: input.ticketId,
          body: input.body,
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
        });
        if ("error" in result) throw new ORPCError("BAD_REQUEST", { message: result.error });
        return result.comment;
      }),
      comments: boardEnabled.tickets.comments.handler(async ({ context, input }) => {
        const board = await ensureBoard(deps.prisma, context.actor.spaceId);
        const ticket = await findTicket(deps.prisma, context.actor.spaceId, board, {
          id: input.ticketId,
        });
        if (!ticket) throw new IsolationError();
        const rows = await listTicketComments(deps.prisma, context.actor.spaceId, ticket.id);
        return rows.map(toTicketCommentDto);
      }),
    },
    skills: {
      list: authed.skills.list.handler(async ({ context, input }) => {
        await repos.getBot(context.actor, input.botId);
        return taughtSkills.list(context.actor, input.botId);
      }),
      get: authed.skills.get.handler(async ({ context, input }) =>
        taughtSkills.get(context.actor, input.skillId),
      ),
      start: authed.skills.start.handler(async ({ context, input }) => {
        await repos.getBot(context.actor, input.botId);
        return taughtSkills.start(context.actor, input.botId, input.goal);
      }),
      appendEvent: authed.skills.appendEvent.handler(async ({ context, input }) =>
        taughtSkills.appendEvent(context.actor, input.skillId, input.event),
      ),
      snapshot: authed.skills.snapshot.handler(async ({ context, input }) =>
        taughtSkills.snapshot(context.actor, input.skillId),
      ),
      stop: authed.skills.stop.handler(async ({ context, input }) =>
        taughtSkills.stop(context.actor, input.skillId),
      ),
      updateDraft: authed.skills.updateDraft.handler(async ({ context, input }) =>
        taughtSkills.updateDraft(context.actor, input.skillId, {
          name: input.name,
          playbook: input.playbook,
        }),
      ),
      save: authed.skills.save.handler(async ({ context, input }) =>
        taughtSkills.save(context.actor, input.skillId, input.name),
      ),
      testRun: authed.skills.testRun.handler(async ({ context, input }) =>
        taughtSkills.testRun(context.actor, input.skillId, input.prompt),
      ),
      remove: authed.skills.remove.handler(async ({ context, input }) =>
        taughtSkills.remove(context.actor, input.skillId),
      ),
    },
    taughtSkills: {
      list: authed.taughtSkills.list.handler(async ({ context, input }) => {
        await repos.getBot(context.actor, input.botId);
        return taughtSkills.listSaved(context.actor, input.botId);
      }),
      delete: authed.taughtSkills.delete.handler(async ({ context, input }) =>
        taughtSkills.remove(context.actor, input.skillId),
      ),
      saveLogin: authed.taughtSkills.saveLogin.handler(async ({ context, input }) =>
        taughtSkills.saveLogin(context.actor, input),
      ),
      skipLogin: authed.taughtSkills.skipLogin.handler(async ({ context, input }) =>
        taughtSkills.skipLogin(context.actor, input),
      ),
      cancel: authed.taughtSkills.cancel.handler(async ({ context, input }) =>
        taughtSkills.cancel(context.actor, input.skillId),
      ),
    },
    agentSkills: {
      list: authed.agentSkills.list.handler(async ({ context }) => agentSkills.list(context.actor)),
      get: authed.agentSkills.get.handler(async ({ context, input }) =>
        agentSkills.get(context.actor, input),
      ),
      create: authed.agentSkills.create.handler(async ({ context, input }) =>
        agentSkills.create(context.actor, input),
      ),
      update: authed.agentSkills.update.handler(async ({ context, input }) =>
        agentSkills.update(context.actor, input),
      ),
      remove: authed.agentSkills.remove.handler(async ({ context, input }) =>
        agentSkills.remove(context.actor, input.skillId),
      ),
      drafts: authed.agentSkills.drafts.handler(async ({ context }) =>
        agentSkills.drafts(context.actor),
      ),
      approveDraft: authed.agentSkills.approveDraft.handler(async ({ context, input }) =>
        agentSkills.approveDraft(context.actor, input.skillId, input.toolHash),
      ),
      discardDraft: authed.agentSkills.discardDraft.handler(async ({ context, input }) =>
        agentSkills.discardDraft(context.actor, input.skillId),
      ),
      forBot: authed.agentSkills.forBot.handler(async ({ context, input }) =>
        agentSkills.forBot(context.actor, input.botId),
      ),
      setEnabled: authed.agentSkills.setEnabled.handler(async ({ context, input }) =>
        agentSkills.setEnabled(context.actor, input),
      ),
      importFromUrl: authed.agentSkills.importFromUrl.handler(async ({ context, input }) =>
        agentSkills.importFromUrl(context.actor, input),
      ),
    },
    capabilities: {
      list: authed.capabilities.list.handler(async ({ context }) => {
        const agentDeps = sourceAgentDeps(context.actor);
        // Sources connected before they had agents get theirs here, once; best effort.
        await provisionMissingSourceAgents(agentDeps, context.actor).catch(() => undefined);
        return listCapabilities(agentDeps, context.actor);
      }),
      catalogSearch: authed.capabilities.catalogSearch.handler(async ({ context, input }) => {
        const baseUrl =
          deps.env.integrationsCatalogUrl ??
          (input.usePublicCatalog ? "https://integrations.sh" : undefined);
        if (!baseUrl) return { enabled: false, results: [] };
        try {
          const results = await searchIntegrationCatalog({
            baseUrl,
            query: input.query,
            signal: context.signal ?? new AbortController().signal,
            fetch: deps.remoteConnectors?.fetch,
          });
          return { enabled: true, results };
        } catch (error) {
          throw new ORPCError("BAD_GATEWAY", {
            message: error instanceof Error ? error.message : "Integration catalog search failed",
          });
        }
      }),
      install: authed.capabilities.install.handler(async ({ context, input }) => {
        let source = input.source.trim();
        let config = input.config;
        const credential = input.credential?.trim() || undefined;
        if (
          credential &&
          credential.length >= 8 &&
          (source.includes(credential) || containsSecret(config, [credential]))
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Put credentials only in the encrypted credential field",
          });
        }
        if (JSON.stringify(config).length > 2_000_000) {
          throw new ORPCError("BAD_REQUEST", { message: "Capability configuration is too large" });
        }
        if (
          credential &&
          input.kind !== "mcp" &&
          input.kind !== "api" &&
          input.kind !== "graphql"
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Credentials are only accepted for MCP, API, and GraphQL tool sources",
          });
        }
        try {
          if (input.kind === "mcp") {
            if (config.preset === "treg") {
              source = "https://treg.to/mcp/";
              config = { ...config, preset: "treg", auth: { type: "bearer" } };
            }
            const verified = await verifyMcpInstall({
              source,
              config,
              credential,
              signal: context.signal,
              remote: deps.remoteConnectors,
              allowPrivateEndpoint: mayUsePrivateEndpoint(context.actor, deps),
            });
            config = verified.config;
          }
          if (input.kind === "api") {
            const prepared = await prepareApiInstall({
              source,
              config,
              credential,
              signal: context.signal,
              remote: deps.remoteConnectors,
              allowPrivateEndpoint: mayUsePrivateEndpoint(context.actor, deps),
            });
            source = prepared.source;
            config = prepared.config;
          }
          if (input.kind === "graphql") {
            const prepared = await prepareGraphqlInstall({
              source,
              config,
              credential,
              signal: context.signal,
              remote: deps.remoteConnectors,
              allowPrivateEndpoint: mayUsePrivateEndpoint(context.actor, deps),
            });
            source = prepared.source;
            config = prepared.config;
          }
        } catch (error) {
          const message = sanitizeComposioError(error);
          throw new ORPCError("BAD_REQUEST", {
            message: credential ? message.split(credential).join("[redacted]") : message,
          });
        }
        const stored = credential
          ? await deps.secrets.put(credential, {
              operationId: "capabilities.install",
              traceId: "capabilities.install",
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              signal: context.signal ?? new AbortController().signal,
            })
          : undefined;
        const digest = `sha256:${createHash("sha256")
          .update(JSON.stringify({ kind: input.kind, source, config }))
          .digest("hex")}`;
        const row = await deps.prisma.$transaction(async (tx) => {
          if (stored) {
            await tx.secret.create({
              data: {
                id: stored.id,
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
                kind: "connector",
                ciphertext: stored.ciphertext,
              },
            });
          }
          return tx.capabilityInstall.create({
            data: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              kind: input.kind,
              name: input.name.trim(),
              source,
              secretId: stored?.id,
              config: config as Prisma.InputJsonValue,
              digest,
              version: "1.0.0",
            },
          });
        });
        // The source gets its own agent, private to it; a failure leaves Create agent as the repair.
        if (row.kind === "mcp" || row.kind === "api" || row.kind === "graphql")
          await provisionSourceAgent(sourceAgentDeps(context.actor), context.actor, row.id);
        return oneCapability(context.actor, row.id);
      }),
      remove: authed.capabilities.remove.handler(async ({ context, input }) => {
        let agentToArchive: string | null = null;
        await deps.prisma.$transaction(async (tx) => {
          // Locked first, so provisioning cannot link an agent between this read and the delete.
          await tx.$queryRaw`SELECT id FROM capability_installs WHERE id = ${input.id} AND "spaceId" = ${context.actor.spaceId} AND "userId" = ${context.actor.userId} FOR UPDATE`;
          const existing = await tx.capabilityInstall.findFirst({
            where: {
              id: input.id,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
            },
          });
          if (!existing) return;
          agentToArchive = existing.agentBotId;
          await tx.capabilityInstall.delete({ where: { id: existing.id } });
          if (existing.secretId) {
            const shared = await tx.capabilityInstall.count({
              where: { secretId: existing.secretId },
            });
            if (shared === 0) {
              await tx.secret.deleteMany({
                where: {
                  id: existing.secretId,
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                },
              });
            }
          }
        });
        // A source's own agent goes with it, archived once the removal committed.
        if (agentToArchive)
          await archiveActorBot(context.actor, agentToArchive).catch((error) =>
            getLogger().error("source agent archive failed", error),
          );
        return { ok: true as const };
      }),
      createAgent: authed.capabilities.createAgent.handler(async ({ context, input }) => {
        const { bot } = await ensureSourceAgent(
          sourceAgentDeps(context.actor),
          context.actor,
          input.id,
        );
        return { botId: bot.id };
      }),
      rename: authed.capabilities.rename.handler(async ({ context, input }) => {
        await renameSource(deps.prisma, context.actor, input.id, input.name);
        return oneCapability(context.actor, input.id);
      }),
      setWrites: authed.capabilities.setWrites.handler(async ({ context, input }) => {
        await setSourceWrites(deps.prisma, context.actor, input.id, input.enabled);
        return oneCapability(context.actor, input.id);
      }),
      setExclusive: authed.capabilities.setExclusive.handler(async ({ context, input }) => {
        await setSourceExclusive(deps.prisma, context.actor, input.id, input.exclusive);
        return oneCapability(context.actor, input.id);
      }),
      setAllAgents: authed.capabilities.setAllAgents.handler(async ({ context, input }) => {
        await setSourceAllAgents(deps.prisma, context.actor, input.id, input.on);
        return oneCapability(context.actor, input.id);
      }),
      setAgentAccess: authed.capabilities.setAgentAccess.handler(async ({ context, input }) => {
        await setSourceAgentAccess(deps.prisma, context.actor, input);
        return oneCapability(context.actor, input.id);
      }),
    },
    integrationAgents: {
      create: authed.integrationAgents.create.handler(async ({ context, input }) => {
        const { server, bot } = await ensureIntegrationAgent(
          {
            prisma: deps.prisma,
            repos,
            archiveBot: (botId) => archiveActorBot(context.actor, botId),
          },
          context.actor,
          input.serverId,
        );
        return {
          server: mcpServerDto(server, await mcpOAuth.statusFor(server, context.actor)),
          botId: bot.id,
        };
      }),
      setExclusive: authed.integrationAgents.setExclusive.handler(async ({ context, input }) => {
        const row = await setIntegrationExclusive(
          deps.prisma,
          context.actor,
          input.serverId,
          input.exclusive,
        );
        return mcpServerDto(row, await mcpOAuth.statusFor(row, context.actor));
      }),
    },
    mcp: {
      servers: {
        list: authed.mcp.servers.list.handler(async ({ context }) => {
          const rows = await deps.prisma.mcpServer.findMany({
            where: { spaceId: context.actor.spaceId, userId: context.actor.userId },
            orderBy: [{ name: "asc" }, { createdAt: "asc" }],
          });
          const secretIds = rows.flatMap((row) => (row.secretId ? [row.secretId] : []));
          const secrets = secretIds.length
            ? await deps.prisma.secret.findMany({
                where: {
                  id: { in: secretIds },
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                },
                select: { id: true, ciphertext: true },
              })
            : [];
          const ciphertextById = new Map(secrets.map((secret) => [secret.id, secret.ciphertext]));
          const open = await deps.prisma.mcpOAuthSession.findMany({
            where: { spaceId: context.actor.spaceId, userId: context.actor.userId },
            select: { serverId: true },
          });
          const attempted = new Set(open.map((session) => session.serverId));
          return Promise.all(
            rows.map(async (row) =>
              mcpServerDto(
                row,
                await mcpOAuth.statusForCiphertext(
                  row.secretId ? ciphertextById.get(row.secretId) : undefined,
                  row.secretId ?? undefined,
                ),
                attempted.has(row.id),
              ),
            ),
          );
        }),
        create: authed.mcp.servers.create.handler(async ({ context, input }) => {
          if (input.transport === "stdio") assertMcpStdioCommand(input.command, deps);
          await assertMcpRemoteEndpoint(
            "endpoint" in input ? input.endpoint : null,
            context.actor,
            deps,
          );
          await assertNoOtherDevinConnection(deps.prisma, context.actor, {
            endpoint: "endpoint" in input ? input.endpoint : null,
            enabled: input.enabled,
          });
          const secretPayload = buildMcpCredentialBlob(input);
          const stored = secretPayload
            ? await deps.secrets.put(
                secretPayload,
                computerContext(context.actor, "mcp", "mcp.create"),
              )
            : null;
          const row = await deps.prisma
            .$transaction(async (tx) => {
              if (stored) {
                await tx.secret.create({
                  data: {
                    id: stored.id,
                    userId: context.actor.userId,
                    spaceId: context.actor.spaceId,
                    kind: "mcp",
                    ciphertext: stored.ciphertext,
                  },
                });
              }
              return tx.mcpServer.create({
                data: {
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                  slug: input.slug,
                  name: input.name,
                  description: input.description,
                  transport: input.transport,
                  endpoint: "endpoint" in input ? input.endpoint : null,
                  command: "command" in input ? input.command : null,
                  args: ("args" in input ? input.args : []) as Prisma.InputJsonValue,
                  env: ("env" in input
                    ? Object.fromEntries(Object.keys(input.env).map((key) => [key, true]))
                    : {}) as Prisma.InputJsonValue,
                  headers: ("headers" in input
                    ? Object.fromEntries(Object.keys(input.headers).map((key) => [key, true]))
                    : {}) as Prisma.InputJsonValue,
                  secretId: stored?.id,
                  enabled: input.enabled,
                },
              });
            })
            .catch((error: unknown) => {
              // The slug comes from the name, so this is a second server with the same name.
              if (isUniqueViolation(error)) {
                throw new ORPCError("CONFLICT", {
                  message: "An MCP server with that name already exists.",
                });
              }
              throw error;
            });
          // An existing Carta agent gets a newly added Carta server, with read tools only.
          if (isCartaEndpoint(row.endpoint))
            await assignToExistingCartaAgent(deps.prisma, context.actor);
          // A service only its own agent may use (Devin) gets that agent now, after its key is
          // checked, so the first tool call already works and a rejected key leaves nothing behind.
          if (!isCartaEndpoint(row.endpoint)) {
            const preset = integrationPresetForEndpoint(row.endpoint);
            if (preset?.requiresAgent && !isZernioEndpoint(row.endpoint) && deps.mcp) {
              try {
                await deps.mcp.listServerTools(
                  row,
                  computerContext(context.actor, "mcp", "mcp.create"),
                  { fresh: true },
                );
              } catch {
                await deps.prisma.mcpServer.deleteMany({
                  where: { id: row.id, ...actorScope(context.actor) },
                });
                if (stored)
                  await deps.prisma.secret.deleteMany({
                    where: { id: stored.id, ...actorScope(context.actor) },
                  });
                throw new ORPCError("BAD_REQUEST", {
                  message: `Could not connect to ${preset.service}. Check the API key and try again.`,
                });
              }
            }
            // Every other new server gets its agent too, best-effort: a failure keeps the server
            // and Create agent stays the repair path. Only Devin must have one.
            try {
              const { server: linked } = await provisionExclusiveAgent(context.actor, row.id);
              return mcpServerDto(linked, await mcpOAuth.statusFor(linked, context.actor));
            } catch (error) {
              if (preset?.requiresAgent) throw error;
              getLogger().error("mcp.servers.create: agent not provisioned", error);
            }
          }
          return mcpServerDto(row, await mcpOAuth.statusFor(row, context.actor));
        }),
        update: authed.mcp.servers.update.handler(async ({ context, input }) => {
          // The Brex cards token changes only through Replace token, which checks it with Brex
          // first, and only for the current space owner.
          const brexRow = await deps.prisma.mcpServer.findFirst({
            where: { id: input.id, ...actorScope(context.actor) },
            select: { endpoint: true },
          });
          if (isBrexCardsEndpoint(brexRow?.endpoint)) {
            await requireSpaceOwner(deps.prisma, context.actor);
            throw new ORPCError("BAD_REQUEST", { message: REPLACE_BREX_TOKEN_MESSAGE });
          }
          // The space's Devin connection is an owner's to change, and its key only through Reconnect.
          if (await requireOwnerForActiveDevinRow(deps.prisma, context.actor, input.id)) {
            const next = "config" in input ? input.config : input;
            if (
              ("secret" in next && next.secret) ||
              ("clearCredential" in next && next.clearCredential)
            )
              throw new ORPCError("BAD_REQUEST", { message: RECONNECT_DEVIN_MESSAGE });
          }
          for (let attempt = 0; attempt < 5; attempt++) {
            const { existing, existingSecret } = await deps.prisma.$transaction(async (tx) => {
              const existing = await tx.mcpServer.findFirst({
                where: {
                  id: input.id,
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                },
              });
              if (!existing) throw new IsolationError();
              const existingSecret = existing.secretId
                ? await tx.secret.findFirst({
                    where: {
                      id: existing.secretId,
                      spaceId: context.actor.spaceId,
                      userId: context.actor.userId,
                    },
                  })
                : null;
              return { existing, existingSecret };
            });
            let existingMaterial: Record<string, unknown> = {};
            if (existingSecret) {
              try {
                const value = JSON.parse(
                  await deps.secrets.load(existingSecret.ciphertext, existingSecret.id),
                );
                if (value && typeof value === "object" && !Array.isArray(value))
                  existingMaterial = value as Record<string, unknown>;
              } catch {
                /* Existing malformed secrets are replaced only when new credentials are supplied. */
              }
            }
            const config =
              "config" in input
                ? input.config
                : {
                    slug: existing.slug,
                    name: existing.name,
                    description: existing.description,
                    enabled: existing.enabled,
                    transport: existing.transport as "streamable_http" | "sse",
                    endpoint: existing.endpoint!,
                    headers: (existingMaterial.headers ?? {}) as Record<string, string>,
                    secret: input.secret,
                  };
            if (!("config" in input) && existing.transport === "stdio") {
              throw new ORPCError("BAD_REQUEST", { message: "A remote MCP server is required" });
            }
            if (config.transport === "stdio") assertMcpStdioCommand(config.command, deps);
            const nextEndpoint = "endpoint" in config ? config.endpoint : null;
            if (existing.endpoint !== nextEndpoint) {
              await assertMcpRemoteEndpoint(nextEndpoint, context.actor, deps);
            }
            await assertNoOtherDevinConnection(
              deps.prisma,
              context.actor,
              { endpoint: nextEndpoint, enabled: config.enabled },
              existing.id,
            );
            const update = buildMcpUpdateMaterial(existingMaterial, config, {
              clearOAuth: existing.endpoint !== nextEndpoint,
              // A stored key belongs to one host: a new origin gets only credentials sent with it.
              clearStatic: mcpOrigin(existing.endpoint) !== mcpOrigin(nextEndpoint),
            });
            const stored =
              update.action === "store" && Object.keys(update.material).length > 0
                ? await deps.secrets.put(
                    JSON.stringify(update.material),
                    computerContext(context.actor, "mcp", "mcp.update"),
                  )
                : null;
            const clearing = update.action === "store" && Object.keys(update.material).length === 0;
            const row = await persistPreparedSecret(
              deps.prisma,
              deps.secrets,
              stored ?? undefined,
              () =>
                deps.prisma.$transaction(async (tx) => {
                  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('mcp-oauth-material'), hashtext(${input.id}))`;
                  const current = await tx.mcpServer.findFirst({
                    where: {
                      id: input.id,
                      spaceId: context.actor.spaceId,
                      userId: context.actor.userId,
                    },
                  });
                  if (!current) throw new IsolationError();
                  if (
                    current.revision !== existing.revision ||
                    current.secretId !== existing.secretId ||
                    current.endpoint !== existing.endpoint
                  )
                    return null;
                  if (current.secretId)
                    await tx.$queryRaw`SELECT id FROM secrets WHERE id = ${current.secretId} FOR UPDATE`;
                  const secret = current.secretId
                    ? await tx.secret.findFirst({
                        where: {
                          id: current.secretId,
                          spaceId: context.actor.spaceId,
                          userId: context.actor.userId,
                        },
                      })
                    : null;
                  if (secret?.ciphertext !== existingSecret?.ciphertext) return null;
                  if (stored) {
                    await tx.secret.create({
                      data: {
                        id: stored.id,
                        userId: context.actor.userId,
                        spaceId: context.actor.spaceId,
                        kind: "mcp",
                        ciphertext: stored.ciphertext,
                      },
                    });
                  }
                  const updated = await tx.mcpServer.update({
                    where: { id: existing.id },
                    data: {
                      slug: config.slug,
                      name: config.name,
                      description: config.description,
                      transport: config.transport,
                      endpoint: nextEndpoint,
                      command: "command" in config ? config.command : null,
                      args: ("args" in config ? config.args : []) as Prisma.InputJsonValue,
                      env: ("env" in config
                        ? Object.fromEntries(Object.keys(config.env).map((key) => [key, true]))
                        : {}) as Prisma.InputJsonValue,
                      headers: ("headers" in config
                        ? Object.fromEntries(Object.keys(config.headers).map((key) => [key, true]))
                        : {}) as Prisma.InputJsonValue,
                      enabled: config.enabled,
                      revision: { increment: 1 },
                      // A server that moves to another endpoint is no longer the one its agent works with.
                      ...(current.endpoint !== nextEndpoint && current.agentBotId
                        ? { agentBotId: null, agentExclusive: false, writesEnabled: false }
                        : {}),
                      ...(stored ? { secretId: stored.id } : clearing ? { secretId: null } : {}),
                    },
                  });
                  if ((stored || clearing) && existing.secretId)
                    await tx.secret.deleteMany({
                      where: {
                        id: existing.secretId,
                        spaceId: context.actor.spaceId,
                        userId: context.actor.userId,
                      },
                    });
                  return updated;
                }),
            );
            if (row) {
              if (isCartaEndpoint(row.endpoint))
                await assignToExistingCartaAgent(deps.prisma, context.actor);
              else if (isCartaEndpoint(existing.endpoint))
                await deps.prisma.botMcpServer.deleteMany({
                  where: { serverId: row.id, ...actorScope(context.actor) },
                });
              if (
                isZernioEndpoint(existing.endpoint) &&
                existing.endpoint !== row.endpoint &&
                existing.agentBotId
              )
                await deps.prisma.botMcpServer.deleteMany({
                  where: {
                    serverId: row.id,
                    botId: existing.agentBotId,
                    ...actorScope(context.actor),
                  },
                });
              // The released agent belongs to the old service (spawn key per server id): archive it so
              // Create agent makes a fresh one for the new service.
              if (
                existing.agentBotId &&
                !row.agentBotId &&
                existing.endpoint !== row.endpoint &&
                !isZernioEndpoint(existing.endpoint)
              )
                await archiveActorBot(context.actor, existing.agentBotId);
              if (isZernioEndpoint(row.endpoint)) {
                const bot = await ensureGtmBot({ prisma: deps.prisma, repos }, context.actor);
                const linked = await deps.prisma.mcpServer.findFirst({
                  where: { id: row.id, ...actorScope(context.actor) },
                });
                if (!linked || linked.endpoint !== row.endpoint || linked.agentBotId !== bot.id)
                  throw new ORPCError("CONFLICT", {
                    message: "The Zernio integration changed; retry",
                  });
                return mcpServerDto(linked, await mcpOAuth.statusFor(linked, context.actor));
              }
              return mcpServerDto(row, await mcpOAuth.statusFor(row, context.actor));
            }
          }
          throw new ORPCError("CONFLICT", { message: "MCP credentials changed; retry" });
        }),
        rename: authed.mcp.servers.rename.handler(async ({ context, input }) => {
          const where = {
            id: input.id,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          };
          const { count } = await deps.prisma.mcpServer.updateMany({
            where,
            data: { name: input.name },
          });
          const row = count ? await deps.prisma.mcpServer.findFirst({ where }) : null;
          if (!row) throw new IsolationError();
          return mcpServerDto(row, await mcpOAuth.statusFor(row, context.actor));
        }),
        setAgentAssignment: authed.mcp.servers.setAgentAssignment.handler(
          async ({ context, input }) => {
            const { actor } = context;
            const seqs = await deps.prisma.$transaction(async (tx) => {
              // Server row first, so concurrent changes to one server queue up.
              await tx.$queryRaw`SELECT id FROM mcp_servers WHERE id = ${input.serverId} AND "spaceId" = ${actor.spaceId} AND "userId" = ${actor.userId} FOR UPDATE`;
              const server = await tx.mcpServer.findFirst({
                where: { id: input.serverId, spaceId: actor.spaceId, userId: actor.userId },
                select: { id: true, agentBotId: true, agentExclusive: true },
              });
              const bot = await tx.bot.findFirst({
                where: { id: input.botId, spaceId: actor.spaceId, userId: actor.userId },
                select: { id: true },
              });
              if (!server || !bot) throw new IsolationError();
              const exclusiveOther =
                server.agentExclusive && server.agentBotId !== null && server.agentBotId !== bot.id;
              if (input.on) {
                if (exclusiveOther)
                  throw new ORPCError("BAD_REQUEST", { message: EXCLUSIVE_SERVER_MESSAGE });
                await tx.botMcpServer.createMany({
                  data: [
                    {
                      spaceId: actor.spaceId,
                      userId: actor.userId,
                      botId: bot.id,
                      serverId: server.id,
                      allowAllTools: true,
                      allowedTools: [] as Prisma.InputJsonValue,
                    },
                  ],
                  skipDuplicates: true,
                });
                return [];
              }
              // The server's own agent keeps it; an exclusive server's rows for others are kept as saved.
              if (server.agentBotId === bot.id || exclusiveOther) return [];
              const removed = await tx.botMcpServer.deleteMany({
                where: {
                  botId: bot.id,
                  serverId: server.id,
                  spaceId: actor.spaceId,
                  userId: actor.userId,
                },
              });
              if (!removed.count) return [];
              return revertConnectedMcpApprovals(
                onboardingDeps,
                actor,
                { botId: bot.id, serverId: server.id, status: "pending" },
                tx,
              );
            });
            for (const event of seqs) await deps.events.notify(event.threadId, event.seq);
            return { ok: true as const };
          },
        ),
        setWrites: authed.mcp.servers.setWrites.handler(async ({ context, input }) => {
          const row = await setIntegrationAgentWrites(
            deps.prisma,
            context.actor,
            input.id,
            input.enabled,
          );
          // The Carta agent's tool list follows the switch; the call-time check already does.
          if (isCartaEndpoint(row.endpoint))
            await assignToExistingCartaAgent(deps.prisma, context.actor);
          return mcpServerDto(row, await mcpOAuth.statusFor(row, context.actor));
        }),
        remove: authed.mcp.servers.remove.handler(async ({ context, input }) => {
          if (await requireOwnerForActiveDevinRow(deps.prisma, context.actor, input.id)) {
            await devinDisconnect(devinDeps, context.actor, input.id);
            return { ok: true as const };
          }
          // The current space owner removes a Brex cards server whoever connected it; its rows are
          // in the connecting user's scope. A former owner who still owns the row is refused.
          const brexRow = await deps.prisma.mcpServer.findFirst({
            where: { id: input.id, spaceId: context.actor.spaceId },
            select: { endpoint: true, userId: true },
          });
          let actor: Actor = context.actor;
          if (isBrexCardsEndpoint(brexRow?.endpoint)) {
            await requireSpaceOwner(deps.prisma, context.actor);
            actor = { ...context.actor, userId: brexRow?.userId as string };
          }
          const server = await deps.prisma.mcpServer.findFirst({
            where: {
              id: input.id,
              spaceId: actor.spaceId,
              userId: actor.userId,
            },
            select: { id: true, secretId: true },
          });
          if (!server) throw new IsolationError();
          // Assignments cascade; the encrypted credential must go with the server.
          // Cards are closed first, including ones that were never assigned.
          let agentToArchive: string | null = null;
          const seqs = await deps.prisma.$transaction(async (tx) => {
            const painted = await dismissMcpServerApprovals(onboardingDeps, actor, server.id, tx);
            await companyWriter(tx, actor).disconnectMcpServer(server.id);
            // The deleted row says which agent it had at that moment, so a concurrent relink is seen.
            const deleted = await tx.mcpServer.delete({ where: { id: server.id } });
            // Carta's agent is shared with the Cap table, and the Granola agent with the API key.
            agentToArchive =
              deleted.agentBotId &&
              !isCartaEndpoint(deleted.endpoint) &&
              !isGranolaEndpoint(deleted.endpoint) &&
              !isZernioEndpoint(deleted.endpoint)
                ? deleted.agentBotId
                : null;
            // An agent that another server of the space still uses (the Brex finance and cards
            // servers share one) stays with that server.
            if (
              agentToArchive &&
              (await tx.mcpServer.count({
                where: { spaceId: actor.spaceId, agentBotId: agentToArchive },
              }))
            )
              agentToArchive = null;
            // Archived with the server, so the agent is never left active without it.
            if (agentToArchive)
              await tx.bot.updateMany({
                where: { id: agentToArchive, ...actorScope(actor), archivedAt: null },
                data: { archivedAt: new Date(), pinned: false },
              });
            if (server.secretId) {
              await tx.secret.deleteMany({
                where: {
                  id: server.secretId,
                  spaceId: actor.spaceId,
                  userId: actor.userId,
                },
              });
            }
            return painted;
          });
          // Runs and the computer of the archived agent are cleaned up now; the archive itself is done.
          if (agentToArchive)
            await archiveActorBot(actor, agentToArchive).catch((error) =>
              getLogger().error("mcp.servers.remove: agent not archived", error),
            );
          for (const event of seqs) await deps.events.notify(event.threadId, event.seq);
          return { ok: true as const };
        }),
      },
      assignments: {
        all: authed.mcp.assignments.all.handler(async ({ context }) => {
          const rows = await deps.prisma.botMcpServer.findMany({
            where: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              bot: { archivedAt: null },
            },
            orderBy: { createdAt: "asc" },
          });
          return rows.map(mcpAssignmentDto);
        }),
        list: authed.mcp.assignments.list.handler(async ({ context, input }) => {
          const bot = await deps.prisma.bot.findFirst({
            where: {
              id: input.botId,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
            },
            select: { id: true },
          });
          if (!bot) throw new IsolationError();
          const rows = await deps.prisma.botMcpServer.findMany({
            where: {
              botId: bot.id,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
            },
            orderBy: { createdAt: "asc" },
          });
          return rows.map(mcpAssignmentDto);
        }),
        approve: authed.mcp.assignments.approve.handler(async ({ context, input }) => {
          const row = await resolveMcpApprovalCards(
            onboardingDeps,
            context.actor,
            {
              botId: input.botId,
              serverId: input.serverId,
              status: "connected",
              threadId: input.threadId,
            },
            async (tx, decision) => {
              if (!decision.assign) throw new IsolationError();
              const [bot, server] = await Promise.all([
                tx.bot.findFirst({
                  where: {
                    id: input.botId,
                    spaceId: context.actor.spaceId,
                    userId: context.actor.userId,
                  },
                  select: { id: true, spawnKey: true },
                }),
                tx.mcpServer.findFirst({
                  where: {
                    id: input.serverId,
                    spaceId: context.actor.spaceId,
                    userId: context.actor.userId,
                    enabled: true,
                  },
                  select: { id: true, endpoint: true, agentBotId: true, agentExclusive: true },
                }),
              ]);
              if (!bot || !server) throw new IsolationError();
              if (server.agentExclusive && server.agentBotId !== bot.id)
                throw new ORPCError("BAD_REQUEST", { message: EXCLUSIVE_SERVER_MESSAGE });
              return tx.botMcpServer.upsert({
                where: { botId_serverId: { botId: bot.id, serverId: server.id } },
                create: {
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                  botId: bot.id,
                  serverId: server.id,
                  allowAllTools: true,
                  allowedTools: [],
                },
                update: {},
              });
            },
          );
          if (!row) throw new IsolationError();
          return mcpAssignmentDto(row);
        }),
        dismiss: authed.mcp.assignments.dismiss.handler(async ({ context, input }) => {
          // Not now resolves the card only. Assignments are never touched
          // here: a stale card must not delete a live connection, and server
          // removal belongs to the MCP settings surface.
          await resolveMcpApprovalCards(onboardingDeps, context.actor, {
            botId: input.botId,
            serverId: input.serverId,
            status: "dismissed",
            threadId: input.threadId,
          });
          return { ok: true as const };
        }),
        replace: authed.mcp.assignments.replace.handler(async ({ context, input }) => {
          const { rows, seqs } = await deps.prisma.$transaction(async (tx) => {
            const bot = await tx.bot.findFirst({
              where: {
                id: input.botId,
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
              },
              select: { id: true, spawnKey: true },
            });
            if (!bot) throw new IsolationError();
            const servers = await tx.mcpServer.findMany({
              where: {
                id: { in: input.assignments.map((assignment) => assignment.serverId) },
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
              },
              select: { id: true, endpoint: true },
            });
            if (servers.length !== input.assignments.length) throw new IsolationError();
            // Exclusive servers of other bots: never newly granted, and their saved rows are kept
            // (hidden from this bot's list) so turning exclusivity off restores the sharing.
            const exclusiveOthers = (
              await tx.mcpServer.findMany({
                where: {
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                  agentExclusive: true,
                  agentBotId: { not: bot.id },
                },
                select: { id: true },
              })
            ).map((server) => server.id);
            const previous = await tx.botMcpServer.findMany({
              where: {
                botId: bot.id,
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
              },
              select: { serverId: true },
            });
            if (
              input.assignments.some(
                (assignment) =>
                  exclusiveOthers.includes(assignment.serverId) &&
                  !previous.some((row) => row.serverId === assignment.serverId),
              )
            )
              throw new ORPCError("BAD_REQUEST", { message: EXCLUSIVE_SERVER_MESSAGE });
            const nextIds = new Set(input.assignments.map((assignment) => assignment.serverId));
            const removed = previous
              .map((row) => row.serverId)
              .filter((serverId) => !nextIds.has(serverId) && !exclusiveOthers.includes(serverId));
            await tx.botMcpServer.deleteMany({
              where: {
                botId: bot.id,
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
                serverId: { notIn: exclusiveOthers },
                // Exclusivity can turn on after the read above: the delete itself spares such rows.
                server: { OR: [{ agentExclusive: false }, { agentBotId: bot.id }] },
              },
            });
            const kept = input.assignments.filter(
              (assignment) => !exclusiveOthers.includes(assignment.serverId),
            );
            if (kept.length)
              await tx.botMcpServer.createMany({
                data: kept.map((assignment) => ({
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                  botId: bot.id,
                  serverId: assignment.serverId,
                  allowAllTools: assignment.allowAllTools,
                  allowedTools: assignment.allowedTools as Prisma.InputJsonValue,
                })),
                skipDuplicates: true,
              });
            const seqs = (
              await Promise.all(
                removed.map((serverId) =>
                  revertConnectedMcpApprovals(
                    onboardingDeps,
                    context.actor,
                    { botId: bot.id, serverId, status: "pending" },
                    tx,
                  ),
                ),
              )
            ).flat();
            const rows = await tx.botMcpServer.findMany({
              where: {
                botId: bot.id,
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
              },
              orderBy: { createdAt: "asc" },
            });
            return { rows, seqs };
          });
          for (const event of seqs) await deps.events.notify(event.threadId, event.seq);
          return rows.map(mcpAssignmentDto);
        }),
      },
      oauth: {
        begin: authed.mcp.oauth.begin.handler(async ({ context, input }) => {
          try {
            return await beginMcpOAuth(
              {
                ...input,
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
              },
              context.requestHeaders,
            );
          } catch (error) {
            throw new ORPCError("BAD_REQUEST", {
              message: error instanceof Error ? error.message : "Could not start MCP OAuth",
            });
          }
        }),
        complete: authed.mcp.oauth.complete.handler(async ({ context, input }) => {
          try {
            // The session is consumed by complete(), so read which server it signs in first.
            const session = await deps.prisma.mcpOAuthSession.findFirst({
              where: { id: input.sessionId, ...actorScope(context.actor) },
              select: { serverId: true },
            });
            await mcpOAuth.complete({
              ...input,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
            });
            if (session) {
              await onMcpServerConnected(cartaSyncDeps, context.actor, session.serverId);
              await onFinanceServerReconnected(financeDeps, context.actor, session.serverId);
            }
            return { ok: true as const };
          } catch (error) {
            throw new ORPCError("BAD_REQUEST", {
              message: error instanceof Error ? error.message : "Could not complete MCP OAuth",
            });
          }
        }),
        disconnect: authed.mcp.oauth.disconnect.handler(async ({ context, input }) => {
          await mcpOAuth.disconnect({
            ...input,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          });
          return { ok: true as const };
        }),
      },
    },
    onboarding: {
      start: authed.onboarding.start.handler(async ({ context, input }) => {
        await startOnboarding(onboardingDeps, context.actor, input.botId);
        return { ok: true as const };
      }),
      promptFocus: authed.onboarding.promptFocus.handler(async ({ context, input }) => {
        await promptFocus(onboardingDeps, context.actor, input.botId);
        return { ok: true as const };
      }),
      choose: authed.onboarding.choose.handler(async ({ context, input }) => {
        // A new bot's setup question: the pick is the user's first message, so the bot sets itself up
        // from it exactly as it does when they type. Sending closes the card.
        const setup = SETUP_OPTIONS.find((option) => option.id === input.optionId);
        if (setup) {
          if ((await modelSetup(deps, context.actor)).needsModel) {
            throw new ORPCError("BAD_REQUEST", { message: "Connect a model to start a run." });
          }
          const target = await resolveThreadTarget(deps.prisma, context.actor, {
            botId: input.botId,
          });
          await sendThreadMessage(deps, context.actor, target, { text: setup.label });
          return { ok: true as const };
        }
        await chooseFocus(onboardingDeps, context.actor, input.botId, input.optionId);
        return { ok: true as const };
      }),
      dismissFocus: authed.onboarding.dismissFocus.handler(async ({ context, input }) => {
        await dismissFocus(onboardingDeps, context.actor, input.botId);
        return { ok: true as const };
      }),
      appConnected: authed.onboarding.appConnected.handler(async ({ context, input }) => {
        await markAppConnected(
          onboardingDeps,
          context.actor,
          input.botId,
          input.provider,
          input.connectorId,
        );
        return { ok: true as const };
      }),
    },
    integrationSetup: {
      get: authed.integrationSetup.get.handler(async ({ context }) => {
        const canConfigure = context.actor.isDeploymentOwner;
        const providers = canConfigure
          ? await Promise.all(
              IntegrationProviderIdSchema.options.map(async (id) => ({
                id,
                configured: deps.integrationSettings
                  ? await deps.integrationSettings.configured(id)
                  : Boolean(deps.connectors.managed(id)),
              })),
            )
          : [];
        return {
          canConfigure,
          needsSetup: canConfigure && !providers.some((provider) => provider.configured),
          webUrl: new URL("/integrations/setup", deps.env.webOrigin).toString(),
          providers,
        };
      }),
      save: authed.integrationSetup.save.handler(async ({ context, input }) => {
        if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
        if (!deps.integrationSettings) throw new ORPCError("NOT_IMPLEMENTED");
        try {
          await deps.integrationSettings.save(
            input,
            connectionContext(context.actor, "integrationSetup.save", context.signal),
          );
        } catch {
          throw new ORPCError("BAD_REQUEST", {
            message: "Could not verify or save these credentials",
          });
        }
        return { ok: true as const };
      }),
    },
    messagingSetup: {
      get: authed.messagingSetup.get.handler(async ({ context }) => {
        const canConfigure = context.actor.isDeploymentOwner;
        return {
          canConfigure,
          providers:
            canConfigure && deps.messagingSettings
              ? await deps.messagingSettings.state(deps.messaging?.providers ?? [])
              : [],
        };
      }),
      save: authed.messagingSetup.save.handler(async ({ context, input }) => {
        if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
        if (!deps.messagingSettings) throw new ORPCError("NOT_IMPLEMENTED");
        try {
          await deps.messagingSettings.save(
            input,
            connectionContext(context.actor, "messagingSetup.save", context.signal),
          );
        } catch (error) {
          throw new ORPCError("BAD_REQUEST", {
            message: error instanceof Error ? error.message : "Could not save these settings",
          });
        }
        return { ok: true as const };
      }),
      test: authed.messagingSetup.test.handler(async ({ context, input }) => {
        if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
        if (!deps.messagingSettings) throw new ORPCError("NOT_IMPLEMENTED");
        return deps.messagingSettings.test(input.provider);
      }),
    },
    connections: {
      catalog: authed.connections.catalog.handler(async ({ context, input }) => {
        const adapterContext = connectionContext(
          context.actor,
          "connections.catalog",
          context.signal,
        );
        const providers = input.connectorId
          ? [deps.connectors.managed(input.connectorId)].filter(
              (provider): provider is NonNullable<typeof provider> => Boolean(provider),
            )
          : deps.connectors.managedProviders();
        const catalogs = await Promise.all(
          providers.map(async (provider): Promise<ConnectorCatalogItem[]> => {
            try {
              const items = await provider.catalog(adapterContext, input.query);
              const nowConnected = items.filter((item) => item.connected).map((item) => item.slug);
              if (nowConnected.length > 0) {
                await reconcilePendingConnections(
                  deps.prisma,
                  context.actor,
                  provider.describe().id,
                  nowConnected,
                ).catch((error) => {
                  getLogger().error(
                    `${provider.describe().id} pending-connection reconciliation failed`,
                    error,
                  );
                });
              }
              return items;
            } catch (error) {
              getLogger().error(`${provider.describe().id} catalog failed`, error);
              return [];
            }
          }),
        );
        return dedupeCatalogBySlug(withAppDirectory(catalogs.flat()));
      }),
      featured: authed.connections.featured.handler(async () => {
        const catalogs = await Promise.all(
          deps.connectors
            .managedProviders()
            .map(async (provider): Promise<ConnectorCatalogItem[]> => {
              try {
                const items = (await provider.catalogDirectory?.()) ?? [];
                return items
                  .filter(
                    (item) =>
                      matchFeaturedConnectorId(item.slug) !== null ||
                      matchFeaturedConnectorId(item.name) !== null,
                  )
                  .map((item) => ({ ...item, connected: false }));
              } catch (error) {
                getLogger().error(`${provider.describe().id} catalog failed`, error);
                return [];
              }
            }),
        );
        return dedupeCatalogBySlug(withAppDirectory(catalogs.flat()));
      }),
      list: authed.connections.list.handler(async ({ context }) => {
        const rows = await deps.prisma.connection.findMany({
          where: {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            status: { in: ["connected", "pending", "error"] },
            // The Granola key shows through meetings.status, never as a generic app.
            // Omi shows through omi.status.
            connectorId: {
              notIn: [
                GRANOLA_API_CONNECTOR_ID,
                OMI_CLOUD_CONNECTOR_ID,
                OMI_CONNECTOR_ID,
                HEX_CONNECTOR_ID,
              ],
            },
          },
          // Without an order Postgres returns rows in storage order, which changes when a row is
          // updated, so the accounts of one app swapped places between loads.
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: { mailSyncState: { select: { needsReconnect: true, lastErrorAt: true } } },
        });
        // Gmail accounts connected before the Inbox agent link existed join it now, once.
        const unlinked = rows.filter(
          (row) =>
            row.status === "connected" && !row.agentBotId && row.provider.toLowerCase() === "gmail",
        );
        if (unlinked.length === 0) return rows.map(connectionDto);
        for (const row of unlinked) await provisionForActor(context.actor, row.id);
        const fresh = await deps.prisma.connection.findMany({
          where: { id: { in: unlinked.map((row) => row.id) }, spaceId: context.actor.spaceId },
          select: { id: true, agentBotId: true, writesEnabled: true, allAgents: true },
        });
        const byId = new Map(fresh.map((row) => [row.id, row]));
        return rows.map((row) => connectionDto({ ...row, ...(byId.get(row.id) ?? {}) }));
      }),
      begin: authed.connections.begin.handler(async ({ context, input }) => {
        if (input.redirect === "desktop" && input.connectorId !== "google") {
          throw new ORPCError("BAD_REQUEST", { message: "Desktop sign-in is only for Google" });
        }
        if (input.permission && input.connectorId !== "google") {
          throw new ORPCError("BAD_REQUEST", { message: "This permission is only for Google" });
        }
        // Composio and Pipedream finish by polling, so their sign-in window only has to close itself.
        const returnOrigin = pickReturnOrigin(deps.env, context.requestHeaders);
        const redirectUrl =
          input.redirect === "desktop"
            ? GOOGLE_DESKTOP_REDIRECT_URI
            : input.connectorId === "composio" || input.connectorId === "pipedream"
              ? connectReturnUrl(returnOrigin, input.client)
              : `${returnOrigin}/app`;
        const connector =
          deps.integrationSettings &&
          (input.connectorId === "composio" ||
            input.connectorId === "pipedream" ||
            input.connectorId === "google")
            ? await deps.integrationSettings.resolve(input.connectorId)
            : deps.connectors.managed(input.connectorId);
        if (!connector) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Connector ${input.connectorId} is not configured`,
          });
        }
        // Share the revoke scope lock so a slug-wide remote delete cannot miss a
        // row that is inserted after SELECT FOR UPDATE and before remote revoke.
        const row = await deps.prisma.$transaction(async (tx) => {
          await lockProviderConnectionScope(tx, context.actor, input.connectorId, input.provider);
          const existing = await tx.connection.findMany({
            where: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              connectorId: input.connectorId,
              provider: input.provider,
            },
            select: {
              id: true,
              status: true,
              agentBotId: true,
              allAgents: true,
              botAccess: {
                where: { spaceId: context.actor.spaceId, userId: context.actor.userId },
                select: { botId: true },
              },
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          });
          const reusable = pickReusableConnection(existing);
          if (reusable) {
            return tx.connection.update({
              where: { id: reusable.id },
              data: {
                displayName: input.displayName,
                status: "pending",
                providerRef: null,
                metadata: {},
              },
            });
          }
          // New accounts start private; connecting gives them an agent, and sharing is opt-in.
          const created = await tx.connection.create({
            data: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              connectorId: input.connectorId,
              provider: input.provider,
              displayName: input.displayName,
              status: "pending",
              allAgents: false,
              privateByDefault: true,
            },
          });
          return created;
        });
        try {
          const auth = await connector.begin(
            {
              provider: input.provider,
              redirectUrl,
              ...(input.permission ? { permission: input.permission } : {}),
            },
            connectionContext(context.actor, "connections.begin", context.signal),
          );
          // Re-take the provider lock and only advance still-pending rows so a
          // concurrent revoke cannot be overwritten back to pending/connected.
          const applied = await deps.prisma.$transaction(async (tx) => {
            await lockProviderConnectionScope(tx, context.actor, input.connectorId, input.provider);
            const updated = await tx.connection.updateMany({
              where: {
                id: row.id,
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
                status: "pending",
              },
              data: {
                status: auth.authorizationUrl ? "pending" : "connected",
                providerRef: auth.state || null,
                // complete() must repeat the redirect_uri the authorization used.
                metadata: {
                  state: auth.state,
                  ...(input.redirect === "desktop" ? { redirectUrl } : {}),
                  ...(input.replacesConnectionId
                    ? { replacesConnectionId: input.replacesConnectionId }
                    : {}),
                },
              },
            });
            return updated.count > 0;
          });
          if (!applied) {
            // Revoke won the race. Clean up without a provider-wide slug delete.
            const state = auth.state?.trim();
            const adapterContext = connectionContext(
              context.actor,
              "connections.begin",
              context.signal,
            );
            if (state && state !== input.provider) {
              // Composio browser OAuth stores an authorization-request id in
              // auth.state. Prefer canceling that pending request by id so the
              // authorization URL cannot later create an untracked remote. The
              // request id is the connected-account nanoid (INITIATED until OAuth
              // finishes). Fall back to resolving an ACTIVE account id only when
              // cancel is unavailable.
              const cancelAuthorizationRequest = (
                connector as {
                  cancelAuthorizationRequest?: (
                    requestId: string,
                    context: typeof adapterContext,
                  ) => Promise<void>;
                }
              ).cancelAuthorizationRequest;
              if (cancelAuthorizationRequest) {
                await cancelAuthorizationRequest(state, adapterContext).catch(() => undefined);
              } else {
                const resolveAccountId = (
                  connector as {
                    resolveConnectedAccountId?: (
                      userId: string,
                      slug: string,
                      currentRef: string | null | undefined,
                      excludeIds?: string[],
                      spaceId?: string,
                    ) => Promise<string | undefined>;
                  }
                ).resolveConnectedAccountId;
                let revokeRef = state;
                if (resolveAccountId) {
                  const resolved = await resolveAccountId(
                    context.actor.userId,
                    input.provider,
                    state,
                    [],
                    context.actor.spaceId,
                  ).catch(() => undefined);
                  if (!resolved) {
                    revokeRef = "";
                  } else {
                    revokeRef = resolved;
                  }
                }
                if (revokeRef) {
                  await connector
                    .revoke(revokeRef, adapterContext, { provider: input.provider })
                    .catch(() => undefined);
                }
              }
            } else if (state === input.provider) {
              // Pipedream begin only returns the app slug. Drop remotes that no
              // remaining local row still references so a lost race cannot leave
              // an orphan authorization, without wiping sibling accounts.
              const revokeUnreferenced = (
                connector as {
                  revokeUnreferencedAccounts?: (
                    slug: string,
                    keepAccountIds: string[],
                    context: ReturnType<typeof connectionContext>,
                  ) => Promise<void>;
                }
              ).revokeUnreferencedAccounts;
              if (revokeUnreferenced) {
                // Hold the provider lock across the keep-id snapshot and remote
                // cleanup so a concurrent complete cannot persist a providerRef
                // that this cleanup then deletes as unreferenced.
                await deps.prisma
                  .$transaction(
                    async (tx) => {
                      await lockProviderConnectionScope(
                        tx,
                        context.actor,
                        input.connectorId,
                        input.provider,
                      );
                      const kept = await tx.connection.findMany({
                        where: {
                          spaceId: context.actor.spaceId,
                          userId: context.actor.userId,
                          connectorId: input.connectorId,
                          provider: input.provider,
                          status: { in: ["connected", "pending", "error"] },
                        },
                        select: { providerRef: true },
                      });
                      const { keepIds, canRevokeUnreferenced } = concreteKeepAccountIds(
                        kept.map((entry) => entry.providerRef),
                        input.provider,
                      );
                      // Skip while any sibling still lacks a concrete account id —
                      // otherwise slug-only pending refs are dropped from keepIds and
                      // revokeUnreferencedAccounts deletes that sibling's remote auth.
                      if (!canRevokeUnreferenced) return;
                      await revokeUnreferenced(input.provider, keepIds, adapterContext);
                    },
                    { timeout: 60_000 },
                  )
                  .catch(() => undefined);
              }
            }
            throw new IsolationError();
          }
          // An app that needs no sign-in is connected right here.
          if (!auth.authorizationUrl) await provisionForActor(context.actor, row.id);
          return { connectionId: row.id, authorizationUrl: auth.authorizationUrl };
        } catch (error) {
          if (error instanceof IsolationError) throw error;
          await deps.prisma.connection.updateMany({
            where: {
              id: row.id,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              status: "pending",
            },
            data: { status: "error" },
          });
          throw new ORPCError("BAD_REQUEST", { message: connectionFailureMessage(error) });
        }
      }),
      complete: authed.connections.complete.handler(async ({ context, input }) => {
        if (input.state !== undefined) {
          const connector = deps.connectors.managed("google");
          if (!connector) {
            throw new ORPCError("BAD_REQUEST", { message: "Connector google is not configured" });
          }
          return completeNativeOAuth({
            prisma: deps.prisma,
            actor: context.actor,
            connector,
            connectorId: "google",
            state: input.state,
            code: input.code ?? "",
            context: connectionContext(context.actor, "connections.complete", context.signal),
            lock: (tx, connectorId, provider) =>
              lockProviderConnectionScope(tx, context.actor, connectorId, provider),
            provision: (connectionId) => provisionForActor(context.actor, connectionId),
            // Skipped senders that waited for the filter permission get their filters now, on a
            // signal of their own because this request ends first.
            afterConnect: (connectionId) => {
              const background = mailContext(context.actor, "connections.rules");
              void deps.mail
                .listAccounts(
                  { spaceId: context.actor.spaceId, userId: context.actor.userId },
                  background,
                )
                .then((accounts) => accounts.find((a) => a.id === connectionId))
                .then((account) =>
                  account
                    ? applyPendingSenderRules(
                        {
                          prisma: deps.prisma,
                          mail: deps.mail,
                          writesDisabled: deps.env.mailWritesDisabled,
                        },
                        account,
                        background,
                      )
                    : undefined,
                )
                .catch(() => undefined);
            },
          });
        }
        // An undefined id would match any of the caller's rows; the input schema forbids it.
        if (!input.connectionId) throw new ORPCError("BAD_REQUEST");
        const existing = await deps.prisma.connection.findFirst({
          where: {
            id: input.connectionId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          },
        });
        if (!existing) throw new IsolationError();
        const connector = deps.connectors.managed(existing.connectorId);
        if (!connector) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Connector ${existing.connectorId} is not configured`,
          });
        }
        const prepared =
          existing.status !== "connected"
            ? await prepareManagedConnectorForTransaction(connector)
            : { provider: connector, recheck: undefined };
        const transactionConnector = prepared.provider;
        if (!transactionConnector)
          throw new ORPCError("BAD_REQUEST", { message: "Integration provider is not configured" });
        let row = existing;
        if (existing.status !== "connected") {
          // Hold the provider lock across remote completion, account-id resolution,
          // providerRef persistence, and any overlapping revokeUnreferenced cleanup
          // so a concurrent begin-loss cleanup cannot delete the account we are about
          // to persist.
          row = await deps.prisma.$transaction(
            async (tx) => {
              await lockProviderConnectionScope(
                tx,
                context.actor,
                existing.connectorId,
                existing.provider,
              );
              const current = await tx.connection.findFirst({
                where: {
                  id: existing.id,
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                },
              });
              if (!current) throw new IsolationError();
              if (prepared.recheck && !(await prepared.recheck(tx))) {
                throw new ORPCError("CONFLICT", {
                  message: "Integration credentials changed; retry.",
                });
              }
              if (current.status === "connected") return current;
              if (current.status === "revoked") {
                // Authorization URLs from a revoke-win begin can still finish
                // remotely. Cancel leftover Composio request ids / drop Pipedream
                // remotes no active local row still references before rejecting.
                const revokedContext = connectionContext(
                  context.actor,
                  "connections.complete",
                  context.signal,
                );
                const restoreRevokedForRetry = async () => {
                  // Cleanup failed while the row is already revoked — restore pending
                  // so the UI can retry removal instead of leaving an orphan remote.
                  // Use the root client (not tx): throwing IsolationError aborts this
                  // transaction and would otherwise roll back a tx-scoped restore.
                  await deps.prisma.connection.updateMany({
                    where: {
                      id: current.id,
                      spaceId: context.actor.spaceId,
                      userId: context.actor.userId,
                      status: "revoked",
                    },
                    data: { status: "pending" },
                  });
                };
                const pendingRef = current.providerRef?.trim();
                try {
                  if (pendingRef && pendingRef !== current.provider) {
                    const cancelAuthorizationRequest = (
                      transactionConnector as {
                        cancelAuthorizationRequest?: (
                          requestId: string,
                          context: typeof revokedContext,
                        ) => Promise<void>;
                      }
                    ).cancelAuthorizationRequest;
                    if (cancelAuthorizationRequest) {
                      await cancelAuthorizationRequest(pendingRef, revokedContext);
                    } else {
                      const resolveAccountId = (
                        transactionConnector as {
                          resolveConnectedAccountId?: (
                            userId: string,
                            slug: string,
                            currentRef: string | null | undefined,
                            excludeIds?: string[],
                            spaceId?: string,
                          ) => Promise<string | undefined>;
                        }
                      ).resolveConnectedAccountId;
                      let revokeRef = pendingRef;
                      if (resolveAccountId) {
                        const resolved = await resolveAccountId(
                          context.actor.userId,
                          current.provider,
                          pendingRef,
                          [],
                          context.actor.spaceId,
                        ).catch(() => undefined);
                        revokeRef = resolved ?? "";
                      }
                      if (revokeRef) {
                        await transactionConnector.revoke(revokeRef, revokedContext, {
                          provider: current.provider,
                        });
                      }
                    }
                  } else {
                    const revokeUnreferenced = (
                      transactionConnector as {
                        revokeUnreferencedAccounts?: (
                          slug: string,
                          keepAccountIds: string[],
                          context: typeof revokedContext,
                        ) => Promise<void>;
                      }
                    ).revokeUnreferencedAccounts;
                    if (revokeUnreferenced) {
                      const kept = await tx.connection.findMany({
                        where: {
                          spaceId: context.actor.spaceId,
                          userId: context.actor.userId,
                          connectorId: existing.connectorId,
                          provider: existing.provider,
                          status: { in: ["connected", "pending", "error"] },
                        },
                        select: { providerRef: true },
                      });
                      const { keepIds, canRevokeUnreferenced } = concreteKeepAccountIds(
                        kept.map((entry) => entry.providerRef),
                        existing.provider,
                      );
                      if (canRevokeUnreferenced) {
                        await revokeUnreferenced(existing.provider, keepIds, revokedContext);
                      }
                    }
                  }
                } catch (error) {
                  getLogger().error(
                    "connections.complete remote cleanup failed for revoked row",
                    error,
                    {
                      connectionId: current.id,
                      connectorId: existing.connectorId,
                      provider: existing.provider,
                    },
                  );
                  await restoreRevokedForRetry();
                }
                throw new IsolationError();
              }

              const adapterContext = connectionContext(
                context.actor,
                "connections.complete",
                context.signal,
              );
              if (input.code) {
                const state = current.providerRef ?? current.provider;
                try {
                  await transactionConnector.complete({ state, code: input.code }, adapterContext);
                } catch (error) {
                  throw new ORPCError("BAD_REQUEST", { message: connectionFailureMessage(error) });
                }
              }
              const ready = await transactionConnector.connectionReady(
                adapterContext,
                current.provider,
              );
              if (!ready) return current;

              // Browser OAuth stores a connection-request id in providerRef from
              // begin. Resolve it to the connected-account id so revoke deletes the
              // right remote authorization. Prefer an account id not already used
              // by a sibling row for the same provider.
              const resolveAccountId = (
                transactionConnector as {
                  resolveConnectedAccountId?: (
                    userId: string,
                    slug: string,
                    currentRef: string | null | undefined,
                    excludeIds?: string[],
                    spaceId?: string,
                  ) => Promise<string | undefined>;
                  connectedAccountId?: (
                    userId: string,
                    slug: string,
                  ) => Promise<string | undefined>;
                }
              ).resolveConnectedAccountId;
              const fallbackAccountId = (
                transactionConnector as {
                  connectedAccountId?: (
                    userId: string,
                    slug: string,
                  ) => Promise<string | undefined>;
                }
              ).connectedAccountId;
              let resolvedAccountId: string | undefined;
              if (resolveAccountId || fallbackAccountId) {
                const siblings = await tx.connection.findMany({
                  where: {
                    spaceId: context.actor.spaceId,
                    userId: context.actor.userId,
                    connectorId: existing.connectorId,
                    provider: existing.provider,
                    id: { not: existing.id },
                    status: { in: ["connected", "pending", "error"] },
                  },
                  select: { providerRef: true },
                });
                // Exclude concrete account ids only. A pending sibling may still
                // store a slug or authorization-request id; passing those raw refs
                // would not match remote account ids and can let this row adopt the
                // sibling's account. If a sibling ref cannot be resolved yet, leave
                // this row pending so a later complete can re-resolve safely.
                const excludeIds: string[] = [];
                let unresolvedSibling = false;
                for (const sibling of siblings) {
                  const ref = sibling.providerRef?.trim();
                  // Slug-only refs cannot identify a concrete remote account; resolving
                  // them would pick an arbitrary ACTIVE id and over-exclude.
                  if (!ref || ref === existing.provider) continue;
                  if (resolveAccountId) {
                    const resolvedSiblingId = await resolveAccountId(
                      context.actor.userId,
                      existing.provider,
                      ref,
                      [],
                      context.actor.spaceId,
                    ).catch(() => undefined);
                    if (resolvedSiblingId) {
                      excludeIds.push(resolvedSiblingId);
                    } else {
                      unresolvedSibling = true;
                    }
                  } else {
                    excludeIds.push(ref);
                  }
                }
                if (unresolvedSibling) {
                  return current;
                }
                resolvedAccountId = resolveAccountId
                  ? await resolveAccountId(
                      context.actor.userId,
                      existing.provider,
                      current.providerRef,
                      excludeIds,
                      context.actor.spaceId,
                    ).catch(() => undefined)
                  : await fallbackAccountId!(context.actor.userId, existing.provider).catch(
                      () => undefined,
                    );
              }

              // When a resolver exists and providerRef is still a request-scoped
              // id (not the provider slug), require a concrete account id before
              // marking connected — otherwise revoke would delete the wrong ref.
              if (
                resolveAccountId &&
                current.providerRef &&
                current.providerRef !== current.provider &&
                !resolvedAccountId
              ) {
                return current;
              }

              const providerRef = resolvedAccountId ?? current.providerRef;
              if (providerRef) {
                const taken = await tx.connection.findFirst({
                  where: {
                    spaceId: context.actor.spaceId,
                    userId: context.actor.userId,
                    connectorId: existing.connectorId,
                    provider: existing.provider,
                    id: { not: existing.id },
                    status: { in: ["connected", "pending", "error"] },
                    providerRef,
                  },
                  select: { id: true },
                });
                if (taken) {
                  // Do not mark connected with a request-scoped or shared ref —
                  // leave pending so a later complete can re-resolve an unused id.
                  return current;
                }
              }
              return tx.connection.update({
                where: { id: current.id },
                data: {
                  status: "connected",
                  ...(providerRef ? { providerRef } : {}),
                },
              });
            },
            { timeout: 60_000 },
          );
        }
        // A connection created private gets its agent as soon as it is connected and has none:
        // the first connect, a reconnect, a racing poll and a crash before provisioning alike.
        if (row.status === "connected" && row.privateByDefault && !row.agentBotId) {
          await provisionForActor(context.actor, row.id);
          row =
            (await deps.prisma.connection.findFirst({
              where: { id: row.id, spaceId: context.actor.spaceId, userId: context.actor.userId },
            })) ?? row;
        }
        return connectionDto(row);
      }),
      rename: authed.connections.rename.handler(async ({ context, input }) => {
        const existing = await deps.prisma.connection.findFirst({
          where: {
            id: input.connectionId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          },
        });
        if (!existing) throw new IsolationError();
        const row = await deps.prisma.connection.update({
          where: { id: existing.id },
          data: { displayName: input.displayName },
        });
        return connectionDto(row);
      }),
      check: authed.connections.check.handler(async ({ context, input }) => {
        const where = {
          id: input.connectionId,
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
          status: "connected",
        };
        const existing = await deps.prisma.connection.findFirst({ where });
        if (!existing) throw new IsolationError();
        if (existing.provider.toLowerCase() === "gmail")
          await checkMailConnection(deps, context.actor, existing.id, context.signal);
        const row = await deps.prisma.connection.findFirstOrThrow({
          where,
          include: { mailSyncState: { select: { needsReconnect: true, lastErrorAt: true } } },
        });
        return connectionDto(row);
      }),
      effectiveAccess: authed.connections.effectiveAccess.handler(({ context }) =>
        allEffectiveAccess(deps.prisma, context.actor),
      ),
      access: authed.connections.access.handler(async ({ context, input }) => {
        return connectionAccess(deps.prisma, context.actor, input.connectionId);
      }),
      accessAll: authed.connections.accessAll.handler(async ({ context }) =>
        allConnectionAccess(deps.prisma, context.actor),
      ),
      setAccess: authed.connections.setAccess.handler(async ({ context, input }) => {
        await saveConnectionAccess(deps.prisma, context.actor, input.connectionId, () => ({
          allAgents: input.allAgents,
          botIds: input.botIds,
        }));
        return connectionAccess(deps.prisma, context.actor, input.connectionId);
      }),
      setAgentAccess: authed.connections.setAgentAccess.handler(async ({ context, input }) => {
        await saveConnectionAccess(
          deps.prisma,
          context.actor,
          input.connectionId,
          (connection, bots) =>
            toggleAgentAccess(
              connection,
              bots,
              input.botId,
              input.on,
              input.canWrite,
              input.supportLabel,
            ),
        );
        return connectionAccess(deps.prisma, context.actor, input.connectionId);
      }),
      createAgent: authed.connections.createAgent.handler(async ({ context, input }) => {
        const { bot } = await ensureConnectedAppAgent(
          {
            prisma: deps.prisma,
            repos,
            archiveBot: (botId) => archiveActorBot(context.actor, botId),
          },
          context.actor,
          input.connectionId,
        );
        return { botId: bot.id };
      }),
      setWrites: authed.connections.setWrites.handler(async ({ context, input }) =>
        connectionDto(
          await setConnectedAppWrites(
            deps.prisma,
            context.actor,
            input.connectionId,
            input.enabled,
          ),
        ),
      ),
      setExclusive: authed.connections.setExclusive.handler(async ({ context, input }) =>
        connectionDto(
          await setConnectedAppExclusive(
            deps.prisma,
            context.actor,
            input.connectionId,
            input.exclusive,
          ),
        ),
      ),
      revoke: authed.connections.revoke.handler(async ({ context, input }) => {
        type RemoteRevoke = {
          connectorId: string;
          connectionRef: string;
          provider: string;
          accountSpecific: boolean;
        };
        const snapshot = await deps.prisma.connection.findFirst({
          where: {
            id: input.connectionId,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          },
        });
        // The watch needs the login, which the revoke below removes. Best effort: a watch that
        // is not stopped lapses within 7 days and its pushes match no connection.
        if (snapshot?.connectorId === "google" && isMailConnection(snapshot)) {
          await stopMailWatch(
            { prisma: deps.prisma, mail: deps.mail },
            { spaceId: context.actor.spaceId, userId: context.actor.userId },
            snapshot.id,
          );
        }
        const needsProvider =
          snapshot &&
          snapshot.status === "connected" &&
          (!snapshot.providerRef || snapshot.providerRef === snapshot.provider) &&
          (await deps.prisma.connection.count({
            where: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              connectorId: snapshot.connectorId,
              provider: snapshot.provider,
              id: { not: snapshot.id },
              status: { in: ["connected", "pending"] },
            },
          })) === 0;
        const configured = needsProvider
          ? deps.connectors.managed(snapshot.connectorId)
          : undefined;
        const prepared = configured
          ? await prepareManagedConnectorForTransaction(configured)
          : undefined;
        let agentToArchive: string | null = null;
        let photoKeys: string[] = [];
        // What the revoke took off the row, to put back if the remote revoke fails recoverably.
        const undo: {
          ownership: {
            agentBotId: string | null;
            writesEnabled: boolean;
            grants: { botId: string; spaceId: string; userId: string; canWrite: boolean }[];
          } | null;
        } = { ownership: null };
        const outcome = await retryOnDeadlock(() =>
          deps.prisma.$transaction(
            async (tx) => {
              agentToArchive = null;
              photoKeys = [];
              undo.ownership = null;
              const row = await tx.connection.findFirst({
                where: {
                  id: input.connectionId,
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                },
              });
              if (!row) {
                return {
                  remote: null as null | RemoteRevoke,
                  previousStatus: null as string | null,
                };
              }

              // Advisory lock covers inserts as well as existing rows. SELECT FOR UPDATE
              // alone misses a concurrent begin that inserts after the lock query.
              await lockProviderConnectionScope(tx, context.actor, row.connectorId, row.provider);
              await tx.$queryRaw`
              SELECT id
              FROM connections
              WHERE "spaceId" = ${context.actor.spaceId}
                AND "userId" = ${context.actor.userId}
                AND "connectorId" = ${row.connectorId}
                AND provider = ${row.provider}
                AND status IN ('connected', 'pending', 'error')
              FOR UPDATE`;

              const updated = await tx.connection.updateMany({
                where: {
                  id: row.id,
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                  status: { in: ["connected", "pending", "error"] },
                },
                data: { status: "revoked" },
              });
              if (updated.count === 0) {
                return {
                  remote: null as null | RemoteRevoke,
                  previousStatus: null as string | null,
                };
              }
              await companyWriter(tx, context.actor).disconnectConnection(row.id);
              await companyWriter(tx, context.actor).sourceControl(
                { sourceKind: "data_room", connectionId: row.id, mcpServerId: null },
                false,
              );
              // Unlink a provisioned agent under the same lock, so a begin that reuses the row
              // right after sees a clean row. The agent itself is archived once this commits.
              if (row.privateByDefault) {
                const agent = row.agentBotId
                  ? await tx.bot.findFirst({
                      where: { id: row.agentBotId, spaceId: row.spaceId, userId: row.userId },
                      select: { spawnKey: true },
                    })
                  : null;
                agentToArchive =
                  agent?.spawnKey === integrationAgentSpawnKey(row.id) ? row.agentBotId : null;
                undo.ownership = {
                  agentBotId: row.agentBotId,
                  writesEnabled: row.writesEnabled,
                  grants: await tx.botConnectionAccess.findMany({
                    where: { connectionId: row.id },
                    select: { botId: true, spaceId: true, userId: true, canWrite: true },
                  }),
                };
                await tx.connection.update({
                  where: { id: row.id },
                  data: { agentBotId: null, writesEnabled: false },
                });
                await tx.botConnectionAccess.deleteMany({ where: { connectionId: row.id } });
              }
              // Revoking only marks the row, so no cascade fires; mail data goes explicitly.
              await deleteMailConnectionData(tx, {
                spaceId: context.actor.spaceId,
                userId: context.actor.userId,
                connectionId: row.id,
              });
              if (row.connectorId === "google" && isMailConnection(row))
                photoKeys = await deleteContactPhotosForConnection(tx, {
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                  connectionId: row.id,
                });

              const remaining = await tx.connection.count({
                where: {
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                  connectorId: row.connectorId,
                  provider: row.provider,
                  status: { in: ["connected", "pending"] },
                },
              });
              const connectionRef = row.providerRef || row.provider;
              const accountSpecific = Boolean(row.providerRef && row.providerRef !== row.provider);
              // Account-scoped refs can disconnect one remote authorization while
              // siblings remain. Slug-only legacy rows must wait until they are last,
              // or a provider-wide revoke would drop every account for that app.
              if (!accountSpecific && remaining > 0) {
                return {
                  remote: null as null | RemoteRevoke,
                  previousStatus: null as string | null,
                };
              }

              // Slug-only remote delete is provider-wide. Run it before commit while
              // still holding the begin/revoke lock so a new authorization cannot be
              // created and then wiped by Pipedream's slug-scoped DELETE.
              // A pending or failed row with no account id never created a remote account.
              if (!accountSpecific && row.status !== "connected") {
                return {
                  remote: null as null | RemoteRevoke,
                  previousStatus: null as string | null,
                };
              }
              if (!accountSpecific) {
                if (
                  !needsProvider ||
                  row.connectorId !== snapshot?.connectorId ||
                  row.provider !== snapshot?.provider ||
                  (prepared?.recheck && !(await prepared.recheck(tx)))
                ) {
                  throw new ORPCError("CONFLICT", {
                    message: "Integration credentials changed; retry.",
                  });
                }
                const connector = prepared?.provider;
                if (!connector) {
                  throw new ORPCError("BAD_REQUEST", {
                    message: `Connector ${row.connectorId} is not configured`,
                  });
                }
                try {
                  // Abort before the 60s Prisma transaction timeout so a late remote
                  // delete cannot succeed after local status has already rolled back.
                  const signals = [AbortSignal.timeout(45_000)];
                  if (context.signal) signals.unshift(context.signal);
                  const revokeSignal =
                    signals.length === 1 ? signals[0]! : AbortSignal.any(signals);
                  await connector.revoke(
                    connectionRef,
                    connectionContext(context.actor, "connections.revoke", revokeSignal),
                    { provider: row.provider },
                  );
                } catch (error) {
                  if (error instanceof ORPCError) throw error;
                  if (!isRemoteAccountGone(error))
                    throw new ORPCError("BAD_REQUEST", {
                      message: connectionFailureMessage(error),
                    });
                }
                return {
                  remote: null as null | RemoteRevoke,
                  previousStatus: null as string | null,
                };
              }

              return {
                remote: {
                  connectorId: row.connectorId,
                  connectionRef,
                  provider: row.provider,
                  accountSpecific,
                },
                previousStatus: row.status,
              };
            },
            { timeout: 60_000 },
          ),
        );

        // Revoke keeps the Connection row, so no cascade removes the saved mail searches.
        if (snapshot && isMailConnection(snapshot)) {
          await deleteMailSearches(deps.prisma, {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
          });
        }

        if (outcome.remote) {
          const restoreLocalStatus = async () => {
            // Local row was marked revoked inside the transaction; restore it so a
            // failed remote disconnect remains retryable instead of orphaned.
            if (!outcome.previousStatus) return;
            const previous = outcome.previousStatus;
            const owned = undo.ownership;
            await deps.prisma.$transaction(async (tx) => {
              // Connection row first, then bots and grants, like every other path.
              await tx.$queryRaw`SELECT id FROM connections WHERE id = ${input.connectionId} FOR UPDATE`;
              // An agent archived or deleted since the revoke is not put back: the row stays
              // private and agentless, as release leaves it.
              const ids = owned
                ? [...new Set([...owned.grants.map((g) => g.botId), owned.agentBotId ?? ""])]
                : [];
              const active = new Set(
                (
                  await tx.bot.findMany({
                    where: {
                      id: { in: ids },
                      spaceId: context.actor.spaceId,
                      userId: context.actor.userId,
                      archivedAt: null,
                    },
                    select: { id: true },
                  })
                ).map((b) => b.id),
              );
              const agentActive = Boolean(owned?.agentBotId && active.has(owned.agentBotId));
              const restored = await tx.connection.updateMany({
                where: {
                  id: input.connectionId,
                  spaceId: context.actor.spaceId,
                  userId: context.actor.userId,
                  status: "revoked",
                },
                data: {
                  status: previous,
                  ...(owned && agentActive
                    ? { agentBotId: owned.agentBotId, writesEnabled: owned.writesEnabled }
                    : {}),
                },
              });
              // Put the grants back, so the connection does not turn shareable.
              if (owned && restored.count > 0)
                await tx.botConnectionAccess.createMany({
                  data: owned.grants
                    .filter((grant) => active.has(grant.botId))
                    .map((grant) => ({ ...grant, connectionId: input.connectionId })),
                  skipDuplicates: true,
                });
            });
          };
          try {
            const connector = deps.connectors.managed(outcome.remote.connectorId);
            if (!connector) {
              throw new ORPCError("BAD_REQUEST", {
                message: `Connector ${outcome.remote.connectorId} is not configured`,
              });
            }
            await connector.revoke(
              outcome.remote.connectionRef,
              connectionContext(context.actor, "connections.revoke", context.signal),
              { provider: outcome.remote.provider },
            );
          } catch (error) {
            if (!isRemoteAccountGone(error)) {
              // Restore when DELETE clearly did not run (including pre-delete list
              // timeouts). Post-delete timeouts stay ambiguous — leave revoked.
              if (shouldRestoreLocalAfterRemoteRevokeFailure(error)) {
                await restoreLocalStatus();
              } else {
                getLogger().error(
                  "connections.revoke remote outcome uncertain; leaving local revoked",
                  error,
                  {
                    connectionId: input.connectionId,
                    connectorId: outcome.remote.connectorId,
                  },
                );
              }
              if (error instanceof ORPCError) throw error;
              throw new ORPCError("BAD_REQUEST", { message: connectionFailureMessage(error) });
            }
          }
        }
        for (const storageKey of photoKeys)
          await deps.jobs
            .enqueue(dataRoomBlobDeleteJob(context.actor.spaceId, storageKey))
            .catch((jobError) => getLogger().error("contact photo blob cleanup", jobError));
        // The connection's own agent goes with it, archived after the revoke committed. The Inbox
        // agent serves every Gmail account, so it only loses this one.
        if (agentToArchive)
          await archiveActorBot(context.actor, agentToArchive).catch((error) =>
            getLogger().error("connection agent archive failed", error),
          );
        return { ok: true as const };
      }),
      tools: authed.connections.tools.handler(async ({ context, input }) => {
        const connector = deps.connectors.managed(input.connectorId);
        if (!connector) return [];
        const row = await deps.prisma.connection.findFirst({
          where: {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            connectorId: input.connectorId,
            provider: input.provider,
            status: "connected",
          },
        });
        if (!row) return [];
        try {
          const tools = await connector.discoverTools({
            ...connectionContext(context.actor, "connections.tools", context.signal),
            connectedConnections: [
              {
                id: row.id,
                connectorId: input.connectorId,
                externalId: input.provider,
                displayName: row.displayName,
                providerRef: row.providerRef ?? undefined,
              },
            ],
            connectedProviders: [input.provider],
          });
          return tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
          }));
        } catch (error) {
          getLogger().error("connections.tools failed", error, {
            connectorId: input.connectorId,
            provider: input.provider,
          });
          return [];
        }
      }),
    },
    messaging: {
      status: authed.messaging.status.handler(async ({ context }) => {
        const identities = await acrossChatIdentities(() =>
          deps.prisma.messagingIdentity.findMany({
            where: { userId: context.actor.userId },
            orderBy: { createdAt: "asc" },
          }),
        );
        return {
          enabled: deps.messaging?.enabled ?? false,
          providers: deps.messaging?.providers ?? [],
          openSignup: deps.messaging?.openSignup ?? false,
          identities: await Promise.all(
            identities.map((identity) => messagingIdentityDto(deps.prisma, identity)),
          ),
        };
      }),
      link: {
        start: authed.messaging.link.start.handler(async ({ context, input }) => {
          const bot = await deps.prisma.bot.findFirst({
            where: {
              id: input.botId,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              archivedAt: null,
            },
            select: { id: true, spawnKey: true },
          });
          if (!bot) throw new ORPCError("NOT_FOUND");
          // A code works on any mounted provider, so refuse only when every
          // provider this deployment has would block the bot.
          const providers = deps.messaging?.providers ?? [];
          if (
            providers.length > 0 &&
            providers.every((provider) => messagingProviderBlocksBot(provider, bot.spawnKey))
          ) {
            throw new ORPCError("BAD_REQUEST", { message: MESSAGING_PHOTON_BLOCKED_MESSAGE });
          }
          // One chat identity per bot: delivery mirrors a bot's replies to
          // exactly one conversation.
          const linked = await deps.prisma.messagingIdentity.findUnique({
            where: { botId: bot.id },
            select: { id: true },
          });
          if (linked) {
            throw new ORPCError("BAD_REQUEST", {
              message: "That bot is already linked to a chat app; unlink it first.",
            });
          }
          const issued = await issueMessagingLinkCode(deps.prisma, {
            userId: context.actor.userId,
            spaceId: context.actor.spaceId,
            botId: bot.id,
          });
          return {
            code: formatMessagingLinkCode(issued.code),
            expiresAt: issued.expiresAt.toISOString(),
          };
        }),
      },
      identities: {
        setBot: authed.messaging.identities.setBot.handler(async ({ context, input }) => {
          const identity = await acrossChatIdentities(() =>
            deps.prisma.messagingIdentity.findFirst({
              where: { id: input.identityId, userId: context.actor.userId },
            }),
          );
          if (!identity) throw new ORPCError("NOT_FOUND");
          const bot = await deps.prisma.bot.findFirst({
            where: {
              id: input.botId,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              archivedAt: null,
            },
            select: { id: true, spawnKey: true },
          });
          if (!bot) throw new ORPCError("NOT_FOUND");
          if (messagingProviderBlocksBot(identity.provider, bot.spawnKey)) {
            throw new ORPCError("BAD_REQUEST", { message: MESSAGING_PHOTON_BLOCKED_MESSAGE });
          }
          try {
            const updated = await acrossChatIdentities(() =>
              deps.prisma.messagingIdentity.update({
                where: { id: identity.id },
                // The identity must live in the bot's space: runs resolve
                // credentials, memory, and approval rules from run.spaceId.
                data: { botId: bot.id, spaceId: context.actor.spaceId },
              }),
            );
            return messagingIdentityDto(deps.prisma, updated);
          } catch (error) {
            // botId is unique: the target bot is already linked elsewhere.
            if (isUniqueViolation(error)) {
              throw new ORPCError("BAD_REQUEST", {
                message: "That bot is already linked to a chat app.",
              });
            }
            throw error;
          }
        }),
        unlink: authed.messaging.identities.unlink.handler(async ({ context, input }) => {
          const { count } = await acrossChatIdentities(() =>
            deps.prisma.messagingIdentity.deleteMany({
              where: { id: input.identityId, userId: context.actor.userId },
            }),
          );
          if (count === 0) throw new ORPCError("NOT_FOUND");
          return { ok: true as const };
        }),
      },
      channels: {
        list: authed.messaging.channels.list.handler(async ({ context }) => {
          const identities = await messagingIdentitiesFor(deps.prisma, context.actor.userId);
          if (identities.length === 0) return [];
          const memberships = await deps.prisma.messagingChannelMember.findMany({
            where: { identityId: { in: identities.map((identity) => identity.id) } },
            include: { channel: { include: { members: ACTIVE_CHANNEL_MEMBERS } } },
            orderBy: { updatedAt: "desc" },
          });
          return memberships.map((membership) => messagingChannelDto(membership));
        }),
        respond: authed.messaging.channels.respond.handler(async ({ context, input }) => {
          const identities = await messagingIdentitiesFor(deps.prisma, context.actor.userId);
          const membership = identities.length
            ? await deps.prisma.messagingChannelMember.findFirst({
                where: {
                  id: input.membershipId,
                  identityId: { in: identities.map((identity) => identity.id) },
                },
                include: { channel: { include: { members: ACTIVE_CHANNEL_MEMBERS } } },
              })
            : null;
          if (membership?.status !== "invited") {
            throw new ORPCError("NOT_FOUND");
          }
          const { count } = await deps.prisma.messagingChannelMember.updateMany({
            where: { id: membership.id, status: "invited" },
            data: { status: input.accept ? "approved" : "declined" },
          });
          if (count === 0) {
            // Lost a race with leave/sweep: approval must not resurrect a
            // departed member.
            throw new ORPCError("NOT_FOUND");
          }
          const updated = await deps.prisma.messagingChannelMember.findUniqueOrThrow({
            where: { id: membership.id },
            include: { channel: { include: { members: ACTIVE_CHANNEL_MEMBERS } } },
          });
          return messagingChannelDto(updated);
        }),
        leave: authed.messaging.channels.leave.handler(async ({ context, input }) => {
          const identities = await messagingIdentitiesFor(deps.prisma, context.actor.userId);
          const membership = identities.length
            ? await deps.prisma.messagingChannelMember.findFirst({
                where: {
                  id: input.membershipId,
                  identityId: { in: identities.map((identity) => identity.id) },
                },
              })
            : null;
          if (!membership) throw new ORPCError("NOT_FOUND");
          await deps.prisma.messagingChannelMember.update({
            where: { id: membership.id },
            data: { status: "left" },
          });
          return { ok: true as const };
        }),
      },
      connections: {
        list: authed.messaging.connections.list.handler(async ({ context }) => {
          const identities = await messagingIdentitiesFor(deps.prisma, context.actor.userId);
          if (identities.length === 0) return [];
          const botIds = identities.map((identity) => identity.botId);
          const connections = await deps.prisma.agentConnection.findMany({
            where: {
              OR: [{ requesterBotId: { in: botIds } }, { targetBotId: { in: botIds } }],
            },
            orderBy: { updatedAt: "desc" },
          });
          const myBotIds = new Set(botIds);
          return Promise.all(
            connections.map((connection) =>
              messagingConnectionDto(deps.prisma, myBotIds, connection),
            ),
          );
        }),
        respond: authed.messaging.connections.respond.handler(async ({ context, input }) => {
          const identities = await messagingIdentitiesFor(deps.prisma, context.actor.userId);
          const myBotIds = new Set(identities.map((identity) => identity.botId));
          const connection = identities.length
            ? await deps.prisma.agentConnection.findFirst({
                where: {
                  id: input.connectionId,
                  targetBotId: { in: [...myBotIds] },
                  status: "pending",
                },
              })
            : null;
          if (!connection) throw new ORPCError("NOT_FOUND");
          const { updated, notifyRequester } = await acrossChatIdentities(() =>
            deps.prisma.$transaction(async (tx) => {
              // The claim holds the connection row lock through commit, so a
              // revoke either beats it or waits — it can never interleave with
              // the confirmation write below.
              if (
                input.accept &&
                !(await crossSpaceCommunicationAllowed(
                  tx,
                  connection.requesterBotId,
                  connection.targetBotId,
                ))
              ) {
                throw new ORPCError("FORBIDDEN");
              }
              const { count } = await tx.agentConnection.updateMany({
                where: { id: connection.id, status: "pending" },
                data: { status: input.accept ? "approved" : "declined" },
              });
              if (count === 0) {
                // Lost a race with revoke: approval must never overwrite it.
                throw new ORPCError("NOT_FOUND");
              }
              const row = await tx.agentConnection.findUniqueOrThrow({
                where: { id: connection.id },
              });
              if (!input.accept) return { updated: row, notifyRequester: false };
              // Parity with the text-command path: the requester hears about it.
              const requesterIdentity = await tx.messagingIdentity.findUnique({
                where: { botId: connection.requesterBotId },
              });
              if (!requesterIdentity) return { updated: row, notifyRequester: false };
              const key = `command:connected:${connection.id}`;
              // A re-approved pair starts a fresh cycle; clear the stale row or
              // skipDuplicates would swallow the new confirmation.
              await tx.messagingOutbound.deleteMany({ where: { idempotencyKey: key } });
              await tx.messagingOutbound.createMany({
                data: [
                  {
                    idempotencyKey: key,
                    kind: "dm",
                    identityId: requesterIdentity.id,
                    body: "Your connection request was accepted. Your agents can now message each other.",
                  },
                ],
                skipDuplicates: true,
              });
              return { updated: row, notifyRequester: true };
            }),
          );
          if (notifyRequester) {
            await deps.jobs.enqueue(messagingDeliverJob()).catch((error) => {
              getLogger().error("messaging connection confirmation enqueue error", error);
            });
          }
          return messagingConnectionDto(deps.prisma, myBotIds, updated);
        }),
        revoke: authed.messaging.connections.revoke.handler(async ({ context, input }) => {
          const identities = await messagingIdentitiesFor(deps.prisma, context.actor.userId);
          const botIds = identities.map((identity) => identity.botId);
          const connection = identities.length
            ? await deps.prisma.agentConnection.findFirst({
                where: {
                  id: input.connectionId,
                  OR: [{ requesterBotId: { in: botIds } }, { targetBotId: { in: botIds } }],
                },
              })
            : null;
          if (!connection) throw new ORPCError("NOT_FOUND");
          // Claim + invite cancel in one transaction. The status update holds
          // the connection row lock through commit, so a concurrent reconnect
          // (FOR UPDATE) waits until both the revoke and the invite delete
          // finish — otherwise it could reopen and create a fresh invite that
          // a post-commit deleteMany would then wipe while leaving the row
          // pending with no approval prompt.
          await acrossChatIdentities(() =>
            deps.prisma.$transaction(async (tx) => {
              const { count } = await tx.agentConnection.updateMany({
                where: { id: connection.id, status: connection.status },
                data: { status: "revoked" },
              });
              if (count === 0) throw new ORPCError("NOT_FOUND");
              // Cancel undelivered invites, including rows the drain already
              // claimed (status sent, no providerHandle yet). Connect-invite
              // delivery holds this connection row FOR UPDATE through
              // sendDirect, so revoke either waits until the DM is sent or
              // deletes the claim before send starts.
              await tx.messagingOutbound.deleteMany({
                where: {
                  idempotencyKey: `connect:${connection.requesterBotId}:${connection.targetBotId}`,
                  OR: [{ status: "pending" }, { status: "sent", providerHandle: null }],
                },
              });
            }),
          );
          return { ok: true as const };
        }),
      },
    },
    externalConversations: {
      updatePolicy: authed.externalConversations.updatePolicy.handler(
        async ({ context, input }) => {
          const { externalConversationId, ...policy } = input;
          return createExternalConversationRepos(deps.prisma).updatePolicy(
            context.actor,
            externalConversationId,
            policy,
          );
        },
      ),
    },
    agentSecrets: createAgentSecretsRoutes(routeContext),
    botSecrets: {
      list: authed.botSecrets.list.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const rows = await listBotSecretMetadata(
          deps.prisma,
          botSecretScope(context.actor, bot.id),
        );
        return rows.map(botSecretMetadataDto);
      }),
      put: authed.botSecrets.put.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        const scope = botSecretScope(context.actor, bot.id);
        let row: Awaited<ReturnType<typeof getBotSecretMetadata>>;
        try {
          row = await storeBotSecret({
            prisma: deps.prisma,
            secretStore: deps.secrets,
            scope,
            destination: input.destination,
            plaintext: input.value,
          });
        } catch (error) {
          throw mapBotSecretStoreError(error);
        }
        if (!row) throw new ORPCError("CONFLICT", { message: "Credential was not saved" });
        return botSecretMetadataDto(row);
      }),
      remove: authed.botSecrets.remove.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        await forgetBotSecret(deps.prisma, botSecretScope(context.actor, bot.id), input.name);
        return { ok: true as const };
      }),
    },
    approvalRules: {
      list: authed.approvalRules.list.handler(async ({ context }) => {
        const rows = await listApprovalRules(deps.prisma, {
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
        });
        // An agent's "Allow all sites" rule is listed too, so it can be removed here.
        const allSites = await deps.prisma.actionApprovalRule.findMany({
          where: {
            spaceId: context.actor.spaceId,
            createdByUserId: context.actor.userId,
            botId: { not: null },
            matchKind: "tool",
            matchValue: "web_fetch",
          },
          include: { bot: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        });
        // A routine's "Always for this routine" rules, with the routine's name, so they can be removed.
        const routineRules = await deps.prisma.actionApprovalRule.findMany({
          where: {
            spaceId: context.actor.spaceId,
            createdByUserId: context.actor.userId,
            routineId: { not: null },
          },
          include: { routine: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        });
        return [
          ...rows,
          ...allSites.map((rule) => ({ ...rule, botName: rule.bot?.name })),
          ...routineRules.map((rule) => ({ ...rule, routineName: rule.routine?.name })),
        ].map(approvalRuleDto);
      }),
      set: authed.approvalRules.set.handler(async ({ context, input }) => {
        // A bot rule needs a bot the caller can see.
        if (input.botId) await repos.getBot(context.actor, input.botId);
        const scope = { spaceId: context.actor.spaceId, userId: context.actor.userId };
        let matchValue = input.matchValue;
        if (input.matchKind === "site") {
          const site = urlSite(matchValue) ?? hostSite(matchValue);
          if (!site || /[\s/]/.test(site)) throw new ORPCError("BAD_REQUEST");
          matchValue = site;
        } else if (input.matchKind === "category") {
          const type = actionTypeFromCategory(matchValue);
          // An always-ask type's every call is a hard line; an Allow rule for it can never run.
          if (!type || (input.effect === "always_allow" && ALWAYS_ASK_ACTION_TYPES.has(type))) {
            throw new ORPCError("BAD_REQUEST");
          }
        }
        // A legacy row saved with the raw value would otherwise linger beside the normalised one.
        if (matchValue !== input.matchValue) {
          await clearApprovalRule(deps.prisma, { ...scope, ...input });
        }
        const row = await setApprovalRule(deps.prisma, { ...scope, ...input, matchValue });
        return approvalRuleDto(row);
      }),
      table: authed.approvalRules.table.handler(async ({ context, input }) => {
        const bot = input.botId ? await repos.getBot(context.actor, input.botId) : undefined;
        // The executor's inputs and fallback, so the rows show what the gate will do.
        const level = await resolvePermissionLevel(async () => ({
          botLevel: bot?.permissionLevel,
          spaceLevel: (await loadPermissionSettings(deps, context.actor)).level,
          firewall: bot?.firewall,
          external: bot?.audience === "external",
        }));
        return {
          rows: await approvalTable(
            deps.prisma,
            { spaceId: context.actor.spaceId, userId: context.actor.userId, botId: input.botId },
            level,
          ),
          level,
        };
      }),
      setActionType: authed.approvalRules.setActionType.handler(async ({ context, input }) => {
        if (input.botId) await repos.getBot(context.actor, input.botId);
        // An always-ask type's every call is a hard line; only Ask and Block are real choices.
        if (input.effect === "allow" && ALWAYS_ASK_ACTION_TYPES.has(input.actionType)) {
          throw new ORPCError("BAD_REQUEST");
        }
        await setActionTypeChoice(deps.prisma, {
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
          botId: input.botId,
          actionType: input.actionType,
          choice: input.effect,
        });
        return { ok: true as const };
      }),
      remove: authed.approvalRules.remove.handler(async ({ context, input }) => {
        await deps.prisma.actionApprovalRule.deleteMany({
          where: {
            id: input.id,
            spaceId: context.actor.spaceId,
            createdByUserId: context.actor.userId,
          },
        });
        return { ok: true as const };
      }),
    },
    permissions: {
      get: authed.permissions.get.handler(({ context }) =>
        loadPermissionSettings(deps, context.actor),
      ),
      set: authed.permissions.set.handler(async ({ context, input }) => {
        await deps.prisma.actionAutoReviewPreference.upsert({
          where: {
            spaceId_userId: { spaceId: context.actor.spaceId, userId: context.actor.userId },
          },
          create: {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            enabled: deploymentAutoReviewDefault(process.env),
            permissionLevel: input.level,
          },
          update: { permissionLevel: input.level },
        });
        return loadPermissionSettings(deps, context.actor);
      }),
    },
    autoReview: {
      get: authed.autoReview.get.handler(async ({ context }) => {
        return loadAutoReviewSettings(deps, context.actor);
      }),
      set: authed.autoReview.set.handler(async ({ context, input }) => {
        await deps.prisma.actionAutoReviewPreference.upsert({
          where: {
            spaceId_userId: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
            },
          },
          create: {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            enabled: input.enabled ?? deploymentAutoReviewDefault(process.env),
            background: input.background ?? true,
          },
          update: { enabled: input.enabled, background: input.background },
        });
        return loadAutoReviewSettings(deps, context.actor);
      }),
      approvals: authed.autoReview.approvals.handler(async ({ context }) => ({
        rows: await listAutoApprovalRows(deps.prisma, context.actor),
      })),
      undo: authed.autoReview.undo.handler(({ context, input }) =>
        undoAutoApproval(
          {
            prisma: deps.prisma,
            undoMail: (actor, batchId) =>
              inboxActionsUndo(
                { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
                actor,
                { batchId },
                context.signal,
              ),
            restoreBot: restoreActorBot,
          },
          context.actor,
          input.id,
        ),
      ),
      // Every call the judge passed for this user in this space, newest first.
      recent: authed.autoReview.recent.handler(async ({ context }) => {
        const rows = await deps.prisma.externalEffect.findMany({
          where: {
            spaceId: context.actor.spaceId,
            reviewDecision: "pass",
            run: { userId: context.actor.userId, spaceId: context.actor.spaceId },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            kind: true,
            reviewReason: true,
            createdAt: true,
            run: { select: { bot: { select: { name: true } } } },
          },
        });
        return rows.map((row) => ({
          id: row.id,
          tool: row.kind,
          reason: row.reviewReason,
          at: row.createdAt.toISOString(),
          botName: row.run.bot.name,
        }));
      }),
    },
    company: {
      agent: authed.company.agent.handler(({ context }) =>
        ensureCompanyAgent({ repos }, context.actor),
      ),
      privacy: authed.company.privacy.handler(({ context }) =>
        companyForActor(deps.prisma, context.actor).privacy(),
      ),
      sourceControl: authed.company.sourceControl.handler(async ({ context, input }) => {
        return companyForActor(deps.prisma, context.actor)
          .sourceControl(input, input.connected)
          .then(() => ({ ok: true as const }))
          .catch((error) => {
            if (error instanceof CompanyPrivacyBusinessError)
              throw new ORPCError("BAD_REQUEST", { message: error.message });
            throw error;
          });
      }),
      excludePerson: authed.company.excludePerson.handler(async ({ context, input }) => {
        return companyForActor(deps.prisma, context.actor)
          .excludePerson(input.entityId)
          .then(() => ({ ok: true as const }))
          .catch((error) => {
            if (error instanceof CompanyPrivacyBusinessError)
              throw new ORPCError("BAD_REQUEST", { message: error.message });
            throw error;
          });
      }),
      erase: authed.company.erase.handler(async ({ context }) => {
        await companyForActor(deps.prisma, context.actor).eraseMap();
        return { ok: true as const };
      }),
      export: authed.company.export.handler(({ context }) =>
        companyForActor(deps.prisma, context.actor).export(),
      ),
      visibility: authed.company.visibility.handler(async ({ context, input }) => {
        return companyForActor(deps.prisma, context.actor)
          .visibility(input)
          .then(() => ({ ok: true as const }))
          .catch((error) => {
            if (error instanceof CompanyPrivacyBusinessError)
              throw new ORPCError("BAD_REQUEST", { message: error.message });
            throw error;
          });
      }),
      page: authed.company.page.handler(({ context }) => companyPage(deps.prisma, context.actor)),
      calendar: authed.company.calendar.handler(({ context, input }) =>
        companyCalendar(deps.prisma, context.actor, input),
      ),
      review: authed.company.review.handler(({ context }) =>
        companyForActor(deps.prisma, context.actor).review(),
      ),
      resolveCandidate: authed.company.resolveCandidate.handler(async ({ context, input }) => {
        await companyForActor(deps.prisma, context.actor).resolveCandidate(input);
        return { ok: true as const };
      }),
      fact: authed.company.fact.handler(({ context, input }) =>
        companyFact(deps.prisma, context.actor, input),
      ),
      confirm: authed.company.confirm.handler(async ({ context, input }) => {
        const store = companyForActor(deps.prisma, context.actor);
        if (input.kind === "entity") await store.confirm(input.id);
        else if (input.kind === "edge") await store.confirmEdge(input.id);
        else await store.confirmEvent(input.id);
        return { ok: true as const };
      }),
      reject: authed.company.reject.handler(async ({ context, input }) => {
        const store = companyForActor(deps.prisma, context.actor);
        if (input.kind === "entity") await store.reject(input.id);
        else if (input.kind === "edge") await store.rejectEdge(input.id);
        else await store.rejectEvent(input.id);
        return { ok: true as const };
      }),
      editEntity: authed.company.editEntity.handler(async ({ context, input }) => {
        await companyForActor(deps.prisma, context.actor).edit(input);
        return { ok: true as const };
      }),
      editEdge: authed.company.editEdge.handler(async ({ context, input }) => {
        await companyForActor(deps.prisma, context.actor).editEdge(input);
        return { ok: true as const };
      }),
      editEvent: authed.company.editEvent.handler(async ({ context, input }) => {
        await companyForActor(deps.prisma, context.actor).editEvent(input);
        return { ok: true as const };
      }),
    },
    companyImport: {
      agent: authed.companyImport.agent.handler(({ context }) =>
        ensureCompanyImporter({ repos }, context.actor),
      ),
      catalog: authed.companyImport.catalog.handler(({ context }) =>
        deps.companyImportPage
          ? deps.companyImportPage.catalog(context.actor)
          : { sources: [], folders: [] },
      ),
      channels: authed.companyImport.channels.handler(
        ({ context, input }) =>
          deps.companyImportPage?.channels(context.actor, input) ?? {
            channels: [],
            nextCursor: null,
          },
      ),
      session: authed.companyImport.session.handler(
        ({ context, input }) => deps.companyImportPage?.session(context.actor, input.runId) ?? null,
      ),
      sample: authed.companyImport.sample.handler(
        ({ context, input }) => deps.companyImportPage?.sample(context.actor, input.runId) ?? [],
      ),
      create: authed.companyImport.create.handler(
        ({ context, input }) =>
          deps.companyImportPage?.create(context.actor, input) ??
          deps.companyImport.create(context.actor, input),
      ),
      progress: authed.companyImport.progress.handler(({ context, input }) =>
        deps.companyImport.progress(context.actor, input.runId),
      ),
      consentStatus: authed.companyImport.consentStatus.handler(({ context, input }) =>
        deps.companyImport.consentStatus(context.actor, input.runId, input.sourceId),
      ),
      grantConsent: authed.companyImport.grantConsent.handler(({ context, input }) =>
        deps.companyImport.grantConsent(context.actor, input),
      ),
      start: authed.companyImport.start.handler(
        ({ context, input }) =>
          deps.companyImportPage?.start(context.actor, input.runId) ??
          deps.companyImport.start(context.actor, input.runId),
      ),
      action: authed.companyImport.action.handler(
        ({ context, input }) =>
          deps.companyImportPage?.action(
            context.actor,
            input.runId,
            input.action,
            input.tokenCap,
          ) ?? deps.companyImport.action(context.actor, input.runId, input.action, input.tokenCap),
      ),
      refreshStatus: authed.companyImport.refreshStatus.handler(({ context }) =>
        deps.companyImport.refreshStatus(context.actor),
      ),
      refresh: authed.companyImport.refresh.handler(({ context, input }) =>
        deps.companyImport.refresh(context.actor, input.sourceId),
      ),
      subscribe: authed.companyImport.subscribe.handler(async function* ({ context, input }) {
        const stream = deps.companyImport.follow(context.actor, input.runId, context.signal);
        const iterator = withHeartbeat(stream, {
          signal: context.signal,
          stillAuthorized: context.stillAuthorized,
          heartbeatMs: HEARTBEAT_MS,
          recheckMs: SESSION_RECHECK_MS,
        })[Symbol.asyncIterator]();
        let pending = iterator.next();
        try {
          yield await deps.companyImport.progress(context.actor, input.runId);
          while (true) {
            const next = await pending;
            if (next.done) return;
            if (next.value === HEARTBEAT) {
              yield await deps.companyImport.progress(context.actor, input.runId);
            } else {
              yield next.value;
            }
            pending = iterator.next();
          }
        } finally {
          await iterator.return?.(undefined);
        }
      }),
    },
    dataRoom: {
      agent: authed.dataRoom.agent.handler(({ context }) =>
        ensureDataRoomAgent({ repos }, context.actor),
      ),
      folders: authed.dataRoom.folders.handler(({ context }) => dataRoom.folders(context.actor)),
      facetValues: authed.dataRoom.facetValues.handler(({ context, input }) =>
        dataRoom.facetValues(context.actor, input),
      ),
      stats: authed.dataRoom.stats.handler(({ context, input }) =>
        dataRoom.stats(context.actor, input),
      ),
      folderCreate: authed.dataRoom.folderCreate.handler(({ context, input }) =>
        dataRoom.createFolder(context.actor, input),
      ),
      folderRename: authed.dataRoom.folderRename.handler(({ context, input }) =>
        dataRoom.renameFolder(context.actor, input),
      ),
      folderMove: authed.dataRoom.folderMove.handler(({ context, input }) =>
        dataRoom.moveFolder(context.actor, input),
      ),
      folderDelete: authed.dataRoom.folderDelete.handler(({ context, input }) =>
        dataRoom.deleteFolder(context.actor, input.id),
      ),
      items: {
        list: authed.dataRoom.items.list.handler(({ context, input }) =>
          dataRoom.items(context.actor, input),
        ),
      },
      item: authed.dataRoom.item.handler(({ context, input }) =>
        dataRoom.item(context.actor, input.id),
      ),
      itemRename: authed.dataRoom.itemRename.handler(({ context, input }) =>
        dataRoom.renameItem(context.actor, input),
      ),
      itemMove: authed.dataRoom.itemMove.handler(({ context, input }) =>
        dataRoom.moveItem(context.actor, input),
      ),
      itemDelete: authed.dataRoom.itemDelete.handler(({ context, input }) =>
        dataRoom.deleteItem(context.actor, input.id),
      ),
      itemRetry: authed.dataRoom.itemRetry.handler(({ context, input }) =>
        dataRoom.retryItem(context.actor, input.id),
      ),
      emailImported: authed.dataRoom.emailImported.handler(({ context, input }) =>
        dataRoom.emailImported(context.actor, input),
      ),
      importEmail: authed.dataRoom.importEmail.handler(({ context, input }) =>
        dataRoom.importEmail(context.actor, input, context.signal),
      ),
      driveList: authed.dataRoom.driveList.handler(({ context, input }) =>
        dataRoom.driveList(context.actor, input, context.signal),
      ),
      boxList: authed.dataRoom.boxList.handler(({ context, input }) =>
        dataRoom.boxList(context.actor, input, context.signal),
      ),
      importBox: authed.dataRoom.importBox.handler(({ context, input }) =>
        dataRoom.importBox(context.actor, input, context.signal),
      ),
      importDrive: authed.dataRoom.importDrive.handler(({ context, input }) =>
        dataRoom.importDrive(context.actor, input, context.signal),
      ),
      imports: authed.dataRoom.imports.handler(({ context }) => dataRoom.imports(context.actor)),
      processing: authed.dataRoom.processing.handler(({ context }) =>
        dataRoom.processing(context.actor),
      ),
      search: authed.dataRoom.search.handler(({ context, input }) =>
        dataRoom.search(context.actor, input),
      ),
      consent: authed.dataRoom.consent.handler(({ context }) => dataRoom.consent(context.actor)),
      consentGrant: authed.dataRoom.consentGrant.handler(({ context, input }) =>
        dataRoom.consentGrant(context.actor, input),
      ),
      autoSort: {
        plan: authed.dataRoom.autoSort.plan.handler(({ context }) =>
          dataRoom.autoSort.plan(context.actor),
        ),
        apply: authed.dataRoom.autoSort.apply.handler(({ context, input }) =>
          dataRoom.autoSort.apply(context.actor, input),
        ),
        undo: authed.dataRoom.autoSort.undo.handler(({ context, input }) =>
          dataRoom.autoSort.undo(context.actor, input.batchId),
        ),
      },
    },
    meetings: {
      connect: authed.meetings.connect.handler(({ context, input }) =>
        connectGranola(meetingsFor(context.actor), context.actor, input, context.signal),
      ),
      status: authed.meetings.status.handler(({ context }) =>
        granolaStatus(meetingsFor(context.actor), context.actor),
      ),
      disconnect: authed.meetings.disconnect.handler(({ context }) =>
        disconnectGranola(meetingsFor(context.actor), context.actor),
      ),
      refresh: authed.meetings.refresh.handler(({ context }) =>
        refreshGranola(meetingsFor(context.actor), context.actor),
      ),
      list: authed.meetings.list.handler(({ context, input }) =>
        listStoredMeetings(meetingsFor(context.actor), context.actor, input.cursor, input),
      ),
      get: authed.meetings.get.handler(({ context, input }) =>
        getStoredMeeting(meetingsFor(context.actor), context.actor, input.meetingId),
      ),
      mergeWithPrevious: authed.meetings.mergeWithPrevious.handler(({ context, input }) =>
        mergeStoredMeeting(meetingsFor(context.actor), context.actor, input.meetingId),
      ),
      delete: authed.meetings.delete.handler(({ context, input }) =>
        deleteStoredMeeting(meetingsFor(context.actor), context.actor, input.meetingId),
      ),
      connectLocal: authed.meetings.connectLocal.handler(({ context }) =>
        connectLocal(meetingsFor(context.actor), context.actor),
      ),
      localStatus: authed.meetings.localStatus.handler(({ context }) =>
        localStatus(meetingsFor(context.actor), context.actor),
      ),
      importLocal: authed.meetings.importLocal.handler(({ context, input }) =>
        importLocal(meetingsFor(context.actor), context.actor, input),
      ),
      disconnectLocal: authed.meetings.disconnectLocal.handler(({ context, input }) =>
        disconnectLocal(meetingsFor(context.actor), context.actor, input),
      ),
    },
    scanner: {
      agent: authed.scanner.agent.handler(async ({ context }) => {
        const bot = await ensureScannerAgent({ repos }, context.actor);
        await scheduleReadyScans(
          { prisma: deps.prisma, jobs: deps.jobs },
          { scope: { userId: context.actor.userId, spaceId: context.actor.spaceId } },
        ).catch(() => undefined);
        return bot;
      }),
    },
    meetingCaptures: {
      start: authed.meetingCaptures.start.handler(({ context, input }) =>
        startCapture(deps, context.actor, input),
      ),
      appendText: authed.meetingCaptures.appendText.handler(({ context, input }) =>
        appendCaptureText(deps, context.actor, input),
      ),
      finish: authed.meetingCaptures.finish.handler(({ context, input }) =>
        finishCapture(deps, context.actor, input),
      ),
      discard: authed.meetingCaptures.discard.handler(({ context, input }) =>
        discardCapture(deps, context.actor, input.captureId),
      ),
      active: authed.meetingCaptures.active.handler(({ context }) =>
        activeCapture(deps, context.actor),
      ),
    },
    omiCloud: {
      connect: authed.omiCloud.connect.handler(({ context, input }) =>
        connectOmiCloud(meetingsFor(context.actor), context.actor, input, context.signal),
      ),
      status: authed.omiCloud.status.handler(({ context }) =>
        omiCloudStatus(meetingsFor(context.actor), context.actor),
      ),
      disconnect: authed.omiCloud.disconnect.handler(({ context }) =>
        disconnectOmiCloud(meetingsFor(context.actor), context.actor),
      ),
    },
    omi: {
      connect: authed.omi.connect.handler(({ context, input }) =>
        connectOmi(
          {
            prisma: deps.prisma,
            jobs: deps.jobs,
            artifacts: deps.artifacts,
            agent: {
              prisma: deps.prisma,
              repos,
              archiveBot: (botId) => archiveActorBot(context.actor, botId),
            },
          },
          context.actor,
          input,
        ),
      ),
      status: authed.omi.status.handler(({ context }) => omiStatus(deps, context.actor)),
      deleteRecordings: authed.omi.deleteRecordings.handler(({ context }) =>
        deleteOmiRecordingsFor(deps, context.actor),
      ),
      disconnect: authed.omi.disconnect.handler(({ context, input }) =>
        disconnectOmi(deps, context.actor, input),
      ),
      retryTranscription: authed.omi.retryTranscription.handler(async ({ context }) => {
        await requeueOmiTranscriptions(deps, context.actor);
        return { ok: true as const };
      }),
      segments: {
        list: authed.omi.segments.list.handler(({ context, input }) =>
          input.days && !input.date
            ? listRecentOmiSegments(deps.prisma, context.actor, input.days)
            : listOmiSegments(deps.prisma, context.actor, input),
        ),
        move: authed.omi.segments.move.handler(({ context, input }) =>
          moveOmiSegment(deps, context.actor, input).catch(contactNotFound),
        ),
      },
    },
    devin: {
      sessions: authed.devin.sessions.handler(({ context }) =>
        devinSessions(devinDeps, context.actor),
      ),
      agent: authed.devin.agent.handler(({ context }) => devinAgent(devinDeps, context.actor)),
      connect: ownerOnly.devin.connect.handler(async ({ context, input }) => {
        await devinConnect(devinDeps, context.actor, input.secret);
        return { ok: true as const };
      }),
      replaceKey: ownerOnly.devin.replaceKey.handler(async ({ context, input }) => {
        await devinReplaceKey(devinDeps, context.actor, input.secret);
        return { ok: true as const };
      }),
      disconnect: ownerOnly.devin.disconnect.handler(async ({ context }) => {
        await devinDisconnect(devinDeps, context.actor);
        return { ok: true as const };
      }),
    },
    brexCards: {
      connect: ownerOnly.brexCards.connect.handler(({ context, input }) =>
        brexCardsConnect(brexCardsDeps, context.actor, input.token),
      ),
      replaceToken: ownerOnly.brexCards.replaceToken.handler(async ({ context, input }) => {
        await brexCardsReplaceToken(brexCardsDeps, context.actor, input.token);
        return { ok: true as const };
      }),
      cards: ownerOnly.brexCards.cards.handler(({ context }) =>
        brexCardsCards(brexCardsDeps, context.actor),
      ),
      overview: ownerOnly.brexCards.overview.handler(({ context }) =>
        brexCardsOverview(brexCardsDeps, context.actor),
      ),
      cardsView: ownerOnly.brexCards.cardsView.handler(({ context }) =>
        brexCardsView(brexCardsDeps, context.actor),
      ),
      spending: ownerOnly.brexCards.spending.handler(({ context, input }) =>
        brexCardsSpending(brexCardsDeps, context.actor, input),
      ),
      limits: ownerOnly.brexCards.limits.handler(({ context }) =>
        brexCardsLimits(brexCardsDeps, context.actor),
      ),
      people: ownerOnly.brexCards.people.handler(({ context }) =>
        brexCardsPeople(brexCardsDeps, context.actor),
      ),
      expenses: ownerOnly.brexCards.expenses.handler(({ context }) =>
        brexCardsExpenses(brexCardsDeps, context.actor),
      ),
      accounts: ownerOnly.brexCards.accounts.handler(({ context }) =>
        brexCardsAccounts(brexCardsDeps, context.actor),
      ),
      trips: ownerOnly.brexCards.trips.handler(({ context }) =>
        brexCardsTrips(brexCardsDeps, context.actor),
      ),
      activity: ownerOnly.brexCards.activity.handler(({ context }) =>
        brexCardsActivity(brexCardsDeps, context.actor),
      ),
      getControls: ownerOnly.brexCards.getControls.handler(({ context }) =>
        brexCardsGetControls(brexCardsDeps, context.actor),
      ),
      setControls: ownerOnly.brexCards.setControls.handler(({ context, input }) =>
        brexCardsSetControls(brexCardsDeps, context.actor, input),
      ),
    },
    gtm: {
      agent: authed.gtm.agent.handler(({ context }) =>
        ensureGtmAgent(
          {
            prisma: deps.prisma,
            repos,
            jobs: deps.jobs,
          },
          context.actor,
        ),
      ),
      overview: authed.gtm.overview.handler(({ context }) =>
        gtmOverview(
          {
            prisma: deps.prisma,
            secrets: deps.secrets,
            mcp: deps.gtmMcp ?? deps.mcp,
            queueReader: deps.gtmQueueReader,
          },
          context.actor,
          context.signal,
        ),
      ),
      queue: authed.gtm.queue.handler(({ context, input }) =>
        gtmQueue(
          {
            prisma: deps.prisma,
            secrets: deps.secrets,
            queueReader: deps.gtmQueueReader,
          },
          context.actor,
          input,
          context.signal,
        ),
      ),
      postingCapability: authed.gtm.postingCapability.handler(({ context }) =>
        gtmPostingCapability({ prisma: deps.prisma, secrets: deps.secrets }, context.actor),
      ),
    },
    legal: {
      agent: authed.legal.agent.handler(({ context }) => legalAgent(legalDeps, context.actor)),
      overview: authed.legal.overview.handler(({ context }) =>
        legalOverview(legalDeps, context.actor),
      ),
      safeCount: authed.legal.safeCount.handler(({ context }) =>
        legalSafeCount(legalDeps, context.actor),
      ),
      graph: authed.legal.graph.handler(({ context }) => legalGraph(legalDeps, context.actor)),
      doneDeadlines: authed.legal.doneDeadlines.handler(({ context }) =>
        legalDoneDeadlines(legalDeps, context.actor),
      ),
      updateDeadline: authed.legal.updateDeadline.handler(({ context, input }) =>
        legalUpdateDeadline(legalDeps, context.actor, input),
      ),
      itemLinks: authed.legal.itemLinks.handler(({ context, input }) =>
        legalItemLinks(legalDeps, context.actor, input.itemId),
      ),
      scanNow: authed.legal.scanNow.handler(({ context }) =>
        legalScanNow(legalDeps, context.actor),
      ),
      consent: authed.legal.consent.handler(({ context }) =>
        legalConsent(legalDeps, context.actor),
      ),
      consentGrant: authed.legal.consentGrant.handler(({ context, input }) =>
        legalConsentGrant(legalDeps, context.actor, input),
      ),
    },
    investors: {
      agent: authed.investors.agent.handler(({ context }) =>
        ensureInvestorsAgent({ prisma: deps.prisma, jobs: deps.jobs, repos }, context.actor),
      ),
      audits: {
        list: authed.investors.audits.list.handler(({ context, input }) =>
          listAuditRequests(deps.prisma, context.actor, input.includeDone),
        ),
        update: authed.investors.audits.update.handler(({ context, input }) =>
          closeAuditRequest(deps.prisma, context.actor, input.id, input.status).catch(
            contactNotFound,
          ),
        ),
        draft: authed.investors.audits.draft.handler(async ({ context, input }) => {
          const actor = context.actor;
          const scope = actorScope(actor);
          const request = await getAuditRequest(deps.prisma, scope, input.id).catch(
            contactNotFound,
          );
          if (request.status !== "open")
            throw new ORPCError("BAD_REQUEST", { message: "This request is already drafted" });
          if (!(await cartaSyncDeps.hasModel(actor)))
            throw new ORPCError("BAD_REQUEST", { message: "Add a model before drafting" });
          // The button is not capped; the agent is created here if Investors was never opened.
          const created = await ensureInvestorsAgent(
            { prisma: deps.prisma, jobs: deps.jobs, repos },
            actor,
          );
          const bot = (await findInvestorsAgent(deps.prisma, scope)) ?? {
            id: created.id,
            threadId: created.threadId,
          };
          if (!(await claimAuditDraft(deps.prisma, scope, input.id, null)))
            return getAuditRequest(deps.prisma, scope, input.id);
          try {
            await startAuditDraftRun(
              { prisma: deps.prisma, enqueueRun: cartaSyncDeps.enqueueRun },
              scope,
              bot,
              {
                requestId: request.id,
                messageId: await latestAuditMessageId(deps.prisma, scope, request.mailThreadId),
                mailThreadId: request.mailThreadId,
                filedItemIds: request.dataRoomItemId ? [request.dataRoomItemId] : [],
                senderKnown: request.senderKnown,
              },
            );
          } catch (error) {
            await releaseAuditDraft(deps.prisma, scope, input.id);
            throw error;
          }
          return getAuditRequest(deps.prisma, scope, input.id);
        }),
      },
      updates: {
        list: authed.investors.updates.list.handler(({ context }) =>
          listInvestorUpdates(deps.prisma, context.actor),
        ),
        accounts: authed.investors.updates.accounts.handler(async ({ context }) =>
          (
            await deps.mail.listAccounts(
              { spaceId: context.actor.spaceId, userId: context.actor.userId },
              mailContext(context.actor, "investors.updates.accounts"),
            )
          ).map(accountOut),
        ),
        get: authed.investors.updates.get.handler(({ context, input }) =>
          getInvestorUpdate(deps.prisma, context.actor, input.id).catch(contactNotFound),
        ),
        save: authed.investors.updates.save.handler(({ context, input }) =>
          saveInvestorUpdate(deps.prisma, context.actor, input).catch(investorUpdateError),
        ),
        send: authed.investors.updates.send.handler(
          async ({ context, input }) =>
            (
              await startInvestorUpdateSend(investorSendDeps, context.actor, input.id).catch(
                investorUpdateError,
              )
            ).update,
        ),
        retry: authed.investors.updates.retry.handler(
          async ({ context, input }) =>
            (
              await startInvestorUpdateRetry(investorSendDeps, context.actor, input).catch(
                investorUpdateError,
              )
            ).update,
        ),
        markDelivered: authed.investors.updates.markDelivered.handler(({ context, input }) =>
          markInvestorUpdateDelivered(deps.prisma, context.actor, input.id, input.contactIds).catch(
            investorUpdateError,
          ),
        ),
        duplicate: authed.investors.updates.duplicate.handler(({ context, input }) =>
          duplicateInvestorUpdate(deps.prisma, context.actor, input.id).catch(investorUpdateError),
        ),
        delete: authed.investors.updates.delete.handler(async ({ context, input }) => {
          await deleteInvestorUpdate(deps.prisma, context.actor, input.id).catch(
            investorUpdateError,
          );
          return { ok: true as const };
        }),
        post: authed.investors.updates.post.handler(({ context, input }) =>
          postInvestorUpdate(investorSendDeps, context.actor, input.id).catch(investorUpdateError),
        ),
      },
      shares: authed.investors.shares.handler(({ context, input }) =>
        listShareContactIds(deps.prisma, context.actor, input.itemId),
      ),
      share: authed.investors.share.handler(async ({ context, input }) => {
        const itemIds = [
          ...new Set([...(input.itemId ? [input.itemId] : []), ...(input.itemIds ?? [])]),
        ];
        const { requestKey } = input;
        // A replay of a delivered key sends nothing; one still in flight is a CONFLICT.
        if (
          requestKey &&
          (await claimShareRequest(deps.prisma, context.actor, {
            itemIds,
            contactIds: input.contactIds,
            emailLink: input.emailLink,
            requestKey,
          }).catch(investorUpdateError)) === "delivered"
        )
          return { links: [] };
        try {
          const { items, added } = await shareDocuments(
            deps.prisma,
            context.actor,
            itemIds,
            input.contactIds,
          ).catch(investorUpdateError);
          // The one-file form keeps its not-found refusal; a batch reports that file instead.
          if (!input.itemIds?.length && !items.every((item) => item.shared))
            investorUpdateError(new IsolationError("Document not found"));
          // Without "Email them a link" nothing is minted: Copy link on the contact makes one later.
          // Each contact who gained at least one file gets one mail listing them.
          const { links } = input.emailLink
            ? await deliverPortalLinks(investorSendDeps, context.actor, [...added.keys()], {
                copy: false,
                files: added,
              }).catch(investorUpdateError)
            : { links: [] };
          if (requestKey) await completeShareRequest(deps.prisma, context.actor, requestKey);
          return { links, items };
        } catch (error) {
          if (requestKey) await releaseShareRequest(deps.prisma, context.actor, requestKey);
          throw error;
        }
      }),
      unshare: authed.investors.unshare.handler(async ({ context, input }) => {
        await unshareDocument(deps.prisma, context.actor, input.itemId, input.contactId);
        return { ok: true as const };
      }),
      portalResend: authed.investors.portalResend.handler(async ({ context, input }) => {
        const { links } = await deliverPortalLinks(
          investorSendDeps,
          context.actor,
          [input.contactId],
          { copy: input.copy === true, strict: true },
        ).catch(investorUpdateError);
        return { link: links[0]?.link ?? null };
      }),
      portalRevoke: authed.investors.portalRevoke.handler(async ({ context, input }) => {
        const scope = actorScope(context.actor);
        await revokePortal(deps.prisma, scope, input.contactId).catch(contactNotFound);
        return getContact(deps.prisma, scope, input.contactId).catch(contactNotFound);
      }),
      portalUnblock: authed.investors.portalUnblock.handler(async ({ context, input }) => {
        const scope = actorScope(context.actor);
        await unblockPortal(deps.prisma, scope, input.contactId).catch(contactNotFound);
        return getContact(deps.prisma, scope, input.contactId).catch(contactNotFound);
      }),
      reminder: authed.investors.reminder.handler(async ({ context, input }) => {
        const bot = await ensureInvestorsAgent(
          { prisma: deps.prisma, jobs: deps.jobs, repos },
          context.actor,
        );
        if (input.cadence)
          return {
            cadence: await setInvestorsReminder(
              { prisma: deps.prisma, jobs: deps.jobs },
              context.actor,
              bot.id,
              input.cadence,
            ),
          };
        const routine = await deps.prisma.routine.findFirst({
          where: {
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            botId: bot.id,
            name: INVESTOR_UPDATE_ROUTINE_NAME,
          },
        });
        return { cadence: routine ? cadenceOf(routine) : ("monthly" as const) };
      }),
      capTable: authed.investors.capTable.handler(({ context }) => capTableState(context.actor)),
      refresh: authed.investors.refresh.handler(async ({ context }) => {
        const current = await deps.prisma.capTableSnapshot.findUnique({
          where: { spaceId_userId: actorScope(context.actor) },
          select: { source: true },
        });
        if (current?.source === "sheet") {
          await readSheet(context.actor);
          return { ok: true as const };
        }
        const cartaServers = (
          await deps.prisma.mcpServer.findMany({ where: actorScope(context.actor) })
        ).filter((server) => server.enabled && isCartaEndpoint(server.endpoint));
        const statuses = await Promise.all(
          cartaServers.map((server) => mcpOAuth.statusFor(server, context.actor)),
        );
        if (!statuses.includes("connected"))
          throw new ORPCError("BAD_REQUEST", { message: "Connect Carta first" });
        const result = await startCartaSync(cartaSyncDeps, context.actor);
        if (result === "no_model")
          throw new ORPCError("BAD_REQUEST", { message: "Add a model before refreshing" });
        if (result === "other_source")
          throw new ORPCError("BAD_REQUEST", { message: "The cap table is not read from Carta" });
        return { ok: true as const };
      }),
      useSheet: authed.investors.useSheet.handler(async ({ context, input }) => {
        const space = await deps.prisma.space.findUnique({
          where: { id: context.actor.spaceId },
          select: { name: true },
        });
        if (!space) throw new ORPCError("NOT_FOUND");
        await changeCapTableSource(deps.prisma, actorScope(context.actor), {
          source: "sheet",
          sourceRef: input,
          companyName: space.name,
        }).catch(capTableConflict);
        await readSheet(context.actor);
        return capTableState(context.actor);
      }),
      capTableSave: authed.investors.capTableSave.handler(async ({ context, input }) => {
        // Once the ledger has data it is the record: a typed-in save would never show.
        if (await equityLedgerHasData(deps.prisma, actorScope(context.actor)))
          throw new ORPCError("CONFLICT", {
            message: "The cap table is kept on the Cap table page.",
          });
        await saveCapTableSnapshot(
          deps.prisma,
          actorScope(context.actor),
          { ...input.table, source: "native" },
          { loadedAt: input.updatedAt },
        ).catch(capTableConflict);
        return capTableState(context.actor);
      }),
      changeSource: authed.investors.changeSource.handler(async ({ context, input }) => {
        const space = await deps.prisma.space.findUnique({
          where: { id: context.actor.spaceId },
          select: { name: true },
        });
        if (!space) throw new ORPCError("NOT_FOUND");
        await changeCapTableSource(deps.prisma, actorScope(context.actor), {
          ...input,
          companyName: space.name,
        }).catch(capTableConflict);
        return capTableState(context.actor);
      }),
      undoSource: authed.investors.undoSource.handler(async ({ context }) => {
        await undoCapTableSource(deps.prisma, actorScope(context.actor));
        return capTableState(context.actor);
      }),
    },
    fundraising: {
      overview: authed.fundraising.overview.handler(({ context }) =>
        fundraisingOverview(fundraisingDeps, context.actor),
      ),
      refresh: authed.fundraising.refresh.handler(({ context, signal }) =>
        fundraisingRefresh(fundraisingDeps, context.actor, signal),
      ),
      round: {
        save: authed.fundraising.round.save.handler(({ context, input }) =>
          saveRound(deps.prisma, actorScope(context.actor), input).catch(fundraisingError),
        ),
        close: authed.fundraising.round.close.handler(({ context, input }) =>
          closeRound(deps.prisma, actorScope(context.actor), input.id).catch(fundraisingError),
        ),
        reopen: authed.fundraising.round.reopen.handler(({ context, input }) =>
          reopenRound(deps.prisma, actorScope(context.actor), input.id).catch(fundraisingError),
        ),
      },
      prospects: {
        save: authed.fundraising.prospects.save.handler(({ context, input }) =>
          saveProspect(deps.prisma, actorScope(context.actor), input).catch(fundraisingError),
        ),
        markWaiting: authed.fundraising.prospects.markWaiting.handler(({ context, input }) =>
          markWaiting(deps.prisma, actorScope(context.actor), input.id).catch(fundraisingError),
        ),
        notSent: authed.fundraising.prospects.notSent.handler(({ context, input }) =>
          notSent(deps.prisma, actorScope(context.actor), input.id).catch(fundraisingError),
        ),
      },
      calls: {
        log: authed.fundraising.calls.log.handler(({ context, input }) =>
          logCall(deps.prisma, actorScope(context.actor), input).catch(fundraisingError),
        ),
        undo: authed.fundraising.calls.undo.handler(({ context, input }) =>
          undoCall(deps.prisma, actorScope(context.actor), input.eventId)
            .then(() => ({ ok: true as const }))
            .catch(fundraisingError),
        ),
      },
      auto: {
        undo: authed.fundraising.auto.undo.handler(({ context, input }) =>
          undoAutoChange(deps.prisma, actorScope(context.actor), input.eventId)
            .then(() => ({ ok: true as const }))
            .catch(fundraisingError),
        ),
      },
      safes: {
        list: authed.fundraising.safes.list.handler(({ context }) =>
          safesList(fundraisingDeps, context.actor),
        ),
        save: authed.fundraising.safes.save.handler(({ context, input }) =>
          saveSafe(deps.prisma, actorScope(context.actor), input).catch(fundraisingError),
        ),
        mark: authed.fundraising.safes.mark.handler(({ context, input }) =>
          markSafe(deps.prisma, actorScope(context.actor), input).catch(fundraisingError),
        ),
        assign: authed.fundraising.safes.assign.handler(({ context, input }) =>
          assignSafe(deps.prisma, actorScope(context.actor), input.id, input.contactId).catch(
            fundraisingError,
          ),
        ),
        unassign: authed.fundraising.safes.unassign.handler(({ context, input }) =>
          unassignSafe(deps.prisma, actorScope(context.actor), input.id).catch(fundraisingError),
        ),
        delete: authed.fundraising.safes.delete.handler(async ({ context, input }) => {
          await deleteSafe(deps.prisma, actorScope(context.actor), input.id).catch(
            fundraisingError,
          );
          return { ok: true as const };
        }),
      },
    },
    carta: {
      agent: authed.carta.agent.handler(({ context }) =>
        ensureCartaAgent({ prisma: deps.prisma, repos }, context.actor),
      ),
    },
    sidebarPages: {
      list: authed.sidebarPages.list.handler(({ context }) =>
        listSidebarPages(deps.prisma, actorScope(context.actor)),
      ),
      add: authed.sidebarPages.add.handler(({ context, input }) =>
        ("pageId" in input
          ? addSidebarBotPage(deps.prisma, actorScope(context.actor), input.pageId)
          : addSidebarPage(deps.prisma, actorScope(context.actor), input.templateKey)
        ).catch(sidebarPageError),
      ),
      remove: authed.sidebarPages.remove.handler(({ context, input }) =>
        "pageId" in input
          ? removeSidebarBotPage(deps.prisma, actorScope(context.actor), input.pageId)
          : removeSidebarPage(deps.prisma, actorScope(context.actor), input.templateKey),
      ),
    },
    calendar: {
      agenda: authed.calendar.agenda.handler(async ({ context, input }) => {
        const scope = actorScope(context.actor);
        const accounts = await listCalendarAccounts(deps.prisma, scope);
        return calendarAgenda(
          { prisma: deps.prisma, connectors: deps.connectors },
          scope,
          { from: new Date(input.from), to: new Date(input.to) },
          accounts.length > 0
            ? {
                accounts,
                context: connectionContext(
                  scope,
                  `calendar-agenda:${randomUUID()}`,
                  context.signal,
                ),
              }
            : null,
          // The apps' popovers show who is attending; the bot tool calls without this flag.
          { sources: input.sources ?? "all", attendees: true },
        );
      }),
    },
    contacts: {
      list: authed.contacts.list.handler(async ({ context, input }) => {
        const scope = actorScope(context.actor);
        queueContactPhotos(scope);
        return withContactPhotos(deps.prisma, scope, await listContacts(deps.prisma, scope, input));
      }),
      detail: authed.contacts.detail.handler(async ({ context, input }) => {
        const scope = actorScope(context.actor);
        queueContactPhotos(scope);
        const detail = await contactDetail(deps.prisma, scope, input.id).catch(contactNotFound);
        const [contact] = await withContactPhotos(deps.prisma, scope, [detail.contact]);
        return { ...detail, contact: contact! };
      }),
      save: authed.contacts.save.handler(({ context, input }) =>
        saveContact(deps.prisma, actorScope(context.actor), input).catch(contactNotFound),
      ),
      delete: authed.contacts.delete.handler(async ({ context, input }) => {
        await deleteContact(deps.prisma, actorScope(context.actor), input.id).catch(
          contactNotFound,
        );
        return { ok: true as const };
      }),
      linked: authed.contacts.linked.handler(({ context, input }) =>
        linkedContact(deps.prisma, actorScope(context.actor), input.id).catch(contactNotFound),
      ),
    },
    finance: {
      agent: authed.finance.agent.handler(({ context }) =>
        financeAgent(financeDeps, context.actor),
      ),
      overview: authed.finance.overview.handler(({ context }) =>
        financeOverview(financeDeps, context.actor, context.signal),
      ),
      refresh: authed.finance.refresh.handler(({ context }) =>
        financeRefresh(financeDeps, context.actor, context.signal),
      ),
      connect: authed.finance.connect.handler(({ context, input }) =>
        financeConnect(financeDeps, context.actor, input),
      ),
      wallets: authed.finance.wallets.handler(({ context }) =>
        financeWallets(financeDeps, context.actor),
      ),
      walletAdd: authed.finance.walletAdd.handler(({ context, input }) =>
        financeWalletAdd(financeDeps, context.actor, input, context.signal),
      ),
      walletUpdate: authed.finance.walletUpdate.handler(({ context, input }) =>
        financeWalletUpdate(financeDeps, context.actor, input),
      ),
      walletRemove: authed.finance.walletRemove.handler(({ context, input }) =>
        financeWalletRemove(financeDeps, context.actor, input),
      ),
      crypto: authed.finance.crypto.handler(({ context }) =>
        financeCrypto(financeDeps, context.actor),
      ),
      cryptoConnect: authed.finance.cryptoConnect.handler(({ context, input }) =>
        financeCryptoConnect(financeDeps, context.actor, input),
      ),
      exchanges: authed.finance.exchanges.handler(({ context }) =>
        financeExchanges(financeDeps, context.actor),
      ),
      exchangeConnect: authed.finance.exchangeConnect.handler(({ context, input }) =>
        financeExchangeConnect(financeDeps, context.actor, input, context.signal),
      ),
      exchangeRemove: authed.finance.exchangeRemove.handler(({ context, input }) =>
        financeExchangeRemove(financeDeps, context.actor, input),
      ),
      cryptoProviderConnect: authed.finance.cryptoProviderConnect.handler(({ context, input }) =>
        financeCryptoProviderConnect(financeDeps, context.actor, input),
      ),
      statements: authed.finance.statements.handler(({ context }) =>
        financeStatements(financeDeps, context.actor),
      ),
      statementUpload: authed.finance.statementUpload.handler(({ context, input }) =>
        financeStatementUpload(financeDeps, context.actor, input),
      ),
      statementConfirm: authed.finance.statementConfirm.handler(({ context, input }) =>
        financeStatementConfirm(financeDeps, context.actor, input),
      ),
      statementDiscard: authed.finance.statementDiscard.handler(({ context, input }) =>
        financeStatementDiscard(financeDeps, context.actor, input),
      ),
      statementAccountRename: authed.finance.statementAccountRename.handler(({ context, input }) =>
        financeStatementAccountRename(financeDeps, context.actor, input),
      ),
      cryptoProviderRemove: authed.finance.cryptoProviderRemove.handler(({ context }) =>
        financeCryptoProviderRemove(financeDeps, context.actor),
      ),
      accounts: authed.finance.accounts.handler(({ context }) =>
        financeAccounts(financeDeps, context.actor),
      ),
      account: authed.finance.account.handler(({ context, input }) =>
        financeAccountDetail(financeDeps, context.actor, input),
      ),
      burn: authed.finance.burn.handler(({ context }) => financeBurn(financeDeps, context.actor)),
      month: authed.finance.month.handler(({ context, input }) =>
        financeMonth(financeDeps, context.actor, input),
      ),
      runway: authed.finance.runway.handler(({ context }) =>
        financeRunway(financeDeps, context.actor),
      ),
      balanceSeries: authed.finance.balanceSeries.handler(({ context, input }) =>
        financeBalanceSeries(financeDeps, context.actor, input),
      ),
      preferences: authed.finance.preferences.handler(({ context }) =>
        financePreferences(financeDeps, context.actor),
      ),
      setPreferences: authed.finance.setPreferences.handler(({ context, input }) =>
        financeSetPreferences(financeDeps, context.actor, input),
      ),
      chartNotes: authed.finance.chartNotes.handler(({ context, input }) =>
        financeChartNotes(financeDeps, context.actor, input),
      ),
      chartNoteAdd: authed.finance.chartNoteAdd.handler(({ context, input }) =>
        financeChartNoteAdd(financeDeps, context.actor, input),
      ),
      chartNoteDelete: authed.finance.chartNoteDelete.handler(({ context, input }) =>
        financeChartNoteDelete(financeDeps, context.actor, input),
      ),
      cryptoHistory: authed.finance.cryptoHistory.handler(({ context, input }) =>
        financeCryptoHistory(financeDeps, context.actor, input),
      ),
      spend: authed.finance.spend.handler(({ context, input }) =>
        financeSpend(financeDeps, context.actor, input),
      ),
      category: authed.finance.category.handler(({ context, input }) =>
        financeCategory(financeDeps, context.actor, input),
      ),
      recurring: authed.finance.recurring.handler(({ context, input }) =>
        financeRecurring(financeDeps, context.actor, input),
      ),
      vendor: authed.finance.vendor.handler(({ context, input }) =>
        financeVendor(financeDeps, context.actor, input),
      ),
      transaction: authed.finance.transaction.handler(({ context, input }) =>
        financeTransaction(financeDeps, context.actor, input),
      ),
      receiptUrl: authed.finance.receiptUrl.handler(({ context, input }) =>
        financeReceiptUrl(financeDeps, context.actor, input, context.signal),
      ),
    },
    inbox: {
      agent: authed.inbox.agent.handler(async ({ context }) =>
        ensureInboxAgent(repos, context.actor),
      ),
      askAgent: authed.inbox.askAgent.handler(({ context, input }) =>
        inboxAskAgent({ ...deps, repos }, context.actor, input, context.signal),
      ),
      personContext: authed.inbox.personContext.handler(({ context, input }) =>
        inboxPersonContext(personContextDeps, context.actor, input, context.signal),
      ),
      personSummary: authed.inbox.personSummary.handler(({ context, input }) =>
        inboxPersonSummary(personContextDeps, context.actor, input, context.signal),
      ),
      reviewAttachment: authed.inbox.reviewAttachment.handler(({ context, input }) =>
        inboxReviewAttachment(deps, context.actor, input, context.signal),
      ),
      list: authed.inbox.list.handler(({ context, input }) =>
        inboxList(deps, context.actor, input, context.signal),
      ),
      refresh: authed.inbox.refresh.handler(({ context, input }) =>
        inboxRefresh(deps, context.actor, input, context.signal),
      ),
      get: authed.inbox.get.handler(({ context, input }) =>
        inboxGet(deps, context.actor, input, context.signal),
      ),
      unreadCount: authed.inbox.unreadCount.handler(({ context }) =>
        inboxUnreadCount(deps, context.actor),
      ),
      noReply: authed.inbox.noReply.handler(({ context, input }) =>
        inboxNoReply(deps, context.actor, input),
      ),
      feedback: authed.inbox.feedback.handler(({ context, input }) =>
        inboxFeedbackSet(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          input,
        ),
      ),
      markRead: authed.inbox.markRead.handler(({ context, input }) =>
        inboxMarkRead(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          input,
          context.signal,
        ),
      ),
      markReadMany: authed.inbox.markReadMany.handler(({ context, input }) =>
        inboxMarkReadMany(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          input,
          context.signal,
        ),
      ),
      track: authed.inbox.track.handler(({ context, input }) =>
        inboxTrack(deps.prisma, context.actor, input.messageId),
      ),
      untrack: authed.inbox.untrack.handler(({ context, input }) =>
        inboxUntrack(deps.prisma, context.actor, input.messageId),
      ),
      archive: authed.inbox.archive.handler(({ context, input }) =>
        inboxArchive(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          input,
          context.signal,
        ),
      ),
      unarchive: authed.inbox.unarchive.handler(({ context, input }) =>
        inboxUnarchive(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          input,
          context.signal,
        ),
      ),
      archiveMany: authed.inbox.archiveMany.handler(({ context, input }) =>
        inboxArchiveMany(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          input,
          context.signal,
        ),
      ),
      unarchiveMany: authed.inbox.unarchiveMany.handler(({ context, input }) =>
        inboxUnarchiveMany(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          input,
          context.signal,
        ),
      ),
      moveMany: authed.inbox.moveMany.handler(({ context, input }) =>
        inboxMoveMany(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          input,
          context.signal,
        ),
      ),
      unsubscribe: authed.inbox.unsubscribe.handler(({ context, input }) =>
        inboxUnsubscribe(
          { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
          context.actor,
          input,
          context.signal,
        ),
      ),
      cleanup: {
        list: authed.inbox.cleanup.list.handler(({ context, input }) =>
          inboxCleanupList(deps, context.actor, input),
        ),
        archive: authed.inbox.cleanup.archive.handler(({ context, input }) =>
          inboxCleanupArchive(
            { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
            context.actor,
            input,
            context.signal,
          ),
        ),
        forget: authed.inbox.cleanup.forget.handler(({ context, input }) =>
          inboxCleanupForget(
            { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
            context.actor,
            input,
            context.signal,
          ),
        ),
      },
      actions: {
        list: authed.inbox.actions.list.handler(({ context }) =>
          inboxActionsList(deps, context.actor),
        ),
        undo: authed.inbox.actions.undo.handler(({ context, input }) =>
          inboxActionsUndo(
            { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
            context.actor,
            input,
            context.signal,
          ),
        ),
      },
      compose: {
        prefill: authed.inbox.compose.prefill.handler(({ context, input }) =>
          inboxComposePrefill(deps, context.actor, input, context.signal),
        ),
        draftSave: authed.inbox.compose.draftSave.handler(({ context, input }) =>
          inboxComposeDraftSave(
            { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
            context.actor,
            input,
            context.signal,
          ),
        ),
        send: authed.inbox.compose.send.handler(({ context, input }) =>
          inboxComposeSend(
            { ...deps, mailWritesDisabled: deps.env.mailWritesDisabled },
            context.actor,
            input,
          ),
        ),
        discard: authed.inbox.compose.discard.handler(({ context, input }) =>
          inboxComposeDiscard(deps, context.actor, input, context.signal),
        ),
      },
      todos: {
        list: authed.inbox.todos.list.handler(({ context, input }) =>
          inboxTodosList(deps, context.actor, input),
        ),
        setDone: authed.inbox.todos.setDone.handler(({ context, input }) =>
          inboxTodoSetDone(deps, context.actor, input),
        ),
      },
    },
    artifacts: {
      listSpace: authed.artifacts.listSpace.handler(async ({ context, input }) => {
        if (input.botId) await repos.getBot(context.actor, input.botId);
        try {
          return await listSpaceArtifacts(deps, context.actor, input);
        } catch (error) {
          if (error instanceof ArtifactListCursorError) {
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      }),
      listVersions: authed.artifacts.listVersions.handler(async ({ context, input }) => {
        return listArtifactVersions(deps, context.actor, input);
      }),
      create: authed.artifacts.create.handler(async ({ context, input }) => {
        const botId = input.botId
          ? (await repos.getBot(context.actor, input.botId)).id
          : (await groupRepos.getGroupTarget(context.actor, input.groupId!)).members[0]?.bot.id;
        if (!botId) throw new IsolationError();
        try {
          return await createOwnedArtifact(deps, context.actor, { ...input, botId });
        } catch (error) {
          if (error instanceof AttachmentValidationError) {
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      }),
      get: authed.artifacts.get.handler(async ({ context, input }) => {
        if (input.groupId) {
          const group = await groupRepos.getGroupTarget(context.actor, input.groupId);
          const contextBotId = group.members[0]?.bot.id;
          if (!contextBotId) throw new IsolationError();
          return getSpaceArtifact(deps, context.actor, {
            artifactId: input.artifactId,
            groupId: input.groupId,
            contextBotId,
          });
        }
        await repos.getBot(context.actor, input.botId!);
        return getOwnedArtifact(deps, context.actor, {
          botId: input.botId!,
          artifactId: input.artifactId,
        });
      }),
      getById: authed.artifacts.getById.handler(async ({ context, input }) => {
        return getSpaceArtifactById(deps, context.actor, input);
      }),
      remove: authed.artifacts.remove.handler(async ({ context, input }) => {
        return deleteArtifactFamily(deps, context.actor, { familyId: input.artifactId });
      }),
    },
    artifactShares: {
      get: authed.artifactShares.get.handler(async ({ context, input }) =>
        shareJson(await getArtifactShare(deps.prisma, context.actor, input.artifactId)),
      ),
      create: authed.artifactShares.create.handler(async ({ context, input }) => {
        try {
          const { token } = await createArtifactShare(
            deps.prisma,
            context.actor,
            input.artifactId,
            isShareableArtifactMimeType,
          );
          const share = await getArtifactShare(deps.prisma, context.actor, input.artifactId);
          return {
            url: `${deps.env.webOrigin}/s#${token}`,
            share: shareJson(share)!,
          };
        } catch (error) {
          if (error instanceof UnshareableArtifactError) {
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      }),
      revoke: authed.artifactShares.revoke.handler(async ({ context, input }) => {
        await revokeArtifactShare(deps.prisma, context.actor, input.artifactId);
        return { ok: true as const };
      }),
    },
    files: {
      spreadsheetPreview: authed.files.spreadsheetPreview.handler(({ context, input }) =>
        spreadsheetPreview(deps, context.actor, input),
      ),
    },
    usage: {
      list: authed.usage.list.handler(async ({ context }) => {
        const rows = await deps.prisma.usageRecord.findMany({
          where: { spaceId: context.actor.spaceId, userId: context.actor.userId },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return rows.map((row) => ({
          id: row.id,
          botId: row.botId,
          runId: row.runId,
          provider: row.provider,
          model: row.model,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          cacheReadTokens: row.cacheReadTokens,
          cacheWriteTokens: row.cacheWriteTokens,
          cacheWrite1hTokens: row.cacheWrite1hTokens,
          reasoningTokens: row.reasoningTokens,
          totalTokens: row.totalTokens,
          costUsd: row.costUsd,
          costSource: row.costSource,
          pricingVersion: row.pricingVersion,
          usageSource: row.usageSource,
          callId: row.callId,
          operationId: row.operationId,
          operationKind: row.operationKind as UsageOperationKind,
          parentRunId: row.parentRunId,
          agentId: row.agentId,
          createdAt: row.createdAt.toISOString(),
        }));
      }),
      summary: authed.usage.summary.handler(async ({ context }) => {
        const [result, runGroups] = await Promise.all([
          deps.prisma.usageRecord.aggregate({
            where: { spaceId: context.actor.spaceId, userId: context.actor.userId },
            _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
            _count: { _all: true, inputTokens: true, outputTokens: true, totalTokens: true },
          }),
          deps.prisma.usageRecord.groupBy({
            by: ["runId", "parentRunId"],
            where: { spaceId: context.actor.spaceId, userId: context.actor.userId },
          }),
        ]);
        const runs = new Set(runGroups.map((row) => row.parentRunId ?? row.runId).filter(Boolean))
          .size;
        const completeSum = (field: "inputTokens" | "outputTokens" | "totalTokens") =>
          result._count[field] === result._count._all ? (result._sum[field] ?? 0) : null;
        return {
          inputTokens: completeSum("inputTokens"),
          outputTokens: completeSum("outputTokens"),
          totalTokens: completeSum("totalTokens"),
          modelCalls: result._count._all,
          runs,
        };
      }),
    },
    account: {
      exportRequest: authed.account.exportRequest.handler(({ context }) =>
        requestAccountExport({ prisma: deps.prisma, jobs: deps.jobs }, context.actor),
      ),
      exportLatest: authed.account.exportLatest.handler(({ context }) =>
        latestAccountExport(deps.prisma, context.actor.userId),
      ),
    },
    export: {
      bot: authed.export.bot.handler(async ({ context, input }) => {
        const bot = await repos.getBot(context.actor, input.botId);
        if (!bot.thread || !bot.computer) throw new IsolationError();
        const homeKey = bot.computer.homeKey;
        const computerMode = parseComputerMode(bot.computer.scope);
        const exportContext = {
          operationId: "export",
          traceId: "export",
          spaceId: context.actor.spaceId,
          userId: context.actor.userId,
          signal: new AbortController().signal,
        };
        const [memory, routines, files, history] = await Promise.all([
          deps.prisma.memoryDocument.findMany({
            where: {
              botId: input.botId,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              scope: "bot",
            },
          }),
          deps.prisma.routine.findMany({
            where: {
              botId: input.botId,
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
            },
          }),
          (async () => {
            const exported: ExportManifest["files"] = [];
            const directory = resolveBotWorkspacePath(computerMode, bot.id, "");
            // Root dotfiles contain computer state rather than portable bot files.
            for await (const file of deps.home.exportHome(homeKey, exportContext, {
              directory,
              skipHidden: true,
            })) {
              exported.push(exportFile(file.path, file.content));
            }
            return exported;
          })(),
          loadAllMessages(deps.prisma, bot.thread.id, EXPORT_MESSAGE_PAGE_SIZE),
        ]);
        return {
          version: 1 as const,
          exportedAt: new Date().toISOString(),
          bot: {
            name: bot.name,
            title: bot.title,
            description: bot.description,
            instructions: bot.instructions,
          },
          memory: memory.map((m) => ({ path: m.path, content: m.content })),
          routines: routines.map((r) => ({
            name: r.name,
            prompt: r.prompt,
            crons: r.crons,
            timezone: r.timezone,
          })),
          files,
          history,
        };
      }),
    },
    notifications: {
      registerPush: authed.notifications.registerPush.handler(async ({ context, input }) => {
        const sessionId = context.sessionId;
        if (!sessionId) throw new ORPCError("UNAUTHORIZED");
        try {
          await savePushToken(deps.prisma, context.actor.userId, input.token, sessionId, {
            replacesToken: input.replacesToken,
            platform: input.platform,
            sessionActive: async () => {
              const expiresAt = await pushSessionExpiresAt(deps.prisma, sessionId);
              return expiresAt !== null && expiresAt.getTime() > Date.now();
            },
          });
        } catch (error) {
          if (error instanceof PushSessionEndedError) throw new ORPCError("UNAUTHORIZED");
          throw error;
        }
        return { ok: true as const };
      }),
      preferences: authed.notifications.preferences.handler(async ({ context }) => {
        const { actor } = context;
        const [preferences, endpoints, imessage] = await Promise.all([
          getNotificationPreferences(deps.prisma, actor),
          listPushEndpoints(deps.prisma, actor.userId),
          linkedImessageIdentities(deps.prisma, actor),
        ]);
        return { ...preferences, hasPhone: endpoints.length > 0, hasImessage: imessage.length > 0 };
      }),
      updatePreferences: authed.notifications.updatePreferences.handler(
        async ({ context, input }) => {
          const { actor } = context;
          const [preferences, endpoints, imessage] = await Promise.all([
            updateNotificationPreferences(deps.prisma, actor, input),
            listPushEndpoints(deps.prisma, actor.userId),
            linkedImessageIdentities(deps.prisma, actor),
          ]);
          return {
            ...preferences,
            hasPhone: endpoints.length > 0,
            hasImessage: imessage.length > 0,
          };
        },
      ),
      unregisterPush: authed.notifications.unregisterPush.handler(async ({ context }) => {
        await deletePushTokens(deps.prisma, context.actor.userId, context.sessionId);
        return { ok: true as const };
      }),
      list: authed.notifications.list.handler(async ({ context, input }) => {
        try {
          const page = await listNotifications(deps.prisma, {
            ...context.actor,
            since: input.since ? new Date(input.since) : undefined,
            cursor: input.cursor,
          });
          return { notifications: page.items.map(toNotificationDto), nextCursor: page.nextCursor };
        } catch (error) {
          if (error instanceof NotificationValidationError) {
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      }),
      pendingApprovals: authed.notifications.pendingApprovals.handler(async ({ context }) => ({
        notifications: (await listPendingApprovalNotifications(deps.prisma, context.actor)).map(
          toNotificationDto,
        ),
      })),
      markSeen: authed.notifications.markSeen.handler(async ({ context, input }) => ({
        count: await markSeen(deps.prisma, {
          ...context.actor,
          surface: input.surface,
          botId: input.botId,
          id: input.id,
          threadId: input.threadId,
        }),
      })),
      dismiss: authed.notifications.dismiss.handler(async ({ context, input }) => {
        const { count } = await deps.prisma.notification.updateMany({
          where: {
            id: input.id,
            spaceId: context.actor.spaceId,
            userId: context.actor.userId,
            dismissedAt: null,
          },
          data: { dismissedAt: new Date() },
        });
        return { ok: count > 0 };
      }),
      markShown: authed.notifications.markShown.handler(async ({ context, input }) => ({
        ok: await markShown(deps.prisma, context.actor, input.id),
      })),
      unseenCounts: authed.notifications.unseenCounts.handler(async ({ context }) => ({
        counts: await unseenCounts(deps.prisma, context.actor),
      })),
      glance: authed.notifications.glance.handler(async ({ context }) => {
        const [
          runwayMonths,
          legalDueSoon,
          devinNeedsYou,
          isDevinConnected,
          brexMembership,
          brexConnection,
          gtmNeedsYou,
          dataRoomWaiting,
          hasTicket,
          botKinds,
        ] = await Promise.all([
          financeRunwayMonths(financeDeps, context.actor),
          legalDueSoonCount(legalDeps, context.actor, 7),
          devinNeedsYouCount(devinDeps, context.actor),
          devinConnected(devinDeps, context.actor),
          deps.prisma.spaceMember.findUnique({
            where: {
              spaceId_userId: { spaceId: context.actor.spaceId, userId: context.actor.userId },
            },
            select: { role: true },
          }),
          deps.prisma.brexCardsConnection.findUnique({
            where: { spaceId: context.actor.spaceId },
            select: { server: { select: { userId: true } } },
          }),
          gtmNeedsYouCount(deps.prisma, context.actor),
          // Failed items are the only ones the user can act on (retry or remove).
          deps.prisma.dataRoomItem.count({
            where: {
              spaceId: context.actor.spaceId,
              userId: context.actor.userId,
              status: "failed",
            },
          }),
          deps.env?.ticketBoardEnabled
            ? deps.prisma.ticket.findFirst({
                where: { spaceId: context.actor.spaceId },
                select: { id: true },
              })
            : null,
          unseenBotKinds(deps.prisma, context.actor),
        ]);
        const brexConnected =
          isSpaceOwnerRole(brexMembership?.role) &&
          brexConnection?.server.userId === context.actor.userId;
        return {
          financeRunwayMonths: runwayMonths,
          legalDueSoon,
          devinNeedsYou,
          devinConnected: isDevinConnected,
          brexConnected,
          gtmNeedsYou,
          dataRoomWaiting,
          hasTickets: Boolean(hasTicket),
          botKinds,
        };
      }),
      subscribe: authed.notifications.subscribe.handler(async function* ({ context }) {
        const follow = deps.notificationEvents.follow(context.actor, context.signal);
        for await (const event of withHeartbeat(follow, {
          signal: context.signal,
          stillAuthorized: context.stillAuthorized,
          heartbeatMs: HEARTBEAT_MS,
          recheckMs: SESSION_RECHECK_MS,
        })) {
          yield event === HEARTBEAT
            ? { id: NOTIFICATION_HEARTBEAT_ID, surface: "", importance: "info" as const }
            : event;
        }
      }),
    },
    search: {
      query: authed.search.query.handler(async ({ context, input }) => ({
        hits: await querySpaceSearch(deps.prisma, context.actor, input.q),
      })),
    },
    links: {
      favicon: authed.links.favicon.handler(async ({ input }) => favicons.favicon(input.origin)),
    },
    runs: {
      list: authed.runs.list.handler(async ({ context, input }) => ({
        runs: await listSpaceRuns(deps.prisma, context.actor, input.filter),
      })),
    },
    dictation: {
      vocabulary: authed.dictation.vocabulary.handler(({ context }) =>
        dictationVocabulary(
          { prisma: deps.prisma, ticketBoardEnabled: deps.env?.ticketBoardEnabled },
          context.actor,
        ),
      ),
    },
    voice: {
      agent: authed.voice.agent.handler(async ({ context }) => {
        return ensureVoiceAgent(repos, context.actor);
      }),
      catalog: authed.voice.catalog.handler(async () => listVoiceCatalog()),
      status: authed.voice.status.handler(async ({ context }) => {
        const cred = await findDefaultVoiceCredential(deps.prisma, context.actor);
        const selection = await findTranscriptionSelection(deps, context.actor);
        // The same choice server transcription makes, so Record shows only when audio would be sent.
        const { target, consented } = await selectTranscriptionTarget(deps, context.actor);
        return {
          ...toVoiceStatus(cred, selection?.provider ?? null),
          transcriptionConsented: Boolean(target && consented),
        };
      }),
      setTranscription: authed.voice.setTranscription.handler(async ({ context, input }) => {
        const result = await setTranscription(deps, context.actor, {
          ...input,
          signal: context.signal,
        });
        await requeueOmiTranscriptions(deps, context.actor);
        return result;
      }),
      clearTranscription: authed.voice.clearTranscription.handler(async ({ context }) =>
        clearTranscription(deps, context.actor),
      ),
      credentials: authed.voice.credentials.handler(async ({ context }) => {
        const rows = await deps.prisma.userVoiceCredential.findMany({
          where: { userId: context.actor.userId },
          include: {
            preferences: {
              where: { userId: context.actor.userId, spaceId: context.actor.spaceId },
            },
          },
          orderBy: newestVoiceCredentialOrder,
        });
        return rows.map((row) => {
          const preference = row.preferences[0];
          return toVoiceCredential({
            ...row,
            isDefault: preference?.isDefault ?? false,
            voiceId: preference?.voiceId ?? "",
            speechModel: preference?.speechModel ?? "",
          });
        });
      }),
      connect: authed.voice.connect.handler(async ({ context, input }) => {
        const result = await persistVoiceCredential(deps, context.actor, {
          provider: input.provider,
          plaintext: input.apiKey,
          voiceId: input.voiceId,
          speechModel: input.speechModel,
          signal: context.signal,
        });
        await requeueOmiTranscriptions(deps, context.actor);
        return result;
      }),
      disconnect: authed.voice.disconnect.handler(async ({ context, input }) =>
        disconnectVoiceCredential(deps, context.actor, { provider: input.provider }),
      ),
      setVoice: authed.voice.setVoice.handler(async ({ context, input }) => {
        const cred = await withSerializableRetry(() =>
          deps.prisma.$transaction(
            async (tx) => {
              const found = input.provider
                ? await tx.userVoiceCredential.findFirst({
                    where: { userId: context.actor.userId, provider: input.provider },
                    orderBy: newestVoiceCredentialOrder,
                  })
                : (
                    await tx.spaceVoicePreference.findFirst({
                      where: {
                        userId: context.actor.userId,
                        spaceId: context.actor.spaceId,
                        isDefault: true,
                      },
                      include: { credential: true },
                      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
                    })
                  )?.credential;
              if (!found) {
                throw new ORPCError("BAD_REQUEST", { message: "Connect a voice provider first." });
              }
              // Picking a voice also makes its provider the one speak/transcribe use.
              await selectSpaceVoicePreference(tx, context.actor, found.id, input.voiceId);
              return { ...found, voiceId: input.voiceId, isDefault: true };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          ),
        );
        const selection = await findTranscriptionSelection(deps, context.actor);
        return toVoiceStatus(cred, selection?.provider ?? null);
      }),
      setSpeechModel: authed.voice.setSpeechModel.handler(async ({ context, input }) =>
        updateVoiceSpeechModel(deps, context.actor, input),
      ),
      voices: authed.voice.voices.handler(async ({ context, input }) => {
        const loaded = await loadDefaultVoiceCredential(deps, context.actor);
        if (!loaded) return [];
        const providerId = input.provider ?? loaded.cred.provider;
        const row =
          providerId === loaded.cred.provider
            ? loaded
            : await loadVoiceCredential(deps, context.actor, providerId);
        if (!row) return [];
        return createVoiceProvider(row.cred.provider).listVoices(
          row.apiKey,
          voiceContext(context.actor, context.signal),
        );
      }),
      prepare: authed.voice.prepare.handler(async ({ context, input }) =>
        prepareVoice(deps, context.actor, input),
      ),
    },
  });
}

// Lists every Space the member belongs to, with each one's bots and threads, so it
// reads across Spaces. Every query below is limited to the member's Spaces.
function spaceNavigationDto(
  deps: RouterDeps,
  actor: Actor,
  repos: ReturnType<typeof createRepos>,
  groupRepos: ReturnType<typeof createGroupRepos>,
): Promise<SpaceNavigation> {
  return runAsSystem("space navigation across the member's Spaces", () =>
    memberSpaceNavigation(deps, actor, repos, groupRepos),
  );
}

async function memberSpaceNavigation(
  deps: RouterDeps,
  actor: Actor,
  repos: ReturnType<typeof createRepos>,
  groupRepos: ReturnType<typeof createGroupRepos>,
): Promise<SpaceNavigation> {
  const currentSpace = await deps.prisma.space.findUnique({
    where: { id: actor.spaceId },
    select: { organizationId: true },
  });
  if (!currentSpace) throw new IsolationError();
  const memberships = await deps.prisma.spaceMember.findMany({
    where: { userId: actor.userId, organizationId: currentSpace.organizationId },
    select: {
      spaceId: true,
      role: true,
      space: {
        select: {
          name: true,
          isDefault: true,
          deletingAt: true,
          meetingRecording: true,
          _count: { select: { memberships: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const spaceIds = memberships.map((membership) => membership.spaceId);
  const inactiveSpaceIds = spaceIds.filter((spaceId) => spaceId !== actor.spaceId);
  const [
    currentBots,
    currentGroups,
    inactiveBots,
    inactiveGroups,
    botSections,
    externalConversations,
    contentBots,
    contentGroups,
  ] = await Promise.all([
    repos.listBots(actor),
    groupRepos.listGroups(actor),
    repos.listSpaceBotsForSpaces(actor, inactiveSpaceIds),
    groupRepos.listSpaceGroupsForSpaces(actor, inactiveSpaceIds),
    repos.listBotSectionsForSpaces(actor, spaceIds),
    createExternalConversationRepos(deps.prisma).listForSpaces(actor, spaceIds),
    // Active-only navigation lists miss archived content in other spaces; count any
    // bot/group in the actor's spaces (including another member's) so a shared
    // non-empty space cannot look empty for onboarding redirects.
    deps.prisma.bot.findMany({
      where: { spaceId: { in: spaceIds } },
      select: { spaceId: true },
      distinct: ["spaceId"],
    }),
    deps.prisma.chatGroup.findMany({
      where: { spaceId: { in: spaceIds } },
      select: { spaceId: true },
      distinct: ["spaceId"],
    }),
  ]);
  const spacesWithContent = new Set([
    ...contentBots.map((row) => row.spaceId),
    ...contentGroups.map((row) => row.spaceId),
  ]);
  const currentMembership = memberships.find((membership) => membership.spaceId === actor.spaceId);
  if (!currentMembership) throw new IsolationError();
  const botsBySpace = partitionBySpace([...currentBots, ...inactiveBots]);
  const groupsBySpace = partitionBySpace([...currentGroups, ...inactiveGroups]);
  const sectionsBySpace = partitionBySpace(botSections);
  const botsFor = (spaceId: string) => botsBySpace.get(spaceId) ?? [];
  const groupsFor = (spaceId: string) => groupsBySpace.get(spaceId) ?? [];
  const sectionsFor = (spaceId: string) => sectionsBySpace.get(spaceId) ?? [];
  const staleClaimBefore = new Date(Date.now() - SPACE_DELETION_CLAIM_TIMEOUT_MS);

  return {
    current: {
      id: actor.spaceId,
      name: currentMembership.space.name,
      bots: currentBots,
      groups: currentGroups,
      externalConversations: externalConversations.filter(
        (conversation) => conversation.spaceId === actor.spaceId,
      ),
      botSections: sectionsFor(actor.spaceId),
    },
    spaces: memberships.map((membership) => {
      const spaceBots = botsFor(membership.spaceId);
      const spaceGroups = groupsFor(membership.spaceId);
      return {
        id: membership.spaceId,
        name: membership.space.name,
        isDefault: membership.space.isDefault,
        hasContent: spacesWithContent.has(membership.spaceId),
        memberCount: membership.space._count.memberships,
        meetingRecording: membership.space.meetingRecording as MeetingRecordingPolicy,
        canSetMeetingRecording:
          isSpaceOwnerOrAdminRole(membership.role) && membership.space.deletingAt === null,
        canRename: membership.role === "owner" && membership.space.deletingAt === null,
        canDelete:
          membership.role === "owner" &&
          !membership.space.isDefault &&
          memberships.length > 1 &&
          !spacesWithContent.has(membership.spaceId) &&
          (membership.space.deletingAt === null || membership.space.deletingAt < staleClaimBefore),
        bots: spaceBots.map((bot) => ({
          id: bot.id,
          parentBotId: bot.parentBotId,
          spawnKey: bot.spawnKey,
          spaceId: bot.spaceId,
          name: bot.name,
          title: bot.title,
          color: bot.color,
          notifyOnFinish: bot.notifyOnFinish,
          pinned: bot.pinned,
          hiddenAt: bot.hiddenAt ?? null,
          sectionId: bot.sectionId,
          unread: bot.unread,
          preview: bot.preview,
          status: bot.status,
          runPhase: bot.runPhase,
          runErrorId: bot.runErrorId,
          updatedAt: bot.updatedAt,
        })),
        groups: spaceGroups.map((group) => ({
          id: group.id,
          spaceId: group.spaceId,
          name: group.name,
          pinned: group.pinned,
          sectionId: group.sectionId,
          members: group.members,
          preview: group.preview,
          unread: group.unread,
          updatedAt: group.updatedAt,
        })),
        externalConversations: externalConversations.filter(
          (conversation) => conversation.spaceId === membership.spaceId,
        ),
        botSections: sectionsFor(membership.spaceId),
      };
    }),
  };
}

function partitionBySpace<T extends { spaceId: string }>(rows: T[]): Map<string, T[]> {
  const partitioned = new Map<string, T[]>();
  for (const row of rows) {
    const spaceRows = partitioned.get(row.spaceId) ?? [];
    spaceRows.push(row);
    partitioned.set(row.spaceId, spaceRows);
  }
  return partitioned;
}

async function loadPermissionSettings(deps: RouterDeps, actor: Actor) {
  const row = await loadSpacePermissionLevel(deps.prisma, actor);
  return {
    level: PermissionLevelSchema.safeParse(row?.permissionLevel).data ?? null,
    effectiveDefault: deploymentPermissionDefault(process.env),
  };
}

async function loadAutoReviewSettings(deps: RouterDeps, actor: Actor) {
  const environmentAvailable = isAutoReviewCheckerConfigured({ env: process.env });
  const checker = environmentAvailable ? null : resolveAutoReviewChecker(process.env);
  const requiredUserProvider = checker?.provider === "scripted" ? null : checker?.provider;
  const [preference, credential] = await Promise.all([
    deps.prisma.actionAutoReviewPreference.findUnique({
      where: {
        spaceId_userId: {
          spaceId: actor.spaceId,
          userId: actor.userId,
        },
      },
      select: { enabled: true, background: true },
    }),
    requiredUserProvider
      ? deps.prisma.userModelCredential.findFirst({
          where: { userId: actor.userId, provider: requiredUserProvider },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  const enabled = preference?.enabled ?? deploymentAutoReviewDefault(process.env);
  const checkerAvailable = environmentAvailable || Boolean(credential);
  return { enabled, background: enabled && (preference?.background ?? true), checkerAvailable };
}

function hostCredentials(active: boolean, provider: string) {
  return active
    ? { hostCredentialProvider: provider, hostCredentialSource: hostCredentialSource(provider) }
    : { hostCredentialProvider: null, hostCredentialSource: null };
}

async function meDto(deps: RouterDeps, actor: Actor): Promise<Me> {
  const [user, setup] = await Promise.all([
    deps.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } }),
    modelSetup(deps, actor),
  ]);
  return {
    ticketBoardEnabled: deps.env.ticketBoardEnabled === true,
    userId: actor.userId,
    email: user.email,
    name: user.name,
    spaceId: actor.spaceId,
    isDeploymentOwner: actor.isDeploymentOwner,
    needsModel: setup.needsModel,
    defaultProvider:
      setup.credential?.provider ??
      setup.settings?.defaultModelProvider ??
      deps.env.defaultProvider,
    defaultModel:
      setup.credential?.defaultModel ?? setup.settings?.defaultModelId ?? deps.env.defaultModel,
    // Set only while the active default is the deployment's own, running on host credentials.
    ...hostCredentials(
      !setup.credential &&
        !setup.settings?.defaultModelProvider &&
        Boolean(deps.env.deploymentModelHostCredentials),
      deps.env.defaultProvider,
    ),
    computerHost: computerHostFor(setup.settings?.computerHost, deps.env.sandboxProvider),
    canChooseHostComputer: actor.isDeploymentOwner && deps.env.sandboxProvider === "docker",
    sandboxProvider: deps.env.sandboxProvider,
    mcpStdioEnabled: mcpStdioAvailable(mcpStdioPolicy(deps)),
    avatarStyle: user.avatarStyle === "robot" ? "robot" : "organic",
    timezone: user.timezone ?? null,
    tourSeen: Boolean(user.tourSeenAt),
    hiddenPages: user.hiddenPages ?? [],
    hideAmounts: user.hideAmounts,
    billingEnabled: Boolean(deps.billing) && !actor.isDeploymentOwner,
  };
}

async function modelSetup(deps: RouterDeps, actor: Actor) {
  const [credential, settings] = await Promise.all([
    findDefaultModelCredential(deps.prisma, actor),
    deps.prisma.deploymentSettings.findUnique({ where: { id: "default" } }),
  ]);
  const hasDeployment = Boolean(deps.env.deploymentModelConfigured);
  return {
    credential,
    settings,
    needsModel: deps.env.agentRuntime !== "scripted" && !credential && !hasDeployment,
  };
}

/**
 * Thinking levels a caller may set for a provider/model. Catalog models answer from
 * `thinkingLevels`; unknown catalog ids return undefined (no check). OpenAI-compatible
 * connections only advertise levels when the stored endpoint's saved model matches.
 */
async function prepareAllowedThinkingLevels(
  deps: RouterDeps,
  actor: Actor,
  provider: string,
  modelId: string,
): Promise<{ allowed: string[] | undefined; secret?: { id: string; ciphertext: string } }> {
  if (provider !== OPENAI_COMPATIBLE_PROVIDER_ID) {
    return {
      allowed: listPiCatalog().find((item) => item.provider === provider && item.id === modelId)
        ?.thinkingLevels,
    };
  }
  let allowed: string[] | undefined = ["off"];
  let savedSecret: { id: string; ciphertext: string } | undefined;
  const credential = await findModelCredential(deps.prisma, actor, provider);
  if (credential && credential.defaultModel === modelId) {
    const secret = await deps.prisma.secret.findFirst({
      where: { id: credential.secretId, userId: actor.userId, spaceId: null },
      select: { ciphertext: true },
    });
    if (secret) {
      savedSecret = { id: credential.secretId, ciphertext: secret.ciphertext };
      try {
        allowed =
          modelCredentialDto(
            credential,
            await deps.secrets.load(secret.ciphertext, credential.secretId),
          ).thinkingLevels ?? allowed;
      } catch {
        // Unreadable connections must not advertise reasoning support.
      }
    }
  }
  return { allowed, secret: savedSecret };
}

async function allowedThinkingLevels(
  ...args: Parameters<typeof prepareAllowedThinkingLevels>
): Promise<string[] | undefined> {
  return (await prepareAllowedThinkingLevels(...args)).allowed;
}

async function computerStatus(
  deps: RouterDeps,
  actor: Actor,
  botId: string,
): Promise<ComputerStatus> {
  const repos = createRepos(deps.prisma);
  let bot = await repos.getBot(actor, botId);
  if (await expireStaleComputerControl(deps, bot.computer)) {
    bot = await repos.getBot(actor, botId);
  }
  const busyBotName = await resolveBusyBotName(deps.prisma, {
    computerId: bot.computer?.id,
    botId,
    botName: bot.name,
  });
  return toComputerStatus(botId, bot.computer, busyBotName);
}

/** Hand the user's screen control for this bot back, continuing any run waiting on it. */
async function releaseComputerControl(
  deps: RouterDeps,
  actor: Actor,
  botId: string,
  reason?: ComputerReleaseReason,
): Promise<void> {
  const bot = await createRepos(deps.prisma).getBot(actor, botId);
  if (!bot.computer) throw new IsolationError();
  const controlBotId = bot.computer.controlBotId;
  const controlLeaseId = bot.computer.controlLeaseId;
  if (bot.computer.controlHolder !== "user" || !controlBotId || controlBotId !== bot.id) return;
  if (!hasActiveComputerControl(bot.computer) || !controlLeaseId) {
    // Stale controlHolder=user. Prefer expiry (revokes provider control). If a lease id
    // remains after a failed revoke, keep it so reconciliation can retry.
    if (controlLeaseId) {
      await expireComputerControl(deps, bot.computer.id, controlLeaseId).catch(() => undefined);
    } else {
      await clearInactiveUserComputerControl(deps.prisma, bot.computer.id);
    }
    return;
  }
  await revokeScreenControl(
    deps,
    bot.computer,
    computerContext(actor, controlBotId, "screen.release"),
    controlLeaseId,
  );

  const released = await deps.events.finalizeComputerControlRelease({
    spaceId: actor.spaceId,
    computerId: bot.computer.id,
    botId: controlBotId,
    runId: bot.computer.controlRunId,
    leaseId: controlLeaseId,
    holder: "bot",
    reason: reason ?? "released",
  });
  if (!released) return;
  // The lease-specific key makes this cancellation safe after a replacement takeover.
  await deps.jobs
    .cancel(computerControlExpireJobKey(bot.computer.id, controlLeaseId))
    .catch((error) => {
      // The expired job is harmless after the lease is cleared, so do not report a
      // failed release after the transaction has committed.
      getLogger().error("computer control expiry cancellation", error);
    });

  await enqueueTakeoverContinuation(deps.jobs, released.runId);
  scheduleComputerSleep(deps.jobs, bot.computer.id);
}

async function runComputerReplace(
  deps: RouterDeps,
  context: { actor: Actor },
  botId: string,
  mode: "recover" | "reset" | "update",
  operationId: string,
): Promise<ComputerStatus> {
  const repos = createRepos(deps.prisma);
  const bot = await repos.getBot(context.actor, botId);
  if (!bot.computer) throw new IsolationError();
  if (mode === "update" && !computerSupportsUpdate(bot.computer.kind)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Computer update is not available on this device",
    });
  }
  const manualRunId = `${mode}:${randomUUID()}`;
  let lease: ComputerExecutionLease | null;
  try {
    lease = await acquireComputerExecutionLease(deps.prisma, {
      computerId: bot.computer.id,
      runId: manualRunId,
      botId: bot.id,
    });
  } catch (error) {
    if (error instanceof ComputerBusyError) {
      throw new ORPCError("CONFLICT", { message: "Computer is busy" });
    }
    throw error;
  }
  try {
    await replaceComputer(
      deps,
      bot.computer.id,
      mode,
      {
        ...computerContext(context.actor, bot.id, operationId),
        screenLeaseId: screenLeaseIdForRun(lease, manualRunId),
      },
      "none",
      undefined,
      { handBackIdleTakeover: true },
    );
    scheduleComputerSleep(deps.jobs, bot.computer.id);
  } catch (error) {
    if (error instanceof ComputerBusyError) {
      throw new ORPCError("CONFLICT", { message: "Computer is busy" });
    }
    throw error;
  } finally {
    await releaseComputerExecutionLease(deps.prisma, lease);
  }
  return computerStatus(deps, context.actor, botId);
}

async function expireStaleComputerControl(
  deps: RouterDeps,
  computer:
    | (NonNullable<Parameters<typeof hasActiveComputerControl>[0]> & {
        id: string;
        controlHolder?: string;
      })
    | null
    | undefined,
): Promise<boolean> {
  if (!computer || hasActiveComputerControl(computer)) return false;
  if (computer.controlHolder !== "user") {
    // Holder "none" with a surviving lease id is a revoke that failed mid-expiry;
    // retry it so the row does not sit busy forever.
    if (computer.controlLeaseId) {
      await expireComputerControl(deps, computer.id, computer.controlLeaseId).catch(
        () => undefined,
      );
      return true;
    }
    return false;
  }
  const leaseId = computer.controlLeaseId;
  // Keep a failed revoke's lease id so reconciliation can retry provider shutdown.
  if (leaseId) {
    await expireComputerControl(deps, computer.id, leaseId).catch(() => undefined);
    return true;
  }
  return clearInactiveUserComputerControl(deps.prisma, computer.id).catch(() => false);
}

/** When the user already holds control during waiting_takeover, bind controlRunId so
 * takeoverRequested becomes true and release can resume the waiting run. */
async function bindWaitingTakeoverToControl(
  deps: RouterDeps,
  input: {
    spaceId: string;
    threadId: string | null | undefined;
    botId: string;
    computerId: string;
    controlLeaseId: string;
    controlRunId: string | null;
  },
): Promise<void> {
  await deps.prisma.$transaction(async (tx) => {
    // Lock the execution lease so a reclaimed fence/run cannot be bound by a stale read.
    const locked = await tx.$queryRaw<Array<{ runId: string; fence: number }>>`
      SELECT "runId", fence FROM computer_execution_leases
      WHERE "computerId" = ${input.computerId} AND "botId" = ${input.botId}
      FOR UPDATE`;
    const executionLease = locked[0];
    if (!executionLease) return;

    const executionRun = await tx.run.findUnique({
      where: { id: executionLease.runId },
      select: { botId: true, status: true },
    });
    const waitingForTakeover =
      executionRun?.botId === input.botId && executionRun.status === "waiting_takeover";
    if (!waitingForTakeover) return;
    if (input.controlRunId === executionLease.runId) return;

    // Confirm the locked lease row still matches before writing controlRunId.
    const leaseStillCurrent = await tx.computerExecutionLease.count({
      where: {
        computerId: input.computerId,
        botId: input.botId,
        runId: executionLease.runId,
        fence: executionLease.fence,
      },
    });
    if (leaseStillCurrent !== 1) return;

    const bound = await tx.computer.updateMany({
      where: {
        id: input.computerId,
        controlLeaseId: input.controlLeaseId,
        controlBotId: input.botId,
      },
      data: { controlRunId: executionLease.runId },
    });
    if (bound.count !== 1 || !input.threadId) return;

    await deps.events.append({
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: input.botId,
      type: "computer.takeover.granted",
      payload: { leaseId: input.controlLeaseId, takeoverRequested: true },
    });
  });
}

async function computerScreenContext(
  prisma: PrismaClient,
  actor: Actor,
  computerId: string,
  botId: string,
  operationId: string,
): Promise<AdapterContext> {
  const context = computerContext(actor, botId, operationId);
  const lease = await prisma.computerExecutionLease.findUnique({
    where: { computerId_botId: { computerId, botId } },
    select: { runId: true, fence: true, expiresAt: true },
  });
  if (!lease || lease.expiresAt.getTime() <= Date.now()) return context;
  return { ...context, screenLeaseId: screenLeaseIdForRun(lease, lease.runId) };
}

async function deploymentDto(prisma: PrismaClient, sandboxProvider: string) {
  const settings = await prisma.deploymentSettings.findUnique({ where: { id: "default" } });
  return {
    ownerUserId: settings?.ownerUserId ?? null,
    signupsEnabled: settings?.signupsEnabled ?? true,
    signupAllowlist: settings?.signupAllowlist
      ? settings.signupAllowlist.split(",").filter(Boolean)
      : [],
    hasDeploymentModelCredential: Boolean(settings?.deploymentModelCredentialCipher),
    defaultProvider: settings?.defaultModelProvider ?? null,
    defaultModel: settings?.defaultModelId ?? null,
    computerHost: computerHostFor(settings?.computerHost, sandboxProvider),
    canChooseHostComputer: sandboxProvider === "docker",
    sandboxProvider,
  };
}

/**
 * Where a bot may run commands. Host commands run without asking, so they stay limited to the
 * deployment owner on the Docker sandbox, as the deployment default is.
 */
export function assertRunsOnAllowed(input: {
  runsOn: "docker" | "this-mac" | null;
  sandboxProvider: string;
  isDeploymentOwner: boolean;
}) {
  if (input.runsOn === null) return;
  if (input.sandboxProvider !== "docker") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Choosing where a bot runs needs the Docker sandbox.",
    });
  }
  if (input.runsOn === "this-mac" && !input.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
}

/**
 * Validates an owner's app control change and returns what to store. Turning it off, removing
 * apps and the headed switch need no more than ownership; turning it on or adding apps needs a
 * provider and a bot that does not run on this Mac.
 */
async function checkAppControlUpdate(
  deps: RouterDeps,
  actor: Actor,
  bot: { runsOn?: string | null; appControlEnabled?: boolean },
  input: { appControl?: UpdateBotAppControl; runsOn?: string | null },
): Promise<UpdateBotAppControl | undefined> {
  const change = input.appControl;
  const movesHost = input.runsOn !== undefined && input.runsOn !== (bot.runsOn ?? null);
  if (!change && !movesHost) return undefined;
  if (change && !actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
  let apps = change?.apps;
  if (apps) {
    const seen = new Set<string>();
    apps = apps.filter((app) => {
      if (isDeniedApp(app)) {
        throw new ORPCError("BAD_REQUEST", { message: `${app.name} cannot be used` });
      }
      const key = app.id.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const adds = change?.enabled === true || (apps !== undefined && apps.length > 0);
  if (adds && !deps.appControl) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "App control is not set up" });
  }
  // The settings as they will be after this update, so a combined change cannot slip through.
  const enabledAfter = change?.enabled ?? bot.appControlEnabled ?? false;
  if (enabledAfter && (adds || movesHost)) {
    const hostAfter =
      (input.runsOn !== undefined ? input.runsOn : bot.runsOn) ??
      (await deploymentComputerHost(deps));
    if (hostAfter === "this-mac") {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "A bot that runs on this Mac cannot use apps on it. Turn off apps on this Mac first.",
      });
    }
  }
  return change ? { ...change, ...(apps ? { apps } : {}) } : undefined;
}

async function deploymentComputerHost(deps: RouterDeps): Promise<"docker" | "this-mac"> {
  const settings = await deps.prisma.deploymentSettings.findUnique({ where: { id: "default" } });
  return computerHostFor(settings?.computerHost, deps.env.sandboxProvider) === "this-mac"
    ? "this-mac"
    : "docker";
}

function computerHostFor(
  stored: string | null | undefined,
  sandboxProvider: string,
): "docker" | "this-mac" | null {
  if (sandboxProvider === "desktop") return "this-mac";
  if (sandboxProvider !== "docker") return null;
  if (stored === "this-mac" || stored === "docker") return stored;
  return null;
}

async function persistModelCredential(
  deps: RouterDeps,
  actor: Actor,
  input: {
    provider: string;
    plaintext: string;
    label?: string;
    modelId?: string;
    thinkingLevel?: string | null;
    supportsImages?: boolean;
    signal?: AbortSignal;
  },
  codexCatalog: CodexLiveCatalog,
) {
  input.signal?.throwIfAborted();
  const requestedModelId = usableModelId(input.modelId);
  const authError = requestedModelId
    ? validateModelAuthAvailability(input.provider, requestedModelId, input.plaintext)
    : undefined;
  // The backend's live catalog can clear a static OAuth exclusion for the
  // account this credential signs into (e.g. Codex Spark on ChatGPT plans).
  if (
    authError &&
    requestedModelId &&
    !(await codexLiveListsModel(
      codexCatalog,
      actor.userId,
      parseModelSecret(input.plaintext),
      requestedModelId,
    ))
  ) {
    throw new ORPCError("BAD_REQUEST", { message: authError });
  }
  // Signing in again without a model (OpenRouter OAuth) keeps the model this
  // provider already uses in this space instead of resetting to the first catalog row.
  const keptModelId = requestedModelId
    ? undefined
    : usableModelId(
        (
          await deps.prisma.spaceModelPreference.findFirst({
            where: {
              spaceId: actor.spaceId,
              userId: actor.userId,
              credential: { provider: input.provider },
              modelId: { not: null },
            },
            orderBy: { updatedAt: "desc" },
            select: { modelId: true },
          })
        )?.modelId,
      );
  const defaultModel =
    requestedModelId ??
    keptModelId ??
    defaultCatalogModelId(input.provider, input.plaintext) ??
    usableModelId(deps.env.defaultModel);
  const allowedThinking = defaultModel
    ? await allowedThinkingLevels(deps, actor, input.provider, defaultModel)
    : undefined;
  const stored = await deps.secrets.put(input.plaintext, {
    operationId: "cred",
    traceId: "cred",
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: input.signal ?? new AbortController().signal,
  });
  input.signal?.throwIfAborted();
  const cred = await withSerializableRetry(() =>
    deps.prisma.$transaction(
      async (tx) => {
        input.signal?.throwIfAborted();
        const existing = await tx.userModelCredential.findFirst({
          where: { userId: actor.userId, provider: input.provider },
          orderBy: newestModelCredentialOrder,
        });
        input.signal?.throwIfAborted();
        const secret = await tx.secret.create({
          data: {
            id: stored.id,
            userId: actor.userId,
            spaceId: null,
            kind: "model",
            ciphertext: stored.ciphertext,
          },
        });
        input.signal?.throwIfAborted();
        const credential = !existing
          ? await tx.userModelCredential.create({
              data: {
                userId: actor.userId,
                provider: input.provider,
                label: input.label ?? input.provider,
                secretId: secret.id,
                supportsImages: input.supportsImages ?? false,
              },
            })
          : await tx.userModelCredential.update({
              where: { id: existing.id },
              data: {
                label: input.label ?? input.provider,
                secretId: secret.id,
                ...(input.supportsImages !== undefined
                  ? { supportsImages: input.supportsImages }
                  : {}),
              },
            });
        input.signal?.throwIfAborted();
        let thinkingLevel = input.thinkingLevel;
        if (thinkingLevel === undefined) {
          // A stored effort only carries over while it still names this model.
          const previous = await tx.spaceModelPreference.findFirst({
            where: {
              spaceId: actor.spaceId,
              userId: actor.userId,
              credentialId: credential.id,
            },
            select: { modelId: true, thinkingLevel: true },
          });
          thinkingLevel =
            previous?.modelId === usableModelId(defaultModel) ? previous.thinkingLevel : null;
        }
        // Connect and limit saves can still carry an effort chosen for the previous
        // model. Keep it only when this model supports it; otherwise clamp or clear.
        thinkingLevel = defaultModel
          ? clampCatalogThinkingLevel(thinkingLevel, allowedThinking)
          : null;
        // A new connection only becomes the default when the space has none yet or this
        // credential already is it; otherwise the owner's choice stays in place.
        const currentDefault = await tx.spaceModelPreference.findFirst({
          where: { spaceId: actor.spaceId, userId: actor.userId, isDefault: true },
          select: { credentialId: true },
        });
        const preference = await selectSpaceModelPreference(
          tx,
          actor,
          credential.id,
          defaultModel,
          thinkingLevel,
          { makeDefault: !currentDefault || currentDefault.credentialId === credential.id },
        );
        input.signal?.throwIfAborted();
        if (existing) {
          await deleteUnreferencedCredentialSecret(tx, {
            credentialKind: "model",
            credentialId: existing.id,
            secretId: existing.secretId,
          });
          input.signal?.throwIfAborted();
        }
        return { ...credential, isDefault: preference.isDefault, defaultModel };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  return modelCredentialDto(cred, input.plaintext);
}

function nextRoutineDate(crons: string[], timezone: string): Date {
  let next: Date | null;
  try {
    next = nextCronDateAcrossStrict(crons, new Date(), timezone);
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "Enter a valid cron expression." });
  }
  if (!next) throw new ORPCError("BAD_REQUEST", { message: "Enter a valid cron expression." });
  return next;
}

async function assertWatchLimits(prisma: PrismaClient, spaceId: string, botId: string) {
  const message = await watchLimitError(prisma, { spaceId, botId });
  if (message) throw new ORPCError("BAD_REQUEST", { message });
}

/** A routine may only name a model the space has connected. */
/** What a save writes to a pin: a new id, null to clear, or undefined to leave it alone. */
function connectionPinWrite(
  input: { modelProvider?: string | null; modelCredentialId?: string | null },
  existingProvider: string | null,
): string | null | undefined {
  if (input.modelProvider === null) return null;
  if (input.modelCredentialId !== undefined) return input.modelCredentialId;
  return input.modelProvider !== undefined && input.modelProvider !== existingProvider
    ? null
    : undefined;
}

/** Only the caller's own connection, for the model's provider, can be pinned. */
async function assertOwnedConnection(
  deps: RouterDeps,
  actor: Actor,
  credentialId: string,
  provider: string | null,
) {
  const owned = await deps.prisma.userModelCredential.findFirst({
    where: { id: credentialId, userId: actor.userId, provider: provider ?? "" },
    select: { id: true },
  });
  if (!owned) throw new IsolationError();
}

async function assertRoutineModel(
  deps: RouterDeps,
  actor: Actor,
  model: { modelProvider?: string | null; modelId?: string | null },
) {
  if (!model.modelProvider || !model.modelId) return;
  const message = await validateConnectedModelChoice(
    deps.prisma,
    actor,
    model.modelProvider,
    model.modelId,
  );
  if (message) throw new ORPCError("BAD_REQUEST", { message });
}

const routineInclude = {
  watchState: true,
  connectionPause: { select: { pausedUntil: true } },
  taughtSkill: { select: { id: true, name: true } },
} as const;

/** A routine runs a saved taught skill of the same user on the same bot, nothing else. */
async function assertRoutineTaughtSkill(
  deps: RouterDeps,
  actor: Actor,
  botId: string,
  skillId: string,
) {
  const skill = await deps.prisma.taughtSkill.findFirst({
    where: { id: skillId, spaceId: actor.spaceId, userId: actor.userId, botId },
    select: { status: true },
  });
  if (!skill) throw new IsolationError();
  if (skill.status !== "saved") {
    throw new ORPCError("BAD_REQUEST", { message: "Save the skill first" });
  }
}

function mapRoutine(
  row: {
    id: string;
    botId: string;
    name: string;
    prompt: string;
    crons: string[];
    timezone: string;
    active: boolean;
    notify: boolean;
    webhookEnabled: boolean;
    githubEnabled: boolean;
    messageProvider: string | null;
    modelProvider: string | null;
    modelId: string | null;
    modelCredentialId?: string | null;
    thinkingLevel: string | null;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    quiet: boolean;
    watch: unknown;
    managedKind: string | null;
    taughtSkill?: { id: string; name: string } | null;
    watchState?: {
      lastCheckedAt: Date | null;
      lastChangedAt: Date | null;
      pausedReason: string | null;
    } | null;
    connectionPause?: { pausedUntil: Date } | null;
    createdAt: Date;
  },
  lastRunFailed = false,
): Routine {
  const creditPaused = (row.connectionPause?.pausedUntil.getTime() ?? 0) > Date.now();
  const watch = WatchSpecSchema.safeParse(row.watch);
  return {
    id: row.id,
    botId: row.botId,
    name: row.name,
    prompt: row.prompt,
    crons: row.crons,
    timezone: row.timezone,
    active: row.active,
    notify: row.notify,
    webhookEnabled: row.webhookEnabled,
    githubEnabled: row.githubEnabled,
    messageProvider: row.messageProvider,
    modelProvider: row.modelProvider ?? null,
    modelId: row.modelId ?? null,
    modelCredentialId: row.modelCredentialId ?? null,
    thinkingLevel: (row.thinkingLevel as Routine["thinkingLevel"]) ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    quiet: row.quiet,
    watch: watch.success ? watch.data : null,
    managedKind: row.managedKind === "check_in" ? "check_in" : null,
    taughtSkill: row.taughtSkill ?? null,
    status: {
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      nextRunAt: row.nextRunAt?.toISOString() ?? null,
      lastCheckedAt: row.watchState?.lastCheckedAt?.toISOString() ?? null,
      lastChangedAt: row.watchState?.lastChangedAt?.toISOString() ?? null,
      pausedReason:
        (row.watchState?.pausedReason as WatchPausedReason | null) ??
        (creditPaused ? "credit" : null),
      lastRunFailed,
    },
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Whether the routine's newest finished run failed (cancelled counts as finished). Ordered by
 * createdAt, not completedAt, which is null for some finished runs.
 */
// ponytail: one findFirst per routine; a nested `include ... take: 1` loads every run in Prisma 7.
async function routineLastRunFailed(deps: RouterDeps, routineId: string) {
  const last = await deps.prisma.run.findFirst({
    where: { routineId, status: { in: ["completed", "failed", "cancelled"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { status: true },
  });
  return last?.status === "failed";
}

async function listRoutinesDto(deps: RouterDeps, actor: Actor, botId: string) {
  const rows = await deps.prisma.routine.findMany({
    where: { botId, spaceId: actor.spaceId, userId: actor.userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: routineInclude,
  });
  return Promise.all(
    rows.map(async (row) => mapRoutine(row, await routineLastRunFailed(deps, row.id))),
  );
}

/**
 * The provider killed this sandbox (idle timeout) while the row still says running. Clear the
 * dead ref so the UI offers a boot instead of 500ing, and rethrow anything else. Leave any
 * active control lease alone: expireComputerControl owns that release (provider screen-control,
 * events, takeover continuation).
 */
async function clearGoneSandbox(
  deps: RouterDeps,
  computer: { id: string; providerRef: string | null },
  error: unknown,
): Promise<null> {
  if (!isSandboxGoneError(error)) throw error;
  getLogger().error(`computer ${computer.id} sandbox ${computer.providerRef} is gone`, error);
  await deps.prisma.computer.updateMany({
    where: { id: computer.id, providerRef: computer.providerRef },
    data: { state: "stopped", providerRef: null },
  });
  return null;
}

async function keepComputerAwake(deps: RouterDeps, computerId: string) {
  await deps.prisma.computer.updateMany({
    where: { id: computerId, state: "running" },
    data: { updatedAt: new Date() },
  });
  scheduleComputerSleep(deps.jobs, computerId);
}

function withViewOnly(url: string, viewOnly: boolean) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("view_only", viewOnly ? "true" : "false");
    return parsed.toString();
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}view_only=${viewOnly ? "true" : "false"}`;
  }
}

/** Valid UTF-8 stays readable text; anything else is base64 so the bytes survive the JSON. */
function exportFile(path: string, content: Uint8Array): ExportManifest["files"][number] {
  try {
    return {
      path,
      content: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(content),
    };
  } catch {
    return { path, content: Buffer.from(content).toString("base64"), encoding: "base64" };
  }
}

function duplicateBotName(name: string) {
  return `${name.slice(0, 75)} copy`;
}

const ACTIVE_CHANNEL_MEMBERS = {
  where: { status: { in: ["invited", "approved"] } },
  select: { id: true },
};

type MessagingIdentityRecord = {
  id: string;
  botId: string;
};

/** Every linked chat app counts: channels and connections span identities. */
async function messagingIdentitiesFor(
  prisma: PrismaClient,
  userId: string,
): Promise<MessagingIdentityRecord[]> {
  return acrossChatIdentities(() =>
    prisma.messagingIdentity.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, botId: true },
    }),
  );
}

/**
 * Chat identities belong to the account, linked to bots in any of its Spaces, and an
 * agent connection joins two accounts' bots. Every query run through this names the
 * actor's own identities or bots, or a peer the actor is connected to.
 */
function acrossChatIdentities<T>(fn: () => Promise<T>): Promise<T> {
  return runAsSystem("the account's chat identities and agent connections across Spaces", fn);
}

async function messagingIdentityDto(
  prisma: PrismaClient,
  identity: { id: string; provider: string; address: string; botId: string },
) {
  const bot = await acrossChatIdentities(() =>
    prisma.bot.findUnique({
      where: { id: identity.botId },
      select: { name: true },
    }),
  );
  return {
    id: identity.id,
    provider: identity.provider,
    address: identity.address,
    botId: identity.botId,
    botName: bot?.name ?? "Assistant",
  };
}

function messagingChannelDto(membership: {
  id: string;
  channelId: string;
  // Never null here: every membership reaching this DTO was matched by one of
  // the caller's identity ids.
  identityId: string | null;
  status: string;
  channel: { provider: string; name: string | null; members: Array<{ id: string }> };
}) {
  return {
    id: membership.id,
    channelId: membership.channelId,
    identityId: membership.identityId!,
    provider: membership.channel.provider,
    name: membership.channel.name,
    status: membership.status as "invited" | "approved" | "declined" | "left",
    memberCount: membership.channel.members.length,
  };
}

async function messagingConnectionDto(
  prisma: PrismaClient,
  myBotIds: ReadonlySet<string>,
  connection: {
    id: string;
    requesterBotId: string;
    targetBotId: string;
    status: string;
  },
) {
  const incoming = myBotIds.has(connection.targetBotId);
  // The target's identity stays opaque until they approve (mirrors connect_agent).
  if (!incoming && connection.status !== "approved") {
    return {
      id: connection.id,
      peerBotName: "agent",
      peerOwnerLabel: "owner",
      status: connection.status as "pending" | "approved" | "declined" | "revoked",
      incoming,
    };
  }
  const peerBotId = incoming ? connection.requesterBotId : connection.targetBotId;
  const [peerBot, peerIdentity] = await acrossChatIdentities(() =>
    Promise.all([
      prisma.bot.findUnique({ where: { id: peerBotId }, select: { name: true } }),
      prisma.messagingIdentity.findUnique({
        where: { botId: peerBotId },
        select: { userId: true },
      }),
    ]),
  );
  const peerOwner = peerIdentity
    ? await prisma.user.findUnique({
        where: { id: peerIdentity.userId },
        select: { name: true },
      })
    : null;
  return {
    id: connection.id,
    peerBotName: peerBot?.name ?? "agent",
    peerOwnerLabel: peerOwner?.name.trim().split(/\s+/)[0] || "owner",
    status: connection.status as "pending" | "approved" | "declined" | "revoked",
    incoming,
  };
}
