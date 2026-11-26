import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type {
  AgentSkillCatalogEntry,
  ModelCatalogEntry,
  ModelCredential,
  Routine,
  WatchSpec,
} from "@rakazo/contracts";
import { connectorToolLabel } from "@rakazo/contracts";
import type { CronFreq, CronPreset } from "@rakazo/core";
import {
  cronFromPreset,
  defaultCronPreset,
  extractRoutineSkillMentions,
  formatCron,
  isOneShotRoutineCrons,
  modelKeyForConnection,
  nextCronDateAcrossStrict,
  presetFromCron,
  zonedDateTime,
} from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import {
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Eye,
  GitBranch,
  Globe,
  MessageSquare,
  Pause,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useCopyText } from "../lib/copy-text";
import { timezoneLabel } from "../lib/local-timezone";
import {
  connectedModelOptions,
  modelOptionKey,
  parseModelOptionKey,
  thinkingLevelLabel,
} from "../lib/model-catalog";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { isHiddenBuiltinSkill, slashSkillLabel } from "../lib/slash-skills";
import { RoutineRunHistory } from "./RoutineRunHistory";
import { RoutineSchedule } from "./RoutineSchedule";

function defaultArmRunAtLocal(timezone: string): string {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const wallClock = (at: Date) => {
    const values = Object.fromEntries(
      format.formatToParts(at).map(({ type, value }) => [type, value]),
    );
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  };
  // A repeated hour (daylight-saving fall-back) reads back as its first occurrence, which can
  // be now or earlier; step forward until the default parses to a future time.
  let at = Date.now() + 60 * 60 * 1000;
  while (
    (zonedDateTime(wallClock(new Date(at)), timezone)?.getTime() ?? 0) <=
    Date.now() + 30 * 60 * 1000
  )
    at += 60 * 60 * 1000;
  return wallClock(new Date(at));
}

/** Parse the datetime-local wall clock in the routine's timezone. */
export function routineRunAtDate(runAtLocal: string, timezone: string): Date | null {
  return zonedDateTime(runAtLocal, timezone);
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
  /** The connection the model runs on; empty uses the bot's connection or the default. */
  credentialId: string;
  thinkingLevel: string;
  /** Empty keeps the routine's zone, or the account zone for a new routine. */
  timezone: string;
  /** Only message the user when something needs them. */
  quiet: boolean;
  watch: WatchSpec | null;
  /** A saved taught skill this routine runs by reference, instead of pasted text. */
  taughtSkill: { id: string; name: string } | null;
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
    credentialId: "",
    thinkingLevel: "",
    timezone: "",
    quiet: false,
    watch: null,
    taughtSkill: null,
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
    runAtLocal: routineNeedsOneShotArm(routine, routine.crons)
      ? defaultArmRunAtLocal(routine.timezone)
      : "",
    modelKey:
      routine.modelProvider && routine.modelId
        ? modelOptionKey(routine.modelProvider, routine.modelId)
        : "",
    credentialId: routine.modelCredentialId ?? "",
    thinkingLevel: routine.thinkingLevel ?? "",
    timezone: routine.timezone,
    quiet: routine.quiet,
    watch: routine.watch,
    taughtSkill: routine.taughtSkill ?? null,
  };
}

function watchHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function checkInSummary(routine: Routine): string {
  // The 4-hour check-in repeats on an hour step ("0 */4 * * *"); the daily one runs once a day.
  const everyFourHours = routine.crons.some((cron) => cron.split(/\s+/)[1]?.includes("/4"));
  return everyFourHours ? t`Check-in every 4 hours` : t`Daily check-in`;
}

export function routineTriggerSummary(routine: Routine): string {
  if (routine.managedKind === "check_in") return checkInSummary(routine);
  if (!routine.active) return t`Paused`;
  const parts: string[] = [];
  if (routine.watch) {
    const host =
      routine.watch.kind === "connector" ? routine.watch.appName : watchHost(routine.watch.url);
    parts.push(t`Watches ${host}`);
  }
  if (routine.webhookEnabled) parts.push(t`When a webhook fires`);
  if (routine.githubEnabled) parts.push(t`Git event`);
  if (routine.messageProvider === "slack") parts.push(t`Slack message`);
  else if (routine.messageProvider === "teams") parts.push(t`Teams message`);
  else if (routine.messageProvider) parts.push(t`Message event`);
  for (const cron of routine.crons) parts.push(formatCron(cron));
  return parts.length > 0 ? parts.join(" · ") : t`No trigger`;
}

function formatRunTime(iso: string, zone: string, locale: string, now = new Date()): string {
  const date = new Date(iso);
  const time = { hour: "numeric", minute: "2-digit", timeZone: zone } as const;
  const dayKey = (value: Date) => value.toLocaleDateString("en-CA", { timeZone: zone });
  if (dayKey(date) === dayKey(now)) return date.toLocaleTimeString(locale, time);
  const days = Math.abs(date.getTime() - now.getTime()) / 86_400_000;
  return date.toLocaleString(
    locale,
    days < 6 ? { weekday: "short", ...time } : { month: "short", day: "numeric", ...time },
  );
}

/** The muted second line of a routine row; null when there is nothing to say yet. */
export function routineStatusLine(
  routine: Routine,
  locale = "en",
  now = new Date(),
): string | null {
  const { status } = routine;
  if (status.pausedReason) {
    switch (status.pausedReason) {
      case "errors":
        return routine.watch?.kind === "connector"
          ? t`Paused: the app could not be checked`
          : t`Paused: the page could not be checked`;
      case "noisy":
        return routine.watch?.kind === "connector"
          ? t`Paused: the app result changes too often`
          : t`Paused: the page changes too often`;
      case "access":
        return t`Paused: no access`;
      case "budget":
        return t`Paused: too many checks today`;
      case "credit":
        return t`Paused: model connection out of credit`;
    }
  }
  const parts: string[] = [];
  if (status.lastRunFailed && routine.watch) parts.push(t`Last run failed`);
  if (routine.watch) {
    if (status.lastCheckedAt) {
      const checked = formatRelativeTime(status.lastCheckedAt, now);
      parts.push(t`Checked ${checked}`);
    }
    if (status.lastChangedAt) {
      const changed = formatRelativeTime(status.lastChangedAt, now);
      parts.push(t`Changed ${changed}`);
    }
  } else {
    const lastRunAt = status.lastRunAt ?? routine.lastRunAt;
    if (status.lastRunFailed) {
      parts.push(t`Last run failed`);
    } else if (lastRunAt) {
      const lastRan = formatRunTime(lastRunAt, routine.timezone, locale, now);
      parts.push(t`Last ran ${lastRan}`);
    }
    if (status.nextRunAt && routine.active) {
      const next = formatRunTime(status.nextRunAt, routine.timezone, locale, now);
      parts.push(t`Next ${next}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

const ROUTINE_NAME_CHARS = 40;

/** The name a routine gets when none is typed: the instruction's first line, cut at a word. */
export function defaultRoutineName(prompt: string, skillName?: string): string {
  const line = prompt
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .find(Boolean);
  if (!line) return (skillName?.trim() || t`Routine`).slice(0, 80);
  if (line.length <= ROUTINE_NAME_CHARS) return line;
  const cut = line.slice(0, ROUTINE_NAME_CHARS + 1).lastIndexOf(" ");
  return `${line.slice(0, cut > 0 ? cut : ROUTINE_NAME_CHARS)}…`;
}

export function RoutineListHeader({
  onCreate,
  empty,
}: {
  onCreate: () => void;
  /** The bot has no routines of its own yet; only then is the example worth showing. */
  empty: boolean;
}) {
  return (
    <div className="mt-[30px] mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">
          <Trans>Routines</Trans>
        </div>
        {empty ? (
          <p className="mt-0.5 text-xs text-muted-foreground/70 max-sm:hidden">
            <Trans>Work this bot repeats for you, like a cash check every Monday.</Trans>
          </p>
        ) : null}
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
  onToggleActive,
}: {
  routine: Routine;
  running: boolean;
  onOpen: () => void;
  onStop: () => void;
  /** A managed routine (the check-in) shows only this switch; it cannot be opened. */
  onToggleActive?: (active: boolean) => void;
}) {
  const { i18n } = useLingui();
  const managed = routine.managedKind !== null;
  const statusLine = routineStatusLine(routine, i18n.locale || "en");
  const Body = managed ? "div" : "button";
  return (
    <div className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 hover:bg-accent">
      <Body
        {...(managed ? {} : { type: "button" as const, onClick: onOpen })}
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
          {statusLine ? (
            <span
              data-testid="routine-status-line"
              className={`block text-[12.5px] ${
                statusLine.startsWith(t`Last run failed`)
                  ? "text-destructive"
                  : "text-muted-foreground/80"
              }`}
            >
              {statusLine}
            </span>
          ) : null}
        </span>
      </Body>
      {managed ? (
        <Switch
          checked={routine.active}
          aria-label={t`Active`}
          onCheckedChange={(checked) => onToggleActive?.(checked)}
        />
      ) : null}
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

const TAUGHT_PREFIX = "taught:";

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
  taughtSkills = [],
  saving,
  running,
  error,
  onBack,
  onClose,
  onSave,
  onTestRun,
  onDelete,
  onEnsureWebhook,
  onOpenModelSettings,
  onOpenBotSettings,
  onResume,
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
  /** Saved taught skills; choosing one makes the routine run it by reference. */
  taughtSkills?: { id: string; name: string }[];
  saving: boolean;
  running: boolean;
  error: string | null;
  onBack: () => void;
  onClose: () => void;
  onSave: () => void;
  onTestRun: () => void;
  onDelete: () => void;
  onEnsureWebhook: () => Promise<void>;
  /** Opens Settings > Models (an overlay); fixes a credit hold or a failed run's model error. */
  onOpenModelSettings?: () => void;
  /** Opens this bot's settings; leaves the editor, so the draft's leave guard wraps it. */
  onOpenBotSettings?: () => void;
  /** Fires after the system pause was cleared, with the resumed routine, so the list can refresh. */
  onResume?: (routine: Routine) => void;
}) {
  const { t, i18n } = useLingui();
  const fieldId = useId();
  const [credentials, setCredentials] = useState<ModelCredential[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  const [modelsFailed, setModelsFailed] = useState(false);
  const [credentialsFailed, setCredentialsFailed] = useState(false);
  const [modelsRetrying, setModelsRetrying] = useState(false);
  const [modelsRequest, setModelsRequest] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([rpc.models.credentials(), rpc.models.list()]).then(
      ([credentialsResult, catalogResult]) => {
        if (!active) return;
        if (credentialsResult.status === "fulfilled") setCredentials(credentialsResult.value);
        if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value);
        setCredentialsFailed(credentialsResult.status === "rejected");
        setModelsFailed(
          credentialsResult.status === "rejected" || catalogResult.status === "rejected",
        );
        setModelsRetrying(false);
      },
    );
    return () => {
      active = false;
    };
  }, [modelsRequest]);
  const pinnedCredential = credentials.find((entry) => entry.id === draft.credentialId);
  const modelOptions = connectedModelOptions(
    pinnedCredential ? [pinnedCredential] : credentials,
    catalog,
  );
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
    Boolean(draft.watch) ||
    Boolean(draft.messageProvider);
  // A saved routine has nothing to save until a field changes. The baseline is the draft as
  // it stood when this routine was opened or last saved (the parent swaps `editing` on save).
  const draftKey = JSON.stringify(draft);
  const [baseline, setBaseline] = useState(draftKey);
  useEffect(() => setBaseline(draftKey), [editing]);
  const scheduleKey = JSON.stringify([draft.schedules, draft.timezone]);
  const baselineDraft = JSON.parse(baseline) as RoutineDraftState;
  const baselineScheduleKey = JSON.stringify([baselineDraft.schedules, baselineDraft.timezone]);
  const canTest = Boolean(editing) && !saving && !running;
  const needsOneShotArm =
    editing != null && routineNeedsOneShotArm(editing, draft.schedules.map(cronFromPreset));
  const unchanged = editing != null && !needsOneShotArm && draftKey === baseline;
  const nextRunDate = (() => {
    if (!draft.active || needsOneShotArm) return null;
    // Saving keeps the scheduled time unless the schedule itself changed (a rename does not).
    if (editing?.nextRunAt && scheduleKey === baselineScheduleKey)
      return new Date(editing.nextRunAt);
    try {
      return nextCronDateAcrossStrict(draft.schedules.map(cronFromPreset), new Date(), zone);
    } catch {
      return null;
    }
  })();
  const nextRun = nextRunDate
    ? nextRunDate.toLocaleString(i18n.locale || "en", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: zone,
      })
    : null;
  const [leaveIntent, setLeaveIntent] = useState<"back" | "close" | "bot-settings" | null>(null);
  // The pause the user cleared here, so the reason line goes away at once without waiting for
  // the parent's next copy of the routine. A different pause still shows.
  const [clearedReason, setClearedReason] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const pausedReason = editing?.status?.pausedReason ?? null;
  async function resumePaused() {
    if (!editing || !pausedReason || resuming) return;
    setResuming(true);
    try {
      const resumed = await rpc.routines.resume({ routineId: editing.id });
      setClearedReason(pausedReason);
      onResume?.(resumed);
    } catch {
      // Still paused: the reason and the button stay so it can be tried again.
    } finally {
      setResuming(false);
    }
  }
  function requestLeave(intent: "back" | "close" | "bot-settings") {
    if (draftKey !== baseline) {
      setLeaveIntent(intent);
      return;
    }
    if (intent === "back") onBack();
    else if (intent === "close") onClose();
    else onOpenBotSettings?.();
  }
  function confirmLeave() {
    const intent = leaveIntent;
    setLeaveIntent(null);
    if (intent === "back") onBack();
    else if (intent === "close") onClose();
    else if (intent === "bot-settings") onOpenBotSettings?.();
  }

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

  function addWatch() {
    // A watch starts quiet on a new routine: most changes need no message.
    onChange({
      ...draft,
      watch: { kind: "page", url: "", intervalMinutes: 60 },
      ...(editing ? {} : { quiet: true }),
    });
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
          onClick={() => requestLeave("back")}
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
          onClick={() => requestLeave("close")}
          className="text-muted-foreground"
          aria-label={t`Close`}
        >
          <X />
        </Button>
      </div>
      {leaveIntent ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
          <span role="alert" className="text-sm text-foreground">{t`Discard changes?`}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLeaveIntent(null)}>
              <Trans>Keep editing</Trans>
            </Button>
            <Button size="sm" onClick={confirmLeave}>
              <Trans>Discard</Trans>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex items-center justify-between gap-3">
        <label
          htmlFor={`${fieldId}-active`}
          className="flex items-center gap-2.5 text-sm text-foreground/75 pointer-coarse:min-h-11"
        >
          <Switch
            id={`${fieldId}-active`}
            checked={draft.active}
            onCheckedChange={(active) => onChange({ ...draft, active })}
          />
          <Trans>Active</Trans>
        </label>
        <div className="flex items-center gap-2">
          {/* Nothing to delete until the routine is saved. */}
          {editing ? (
            <Button variant="secondary" disabled={saving || running} onClick={onDelete}>
              <Trans>Delete</Trans>
            </Button>
          ) : null}
          {editing ? (
            <Button variant="secondary" disabled={!canTest} onClick={onTestRun}>
              {running ? t`Running…` : t`Test run`}
            </Button>
          ) : (
            // aria-disabled, not disabled, so hover and keyboard focus can still show the reason.
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="secondary"
                    aria-disabled
                    className="opacity-50"
                    onClick={(event) => event.preventDefault()}
                  />
                }
              >
                <Trans>Test run</Trans>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <Trans>Save the routine first</Trans>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {pausedReason && pausedReason !== clearedReason && editing ? (
        <div
          data-testid="routine-paused-reason"
          className="-mt-3 mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted-foreground/80"
        >
          <span>{routineStatusLine(editing, i18n.locale || "en")}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={resuming}
            onClick={() => void resumePaused()}
          >
            <Trans>Resume</Trans>
          </Button>
          {pausedReason === "credit" && onOpenModelSettings ? (
            <Button size="sm" variant="outline" onClick={onOpenModelSettings}>
              <Trans>Open Models settings</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}

      <label htmlFor={`${fieldId}-name`} className="block text-sm text-muted-foreground">
        <Trans>Name</Trans>
        <Input
          id={`${fieldId}-name`}
          value={draft.name}
          placeholder={
            draft.prompt.trim()
              ? defaultRoutineName(draft.prompt, draft.taughtSkill?.name)
              : t`Name this routine`
          }
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
            skill || draft.taughtSkill
              ? t`Optional: add details for this skill`
              : t`What should this routine do each time it runs?`
          }
          onChange={(e) => onChange({ ...draft, prompt: withSkillMention(e.target.value, skill) })}
          rows={4}
          className="mt-2"
        />
      </label>

      {draft.taughtSkill ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-[13px] text-foreground">
          <span className="min-w-0 flex-1 truncate" dir="auto" data-testid="routine-taught-skill">
            <Trans>Runs taught skill: {draft.taughtSkill.name}</Trans>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t`Remove taught skill`}
            onClick={() => onChange({ ...draft, taughtSkill: null })}
          >
            <X size={14} strokeWidth={1.8} />
          </Button>
        </div>
      ) : pickableSkills.length > 0 || taughtSkills.length > 0 ? (
        <NativeSelect
          aria-label={t`Add a skill`}
          className="mt-2 w-full"
          value={skill ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            if (value.startsWith(TAUGHT_PREFIX)) {
              const id = value.slice(TAUGHT_PREFIX.length);
              const picked = taughtSkills.find((entry) => entry.id === id);
              if (picked) onChange({ ...draft, prompt: instruction, taughtSkill: picked });
              return;
            }
            onChange({ ...draft, prompt: withSkillMention(instruction, value) });
          }}
        >
          <NativeSelectOption value="">{t`Add a skill`}</NativeSelectOption>
          {taughtSkills.length ? (
            <NativeSelectOptGroup label={t`Taught`}>
              {taughtSkills.map((entry) => (
                <NativeSelectOption key={entry.id} value={`${TAUGHT_PREFIX}${entry.id}`}>
                  {entry.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ) : null}
          {[
            { label: t`Yours`, entries: pickableSkills.filter((entry) => entry.source === "user") },
            {
              label: t`Built-in`,
              entries: pickableSkills.filter((entry) => entry.source === "builtin"),
            },
            {
              label: t`Plugins`,
              entries: pickableSkills.filter((entry) => entry.source === "plugin"),
            },
          ].map(({ label, entries }) =>
            entries.length ? (
              <NativeSelectOptGroup key={label} label={label}>
                {entries.map((entry) => (
                  <NativeSelectOption key={entry.id} value={entry.name}>
                    {slashSkillLabel(entry).title}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            ) : null,
          )}
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

              {credentials.length > 1 || draft.credentialId ? (
                <label
                  htmlFor={`${fieldId}-connection`}
                  className="mt-5 block text-sm text-muted-foreground"
                >
                  <Trans>Connection</Trans>
                  <NativeSelect
                    id={`${fieldId}-connection`}
                    className="mt-2 w-full"
                    value={draft.credentialId}
                    onChange={(event) => {
                      const next = credentials.find((entry) => entry.id === event.target.value);
                      onChange({
                        ...draft,
                        credentialId: next?.id ?? "",
                        thinkingLevel: "",
                        modelKey: next
                          ? modelKeyForConnection(next, catalog, draft.modelKey)
                          : draft.modelKey,
                      });
                    }}
                  >
                    <NativeSelectOption value="">{t`Bot's connection`}</NativeSelectOption>
                    {draft.credentialId && !pinnedCredential ? (
                      <NativeSelectOption value={draft.credentialId}>
                        {credentialsFailed ? draft.credentialId : t`Signed out or removed`}
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
              {modelsFailed ? (
                <div className="mt-5 flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>
                    <Trans>Could not load</Trans>
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={modelsRetrying}
                    onClick={() => {
                      setModelsRetrying(true);
                      setModelsRequest((request) => request + 1);
                    }}
                  >
                    <Trans>Retry</Trans>
                  </Button>
                </div>
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

          {draft.watch ? (
            <WatchTriggerCard
              watch={draft.watch}
              onChange={(watch) => onChange({ ...draft, watch })}
              onRemove={() => onChange({ ...draft, watch: null })}
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
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <Trans>On a schedule</Trans>
              </DropdownMenuLabel>
              {SCHEDULE_PRESETS.map((freq) => (
                <DropdownMenuItem key={freq} onClick={() => addSchedule(freq)}>
                  <Clock />
                  {schedulePresetLabel(freq)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuItem disabled={Boolean(draft.watch)} onClick={addWatch}>
              <Eye />
              <Trans>Watch a page</Trans>
            </DropdownMenuItem>

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
      </div>

      <label
        htmlFor={`${fieldId}-quiet`}
        className="mt-5 flex items-center justify-between gap-3 text-sm text-foreground/80 pointer-coarse:min-h-11"
      >
        <Trans>Only message me if something needs me</Trans>
        <Switch
          id={`${fieldId}-quiet`}
          checked={draft.quiet}
          onCheckedChange={(checked) => onChange({ ...draft, quiet: checked })}
        />
      </label>

      <div className="mt-5">
        <Button
          className="max-sm:w-full"
          disabled={saving || !hasTriggers || unchanged}
          onClick={onSave}
        >
          {saving ? t`Saving…` : unchanged ? t`Saved` : t`Save`}
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
          onOpenModelSettings={onOpenModelSettings}
          onOpenBotSettings={
            onOpenBotSettings && editing.modelCredentialId == null
              ? () => requestLeave("bot-settings")
              : undefined
          }
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

const WATCH_INTERVALS = [15, 60, 1440] as const;

function WatchTriggerCard({
  watch,
  onChange,
  onRemove,
}: {
  watch: WatchSpec;
  onChange: (next: WatchSpec) => void;
  onRemove: () => void;
}) {
  const { t } = useLingui();
  const id = useId();
  const labels: Record<(typeof WATCH_INTERVALS)[number], string> = {
    15: t`Every 15 minutes`,
    60: t`Every hour`,
    1440: t`Every day`,
  };
  // The bot sets a connected-app watch up in chat; the card only shows it.
  if (watch.kind === "connector") {
    const tool = connectorToolLabel(watch.toolName);
    return (
      <div className="rounded-xl border border-border p-3" data-testid="watch-card">
        <div className="flex items-center gap-2.5 px-0.5">
          <Eye size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
          <span className="flex-1 text-[14.5px] text-foreground">
            <Trans>Watch a connected app</Trans>
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t`Remove app watch`}
            onClick={onRemove}
            className="text-muted-foreground"
          >
            <X />
          </Button>
        </div>
        <p className="mt-2.5 px-0.5 text-[13.5px] text-muted-foreground">
          {watch.appName} · {tool} · {labels[watch.intervalMinutes]}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border p-3" data-testid="watch-card">
      <div className="flex items-center gap-2.5 px-0.5">
        <Eye size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
        <span className="flex-1 text-[14.5px] text-foreground">
          <Trans>Watch a page</Trans>
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t`Remove page watch`}
          onClick={onRemove}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
      <div className="mt-2.5 space-y-2.5 text-[13.5px]">
        <label htmlFor={`${id}-url`} className="block text-muted-foreground/70">
          <Trans>Page address</Trans>
          <Input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            value={watch.url}
            placeholder="https://"
            onChange={(event) => onChange({ ...watch, url: event.target.value.trim() })}
            className="mt-1"
          />
        </label>
        <label htmlFor={`${id}-every`} className="block text-muted-foreground/70">
          <Trans>Check every</Trans>
          <NativeSelect
            id={`${id}-every`}
            className="mt-1 w-full"
            value={String(watch.intervalMinutes)}
            onChange={(event) =>
              onChange({
                ...watch,
                intervalMinutes: Number(event.target.value) as WatchSpec["intervalMinutes"],
              })
            }
          >
            {WATCH_INTERVALS.map((minutes) => (
              <NativeSelectOption key={minutes} value={String(minutes)}>
                {labels[minutes]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>
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
  const [confirmRotate, setConfirmRotate] = useState(false);
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
          <div className="mt-1 flex items-center gap-2">
            <div className={`min-w-0 flex-1 ${cellClass}`}>{postValue}</div>
            {postValue !== placeholder ? <CopyButton label={t`Copy URL`} value={path} /> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground/70">
          <span className="shrink-0">
            <Trans>key</Trans>
          </span>
          <div className={`min-w-0 flex-1 ${cellClass}`}>{keyValue}</div>
          {!pending && secret ? <CopyButton label={t`Copy key`} value={secret} /> : null}
        </div>
        <div className="block text-muted-foreground/70">
          <Trans>header</Trans>
          <div className={`mt-1 ${cellClass}`}>{headerValue}</div>
        </div>
        {saved && configured && !secret ? (
          <Button
            variant="link"
            size="xs"
            onClick={() => setConfirmRotate(true)}
            className="px-0 text-muted-foreground"
          >
            <Trans>Rotate key</Trans>
          </Button>
        ) : null}
      </div>
      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Rotate key?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>The current key stops working right away for webhooks and Git events.</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRotate(false);
                onRotate();
              }}
            >
              <Trans>Rotate</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Quiet copy affordance beside a delivery detail; only shown when there is a value to copy. */
function CopyButton({ label, value }: { label: string; value: string }) {
  const { t } = useLingui();
  const [copied, copy] = useCopyText();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      onClick={() => copy(value)}
      className="shrink-0 text-muted-foreground"
    >
      {copied ? <Check aria-label={t`Copied`} /> : <Copy />}
    </Button>
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
      return t`Every month on the 1st`;
    case "Interval":
      return t`Interval`;
    case "Advanced":
      return t`Advanced…`;
    default:
      return freq;
  }
}
