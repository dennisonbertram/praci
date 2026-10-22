import { Trans, useLingui } from "@lingui/react/macro";
import type { AvatarStyle, SpaceMemoryConfig } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import {
  Brain,
  ChevronRight,
  Cpu,
  CreditCard,
  Monitor,
  Settings,
  ShieldCheck,
  XIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { computersAreUnavailable } from "../components/ComputersUnavailableHint";
import { useHasDesktopUpdates } from "../components/DesktopUpdates";
import {
  ComputerSettingsPanel,
  GeneralSettingsPanels,
  PrivacySettingsPanels,
  UpdatesSettingsPanel,
  UsageSettingsPanel,
} from "./AccountSettingsOverlay";
import { BillingSettingsPanel } from "./BillingSettingsPanel";
import { MemorySettingsOverlay } from "./MemorySettingsOverlay";
import { ModelSettingsOverlay } from "./ModelSettingsOverlay";
import { VoiceSettingsOverlay } from "./VoiceSettingsOverlay";

export type SettingsSection =
  | "general"
  | "privacy"
  | "models"
  | "memory"
  | "voice"
  | "computer"
  | "billing";

type NavItem = {
  id: SettingsSection;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

export function SettingsOverlay({
  email,
  name,
  usage,
  onUsageOpen,
  initialSection = "general",
  modelProvider,
  notice,
  avatarStyle,
  onAvatarStyleChange,
  timezone,
  onTimezoneChange,
  isDeploymentOwner = false,
  billingEnabled = false,
  sandboxProvider,
  onSandboxProviderChange,
  messagingEnabled = false,
  onOpenMessaging,
  memoryConfig,
  onMemoryConfigChange,
  onClose,
  onVoiceStatusMaybeChanged,
}: {
  email?: string | null;
  name: string;
  usage?: {
    runs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens?: number | null;
  } | null;
  onUsageOpen: () => void;
  initialSection?: SettingsSection;
  /** Models opens on this provider with its own-key form open (the Legal page's "Add your OpenRouter key"). */
  modelProvider?: string;
  /** Why Settings opened; shown at the top of the pane. */
  notice?: string;
  avatarStyle: AvatarStyle;
  onAvatarStyleChange: (style: AvatarStyle) => Promise<void>;
  timezone?: string;
  onTimezoneChange?: (timezone: string) => Promise<void>;
  isDeploymentOwner?: boolean;
  billingEnabled?: boolean;
  sandboxProvider?: string | null;
  onSandboxProviderChange?: (sandboxProvider: string) => void;
  messagingEnabled?: boolean;
  onOpenMessaging?: () => void;
  memoryConfig: SpaceMemoryConfig | null | undefined;
  onMemoryConfigChange: (config: SpaceMemoryConfig | null) => void;
  onClose: () => void;
  onVoiceStatusMaybeChanged?: () => void | Promise<void>;
}) {
  const { t } = useLingui();
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef(document.activeElement);
  // The app behind a modal dialog cannot take focus or clicks while it is open.
  useEffect(() => {
    const app = document.getElementById("root");
    app?.setAttribute("inert", "");
    return () => app?.removeAttribute("inert");
  }, []);
  // The control that opened Settings, or the user menu's button when that menu item is gone.
  const returnFocus = () => {
    const from = opener.current;
    return from instanceof HTMLElement && from.isConnected && from !== document.body
      ? from
      : document.querySelector<HTMLElement>('[data-testid="user-menu-trigger"]');
  };
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [keepComputerRecovery, setKeepComputerRecovery] = useState(false);
  const recoveryHoldTimer = useRef<number | undefined>(undefined);
  const showComputer =
    keepComputerRecovery || (isDeploymentOwner && computersAreUnavailable(sandboxProvider));
  const panelBusy = memoryBusy || voiceBusy;
  const releaseComputerRecovery = useCallback(() => {
    window.clearTimeout(recoveryHoldTimer.current);
    recoveryHoldTimer.current = undefined;
    setKeepComputerRecovery(false);
  }, []);
  const holdComputerRecovery = useCallback(() => {
    setKeepComputerRecovery(true);
    window.clearTimeout(recoveryHoldTimer.current);
    recoveryHoldTimer.current = window.setTimeout(() => {
      recoveryHoldTimer.current = undefined;
      setKeepComputerRecovery(false);
    }, 4000);
  }, []);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!showComputer && section === "computer") setSection("general");
  }, [showComputer, section]);

  useEffect(() => {
    if (!billingEnabled && section === "billing") setSection("general");
  }, [billingEnabled, section]);
  const hasDesktopUpdates = useHasDesktopUpdates();

  useEffect(() => {
    if (section !== "computer") releaseComputerRecovery();
  }, [section, releaseComputerRecovery]);
  useEffect(() => () => window.clearTimeout(recoveryHoldTimer.current), []);

  useEffect(() => {
    if (section === "general") onUsageOpen();
  }, [section, onUsageOpen]);

  const navItems: NavItem[] = [
    { id: "general", label: t`General`, icon: Settings },
    { id: "privacy", label: t`Privacy and approvals`, icon: ShieldCheck },
    { id: "models", label: t`Models`, icon: Cpu },
    ...(showComputer ? [{ id: "computer" as const, label: t`Computer`, icon: Monitor }] : []),
    ...(billingEnabled ? [{ id: "billing" as const, label: t`Billing`, icon: CreditCard }] : []),
  ];

  const memoryItem: NavItem = { id: "memory", label: t`Memory`, icon: Brain };
  // The phone select lists every page, Memory included.
  const selectItems = [...navItems.slice(0, 3), memoryItem, ...navItems.slice(3)];
  // Voice lives inside Models; it keeps its own section id so the call card can open it directly.
  const navSection = section === "voice" ? "models" : section;

  const sectionTitle =
    selectItems.find((item) => item.id === navSection)?.label ??
    (section === "general" ? t`General` : t`Settings`);

  const closeLabel =
    section === "models"
      ? t`Close model settings`
      : section === "memory"
        ? t`Close memory settings`
        : section === "voice"
          ? t`Close voice settings`
          : t`Close user settings`;

  const navButton = (item: NavItem) => {
    const Icon = item.icon;
    const active = item.id === navSection;
    return (
      <button
        key={item.id}
        type="button"
        data-testid={`settings-nav-${item.id}`}
        aria-current={active ? "page" : undefined}
        disabled={panelBusy}
        onClick={() => setSection(item.id)}
        className={`flex w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 pointer-coarse:min-h-11 text-start text-[13.5px] transition-colors disabled:pointer-events-none disabled:opacity-50 ${
          active
            ? "bg-foreground/10 font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="whitespace-nowrap">{item.label}</span>
      </button>
    );
  };

  async function refreshVoiceStatus() {
    await onVoiceStatusMaybeChanged?.();
  }

  function leaveSettings(next: () => void) {
    if (panelBusy) return;
    void refreshVoiceStatus().finally(next);
  }

  function requestClose() {
    leaveSettings(onClose);
  }

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (panelBusy) {
          details.cancel();
          return;
        }
        requestClose();
      }}
    >
      <DialogContent
        ref={panelRef}
        data-testid="user-settings"
        data-settings-section={section}
        showCloseButton={false}
        aria-modal="true"
        initialFocus={() => panelRef.current}
        finalFocus={returnFocus}
        // One height for every section, so the nav never moves under the pointer; the pane scrolls.
        className="flex h-[min(760px,calc(100%-2rem))] max-h-[calc(100%-2rem)] w-[min(1080px,calc(100%-1rem))] flex-col sm:w-[min(1080px,calc(100%-2rem))] gap-0 overflow-hidden rounded-2xl p-0 max-w-[calc(100%-1rem)] sm:max-h-[calc(100%-5rem)] sm:max-w-[1080px]"
      >
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* A phone cannot fit every section in a strip, so it gets a select. */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
            <NativeSelect
              data-testid="settings-nav-select"
              aria-label={t`Settings`}
              className="min-w-0 flex-1"
              value={navSection}
              disabled={panelBusy}
              onChange={(event) => setSection(event.target.value as SettingsSection)}
            >
              {selectItems.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <DialogClose
              aria-label={closeLabel}
              disabled={panelBusy}
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <XIcon />
            </DialogClose>
          </div>
          <nav
            data-testid="settings-nav"
            aria-label={t`Settings`}
            className="hidden shrink-0 gap-1 border-border md:flex md:w-[208px] md:flex-col md:overflow-y-auto md:border-e md:px-3 md:py-4"
          >
            {navItems.map(navButton)}
            {/* Memory is rarely needed; it opens from here and stays open while it is the page. */}
            <details className="group" open={section === "memory"}>
              <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-2.5 py-2 pointer-coarse:min-h-11 text-[13.5px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  strokeWidth={1.75}
                />
                <Trans>Advanced</Trans>
              </summary>
              <div className="ms-3">{navButton(memoryItem)}</div>
            </details>
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Scrolling sections get a divider so cards never look tucked under the title. */}
            <div
              className={`flex items-start justify-between gap-4 px-6 pt-6 max-md:p-0 sm:px-8 sm:pt-7 ${
                section === "models" || section === "voice" || section === "memory"
                  ? ""
                  : "border-b border-border pb-4 max-md:border-b-0 max-md:pb-0"
              }`}
            >
              {/* On a phone the select above already names the section; the title stays for screen readers. */}
              <DialogTitle className="text-2xl font-medium text-foreground max-md:sr-only">
                {sectionTitle}
              </DialogTitle>
              <DialogClose
                aria-label={closeLabel}
                disabled={panelBusy}
                render={<Button variant="ghost" size="icon-sm" className="max-md:hidden" />}
              >
                <XIcon />
              </DialogClose>
            </div>

            <div
              className={`min-h-0 flex-1 ${
                section === "models" || section === "voice" || section === "memory"
                  ? "flex flex-col overflow-hidden pt-5"
                  : "rk-scroll rk-scroll-fade-bottom rk-fade-popover overflow-y-auto overscroll-contain px-3 pb-6 pt-5 sm:px-8 sm:pb-8"
              }`}
            >
              {section === "general" ? (
                <GeneralSettingsPanels
                  email={email}
                  name={name}
                  avatarStyle={avatarStyle}
                  onAvatarStyleChange={onAvatarStyleChange}
                  timezone={timezone}
                  onTimezoneChange={onTimezoneChange}
                  messagingEnabled={messagingEnabled}
                  onOpenMessaging={
                    onOpenMessaging ? () => leaveSettings(onOpenMessaging) : undefined
                  }
                  isDeploymentOwner={isDeploymentOwner}
                >
                  <UsageSettingsPanel usage={usage} />
                  {isDeploymentOwner || hasDesktopUpdates ? (
                    <UpdatesSettingsPanel isDeploymentOwner={isDeploymentOwner} />
                  ) : null}
                </GeneralSettingsPanels>
              ) : null}
              {section === "privacy" ? <PrivacySettingsPanels /> : null}
              {section === "computer" && showComputer ? (
                <ComputerSettingsPanel
                  sandboxProvider={sandboxProvider}
                  onSandboxProviderChange={(next) => {
                    onSandboxProviderChange?.(next);
                    holdComputerRecovery();
                  }}
                  onRecoveryDismissed={releaseComputerRecovery}
                />
              ) : null}
              {section === "billing" && billingEnabled ? <BillingSettingsPanel /> : null}
              {section === "models" || section === "voice" ? (
                <>
                  {notice && section === "voice" ? (
                    <p role="status" className="mx-6 mb-3 text-sm text-muted-foreground sm:mx-8">
                      {notice}
                    </p>
                  ) : null}
                  <ModelSettingsOverlay
                    embedded
                    onClose={requestClose}
                    focusProvider={modelProvider}
                    view={section === "voice" ? "voice" : "model"}
                    switchDisabled={voiceBusy}
                    onViewChange={(view) => setSection(view === "voice" ? "voice" : "models")}
                    voice={
                      <VoiceSettingsOverlay
                        embedded
                        onClose={requestClose}
                        onBusyChange={setVoiceBusy}
                      />
                    }
                  />
                </>
              ) : null}
              {section === "memory" ? (
                <MemorySettingsOverlay
                  embedded
                  onClose={requestClose}
                  config={memoryConfig}
                  onConfigChange={onMemoryConfigChange}
                  onBusyChange={setMemoryBusy}
                />
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
