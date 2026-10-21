import { Trans, useLingui } from "@lingui/react/macro";
import type {
  AgentSkillCatalogEntry,
  Bot,
  BotAudience,
  ComputerHost,
  ComputerMode,
  Me,
  ModelCatalogEntry,
  ModelCredential,
  ThinkingLevel,
  VoiceInfo,
} from "@rakazo/contracts";
import {
  BOT_DESCRIPTION_MAX_LENGTH,
  BOT_NAME_MAX_LENGTH,
  BOT_TITLE_MAX_LENGTH,
  botAudienceEditable,
  isBuiltinToolName,
} from "@rakazo/contracts";
import {
  connectedModelChoices,
  modelOptionKey,
  parseModelOptionKey,
  resolveSelectableModelId,
} from "@rakazo/core";
import {
  Button,
  Input,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Textarea,
  Toggle,
} from "@rakazo/ui-web";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { SuccessPop } from "../../components/ai/primitives";
import { ErrorBoundary, SectionLoadFailed } from "../../components/ErrorBoundary";
import { RunsOnPicker } from "../../components/RunsOnPicker";
import { botProfilePatch } from "../../lib/bot-profile-patch";
import { thinkingLevelLabel } from "../../lib/model-catalog";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AvatarStudioPopover } from "./avatar-studio-popover";
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
};

const fieldLabelClass = "mt-4 block text-[14px] text-muted-foreground";
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
        <Trans>Computer</Trans>
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
            className="capitalize aria-pressed:border-foreground/40 aria-pressed:text-foreground"
          >
            {mode === "team" ? <Trans>Team</Trans> : <Trans>Private</Trans>}
          </Toggle>
        ))}
      </div>
    </div>
  );
}

export function BotSettings({
  bot,
  memoryProviderConfigured,
  onSkillsChange,
  skillsRefreshKey,
  onSave,
  onExport,
  onClear,
  focusName = false,
  hostComputer,
  messageTargets = [],
}: {
  bot: Bot;
  /** Internal bots an external bot can be allowed to message. */
  messageTargets?: Pick<Bot, "id" | "name">[];
  /** Set only where the bot may run on the host computer; carries the deployment default. */
  hostComputer?: { defaultHost: ComputerHost };
  /** A bot just created as "New bot": focus and select its name so it gets named first. */
  focusName?: boolean;
  onSkillsChange: (skills: AgentSkillCatalogEntry[]) => void;
  /** Changes when the agent may have created a skill, so the list reloads. */
  skillsRefreshKey?: number;
  memoryProviderConfigured: boolean;
  onSave: (
    patch: {
      name?: string;
      title?: string;
      description?: string;
      instructions?: string;
      color?: string;
      notifyOnFinish?: boolean;
      computerMode: ComputerMode;
      runsOn?: ComputerHost;
      memoryScope?: "isolated" | "shared" | null;
      autoSpeak?: boolean;
      voiceId?: string | null;
      modelProvider?: string | null;
      modelId?: string | null;
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
  const [title, setTitle] = useState(bot.title);
  const [description, setDescription] = useState(bot.description);
  // A roster refresh can skip replacing bots while a reorder is in flight, so
  // this prop keeps the description from when the panel opened. Later saves
  // compare against the description last saved here; otherwise a model or
  // voice change treats that stale text as an edit and overwrites instructions.
  const savedDescriptionRef = useRef(bot.description ?? "");
  const [color, setColor] = useState(bot.color);
  const [notifyOnFinish, setNotifyOnFinish] = useState(bot.notifyOnFinish ?? true);
  const [computerMode, setComputerMode] = useState(bot.computerMode);
  const [runsOn, setRunsOn] = useState<ComputerHost>(
    bot.runsOn ?? hostComputer?.defaultHost ?? "docker",
  );
  // Choosing a different place can give the bot its own computer; follow what the server did.
  useEffect(() => setComputerMode(bot.computerMode), [bot.computerMode]);
  const [memoryScope, setMemoryScope] = useState(bot.memoryScope);
  const [autoSpeak, setAutoSpeak] = useState(bot.autoSpeak);
  const [voiceId, setVoiceId] = useState(bot.voiceId ?? "");
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [modelKey, setModelKey] = useState(
    bot.modelProvider && bot.modelId ? modelOptionKey(bot.modelProvider, bot.modelId) : "",
  );
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
  const [toolNameDraft, setToolNameDraft] = useState("");
  const [credentials, setCredentials] = useState<ModelCredential[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [modelMetaReady, setModelMetaReady] = useState(false);
  // True for about two seconds after a save succeeds.
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);
  // Bumped by Advanced choices that save as soon as they change.
  const [saveTick, setSaveTick] = useState(0);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs only when a choice changes, and enqueueSave reads the latest values through a ref
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
        title?: string;
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

  const connectedOptions = connectedModelChoices(credentials, catalog);
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
      title?: string;
      description?: string;
      color?: string;
      notifyOnFinish?: boolean;
      disabledBuiltinTools?: string[];
      baseDisabledBuiltinTools?: string[];
    } & AudiencePatch,
  ) {
    const selected = selectedModel;
    const nextName = (patchOverrides?.name !== undefined ? patchOverrides.name : name).trim();
    const nextTitle = (patchOverrides?.title !== undefined ? patchOverrides.title : title).trim();
    const nextDescription = (
      patchOverrides?.description !== undefined ? patchOverrides.description : description
    ).trim();
    const nextColor = patchOverrides?.color !== undefined ? patchOverrides.color : color;
    const nextNotify =
      patchOverrides?.notifyOnFinish !== undefined ? patchOverrides.notifyOnFinish : notifyOnFinish;

    if (nextName) setName(nextName);
    setTitle(nextTitle);
    setDescription(nextDescription);

    try {
      setError(null);
      const patch = {
        name: nextName || bot.name,
        title: nextTitle,
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
        ...(patchOverrides?.externalMessageTargets !== undefined
          ? { externalMessageTargets: patchOverrides.externalMessageTargets }
          : {}),
        ...(patchOverrides?.externalComputerTools !== undefined
          ? { externalComputerTools: patchOverrides.externalComputerTools }
          : {}),
        autoSpeak,
        voiceId: voiceId || null,
        modelProvider: selected?.provider ?? null,
        modelId: selected?.modelId ?? null,
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
      setSaved(true);
    } catch (err) {
      setError(errorText(err, t`Could not save`));
      setAudience(bot.audience);
      setAllowedTargets(bot.externalMessageTargets);
      setComputerOn(bot.externalComputerTools);
    } finally {
      pendingSavesRef.current -= 1;
      if (pendingSavesRef.current === 0) {
        setDisabledBuiltinTools([...persistedDisabledToolsRef.current]);
      }
    }
  }
  executeSaveRef.current = executeSave;

  function disableBuiltinTools(raw: string) {
    const names = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!names.length) return;
    const unknown = names.filter((entry) => !isBuiltinToolName(entry));
    if (unknown.length) {
      setToolError(t`Unknown tool: ${unknown.join(", ")}`);
      return;
    }
    setToolNameDraft("");
    setToolError(null);
    const added = names.filter((entry) => !disabledBuiltinTools.includes(entry));
    if (!added.length) return;
    const next = [...disabledBuiltinTools, ...new Set(added)];
    setDisabledBuiltinTools(next);
    void enqueueSave({ disabledBuiltinTools: next });
  }

  function enqueueSave(
    patchOverrides?: {
      name?: string;
      title?: string;
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

  // A bot just created as "New bot" shows only its name until it has replied once.
  const [unfolded, setUnfolded] = useState(false);
  const folded = focusName && !unfolded;

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
      <label htmlFor={`${ids}-name`} className="mt-4 block text-[13.5px] text-muted-foreground/80">
        <Trans>Name</Trans>
        <Input
          id={`${ids}-name`}
          value={name}
          maxLength={BOT_NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void enqueueSave()}
          autoFocus={focusName}
          onFocus={focusName ? (e) => e.currentTarget.select() : undefined}
          className="mt-1.5"
        />
      </label>
      {folded ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 -ms-2.5 text-muted-foreground"
          onClick={() => setUnfolded(true)}
        >
          <Trans>More settings</Trans>
        </Button>
      ) : (
        <>
          <label htmlFor={`${ids}-title`} className={fieldLabelClass}>
            <Trans>Title</Trans>
            <Input
              id={`${ids}-title`}
              value={title}
              maxLength={BOT_TITLE_MAX_LENGTH}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void enqueueSave()}
              placeholder={t`e.g. Recruiting, Sales, Legal`}
              className="mt-1.5"
            />
          </label>
          <label htmlFor={`${ids}-description`} className={fieldLabelClass}>
            <Trans>Description</Trans>
            <Textarea
              id={`${ids}-description`}
              value={description}
              maxLength={BOT_DESCRIPTION_MAX_LENGTH}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => void enqueueSave()}
              rows={3}
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
              <div
                id={`${ids}-notify-finish-desc`}
                className="text-[12px] text-muted-foreground/70"
              >
                <Trans>Get notified when this bot finishes or needs input</Trans>
              </div>
            </div>
            <Switch
              id={`${ids}-notify-finish`}
              checked={notifyOnFinish}
              aria-labelledby={`${ids}-notify-finish-label`}
              aria-describedby={`${ids}-notify-finish-desc`}
              onCheckedChange={(checked) => {
                setNotifyOnFinish(checked);
                void enqueueSave({ notifyOnFinish: checked });
              }}
            />
          </label>
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
                      void enqueueSave({ audience: value });
                    }}
                    className="aria-pressed:border-foreground/40 aria-pressed:text-foreground"
                  >
                    {value === "internal" ? <Trans>Internal</Trans> : <Trans>External</Trans>}
                  </Toggle>
                ))}
              </div>
              {audience === "external" ? (
                <>
                  <p className="mt-2 text-[12px] text-muted-foreground/70">
                    <Trans>
                      Talks to people outside your company. Private tools are turned off.
                    </Trans>
                  </p>
                  {grantedConnections.length ? (
                    <p className="mt-1.5 text-[12px] text-muted-foreground/70">
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
          <details
            data-testid="bot-settings-advanced"
            className="group mt-5"
            onToggle={(event) => {
              if (!event.currentTarget.open) return;
              setAdvancedOpened(true);
              event.currentTarget.scrollIntoView?.({ block: "start", behavior: "smooth" });
            }}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] text-muted-foreground">
              <span className="text-muted-foreground">
                <Trans>Advanced</Trans>
              </span>
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">
                ›
              </span>
            </summary>
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
            <ErrorBoundary fallback={<SectionLoadFailed />}>
              <Suspense fallback={null}>
                <ScratchpadSection botId={bot.id} />
              </Suspense>
            </ErrorBoundary>
            {advancedOpened ? (
              <ErrorBoundary fallback={<SectionLoadFailed />}>
                <Suspense fallback={null}>
                  <KnowledgeSection botId={bot.id} />
                </Suspense>
              </ErrorBoundary>
            ) : null}
            <label htmlFor={`${ids}-model`} className={advancedLabelClass}>
              <Trans>Model</Trans>
              <NativeSelect
                id={`${ids}-model`}
                className="mt-2 w-full"
                value={selectedModelKey}
                onChange={(event) => {
                  saveOnChange(() => {
                    setModelKey(event.target.value);
                    setThinkingLevel("");
                  });
                }}
              >
                <NativeSelectOption value="">
                  {t`Space default`}
                  {me?.defaultModel
                    ? ` (${catalogLabel(catalog, me.defaultProvider, me.defaultModel) ?? me.defaultModel})`
                    : ""}
                </NativeSelectOption>
                {selectedModelKey &&
                !connectedOptions.some((option) => option.key === selectedModelKey) ? (
                  <NativeSelectOption value={selectedModelKey}>
                    {selectedModel?.modelId ?? selectedModelKey}
                  </NativeSelectOption>
                ) : null}
                {connectedOptions.map((option) => (
                  <NativeSelectOption key={option.key} value={option.key}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
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
                      className="flex-1 aria-pressed:border-foreground/40 aria-pressed:text-foreground"
                    >
                      {option.label}
                    </Toggle>
                  ))}
                </div>
              </div>
            ) : null}
            <label
              htmlFor={`${ids}-auto-speak`}
              className="mt-5 flex cursor-pointer items-center gap-3 text-[14px] text-foreground/75 pointer-coarse:min-h-11"
            >
              <Switch
                id={`${ids}-auto-speak`}
                checked={autoSpeak}
                onCheckedChange={(checked) => saveOnChange(() => setAutoSpeak(checked))}
              />
              <Trans>Read replies aloud</Trans>
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
              <Input
                id={`${ids}-disabled-tools`}
                value={toolNameDraft}
                placeholder="web_search"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                onChange={(event) => {
                  setToolNameDraft(event.target.value);
                  setToolError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  disableBuiltinTools(event.currentTarget.value);
                }}
                onBlur={(event) => {
                  if (event.currentTarget.value.trim())
                    disableBuiltinTools(event.currentTarget.value);
                }}
                className="mt-1.5 font-mono"
              />
            </label>
            {toolError ? <p className="mt-1.5 text-[13px] text-destructive">{toolError}</p> : null}
            {disabledBuiltinTools.map((toolName) => (
              <label
                key={toolName}
                htmlFor={`${ids}-disabled-${toolName}`}
                className="mt-2 flex items-center justify-between gap-3 text-[13px] text-foreground/80 pointer-coarse:min-h-11"
              >
                <span className="font-mono">{toolName}</span>
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
            {advancedOpened ? <BotCredentialsSection botId={bot.id} /> : null}
          </details>
          {error ? <p className="mt-2 text-[13px] text-destructive">{error}</p> : null}
          <div className="mt-5 flex flex-col items-start gap-3">
            <Button
              variant="ghost"
              className="h-auto p-0 text-[14px] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => void onExport()}
            >
              <Trans>Export</Trans>
            </Button>
            <Button
              variant="ghost"
              className="h-auto p-0 text-[14px] font-normal text-destructive hover:bg-transparent hover:text-destructive"
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
