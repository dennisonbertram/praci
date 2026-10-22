import { Plural, Trans, useLingui } from "@lingui/react/macro";
import type { AccountSecurity, AvatarStyle } from "@rakazo/contracts";
import {
  BotAvatar,
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Field,
  FieldLabel,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Toggle,
} from "@rakazo/ui-web";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AccountAccess } from "../components/AccountAccess";
import { AiDataSharingSection } from "../components/AiDataSharing";
import { ApprovalRulesSettings } from "../components/ApprovalRulesSettings";
import { SuccessPop } from "../components/ai/primitives";
import { ComputersUnavailableHint } from "../components/ComputersUnavailableHint";
import { DataExportSection } from "../components/DataExport";
import { DesktopUpdateSection } from "../components/DesktopUpdates";
import { NotificationSettingsSection } from "../components/NotificationSettings";
import { DefaultRunsOnSection } from "../components/RunsOnPicker";
import { SoftwareUpdateSection } from "../components/SoftwareUpdateSection";
import { authClient } from "../lib/auth";
import {
  getBotsSidebarDensity,
  setBotsSidebarDensity,
  subscribeBotsSidebarDensity,
} from "../lib/bots-sidebar-density-pref";
import { getActiveUiLocale, setUiLocale } from "../lib/i18n";
import {
  getRemoteImagesPreference,
  setRemoteImagesPreference,
} from "../lib/remote-images-preference";
import {
  getResponseStreamingPreference,
  setResponseStreamingPreference,
} from "../lib/response-streaming";
import { rpc } from "../lib/rpc";
import {
  getToolActivityPreference,
  setToolActivityPreference,
} from "../lib/tool-activity-preference";
import type { AppearancePreference } from "../lib/ui-appearance";
import { getUiAppearancePreference, setUiAppearance } from "../lib/ui-appearance";
import type { UiLocale } from "../lib/ui-locale";
import { UI_LOCALE_LABELS, UI_LOCALES } from "../lib/ui-locale";
import { authErrorText } from "../lib/user-error";

export type SettingsGeneralProps = {
  email?: string | null;
  name: string;
  avatarStyle: AvatarStyle;
  onAvatarStyleChange: (style: AvatarStyle) => Promise<void>;
  /** The zone agents and new schedules use; the section is hidden without it. */
  timezone?: string;
  onTimezoneChange?: (timezone: string) => Promise<void>;
  messagingEnabled?: boolean;
  onOpenMessaging?: () => void;
  isDeploymentOwner?: boolean;
  /** Usage and update cards, shown above the rarely used password and delete actions. */
  children?: ReactNode;
};

export function GeneralSettingsPanels({
  email,
  name,
  avatarStyle,
  onAvatarStyleChange,
  timezone,
  onTimezoneChange,
  messagingEnabled = false,
  onOpenMessaging,
  isDeploymentOwner = false,
  children,
}: SettingsGeneralProps) {
  const { t } = useLingui();
  const [accountSecurity, setAccountSecurity] = useState<AccountSecurity | null>(null);
  const [locale, setLocale] = useState<UiLocale>(() => getActiveUiLocale());
  const localeRequestRef = useRef(0);
  const [appearance, setAppearance] = useState<AppearancePreference>(() =>
    getUiAppearancePreference(),
  );
  const sidebarDensity = useSyncExternalStore(
    subscribeBotsSidebarDensity,
    getBotsSidebarDensity,
    () => "comfortable",
  );
  const themeLabelId = useId();
  const avatarsLabelId = useId();
  const sidebarDensityLabelId = useId();
  const [streamReplies, setStreamReplies] = useState(
    () => getResponseStreamingPreference() === "on",
  );
  const streamRepliesId = useId();
  const [showToolActivity, setShowToolActivity] = useState(
    () => getToolActivityPreference() === "on",
  );
  const showToolActivityId = useId();
  const [loadRemoteImages, setLoadRemoteImages] = useState(
    () => getRemoteImagesPreference() === "on",
  );
  const loadRemoteImagesId = useId();
  const [avatarPending, setAvatarPending] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  function chooseLocale(next: UiLocale) {
    if (next === locale) return;
    const requestId = ++localeRequestRef.current;
    setLocale(next);
    void setUiLocale(next).then((activated) => {
      if (requestId !== localeRequestRef.current) return;
      setLocale(activated);
    });
  }

  async function chooseAvatarStyle(next: AvatarStyle) {
    if (avatarPending || next === avatarStyle) return;
    setAvatarPending(true);
    setAvatarError(null);
    try {
      await onAvatarStyleChange(next);
    } catch {
      setAvatarError(t`Couldn't update avatars`);
    } finally {
      setAvatarPending(false);
    }
  }

  return (
    <div className="@container space-y-5">
      {messagingEnabled && onOpenMessaging ? (
        <section className="rounded-xl border border-border px-4 py-4">
          <h3 className="text-[15px] font-medium text-foreground">
            <Trans>Messaging</Trans>
          </h3>
          <p className="mt-3 text-[13px] text-muted-foreground/70">
            <Trans>Chat apps, group channels, and agent connections.</Trans>
          </p>
          <Button variant="secondary" className="mt-3 rounded-full" onClick={onOpenMessaging}>
            <Trans>Manage messaging settings</Trans>
          </Button>
        </section>
      ) : null}

      {/* Two columns when the pane is wide, so General is not one long scroll. */}
      <div className="grid items-start gap-5 @2xl:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border px-4 py-4">
            <h3 className="text-[15px] font-medium text-foreground">
              <Trans>Appearance</Trans>
            </h3>
            <span id={themeLabelId} className="mt-3 block text-[13px] text-foreground/75">
              <Trans>Theme</Trans>
            </span>
            <AppearancePicker
              labelledBy={themeLabelId}
              value={appearance}
              onChange={(next) => {
                setAppearance(next);
                setUiAppearance(next);
              }}
            />
            {/* The sidebar is a drawer below 1024px, where density does nothing. */}
            <div className="mt-4 hidden lg:block">
              <span id={sidebarDensityLabelId} className="text-[13px] text-foreground/75">
                <Trans>Sidebar density</Trans>
              </span>
              <fieldset
                aria-labelledby={sidebarDensityLabelId}
                data-testid="bots-sidebar-density-select"
                className="mt-2 grid min-w-0 grid-cols-2 gap-1 rounded-lg bg-muted p-1"
              >
                <Toggle
                  data-testid="bots-sidebar-density-comfortable"
                  pressed={sidebarDensity === "comfortable"}
                  onPressedChange={() => setBotsSidebarDensity("comfortable")}
                  className="text-[13px] aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  <Trans>Comfortable</Trans>
                </Toggle>
                <Toggle
                  data-testid="bots-sidebar-density-compact"
                  pressed={sidebarDensity === "compact"}
                  onPressedChange={() => setBotsSidebarDensity("compact")}
                  className="text-[13px] aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  <Trans>Compact</Trans>
                </Toggle>
              </fieldset>
            </div>
            <span id={avatarsLabelId} className="mt-4 block text-[13px] text-foreground/75">
              <Trans>Avatars</Trans>
            </span>
            <fieldset
              aria-labelledby={avatarsLabelId}
              data-testid="avatar-style-select"
              className="mt-2 grid min-w-0 grid-cols-2 gap-3"
            >
              {(["organic", "robot"] as const).map((style) => (
                <Toggle
                  key={style}
                  variant="outline"
                  pressed={style === avatarStyle}
                  disabled={avatarPending}
                  onPressedChange={() => void chooseAvatarStyle(style)}
                  data-testid={`avatar-style-${style}`}
                  className="h-auto justify-start gap-3 px-3.5 py-3 text-[14px] font-normal aria-pressed:border-foreground aria-pressed:ring-1 aria-pressed:ring-foreground"
                >
                  <BotAvatar
                    color="#D9508A"
                    identity="avatar-style-preview"
                    size={32}
                    variant={style}
                  />
                  <span>{style === "robot" ? <Trans>Robot</Trans> : <Trans>Organic</Trans>}</span>
                </Toggle>
              ))}
            </fieldset>
            {avatarError ? (
              <p role="alert" className="mt-3 text-[12.5px] text-destructive">
                {avatarError}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-border px-4 py-4">
            <h3 className="text-[15px] font-medium text-foreground">
              {timezone && onTimezoneChange ? (
                <Trans>Language and time zone</Trans>
              ) : (
                <Trans>Language</Trans>
              )}
            </h3>
            <UiLocalePicker value={locale} onChange={chooseLocale} />
            {timezone && onTimezoneChange ? (
              <TimezonePicker value={timezone} onChange={onTimezoneChange} />
            ) : null}
          </section>
          <NotificationSettingsSection />
        </div>
        <div className="min-w-0 space-y-5">
          {isDeploymentOwner ? <DefaultRunsOnSection /> : null}

          <details
            data-testid="advanced-settings"
            className="group rounded-xl border border-border"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-[14px] text-foreground/75">
              <span className="block text-[15px] text-foreground">
                <Trans>Chat display</Trans>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                strokeWidth={1.75}
              />
            </summary>
            <div className="border-t border-border px-4 pb-5">
              <div className="flex items-start gap-3 pt-5 pointer-coarse:min-h-11 pointer-coarse:items-center">
                <Switch
                  id={streamRepliesId}
                  data-testid="response-streaming-toggle"
                  className="mt-0.5"
                  checked={streamReplies}
                  onCheckedChange={(checked) => {
                    setStreamReplies(checked);
                    setResponseStreamingPreference(checked ? "on" : "off");
                  }}
                />
                <Label
                  htmlFor={streamRepliesId}
                  className="text-[14px] font-normal text-foreground/75 pointer-coarse:flex-1 pointer-coarse:self-stretch"
                >
                  <Trans>Stream replies</Trans>
                </Label>
              </div>
              <div className="flex items-start gap-3 pt-4 pointer-coarse:min-h-11 pointer-coarse:items-center">
                <Switch
                  id={showToolActivityId}
                  data-testid="tool-activity-toggle"
                  className="mt-0.5"
                  checked={showToolActivity}
                  onCheckedChange={(checked) => {
                    setShowToolActivity(checked);
                    setToolActivityPreference(checked ? "on" : "off");
                  }}
                />
                <Label
                  htmlFor={showToolActivityId}
                  className="text-[14px] font-normal text-foreground/75 pointer-coarse:flex-1 pointer-coarse:self-stretch"
                >
                  <Trans>Show tool activity</Trans>
                </Label>
              </div>
              <div className="flex items-start gap-3 pt-4 pointer-coarse:min-h-11 pointer-coarse:items-center">
                <Switch
                  id={loadRemoteImagesId}
                  data-testid="remote-images-toggle"
                  className="mt-0.5"
                  checked={loadRemoteImages}
                  onCheckedChange={(checked) => {
                    setLoadRemoteImages(checked);
                    setRemoteImagesPreference(checked ? "on" : "off");
                  }}
                />
                <Label
                  htmlFor={loadRemoteImagesId}
                  className="text-[14px] font-normal text-foreground/75 pointer-coarse:flex-1 pointer-coarse:self-stretch"
                >
                  <Trans>Load web images automatically</Trans>
                </Label>
              </div>
            </div>
          </details>

          {children}
        </div>
      </div>

      {/* Rare actions come last, below everything that loads on its own, so nothing above them moves.
          Delete is last of all, so a destructive action is never the first thing on the page. */}
      <section className="divide-y divide-border rounded-xl border border-border px-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-3">
          <h3 className="text-[15px] font-medium text-foreground">
            <Trans>Account</Trans>
          </h3>
          <p className="text-[14px] text-foreground/75">
            {name}
            {email ? (
              <span className="ms-2 text-[13px] text-muted-foreground/70">{email}</span>
            ) : null}
          </p>
        </div>
        <DataExportSection />
        {accountSecurity?.hasPassword && accountSecurity.passwordChangeEnabled !== false ? (
          <ChangePasswordSection email={email} />
        ) : null}
        <div data-testid="account-access" className="pb-3">
          <AccountAccess onSecurity={setAccountSecurity} />
        </div>
      </section>
    </div>
  );
}

export function PrivacySettingsPanels() {
  return (
    <div className="space-y-5">
      <AiDataSharingSection />
      <section className="rounded-xl border border-border px-4 py-4">
        <ApprovalRulesSettings />
      </section>
    </div>
  );
}

export function UsageSettingsPanel({
  usage,
}: {
  usage?: {
    runs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens?: number | null;
  } | null;
}) {
  const tokens = usage?.totalTokens;
  // Provider keys only matter to someone who added their own; the system model needs none.
  const [hasOwnKey, setHasOwnKey] = useState(false);
  useEffect(() => {
    void rpc.models
      .credentials()
      .then((credentials) => setHasOwnKey(credentials.length > 0))
      .catch(() => undefined);
  }, []);
  return (
    <section data-testid="usage-settings" className="rounded-xl border border-border px-4 py-4">
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>Usage</Trans>
      </h3>
      {usage ? (
        <p className="mt-3 text-[14px] text-foreground/75">
          <Plural
            value={usage.runs}
            one="# task done by your bots"
            other="# tasks done by your bots"
          />
          {tokens == null ? null : (
            <>
              {" · "}
              <Plural value={tokens} one="# token of AI text" other="# tokens of AI text" />
            </>
          )}
        </p>
      ) : null}
      {hasOwnKey ? (
        <p className="mt-2 text-[12.5px] text-muted-foreground/80">
          <Trans>Model spend uses your provider keys.</Trans>
        </p>
      ) : null}
    </section>
  );
}

export function ComputerSettingsPanel({
  sandboxProvider,
  onSandboxProviderChange,
  onRecoveryDismissed,
}: {
  sandboxProvider?: string | null;
  onSandboxProviderChange?: (sandboxProvider: string) => void;
  onRecoveryDismissed?: () => void;
}) {
  return (
    <div
      data-testid="computers-setup-settings"
      className="rounded-xl border border-border px-4 py-4"
    >
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>Computers</Trans>
      </h3>
      <ComputersUnavailableHint
        className="mt-3 text-[13px] leading-relaxed text-muted-foreground"
        sandboxProvider={sandboxProvider}
        onRecovered={onSandboxProviderChange}
        onRecoveryDismissed={onRecoveryDismissed}
      />
    </div>
  );
}

export function UpdatesSettingsPanel({
  isDeploymentOwner = false,
}: {
  isDeploymentOwner?: boolean;
}) {
  return (
    <>
      {/* Both sections render nothing on hosted installs. */}
      <DesktopUpdateSection />
      <SoftwareUpdateSection isDeploymentOwner={isDeploymentOwner} />
    </>
  );
}

function ChangePasswordSection({ email }: { email?: string | null }) {
  const { t } = useLingui();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changePassword() {
    if (pending) return;
    if (newPassword !== confirmation) {
      setError(t`Passwords do not match`);
      return;
    }
    setPending(true);
    setSaved(false);
    setError(null);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(authErrorText(result.error, t`Could not change password`));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setSaved(true);
    } catch {
      setError(t`Could not reach the server`);
    } finally {
      setPending(false);
    }
  }

  return (
    <details data-testid="change-password" className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-medium text-foreground">
        <Trans>Change password</Trans>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          strokeWidth={1.75}
        />
      </summary>
      <div className="grid gap-3 pb-1">
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={email ?? ""}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
        <SettingsPasswordInput
          label={t`Current password`}
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
        />
        <SettingsPasswordInput
          label={t`New password`}
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
        />
        <SettingsPasswordInput
          label={t`Confirm password`}
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-3 pb-4">
        <Button
          className="rounded-full"
          disabled={pending || currentPassword.length < 8 || newPassword.length < 8}
          onClick={() => void changePassword()}
        >
          {pending ? <Trans>Changing…</Trans> : <Trans>Change password</Trans>}
        </Button>
        {saved ? <SuccessPop label={t`Password updated`} /> : null}
      </div>
    </details>
  );
}

function SettingsPasswordInput({
  label,
  autoComplete,
  value,
  onChange,
}: {
  label: string;
  autoComplete: "current-password" | "new-password";
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        minLength={8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function AppearancePicker({
  value,
  onChange,
  labelledBy,
}: {
  value: AppearancePreference;
  onChange: (next: AppearancePreference) => void;
  labelledBy: string;
}) {
  const { t } = useLingui();
  const options: { value: AppearancePreference; label: string }[] = [
    { value: "system", label: t`System` },
    { value: "light", label: t`Light` },
    { value: "dark", label: t`Dark` },
  ];

  return (
    <fieldset
      aria-labelledby={labelledBy}
      data-testid="ui-appearance-select"
      className="mt-2 grid min-w-0 grid-cols-3 gap-1 rounded-lg bg-muted p-1"
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          data-testid={`ui-appearance-${option.value}`}
          pressed={option.value === value}
          onPressedChange={() => onChange(option.value)}
          className="text-[13px] aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {option.label}
        </Toggle>
      ))}
    </fieldset>
  );
}

function timezoneLabel(zone: string): string {
  const offset = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" })
    .formatToParts()
    .find((part) => part.type === "timeZoneName")?.value;
  const city = (zone.split("/").pop() ?? zone).replaceAll("_", " ");
  return `${city} (${offset?.replace("GMT", "UTC") ?? "UTC"})`;
}

/** The browser's zone first, then the rest alphabetically; the current value is always listed. */
function timezoneOptions(current: string): string[] {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const all = new Set([current, ...Intl.supportedValuesOf("timeZone")]);
  all.delete(browser);
  return [browser, ...all];
}

function TimezonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (timezone: string) => Promise<void>;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(zone: string) {
    setOpen(false);
    if (zone === value || pending) return;
    setPending(zone);
    setSaved(false);
    setError(null);
    try {
      await onChange(zone);
      setSaved(true);
    } catch {
      setError(t`Could not save time zone`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" className="h-9 w-full justify-between font-normal" />}
          aria-label={t`Time zone`}
          disabled={pending !== null}
        >
          {timezoneLabel(pending ?? value)}
          <ChevronDown aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-64 p-0">
          <Command>
            <CommandInput placeholder={t`Search`} />
            <CommandList>
              <CommandEmpty>
                <Trans>No matches</Trans>
              </CommandEmpty>
              {timezoneOptions(value).map((zone) => (
                <CommandItem
                  key={zone}
                  value={zone}
                  keywords={[timezoneLabel(zone)]}
                  data-checked={zone === value}
                  onSelect={() => void choose(zone)}
                >
                  {timezoneLabel(zone)}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? <SuccessPop label={t`Time zone updated`} /> : null}
    </div>
  );
}

function UiLocalePicker({
  value,
  onChange,
}: {
  value: UiLocale;
  onChange: (locale: UiLocale) => void;
}) {
  const { t } = useLingui();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedIndex = Math.max(0, UI_LOCALES.indexOf(value));
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);

  useEffect(() => {
    setHighlightedIndex(selectedIndex);
    setOpen(false);
  }, [selectedIndex, value]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.focus();
  }, [highlightedIndex, open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function choose(index: number) {
    const next = UI_LOCALES[index];
    if (!next) return;
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveHighlight(index: number) {
    setHighlightedIndex((index + UI_LOCALES.length) % UI_LOCALES.length);
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex(UI_LOCALES.length - 1);
    }
  }

  function onOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlightedIndex(UI_LOCALES.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(index);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative mt-3">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        data-testid="ui-locale-select"
        aria-label={t`Language`}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-start text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="min-w-0 truncate">{UI_LOCALE_LABELS[value]}</span>
        <span className="ml-3 shrink-0 text-muted-foreground" aria-hidden="true">
          <ChevronDown size={16} strokeWidth={1.8} />
        </span>
      </button>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t`Language`}
          className="rk-scroll absolute left-0 right-0 top-full z-20 mt-1 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {UI_LOCALES.map((code, index) => (
            <button
              key={code}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={code === value}
              tabIndex={index === highlightedIndex ? 0 : -1}
              className={`w-full rounded-md px-2 py-1.5 text-start text-sm outline-none hover:bg-accent focus-visible:bg-accent ${
                code === value ? "bg-accent" : ""
              }`}
              onClick={() => choose(index)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
            >
              {UI_LOCALE_LABELS[code]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
