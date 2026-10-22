import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type {
  AgentSkillCatalogEntry,
  ModelCatalogEntry,
  ModelCredential,
  Routine,
} from "@rakazo/contracts";
import type { CronFreq, CronPreset } from "@rakazo/core";
import {
  cronFromPreset,
  defaultCronPreset,
  extractRoutineSkillMentions,
  formatCron,
  isOneShotRoutineCrons,
  presetFromCron,
} from "@rakazo/core";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  NativeSelect,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from "@rakazo/ui-web";
import {
  ChevronLeft,
  Clock,
  GitBranch,
  Globe,
  MessageSquare,
  Pause,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { timezoneLabel } from "../lib/local-timezone";
import {
  connectedModelOptions,
  modelOptionKey,
  parseModelOptionKey,
  thinkingLevelLabel,
} from "../lib/model-catalog";
import { rpc } from "../lib/rpc";
import { isHiddenBuiltinSkill, slashSkillLabel } from "../lib/slash-skills";
import { RoutineRunHistory } from "./RoutineRunHistory";
import { RoutineSchedule } from "./RoutineSchedule";

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultArmRunAtLocal(): string {
  return toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
}

export function routineNeedsOneShotArm(
  routine: Pick<Routine, "nextRunAt" | "lastRunAt">,
  crons: string[],
) {
  return isOneShotRoutineCrons(crons) && !routine.nextRunAt && !routine.lastRunAt;
}

const SCHEDULE_PRESETS: CronFreq[] = [
  "Every hour",
  "Every day",
  "Weekdays",
  "Every week",
  "Every month",
  "Interval",
  "Advanced",
];

export type RoutineDraftState = {
  name: string;
  prompt: string;
  schedules: CronPreset[];
  webhookEnabled: boolean;
  githubEnabled: boolean;
  messageProvider: string | null;
  active: boolean;
  runAtLocal: string;
  /** Empty runs this routine on the bot's model. */
  modelKey: string;
  thinkingLevel: string;
  /** Empty keeps the routine's zone, or the account zone for a new routine. */
  timezone: string;
};

export function emptyRoutineDraft(): RoutineDraftState {
  return {
    name: "",
    prompt: "",
    schedules: [],
    webhookEnabled: false,
    githubEnabled: false,
    messageProvider: null,
    active: true,
    runAtLocal: "",
    modelKey: "",
    thinkingLevel: "",
    timezone: "",
  };
}

export function draftFromRoutine(routine: Routine): RoutineDraftState {
  return {
    name: routine.name,
    prompt: routine.prompt,
    schedules: routine.crons.map(presetFromCron),
    webhookEnabled: routine.webhookEnabled,
    githubEnabled: routine.githubEnabled,
    messageProvider: routine.messageProvider,
    active: routine.active,
    runAtLocal: routineNeedsOneShotArm(routine, routine.crons) ? defaultArmRunAtLocal() : "",
    modelKey:
      routine.modelProvider && routine.modelId
        ? modelOptionKey(routine.modelProvider, routine.modelId)
        : "",
    thinkingLevel: routine.thinkingLevel ?? "",
    timezone: routine.timezone,
  };
}

export function routineTriggerSummary(routine: Routine): string {
  if (!routine.active) return t`Paused`;
  const parts: string[] = [];
  if (routine.webhookEnabled) parts.push(t`When a webhook fires`);
  if (routine.githubEnabled) parts.push(t`Git event`);
  if (routine.messageProvider === "slack") parts.push(t`Slack message`);
  else if (routine.messageProvider === "teams") parts.push(t`Teams message`);
  else if (routine.messageProvider) parts.push(t`Message event`);
  for (const cron of routine.crons) parts.push(formatCron(cron));
  return parts.length > 0 ? parts.join(" · ") : t`No trigger`;
}

export function RoutineListHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-[30px] mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">
          <Trans>Routines</Trans>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          <Trans>Work this bot repeats for you, like a cash check every Monday.</Trans>
        </p>
      </div>
      <Button variant="secondary" size="sm" data-testid="routine-create-button" onClick={onCreate}>
        <Plus strokeWidth={1.9} />
        <Trans>Create a routine</Trans>
      </Button>
    </div>
  );
}

export function RoutineListRow({
  routine,
  running,
  onOpen,
  onStop,
}: {
  routine: Routine;
  running: boolean;
  onOpen: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 hover:bg-accent">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="grid h-5 w-5 place-items-center">
          {routine.active ? (
            <Clock size={16} strokeWidth={1.6} className="text-success" aria-hidden />
          ) : (
            <Pause size={14} className="text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium text-foreground" dir="auto">
            {routine.name}
          </span>
          <span className="block truncate text-[12.5px] text-muted-foreground/80">
            {routineTriggerSummary(routine)}
            {routine.modelProvider && routine.modelId ? ` · ${routine.modelId}` : ""}
          </span>
        </span>
      </button>
      {running ? (
        <Button
          size="xs"
          onClick={onStop}
          className="shrink-0 rounded-full bg-warning/15 text-warning hover:bg-warning/25"
        >
          <Trans>Running · Stop</Trans>
        </Button>
      ) : null}
    </div>
  );
}

function withoutSkillMention(prompt: string, skill: string) {
  const mention = new RegExp(
    `(^|[\\s(,])@${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s,.)]|$)`,
    "gi",
  );
  return prompt.replace(mention, "$1").replace(/^\s+/, "");
}

function withSkillMention(instruction: string, skill: string | undefined) {
  return skill ? `@${skill} ${instruction}` : instruction;
}

export function RoutineEditor({
  draft,
  onChange,
  editing,
  timezone,
  webhook,
  githubPath,
  messageProviders,
  skills = [],
  saving,
  running,
  error,
  onBack,
  onClose,
  onSave,
  onTestRun,
  onDelete,
  onEnsureWebhook,
}: {
  draft: RoutineDraftState;
  onChange: (next: RoutineDraftState) => void;
  editing: Routine | null;
  timezone: string;
  webhook: { path: string; secret: string | null; configured: boolean };
  githubPath: string;
  messageProviders: string[];
  /** The bot's skills; choosing one adds an @mention, which loads it when the routine runs. */
  skills?: AgentSkillCatalogEntry[];
  saving: boolean;
  running: boolean;
  error: string | null;
  onBack: () => void;
  onClose: () => void;
  onSave: () => void;
  onTestRun: () => void;
  onDelete: () => void;
  onEnsureWebhook: () => Promise<void>;
}) {
  const { t } = useLingui();
  const fieldId = useId();
  const [credentials, setCredentials] = useState<ModelCredential[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  useEffect(() => {
    void Promise.all([rpc.models.credentials(), rpc.models.list()])
      .then(([nextCredentials, nextCatalog]) => {
        setCredentials(nextCredentials);
        setCatalog(nextCatalog);
      })
      .catch(() => undefined);
  }, []);
  const modelOptions = connectedModelOptions(credentials, catalog);
  const selectedModel = draft.modelKey ? parseModelOptionKey(draft.modelKey) : null;
  const selectedEntry = selectedModel
    ? catalog.find(
        (entry) => entry.provider === selectedModel.provider && entry.id === selectedModel.modelId,
      )
    : undefined;
  const selectedCredential = credentials.find(
    (entry) =>
      entry.provider === selectedModel?.provider && entry.modelId === selectedModel?.modelId,
  );
  const thinkingOptions = (
    selectedCredential?.thinkingLevels ??
    selectedEntry?.thinkingLevels ??
    []
  ).filter((level) => level !== "off");
  const defaultThinkingLevel = selectedCredential?.thinkingLevel ?? "medium";
  // The user's own skills come first.
  const pickableSkills = skills
    .filter((skill) => !isHiddenBuiltinSkill(skill))
    .sort((a, b) => Number(b.source === "user") - Number(a.source === "user"));
  // A skill is stored as an @mention in the instruction; the editor shows it in the picker instead.
  // With no pickable skills the picker is hidden, so leave the text alone (an empty list would
  // make the extractor guess and hide ordinary @mentions).
  const skill = pickableSkills.length
    ? extractRoutineSkillMentions(
        draft.prompt,
        pickableSkills.map((entry) => entry.name),
      )[0]
    : undefined;
  const instruction = skill ? withoutSkillMention(draft.prompt, skill) : draft.prompt;
  const zone = draft.timezone || timezone;
  const zones = Intl.supportedValuesOf("timeZone");
  const slackAvailable = messageProviders.includes("slack");
  const hasTriggers =
    draft.schedules.length > 0 ||
    draft.webhookEnabled ||
    draft.githubEnabled ||
    Boolean(draft.messageProvider);
  // Flash "Saved" when a save finishes without an error.
  const [justSaved, setJustSaved] = useState(false);
  const wasSaving = useRef(false);
  useEffect(() => {
    if (wasSaving.current && !saving && !error) {
      setJustSaved(true);
      const timer = setTimeout(() => setJustSaved(false), 2000);
      wasSaving.current = saving;
      return () => clearTimeout(timer);
    }
    wasSaving.current = saving;
  }, [saving, error]);
  // A saved routine has nothing to save until a field changes. The baseline is the draft as
  // it stood when this routine was opened or last saved (the parent swaps `editing` on save).
  const draftKey = JSON.stringify(draft);
  const [baseline, setBaseline] = useState(draftKey);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-baseline only when the saved routine changes
  useEffect(() => setBaseline(draftKey), [editing]);
  const canTest = Boolean(editing) && !saving && !running;
  const needsOneShotArm =
    editing != null && routineNeedsOneShotArm(editing, draft.schedules.map(cronFromPreset));
  const unchanged = editing != null && !needsOneShotArm && draftKey === baseline;
  const nextRun =
    editing?.nextRunAt && draft.active && unchanged
      ? new Date(editing.nextRunAt).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: zone,
        })
      : null;

  function addSchedule(freq: CronFreq) {
    const base = defaultCronPreset();
    const next: CronPreset =
      freq === "Advanced" ? { ...base, freq, cron: cronFromPreset(base) } : { ...base, freq };
    onChange({ ...draft, schedules: [...draft.schedules, next] });
  }

  async function addWebhook() {
    onChange({ ...draft, webhookEnabled: true });
    if (!webhook.configured) {
      await onEnsureWebhook().catch(() => undefined);
    }
  }

  async function addGithub() {
    onChange({ ...draft, githubEnabled: true });
    if (!webhook.configured) {
      await onEnsureWebhook().catch(() => undefined);
    }
  }

  function addMessageProvider(provider: string) {
    onChange({ ...draft, messageProvider: provider });
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          className="text-muted-foreground"
          aria-label={t`Back`}
        >
          <ChevronLeft />
        </Button>
        <div className="text-[15.5px] font-medium text-foreground">
          <Trans>Routine</Trans>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-muted-foreground"
          aria-label={t`Close`}
        >
          <X />
        </Button>
      </div>

      <div className="mb-5 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 text-sm text-foreground/75">
          <button
            type="button"
            role="switch"
            aria-checked={draft.active}
            onClick={() => onChange({ ...draft, active: !draft.active })}
            className={`relative h-[22px] w-[40px] rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              draft.active ? "bg-primary" : "bg-input"
            }`}
          >
            <span
              className={`absolute top-[2px] left-0 h-[18px] w-[18px] rounded-full bg-background transition-transform ${
                draft.active
                  ? "translate-x-[20px] dark:bg-primary-foreground"
                  : "translate-x-[2px] dark:bg-foreground"
              }`}
            />
          </button>
          <Trans>Active</Trans>
        </label>
        <div className="flex items-center gap-2">
          {/* Nothing to delete until the routine is saved. */}
          {editing ? (
            <Button variant="secondary" disabled={saving || running} onClick={onDelete}>
              <Trans>Delete</Trans>
            </Button>
          ) : null}
          <Button variant="secondary" disabled={!canTest} onClick={onTestRun}>
            {running ? t`Running…` : t`Test run`}
          </Button>
        </div>
      </div>

      <label htmlFor={`${fieldId}-name`} className="block text-sm text-muted-foreground">
        <Trans>Name</Trans>
        <Input
          id={`${fieldId}-name`}
          value={draft.name}
          placeholder={t`Name this routine`}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          className="mt-2"
        />
      </label>

      <label htmlFor={`${fieldId}-prompt`} className="mt-5 block text-sm text-muted-foreground">
        <Trans>Instruction</Trans>
        <Textarea
          id={`${fieldId}-prompt`}
          value={instruction}
          placeholder={
            skill
              ? t`Optional: add details for this skill`
              : t`What should this routine do each time it runs?`
          }
          onChange={(e) => onChange({ ...draft, prompt: withSkillMention(e.target.value, skill) })}
          rows={4}
          className="mt-2"
        />
      </label>

      {pickableSkills.length > 0 ? (
        <NativeSelect
          aria-label={t`Add a skill`}
          className="mt-2 w-full"
          value={skill ?? ""}
          onChange={(event) =>
            onChange({ ...draft, prompt: withSkillMention(instruction, event.target.value) })
          }
        >
          <NativeSelectOption value="">{t`Add a skill`}</NativeSelectOption>
          {pickableSkills.map((entry) => (
            <NativeSelectOption key={entry.id} value={entry.name}>
              {slashSkillLabel(entry).title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}

      <div className="mt-5 text-sm text-muted-foreground">
        <div className="flex items-baseline gap-2">
          <Trans>When to run</Trans>
          <span className="text-xs text-muted-foreground/70" title={zone}>
            {timezoneLabel(zone)}
          </span>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative ml-auto text-muted-foreground"
                  aria-label={t`Advanced`}
                  title={t`Advanced`}
                />
              }
            >
              <SlidersHorizontal />
              {draft.modelKey || (editing && zone !== editing.timezone) ? (
                <span
                  aria-hidden
                  className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-muted-foreground"
                />
              ) : null}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-4">
              <label htmlFor={`${fieldId}-zone`} className="block text-sm text-muted-foreground">
                <Trans>Time zone</Trans>
                <NativeSelect
                  id={`${fieldId}-zone`}
                  className="mt-2 w-full"
                  value={zone}
                  onChange={(event) => onChange({ ...draft, timezone: event.target.value })}
                >
                  {(zones.includes(zone) ? zones : [zone, ...zones]).map((name) => (
                    <NativeSelectOption key={name} value={name}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>

              <label
                htmlFor={`${fieldId}-model`}
                className="mt-5 block text-sm text-muted-foreground"
              >
                <Trans>Model</Trans>
                <NativeSelect
                  id={`${fieldId}-model`}
                  className="mt-2 w-full"
                  value={draft.modelKey}
                  onChange={(event) =>
                    onChange({ ...draft, modelKey: event.target.value, thinkingLevel: "" })
                  }
                >
                  <NativeSelectOption value="">{t`Bot's model`}</NativeSelectOption>
                  {draft.modelKey &&
                  !modelOptions.some((option) => option.key === draft.modelKey) ? (
                    <NativeSelectOption value={draft.modelKey}>
                      {selectedModel?.modelId ?? draft.modelKey}
                    </NativeSelectOption>
                  ) : null}
                  {modelOptions.map((option) => (
                    <NativeSelectOption key={option.key} value={option.key}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>

              {thinkingOptions.length ? (
                <label
                  htmlFor={`${fieldId}-thinking`}
                  className="mt-5 block text-sm text-muted-foreground"
                >
                  <Trans>Thinking</Trans>
                  <NativeSelect
                    id={`${fieldId}-thinking`}
                    className="mt-2 w-full"
                    value={draft.thinkingLevel}
                    onChange={(event) => onChange({ ...draft, thinkingLevel: event.target.value })}
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
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-2 space-y-2">
          {draft.schedules.map((preset, index) => (
            <div key={index} className="relative">
              <RoutineSchedule
                value={preset}
                onChange={(next) =>
                  onChange({
                    ...draft,
                    schedules: draft.schedules.map((item, i) => (i === index ? next : item)),
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t`Remove schedule`}
                onClick={() =>
                  onChange({
                    ...draft,
                    schedules: draft.schedules.filter((_, i) => i !== index),
                  })
                }
                className="absolute top-2 right-2 text-muted-foreground"
              >
                <X />
              </Button>
            </div>
          ))}

          {draft.webhookEnabled ? (
            <InboundTriggerCard
              kind="webhook"
              saved={Boolean(editing)}
              path={webhook.path}
              secret={webhook.secret}
              configured={webhook.configured}
              onRemove={() => onChange({ ...draft, webhookEnabled: false })}
              onRotate={() => void onEnsureWebhook()}
            />
          ) : null}

          {draft.githubEnabled ? (
            <InboundTriggerCard
              kind="github"
              saved={Boolean(editing)}
              path={githubPath}
              secret={webhook.secret}
              configured={webhook.configured}
              onRemove={() => onChange({ ...draft, githubEnabled: false })}
              onRotate={() => void onEnsureWebhook()}
            />
          ) : null}

          {draft.messageProvider ? (
            <MessageTriggerCard
              provider={draft.messageProvider}
              onRemove={() => onChange({ ...draft, messageProvider: null })}
            />
          ) : null}

          {needsOneShotArm ? (
            <label htmlFor={`${fieldId}-run-at`} className="block text-sm text-muted-foreground">
              <Trans>Run at</Trans>
              <Input
                id={`${fieldId}-run-at`}
                type="datetime-local"
                value={draft.runAtLocal}
                onChange={(e) => onChange({ ...draft, runAtLocal: e.target.value })}
                aria-label={t`Run at`}
                className="mt-2"
              />
            </label>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className="mt-2 h-auto w-full rounded-xl py-3" />}
          >
            <Plus />
            <Trans>Choose when it runs</Trans>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Clock />
                <Trans>On a schedule</Trans>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[170px]">
                {SCHEDULE_PRESETS.map((freq) => (
                  <DropdownMenuItem key={freq} onClick={() => addSchedule(freq)}>
                    {schedulePresetLabel(freq)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {slackAvailable ? (
              <DropdownMenuItem
                disabled={draft.messageProvider === "slack"}
                onClick={() => addMessageProvider("slack")}
              >
                <MessageSquare />
                <Trans>Slack message</Trans>
              </DropdownMenuItem>
            ) : null}

            {/* Developer triggers stay available, one level down, so founders see plain choices first. */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Globe />
                <Trans>From another app (advanced)</Trans>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[170px]">
                <DropdownMenuItem disabled={draft.githubEnabled} onClick={() => void addGithub()}>
                  <GitBranch />
                  <Trans>Git event</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={draft.webhookEnabled} onClick={() => void addWebhook()}>
                  <Globe />
                  <Trans>Webhook</Trans>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        {nextRun ? (
          <p className="mt-2 text-xs text-muted-foreground/70">{t`Next run ${nextRun}`}</p>
        ) : null}
        {!hasTriggers ? (
          <p className="mt-2 text-xs text-muted-foreground/70">
            <Trans>Pick when this runs, for example every Monday morning.</Trans>
          </p>
        ) : null}
      </div>

      <div className="mt-5">
        <Button disabled={saving || running || !hasTriggers || unchanged} onClick={onSave}>
          {saving ? t`Saving…` : justSaved ? t`Saved` : t`Save`}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      {editing ? (
        <RoutineRunHistory
          key={editing.id}
          routineId={editing.id}
          name={editing.name}
          running={running}
        />
      ) : null}
    </div>
  );
}

function MessageTriggerCard({ provider, onRemove }: { provider: string; onRemove: () => void }) {
  const { t } = useLingui();
  const label =
    provider === "slack"
      ? t`Slack message`
      : provider === "teams"
        ? t`Teams message`
        : t`Message event`;
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2.5 px-0.5">
        <MessageSquare size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
        <span className="flex-1 text-[14.5px] text-foreground">{label}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t`Remove message trigger`}
          onClick={onRemove}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
      <p className="mt-2.5 text-[13.5px] text-muted-foreground/70">
        <Trans>Runs when this bot receives a verified message from this provider.</Trans>
      </p>
    </div>
  );
}

function InboundTriggerCard({
  kind,
  saved,
  path,
  secret,
  configured,
  onRemove,
  onRotate,
}: {
  kind: "webhook" | "github";
  saved: boolean;
  path: string;
  secret: string | null;
  configured: boolean;
  onRemove: () => void;
  onRotate: () => void;
}) {
  const { t } = useLingui();
  const pending = !saved;
  const placeholder = t`Available after the routine is saved`;
  // GitHub delivery URL and signature header are fixed by bot id / protocol, so show
  // them before save. The shared secret still needs a saved routine to mint.
  const postValue = kind === "github" || !pending ? path : placeholder;
  const keyValue = pending
    ? placeholder
    : (secret ?? (configured ? t`Saved. Rotate to reveal.` : placeholder));
  const headerValue =
    kind === "github"
      ? "X-Hub-Signature-256: sha256=…"
      : pending
        ? placeholder
        : secret
          ? `Authorization: Bearer ${secret}`
          : configured
            ? "Authorization: Bearer …"
            : placeholder;
  const cellClass =
    "break-all rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground/75";

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2.5 px-0.5">
        {kind === "github" ? (
          <GitBranch size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
        ) : (
          <Globe size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
        )}
        <span className="flex-1 text-[14.5px] text-foreground">
          {kind === "github" ? <Trans>Git event</Trans> : <Trans>When a webhook fires</Trans>}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={kind === "github" ? t`Remove Git event` : t`Remove webhook`}
          onClick={onRemove}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
      <div className="mt-2.5 space-y-2.5 text-[13.5px]">
        <div className="block text-muted-foreground/70">
          <Trans>POST to</Trans>
          <div className={`mt-1 ${cellClass}`}>{postValue}</div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground/70">
          <span className="shrink-0">
            <Trans>key</Trans>
          </span>
          <div className={`min-w-0 flex-1 ${cellClass}`}>{keyValue}</div>
        </div>
        <div className="block text-muted-foreground/70">
          <Trans>header</Trans>
          <div className={`mt-1 ${cellClass}`}>{headerValue}</div>
        </div>
        {saved && configured && !secret ? (
          <Button
            variant="link"
            size="xs"
            onClick={onRotate}
            className="px-0 text-muted-foreground"
          >
            <Trans>Rotate key</Trans>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function schedulePresetLabel(freq: CronFreq): string {
  switch (freq) {
    case "Every hour":
      return t`Every hour`;
    case "Every day":
      return t`Every day`;
    case "Weekdays":
      return t`Weekdays`;
    case "Every week":
      return t`Every week`;
    case "Every month":
      return t`Every month`;
    case "Interval":
      return t`Interval`;
    case "Advanced":
      return t`Advanced...`;
    default:
      return freq;
  }
}
