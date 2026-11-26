import { Trans, useLingui } from "@lingui/react/macro";
import type {
  AgentSkillCatalogEntry,
  Bot,
  BotAppControl,
  BotAudience,
  BotProactivity,
  ComputerHost,
  ComputerMode,
  Me,
  ModelCatalogEntry,
  ModelCredential,
  PermissionLevel,
  ThinkingLevel,
  UpdateBotAppControl,
  VoiceInfo,
} from "@rakazo/contracts";
import {
  BOT_DESCRIPTION_MAX_LENGTH,
  BOT_NAME_MAX_LENGTH,
  BUILTIN_TOOL_NAMES,
  botAudienceEditable,
  isVoiceAgentSpawnKey,
} from "@rakazo/contracts";
import {
  connectedModelChoices,
  modelKeyForConnection,
  modelOptionKey,
  parseModelOptionKey,
  resolveSelectableModelId,
} from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Textarea,
  Toggle,
} from "@rakazo/ui-web";
import { ModelPicker } from "@rakazo/ui-web/components/ui/model-picker";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { ApprovalActionsTable } from "../../components/ApprovalActionsTable";
import { SuccessPop } from "../../components/ai/primitives";
import { BotAppControlSection } from "../../components/BotAppControlSection";
import { ErrorBoundary, SectionLoadFailed } from "../../components/ErrorBoundary";
import { PermissionLevelSelect } from "../../components/PermissionLevelSelect";
import { RunsOnPicker } from "../../components/RunsOnPicker";
import { botProfilePatch } from "../../lib/bot-profile-patch";
import { thinkingLevelLabel } from "../../lib/model-catalog";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AvatarStudioPopover } from "./avatar-studio-popover";
import { BotAccessSection } from "./BotAccessSection";
import { BotSkillsSection } from "./BotSkillsSection";
import { BotCredentialsSection } from "./bot-credentials";

const ScratchpadSection = lazy(() =>
  import("../ScratchpadSection").then((module) => ({ default: module.ScratchpadSection })),
);

const KnowledgeSection = lazy(() =>
  import("../KnowledgeSection").then((module) => ({ default: module.KnowledgeSection })),
);

/** Audience settings save the moment they change, each as its own patch. */
type AudiencePatch = {
  audience?: BotAudience;
  externalMessageTargets?: string[];
  externalComputerTools?: boolean;
  proactivity?: BotProactivity;
  /** Server-owned; sent only from its own switch, never by another field's save. */
  firewall?: boolean;
  permissionLevel?: PermissionLevel | null;
  /** Local desktop control; sent only when it changed. */
  appControl?: UpdateBotAppControl;
};

const NO_APP_CONTROL: BotAppControl = { enabled: false, apps: [], headed: false };

/** The selected segment is a filled ink pill, so Internal/External and Team/Private read at a glance. */
const SELECTED_SEGMENT =
  "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:aria-pressed:bg-primary hover:aria-pressed:text-primary-foreground";

// Advanced sections share the heading style of Notifications, Skills, Memory and Credentials.
const advancedLabelClass = "mt-4 block text-[13.5px] font-medium text-foreground";

function ComputerModePicker({
  value,
  onChange,
  teamTestId,
  privateTestId,
}: {
  value: ComputerMode;
  onChange: (value: ComputerMode) => void;
  teamTestId?: string;
  privateTestId?: string;
}) {
  return (
    <div className="mt-4">
      <div className="text-[13.5px] font-medium text-foreground">
        <Trans>Workspace</Trans>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["team", "dedicated"] as const).map((mode) => (
          <Toggle
            key={mode}
            variant="outline"
            pressed={value === mode}
            data-testid={mode === "team" ? teamTestId : privateTestId}
            onPressedChange={(pressed) => {
              if (pressed) onChange(mode);
            }}
            className={`h-auto min-h-8 whitespace-nowrap py-1.5 ${SELECTED_SEGMENT}`}
          >
            {mode === "team" ? <Trans>Shared</Trans> : <Trans>Only this bot</Trans>}
          </Toggle>
        ))}
      </div>
    </div>
  );
}

const CHECK_IN_CADENCES = ["off", "daily", "every_4h"] as const;

export function CheckInSetting({ botId, onChange }: { botId: string; onChange?: () => void }) {
  const { t } = useLingui();
  const id = useId();
  const [cadence, setCadence] = useState<(typeof CHECK_IN_CADENCES)[number]>("off");
  const [error, setError] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    const current = ++request.current;
    void rpc.checkIn
      .get({ botId })
      .then((value) => {
        if (current === request.current) setCadence(value.cadence);
      })
      .catch(() => undefined);
  }, [botId]);
  const labels = { off: t`Off`, daily: t`Daily`, every_4h: t`Every 4 hours` };
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/20 pt-4">
      <label htmlFor={`${id}-check-in`} className="text-[13.5px] font-medium text-foreground">
        <Trans>Check in</Trans>
      </label>
      <NativeSelect
        id={`${id}-check-in`}
        className="w-40"
        value={cadence}
        onChange={(event) => {
          const next = event.target.value as (typeof CHECK_IN_CADENCES)[number];
          const previous = cadence;
          const current = ++request.current;
          setCadence(next);
          setError(false);
          rpc.checkIn
            .set({ botId, cadence: next })
            .then(() => onChange?.())
            .catch(() => {
              if (current !== request.current) return;
              setCadence(previous);
              setError(true);
            });
        }}
      >
        {CHECK_IN_CADENCES.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {labels[value]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error ? (
        <span role="alert" className="basis-full text-[13px] text-destructive">
          <Trans>Could not save</Trans>
        </span>
      ) : null}
    </div>
  );
}

const PROACTIVITY_LEVELS = ["low", "medium", "high"] as const;

/** Firewalled and external agents ignore the level, so the select is shown but cannot change. */
export function ProactivitySetting({
  value,
  locked,
  onChange,
}: {
  value: BotProactivity;
  locked: boolean;
  onChange: (value: BotProactivity) => void;
}) {
  const { t } = useLingui();
  const id = useId();
  const labels = { low: t`Low`, medium: t`Medium`, high: t`High` };
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/20 pt-4">
      <label htmlFor={`${id}-proactivity`} className="text-[13.5px] font-medium text-foreground">
        <Trans>Proactive</Trans>
      </label>
      <NativeSelect
        id={`${id}-proactivity`}
        className="w-40"
        value={value}
        disabled={locked}
        aria-describedby={locked ? `${id}-proactivity-note` : undefined}
        onChange={(event) => onChange(event.target.value as BotProactivity)}
      >
        {PROACTIVITY_LEVELS.map((level) => (
          <NativeSelectOption key={level} value={level}>
            {labels[level]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {locked ? (
        <span
          id={`${id}-proactivity-note`}
          className="basis-full text-[12px] text-muted-foreground"
        >
          <Trans>Not used by firewalled or external agents</Trans>
        </span>
      ) : null}
    </div>
  );
}

export function BotSettings({
  bot,
  memoryProviderConfigured,
  onSkillsChange,
  onCheckInChange,
  skillsRefreshKey,
  focusScratchpadItemId,
  focusScratchpadNonce,
  onScratchpadFocusHandled,
  onSave,
  onExport,
  onClear,
  focusName = false,
  foldable = focusName,
  onFoldedChange,
  hostComputer,
  messageTargets = [],
  notificationsOff = false,
  onOpenNotificationSettings,
}: {
  bot: Bot;
  /** The account delivers no notifications anywhere, so this bot's switch cannot reach the person. */
  notificationsOff?: boolean;
  onOpenNotificationSettings?: () => void;
  /** Internal bots an external bot can be allowed to message. */
  messageTargets?: Pick<Bot, "id" | "name">[];
  /** Set only where the bot may run on the host computer; carries the deployment default. */
  hostComputer?: { defaultHost: ComputerHost };
  /** A bot just created as "New bot": focus and select its name so it gets named first. */
  focusName?: boolean;
  /** Show the More settings toggle even when the name-only view is off (the user opened it). */
  foldable?: boolean;
  /** The user pressed More settings. The parent keeps this, so a rebuilt panel stays as they left it. */
  onFoldedChange?: (folded: boolean) => void;
  onSkillsChange: (skills: AgentSkillCatalogEntry[]) => void;
  /** The check-in setting changed, so its managed routine appeared, changed or went away. */
  onCheckInChange?: () => void;
  /** Changes when a run ends, so skills and open work the agent added reload. */
  skillsRefreshKey?: number;
  /** An open-work row to bring into view when the panel opens. */
  focusScratchpadItemId?: string;
  /** Changes on every request, so choosing the same item again scrolls again. */
  focusScratchpadNonce?: number;
  /** The panel showed the chosen row, so the request can be forgotten. */
  onScratchpadFocusHandled?: () => void;
  memoryProviderConfigured: boolean;
  onSave: (
    patch: {
      name?: string;
      description?: string;
      instructions?: string;
      color?: string;
      notifyOnFinish?: boolean;
      computerMode: ComputerMode;
      runsOn?: ComputerHost;
      memoryScope?: "isolated" | "shared" | null;
      autoSpeak?: boolean;
      crossSpaceCommunication?: boolean;
      voiceId?: string | null;
      modelProvider?: string | null;
      modelId?: string | null;
      modelCredentialId?: string | null;
      thinkingLevel?: ThinkingLevel | null;
      disabledBuiltinTools?: string[];
    } & AudiencePatch,
  ) => Promise<void>;
  onExport: () => Promise<void>;
  onClear: () => void;
}) {
  const { t } = useLingui();
  const [advancedOpened, setAdvancedOpened] = useState(false);
  const ids = useId();
  const [name, setName] = useState(bot.name);
  // Like the description, the name compares against what this panel last saved,
  // not the prop, which can be newer (a rename made elsewhere) or older (a
  // refresh skipped during a reorder). A rename from elsewhere fills the field
  // only while it still shows that saved name, never over text being typed.
  const savedNameRef = useRef(bot.name);
  useEffect(() => {
    if (pendingSavesRef.current !== 0 || name !== savedNameRef.current) return;
    setName(bot.name);
    savedNameRef.current = bot.name;
  }, [bot.name, name]);
  const [description, setDescription] = useState(bot.description);
  // A roster refresh can skip replacing bots while a reorder is in flight, so
  // this prop keeps the description from when the panel opened. Later saves
  // compare against the description last saved here; otherwise a model or
  // voice change treats that stale text as an edit and overwrites instructions.
  const savedDescriptionRef = useRef(bot.description ?? "");
  const [color, setColor] = useState(bot.color);
  const [notifyOnFinish, setNotifyOnFinish] = useState(bot.notifyOnFinish ?? true);
  const [proactivity, setProactivity] = useState<BotProactivity>(bot.proactivity ?? "medium");
  useEffect(() => {
    if (pendingSavesRef.current === 0) setProactivity(bot.proactivity ?? "medium");
  }, [bot.proactivity]);
  const [computerMode, setComputerMode] = useState(bot.computerMode);
  const [runsOn, setRunsOn] = useState<ComputerHost>(
    bot.runsOn ?? hostComputer?.defaultHost ?? "docker",
  );
  // Choosing a different place can give the bot its own computer; follow what the server did.
  useEffect(() => setComputerMode(bot.computerMode), [bot.computerMode]);
  const [memoryScope, setMemoryScope] = useState(bot.memoryScope);
  const [autoSpeak, setAutoSpeak] = useState(bot.autoSpeak);
  const savedAutoSpeakRef = useRef(bot.autoSpeak);
  // Follow a change made elsewhere; a save in flight owns the switch until it finishes.
  useEffect(() => {
    if (pendingSavesRef.current !== 0) return;
    setAutoSpeak(bot.autoSpeak);
    savedAutoSpeakRef.current = bot.autoSpeak;
  }, [bot.autoSpeak]);
  const [crossSpaceCommunication, setCrossSpaceCommunication] = useState(
    bot.crossSpaceCommunication ?? false,
  );
  const [appControl, setAppControl] = useState(bot.appControl ?? NO_APP_CONTROL);
  // Follow the saved settings when nothing is being saved, so a stale copy cannot be edited.
  useEffect(() => {
    if (pendingSavesRef.current === 0) setAppControl(bot.appControl ?? NO_APP_CONTROL);
  }, [bot.appControl]);
  const [voiceId, setVoiceId] = useState(bot.voiceId ?? "");
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [modelKey, setModelKey] = useState(
    bot.modelProvider && bot.modelId ? modelOptionKey(bot.modelProvider, bot.modelId) : "",
  );
  const [credentialId, setCredentialId] = useState(bot.modelCredentialId ?? "");
  const [thinkingLevel, setThinkingLevel] = useState(bot.thinkingLevel ?? "");
  const [disabledBuiltinTools, setDisabledBuiltinTools] = useState<string[]>(
    bot.disabledBuiltinTools ?? [],
  );
  // The list on screen is updated before the save returns. This stays on the
  // last list the server accepted so a rejection can undo that preview.
  const persistedDisabledToolsRef = useRef(disabledBuiltinTools);
  const serverDisabledToolsRef = useRef(disabledBuiltinTools);
  const pendingSavesRef = useRef(0);
  useEffect(() => {
    const next = bot.disabledBuiltinTools ?? [];
    if (serverDisabledToolsRef.current === next) return;
    serverDisabledToolsRef.current = next;
    persistedDisabledToolsRef.current = next;
    if (pendingSavesRef.current === 0) setDisabledBuiltinTools(next);
  }, [bot.disabledBuiltinTools]);
  const [audience, setAudience] = useState<BotAudience>(bot.audience);
  // Follow a change made elsewhere; a save in flight owns the value until it finishes.
  useEffect(() => {
    if (pendingSavesRef.current === 0) setAudience(bot.audience);
  }, [bot.audience]);
  const [firewall, setFirewall] = useState(bot.firewall);
  // Follow a change made elsewhere; a save in flight owns the switch until it finishes.
  useEffect(() => {
    if (pendingSavesRef.current === 0) setFirewall(bot.firewall);
  }, [bot.firewall]);
  // Turning it off asks first, so the switch only follows the dialog's answer.
  const [firewallConfirm, setFirewallConfirm] = useState(false);
  const [allowedTargets, setAllowedTargets] = useState<string[]>(bot.externalMessageTargets);
  const [computerOn, setComputerOn] = useState(bot.externalComputerTools);
  const [grantedConnections, setGrantedConnections] = useState<string[]>([]);
  // Connections an external bot still reaches through an explicit grant. Read once the server
  // has confirmed the audience, because the answer depends on it.
  useEffect(() => {
    if (bot.audience !== "external") return;
    let live = true;
    void Promise.all([rpc.connections.list(), rpc.connections.effectiveAccess()])
      .then(([rows, access]) => {
        if (!live) return;
        setGrantedConnections(
          rows
            .filter((row) => row.status !== "revoked" && access[row.id]?.botIds.includes(bot.id))
            .map((row) => row.displayName),
        );
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [bot.audience, bot.id]);
  const [credentials, setCredentials] = useState<ModelCredential[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [modelMetaReady, setModelMetaReady] = useState(false);
  // True for about two seconds after a save succeeds.
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Advanced choices that save as soon as they change.
  const [saveTick, setSaveTick] = useState(0);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);
  useEffect(() => {
    if (saveTick > 0) void enqueueSave();
  }, [saveTick]);
  const saveOnChange = (apply: () => void) => {
    apply();
    setSaveTick((tick) => tick + 1);
  };
  const saveQueueRef = useRef(Promise.resolve());
  const executeSaveRef = useRef<
    (
      patchOverrides?: {
        name?: string;
        description?: string;
        color?: string;
        notifyOnFinish?: boolean;
        disabledBuiltinTools?: string[];
        baseDisabledBuiltinTools?: string[];
      } & AudiencePatch,
    ) => Promise<void>
  >(async () => undefined);
  useEffect(() => {
    void rpc.voice
      .voices({})
      .then(setVoices)
      .catch(() => setVoices([]));
    void Promise.all([rpc.models.credentials(), rpc.models.list(), rpc.me()])
      .then(([nextCredentials, nextCatalog, nextMe]) => {
        setCredentials(nextCredentials);
        setCatalog(nextCatalog);
        setMe(nextMe);
        // Only mark ready on success — a failed catalog load must not clear
        // an existing thinkingLevel override on save.
        setModelMetaReady(true);
      })
      .catch(() => undefined);
  }, []);

  // A pinned connection narrows the model list to what that connection can run.
  const pinnedCredential = credentials.find((entry) => entry.id === credentialId);
  const connectedOptions = connectedModelChoices(
    pinnedCredential ? [pinnedCredential] : credentials,
    catalog,
  );
  // A lost pin is fixed in Advanced > Connection: open it once, without saving.
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const openedForLostPin = useRef(false);
  const scrollToConnection = useRef(false);
  const pinLost = modelMetaReady && credentialId !== "" && !pinnedCredential;
  useEffect(() => {
    if (!pinLost || openedForLostPin.current || !advancedRef.current) return;
    openedForLostPin.current = true;
    scrollToConnection.current = true;
    advancedRef.current.open = true;
  }, [pinLost]);
  const storedModel = modelKey ? parseModelOptionKey(modelKey) : null;
  const selectedModel = storedModel
    ? {
        provider: storedModel.provider,
        modelId: resolveSelectableModelId(catalog, storedModel.provider, storedModel.modelId),
      }
    : null;
  const selectedModelKey = selectedModel
    ? modelOptionKey(selectedModel.provider, selectedModel.modelId)
    : "";

  // A chosen model whose provider is not connected: runs use the system model instead.
  const unavailableModel =
    modelMetaReady &&
    selectedModel &&
    !connectedOptions.some((option) => option.key === selectedModelKey)
      ? (catalogLabel(catalog, selectedModel.provider, selectedModel.modelId) ??
        selectedModel.modelId)
      : null;
  const effectiveProvider = selectedModel?.provider ?? me?.defaultProvider ?? null;
  const effectiveModelId = selectedModel?.modelId ?? me?.defaultModel ?? null;
  const effectiveEntry =
    effectiveProvider && effectiveModelId
      ? catalog.find(
          (entry) =>
            entry.provider === effectiveProvider &&
            resolveSelectableModelId(catalog, entry.provider, entry.id) === effectiveModelId,
        )
      : undefined;
  const effectiveCredential = credentials.find(
    (entry) => entry.provider === effectiveProvider && entry.modelId === effectiveModelId,
  );
  const thinkingOptions = (
    effectiveCredential?.thinkingLevels ??
    effectiveEntry?.thinkingLevels ??
    []
  ).filter((level) => level !== "off");
  const defaultThinkingLevel = effectiveCredential?.thinkingLevel ?? "medium";

  async function executeSave(
    patchOverrides?: {
      name?: string;
      description?: string;
      color?: string;
      notifyOnFinish?: boolean;
      disabledBuiltinTools?: string[];
      baseDisabledBuiltinTools?: string[];
    } & AudiencePatch,
  ) {
    const selected = selectedModel;
    const nextName = (patchOverrides?.name !== undefined ? patchOverrides.name : name).trim();
    const nextDescription = (
      patchOverrides?.description !== undefined ? patchOverrides.description : description
    ).trim();
    const nextColor = patchOverrides?.color !== undefined ? patchOverrides.color : color;
    const nextNotify =
      patchOverrides?.notifyOnFinish !== undefined ? patchOverrides.notifyOnFinish : notifyOnFinish;

    // An empty field is not a rename: it shows the saved name again instead.
    const nextSavedName = nextName || savedNameRef.current;
    setName(nextSavedName);
    setDescription(nextDescription);

    try {
      setError(null);
      const patch = {
        // Only an edited name goes on the wire; other saves must not revert a
        // rename made on iOS or in another tab.
        ...(nextSavedName !== savedNameRef.current ? { name: nextSavedName } : {}),
        // One field feeds both, so it only goes on the wire when it changed: a
        // model, thinking or voice save must not overwrite longer instructions,
        // nor fail on a description that is already above its own limit.
        ...botProfilePatch(savedDescriptionRef.current, nextDescription),
        // Unchanged color stays off the wire so a legacy named value cannot fail a name save.
        ...(nextColor !== bot.color ? { color: nextColor } : {}),
        notifyOnFinish: nextNotify,
        computerMode,
        ...(hostComputer && runsOn !== (bot.runsOn ?? hostComputer.defaultHost) ? { runsOn } : {}),
        memoryScope,
        ...(patchOverrides?.audience !== undefined ? { audience: patchOverrides.audience } : {}),
        ...(patchOverrides?.proactivity !== undefined
          ? { proactivity: patchOverrides.proactivity }
          : {}),
        ...(patchOverrides?.firewall !== undefined ? { firewall: patchOverrides.firewall } : {}),
        ...(patchOverrides?.permissionLevel !== undefined
          ? { permissionLevel: patchOverrides.permissionLevel }
          : {}),
        ...(patchOverrides?.externalMessageTargets !== undefined
          ? { externalMessageTargets: patchOverrides.externalMessageTargets }
          : {}),
        ...(patchOverrides?.appControl ? { appControl: patchOverrides.appControl } : {}),
        ...(patchOverrides?.externalComputerTools !== undefined
          ? { externalComputerTools: patchOverrides.externalComputerTools }
          : {}),
        // Same rule as the name: an iOS toggle must not be reverted by an
        // unrelated save.
        ...(autoSpeak !== savedAutoSpeakRef.current ? { autoSpeak } : {}),
        crossSpaceCommunication,
        voiceId: voiceId || null,
        modelProvider: selected?.provider ?? null,
        modelId: selected?.modelId ?? null,
        // Sent as saved even when the connection is gone, so saving other fields keeps the pin.
        modelCredentialId: selected && credentialId ? credentialId : null,
        ...(modelMetaReady
          ? {
              thinkingLevel: thinkingOptions.length
                ? ((thinkingLevel || null) as ThinkingLevel | null)
                : null,
            }
          : {}),
      };
      const requestedTools = patchOverrides?.disabledBuiltinTools;
      const baseTools = patchOverrides?.baseDisabledBuiltinTools ?? [];
      // Preserve this edit's additions/removals against any refreshed server list.
      // Retry if a refresh arrives while the request is in flight.
      for (;;) {
        const serverTools = serverDisabledToolsRef.current;
        const nextTools =
          requestedTools === undefined
            ? undefined
            : [
                ...persistedDisabledToolsRef.current.filter(
                  (name) => !baseTools.includes(name) || requestedTools.includes(name),
                ),
                ...requestedTools.filter(
                  (name) =>
                    !baseTools.includes(name) && !persistedDisabledToolsRef.current.includes(name),
                ),
              ];
        // Unrelated saves omit the list, preserving changes from other sessions.
        await onSave({
          ...patch,
          ...(nextTools !== undefined ? { disabledBuiltinTools: nextTools } : {}),
        });
        if (nextTools === undefined) break;
        if (
          serverTools !== serverDisabledToolsRef.current &&
          !sameStringList(nextTools, serverDisabledToolsRef.current)
        )
          continue;
        persistedDisabledToolsRef.current = nextTools;
        break;
      }
      savedDescriptionRef.current = nextDescription;
      savedNameRef.current = nextSavedName;
      savedAutoSpeakRef.current = autoSpeak;
      setSaved(true);
    } catch (err) {
      setError(errorText(err, t`Could not save`));
      setAudience(bot.audience);
      setProactivity(bot.proactivity ?? "medium");
      setFirewall(bot.firewall);
      setAllowedTargets(bot.externalMessageTargets);
      setComputerOn(bot.externalComputerTools);
      setAppControl(bot.appControl ?? NO_APP_CONTROL);
    } finally {
      pendingSavesRef.current -= 1;
      if (pendingSavesRef.current === 0) {
        setDisabledBuiltinTools([...persistedDisabledToolsRef.current]);
      }
    }
  }
  executeSaveRef.current = executeSave;

  function disableBuiltinTool(name: string) {
    if (!name || disabledBuiltinTools.includes(name)) return;
    const next = [...disabledBuiltinTools, name];
    setDisabledBuiltinTools(next);
    void enqueueSave({ disabledBuiltinTools: next });
  }

  function enqueueSave(
    patchOverrides?: {
      name?: string;
      description?: string;
      color?: string;
      notifyOnFinish?: boolean;
      disabledBuiltinTools?: string[];
    } & AudiencePatch,
  ) {
    // Serialize full-object auto-saves so an older in-flight request cannot
    // finish after a newer one and clobber fields. Always call through a ref so
    // queued work reads the latest field values, not a stale render closure.
    pendingSavesRef.current += 1;
    setSaved(false);
    const queuedPatch =
      patchOverrides?.disabledBuiltinTools === undefined
        ? patchOverrides
        : {
            ...patchOverrides,
            baseDisabledBuiltinTools: [...persistedDisabledToolsRef.current],
          };
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => executeSaveRef.current(queuedPatch));
    return saveQueueRef.current;
  }

  // The approvals table shows the gate's decision at the agent's effective level, which these
  // saves change.
  const [approvalsVersion, setApprovalsVersion] = useState(0);
  const saveAndReloadApprovals = (patch: Parameters<typeof enqueueSave>[0]) =>
    void enqueueSave(patch).then(() => setApprovalsVersion((n) => n + 1));

  // A bot just created as "New bot" shows only its name until it has replied once.
  const [folded, setFolded] = useState(focusName);
  useEffect(() => setFolded(focusName), [focusName]);
  // A chosen open-work row lives past the name-only view, so show it rather than hiding it.
  useEffect(() => {
    if (focusScratchpadItemId) setFolded(false);
  }, [focusScratchpadItemId, focusScratchpadNonce]);

  return (
    <div data-testid="bot-settings">
      <div className="flex h-6 justify-end" aria-live="polite">
        {saved ? <SuccessPop label={t`Saved`} /> : null}
      </div>
      <div className="flex justify-center pb-4">
        <AvatarStudioPopover
          value={color}
          identity={bot.id}
          status={bot.status}
          size={76}
          onChange={(newColor) => {
            setColor(newColor);
            void enqueueSave({ color: newColor });
          }}
        />
      </div>
      <label htmlFor={`${ids}-name`} className={advancedLabelClass}>
        <Trans>Name</Trans>
        <Input
          id={`${ids}-name`}
          value={name}
          maxLength={BOT_NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void enqueueSave();
          }}
          onBlur={() => void enqueueSave()}
          autoFocus={focusName}
          onFocus={focusName ? (e) => e.currentTarget.select() : undefined}
          className="mt-1.5"
        />
      </label>
      {foldable ? (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={!folded}
          className="mt-4 -ms-2.5 text-muted-foreground"
          onClick={() => {
            setFolded(!folded);
            onFoldedChange?.(!folded);
          }}
        >
          <Trans>More settings</Trans>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform ${folded ? "" : "rotate-180"}`}
          />
        </Button>
      ) : null}
      {folded ? null : (
        <>
          {isVoiceAgentSpawnKey(bot.spawnKey) ? null : (
            <label
              htmlFor={`${ids}-firewall`}
              className="mt-6 flex items-center justify-between pt-4 border-t border-border/20 pointer-coarse:min-h-11"
            >
              <div className="space-y-0.5 pe-4">
                <div
                  id={`${ids}-firewall-label`}
                  className="text-[13.5px] font-medium text-foreground"
                >
                  <Trans>Firewall</Trans>
                </div>
                <div id={`${ids}-firewall-desc`} className="text-[12px] text-muted-foreground">
                  <Trans>
                    Treat everything it reads as untrusted. Sends and changes always ask.
                  </Trans>
                </div>
              </div>
              <Switch
                id={`${ids}-firewall`}
                checked={firewall}
                aria-labelledby={`${ids}-firewall-label`}
                aria-describedby={`${ids}-firewall-desc`}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setFirewallConfirm(true);
                    return;
                  }
                  setFirewall(true);
                  saveAndReloadApprovals({ firewall: true });
                }}
              />
            </label>
          )}
          <AlertDialog open={firewallConfirm} onOpenChange={setFirewallConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  <Trans>Turn off Firewall?</Trans>
                </AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <Trans>Cancel</Trans>
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    setFirewallConfirm(false);
                    setFirewall(false);
                    saveAndReloadApprovals({ firewall: false });
                  }}
                >
                  <Trans>Turn off</Trans>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <label htmlFor={`${ids}-description`} className={advancedLabelClass}>
            <Trans>Description</Trans>
            <Textarea
              id={`${ids}-description`}
              value={description}
              maxLength={BOT_DESCRIPTION_MAX_LENGTH}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => void enqueueSave()}
              rows={3}
              placeholder={t`What this bot handles`}
              className="mt-1.5"
            />
          </label>
          <label
            htmlFor={`${ids}-notify-finish`}
            className="mt-6 flex items-center justify-between pt-4 border-t border-border/20 pointer-coarse:min-h-11"
          >
            <div className="space-y-0.5 pe-4">
              <div
                id={`${ids}-notify-finish-label`}
                className="text-[13.5px] font-medium text-foreground"
              >
                <Trans>Notifications</Trans>
              </div>
              <div id={`${ids}-notify-finish-desc`} className="text-[12px] text-muted-foreground">
                {notificationsOff && onOpenNotificationSettings ? (
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={(event) => {
                      event.preventDefault();
                      onOpenNotificationSettings();
                    }}
                  >
                    <Trans>Off in Settings</Trans>
                  </button>
                ) : (
                  <Trans>Get notified when this bot finishes or needs input</Trans>
                )}
              </div>
            </div>
            <Switch
              id={`${ids}-notify-finish`}
              checked={notifyOnFinish && !notificationsOff}
              disabled={notificationsOff}
              aria-labelledby={`${ids}-notify-finish-label`}
              aria-describedby={`${ids}-notify-finish-desc`}
              onCheckedChange={(checked) => {
                setNotifyOnFinish(checked);
                void enqueueSave({ notifyOnFinish: checked });
              }}
            />
          </label>
          <CheckInSetting botId={bot.id} onChange={onCheckInChange} />
          {isVoiceAgentSpawnKey(bot.spawnKey) ? null : (
            <ProactivitySetting
              value={proactivity}
              locked={firewall || audience === "external"}
              onChange={(next) => {
                setProactivity(next);
                void enqueueSave({ proactivity: next });
              }}
            />
          )}
          <ErrorBoundary fallback={<SectionLoadFailed />}>
            <Suspense fallback={null}>
              <ScratchpadSection
                botId={bot.id}
                refreshKey={skillsRefreshKey}
                focusItemId={focusScratchpadItemId}
                focusItemNonce={focusScratchpadNonce}
                onFocusHandled={onScratchpadFocusHandled}
              />
            </Suspense>
          </ErrorBoundary>
          {botAudienceEditable(bot.spawnKey) ? (
            <div data-testid="bot-audience" className="mt-6 border-t border-border/20 pt-4">
              <div className="text-[13.5px] font-medium text-foreground">
                <Trans>Audience</Trans>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["internal", "external"] as const).map((value) => (
                  <Toggle
                    key={value}
                    variant="outline"
                    pressed={audience === value}
                    data-testid={`bot-audience-${value}`}
                    onPressedChange={(pressed) => {
                      if (!pressed || audience === value) return;
                      setAudience(value);
                      saveAndReloadApprovals({ audience: value });
                    }}
                    className={SELECTED_SEGMENT}
                  >
                    {value === "internal" ? <Trans>Internal</Trans> : <Trans>External</Trans>}
                  </Toggle>
                ))}
              </div>
              {audience === "external" ? (
                <>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    <Trans>
                      Talks to people outside your company. Anything private it would share waits
                      for your approval. Private tools are turned off.
                    </Trans>
                  </p>
                  {grantedConnections.length ? (
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                      {t`Still has access to: ${grantedConnections.join(", ")}`}
                    </p>
                  ) : null}
                  {messageTargets.length ? (
                    <div className="mt-4">
                      <div className="text-[13.5px] font-medium text-foreground">
                        <Trans>Can message</Trans>
                      </div>
                      {messageTargets.map((target) => (
                        <label
                          key={target.id}
                          htmlFor={`${ids}-target-${target.id}`}
                          className="mt-2 flex items-center justify-between gap-3 text-[13px] text-foreground/80 pointer-coarse:min-h-11"
                        >
                          <span>{target.name}</span>
                          <Switch
                            id={`${ids}-target-${target.id}`}
                            checked={allowedTargets.includes(target.id)}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...allowedTargets, target.id]
                                : allowedTargets.filter((id) => id !== target.id);
                              setAllowedTargets(next);
                              void enqueueSave({ externalMessageTargets: next });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}
                  <label
                    htmlFor={`${ids}-external-computer`}
                    className="mt-4 flex items-center justify-between gap-3 text-[13px] text-foreground/80 pointer-coarse:min-h-11"
                  >
                    <Trans>Computer and browser</Trans>
                    <Switch
                      id={`${ids}-external-computer`}
                      checked={computerOn}
                      onCheckedChange={(checked) => {
                        setComputerOn(checked);
                        void enqueueSave({ externalComputerTools: checked });
                      }}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}
          <BotSkillsSection
            botId={bot.id}
            refreshKey={skillsRefreshKey}
            onSkillsChange={onSkillsChange}
          />
          <BotCredentialsSection botId={bot.id} />
          <BotAccessSection bot={bot} />
          <section data-testid="bot-approvals" className="mt-6">
            <div className="mb-2 text-[13.5px] font-medium text-foreground">
              <Trans>Approvals</Trans>
            </div>
            <PermissionLevelSelect
              agent={{
                level: bot.permissionLevel ?? null,
                clamped: firewall || audience === "external",
                onChange: (permissionLevel) => saveAndReloadApprovals({ permissionLevel }),
              }}
            />
            <div className="mt-3">
              <ApprovalActionsTable botId={bot.id} refreshKey={approvalsVersion} />
            </div>
          </section>
          <details
            ref={advancedRef}
            data-testid="bot-settings-advanced"
            className="group mt-5 open:pb-3"
            onToggle={(event) => {
              if (!event.currentTarget.open) return;
              setAdvancedOpened(true);
              const target = scrollToConnection.current
                ? event.currentTarget.querySelector('select[id$="-connection"]')
                : event.currentTarget.querySelector("summary");
              const block = scrollToConnection.current ? "center" : "nearest";
              scrollToConnection.current = false;
              target?.scrollIntoView?.({
                block,
                behavior: "smooth",
              });
            }}
          >
            <summary
              className={`${FOOTER_ROW} cursor-pointer list-none rounded-lg text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              <Trans>Advanced</Trans>
              <ChevronRight
                aria-hidden="true"
                className="size-4 transition-transform group-open:rotate-90"
              />
            </summary>
            <div className="ms-2 border-s border-border ps-4">
              <ComputerModePicker
                value={computerMode}
                onChange={(value) => saveOnChange(() => setComputerMode(value))}
              />
              {hostComputer ? (
                <div className="mt-4">
                  <div className="text-[13.5px] font-medium text-foreground">
                    <Trans>Runs on</Trans>
                  </div>
                  <RunsOnPicker
                    value={runsOn}
                    onChange={(value) => saveOnChange(() => setRunsOn(value))}
                  />
                </div>
              ) : null}
              <BotAppControlSection
                value={appControl}
                runsOnThisMac={(hostComputer ? runsOn : bot.runsOn) === "this-mac"}
                onChange={(patch) => {
                  setAppControl((current) => ({ ...current, ...patch }));
                  void enqueueSave({ appControl: patch });
                }}
              />
              {advancedOpened ? (
                <ErrorBoundary fallback={<SectionLoadFailed />}>
                  <Suspense fallback={null}>
                    <KnowledgeSection botId={bot.id} />
                  </Suspense>
                </ErrorBoundary>
              ) : null}
              {credentials.length > 1 || credentialId ? (
                <label htmlFor={`${ids}-connection`} className={advancedLabelClass}>
                  <Trans>Connection</Trans>
                  <NativeSelect
                    id={`${ids}-connection`}
                    className="mt-2 w-full"
                    value={credentialId}
                    onChange={(event) => {
                      const next = credentials.find((entry) => entry.id === event.target.value);
                      saveOnChange(() => {
                        setCredentialId(next?.id ?? "");
                        setThinkingLevel("");
                        if (next)
                          setModelKey(modelKeyForConnection(next, catalog, selectedModelKey));
                      });
                    }}
                  >
                    <NativeSelectOption value="">{t`Space default`}</NativeSelectOption>
                    {credentialId && !pinnedCredential ? (
                      <NativeSelectOption value={credentialId}>
                        {t`Signed out or removed`}
                      </NativeSelectOption>
                    ) : null}
                    {credentials.map((entry) => (
                      <NativeSelectOption key={entry.id} value={entry.id}>
                        {entry.authKind === "oauth"
                          ? t`${entry.label} (Subscription)`
                          : entry.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              ) : null}
              <label htmlFor={`${ids}-model`} className={advancedLabelClass}>
                <Trans>Model</Trans>
                <ModelPicker
                  id={`${ids}-model`}
                  className="mt-2 w-full"
                  label={t`Model`}
                  searchLabel={t`Search models`}
                  emptyLabel={t`No matching models`}
                  loadingLabel={t`Loading models…`}
                  loading={!modelMetaReady}
                  value={selectedModelKey}
                  options={[
                    {
                      value: "",
                      label:
                        t`System model` +
                        (me?.defaultModel
                          ? ` (${catalogLabel(catalog, me.defaultProvider, me.defaultModel) ?? me.defaultModel})`
                          : ""),
                    },
                    ...(selectedModelKey &&
                    !connectedOptions.some((option) => option.key === selectedModelKey)
                      ? [
                          {
                            value: selectedModelKey,
                            label: unavailableModel ?? selectedModel?.modelId ?? selectedModelKey,
                            provider: selectedModel?.provider,
                          },
                        ]
                      : []),
                    ...connectedOptions.map((option) => ({
                      ...option,
                      value: option.key,
                      id: option.modelId,
                      providerName: catalog.find((entry) => entry.provider === option.provider)
                        ?.providerName,
                    })),
                  ]}
                  onChange={(value) => {
                    saveOnChange(() => {
                      setModelKey(value);
                      setThinkingLevel("");
                    });
                  }}
                />
                {unavailableModel ? (
                  <span className="mt-1.5 block text-[12.5px] font-normal text-muted-foreground">
                    {t`Using the system model: ${unavailableModel} isn't available`}
                  </span>
                ) : null}
              </label>
              {thinkingOptions.length ? (
                <label htmlFor={`${ids}-thinking`} className={advancedLabelClass}>
                  <Trans>Thinking</Trans>
                  <NativeSelect
                    id={`${ids}-thinking`}
                    className="mt-2 w-full"
                    value={thinkingLevel}
                    onChange={(event) => saveOnChange(() => setThinkingLevel(event.target.value))}
                  >
                    <NativeSelectOption value="">
                      {t`Default (${thinkingLevelLabel(defaultThinkingLevel)})`}
                    </NativeSelectOption>
                    {thinkingOptions.map((level) => (
                      <NativeSelectOption key={level} value={level}>
                        {thinkingLevelLabel(level)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              ) : null}
              {memoryProviderConfigured ? (
                <div className="mt-4 text-[13.5px] font-medium text-foreground">
                  <Trans>Memory scope</Trans>
                  <div className="mt-2 flex gap-2">
                    {(
                      [
                        { value: null, label: t`Inherit default` },
                        { value: "isolated" as const, label: t`Isolated` },
                        { value: "shared" as const, label: t`Shared` },
                      ] satisfies Array<{ value: "isolated" | "shared" | null; label: string }>
                    ).map((option) => (
                      <Toggle
                        key={option.label}
                        variant="outline"
                        size="sm"
                        pressed={memoryScope === option.value}
                        onPressedChange={(pressed) => {
                          if (pressed) saveOnChange(() => setMemoryScope(option.value));
                        }}
                        className={`flex-1 ${SELECTED_SEGMENT}`}
                      >
                        {option.label}
                      </Toggle>
                    ))}
                  </div>
                </div>
              ) : null}
              <label
                htmlFor={`${ids}-auto-speak`}
                className="mt-5 flex cursor-pointer items-center justify-between gap-3 text-[14px] text-foreground/75 pointer-coarse:min-h-11"
              >
                <Trans>Read replies aloud</Trans>
                <Switch
                  id={`${ids}-auto-speak`}
                  checked={autoSpeak}
                  onCheckedChange={(checked) => saveOnChange(() => setAutoSpeak(checked))}
                />
              </label>
              <label
                htmlFor={`${ids}-cross-space`}
                className="mt-5 flex cursor-pointer items-center justify-between gap-3 text-[14px] text-foreground/75 pointer-coarse:min-h-11"
              >
                <Trans>Allow cross-space bot communication</Trans>
                <Switch
                  id={`${ids}-cross-space`}
                  checked={crossSpaceCommunication}
                  onCheckedChange={(checked) =>
                    saveOnChange(() => setCrossSpaceCommunication(checked))
                  }
                />
              </label>
              {voices.length ? (
                <label htmlFor={`${ids}-voice`} className={advancedLabelClass}>
                  <Trans>Voice</Trans>
                  <NativeSelect
                    id={`${ids}-voice`}
                    className="mt-2 w-full"
                    value={voiceId}
                    onChange={(event) => saveOnChange(() => setVoiceId(event.target.value))}
                  >
                    <NativeSelectOption value="">{t`Account default`}</NativeSelectOption>
                    {voices.map((voice) => (
                      <NativeSelectOption key={voice.id} value={voice.id}>
                        {voice.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              ) : null}
              <label htmlFor={`${ids}-disabled-tools`} className={advancedLabelClass}>
                <Trans>Disabled tools</Trans>
                <NativeSelect
                  id={`${ids}-disabled-tools`}
                  className="mt-1.5 w-full"
                  value=""
                  onChange={(event) => disableBuiltinTool(event.target.value)}
                >
                  <NativeSelectOption value="">{t`Choose a tool`}</NativeSelectOption>
                  {BUILTIN_TOOL_NAMES.filter((name) => !disabledBuiltinTools.includes(name)).map(
                    (name) => (
                      <NativeSelectOption key={name} value={name}>
                        {toolLabel(name)}
                      </NativeSelectOption>
                    ),
                  )}
                </NativeSelect>
              </label>
              {disabledBuiltinTools.map((toolName) => (
                <label
                  key={toolName}
                  htmlFor={`${ids}-disabled-${toolName}`}
                  className="mt-2 flex items-center justify-between gap-3 text-[13px] text-foreground/80 pointer-coarse:min-h-11"
                >
                  <span>{toolLabel(toolName)}</span>
                  <Switch
                    id={`${ids}-disabled-${toolName}`}
                    checked
                    onCheckedChange={(checked) => {
                      if (checked) return;
                      const next = disabledBuiltinTools.filter((entry) => entry !== toolName);
                      setDisabledBuiltinTools(next);
                      void enqueueSave({ disabledBuiltinTools: next });
                    }}
                  />
                </label>
              ))}
            </div>
          </details>
          {error ? <p className="mt-2 text-[13px] text-destructive">{error}</p> : null}
          <div className="mt-3 flex flex-col">
            <Button
              variant="ghost"
              className={`${FOOTER_ROW} h-9 justify-start px-0 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground`}
              onClick={() => void onExport()}
            >
              <Trans>Export</Trans>
              <Download aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="ghost"
              className={`${FOOTER_ROW} h-9 justify-start px-0 font-normal text-destructive hover:bg-transparent hover:text-destructive`}
              onClick={onClear}
            >
              <Trans>Clear conversation</Trans>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** The footer rows (Advanced, Export, Clear conversation) share one layout and right edge. */
const FOOTER_ROW = "flex w-full items-center justify-between gap-3 text-[14px]";

/** `web_search` shown as "Web search". */
function toolLabel(name: string) {
  const text = name.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sameStringList(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function catalogLabel(
  catalog: ModelCatalogEntry[],
  provider: string | null | undefined,
  modelId: string,
) {
  if (!provider) return undefined;
  return catalog.find((entry) => entry.provider === provider && entry.id === modelId)?.label;
}
