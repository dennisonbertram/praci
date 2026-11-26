import type {
  AccountSecurity,
  ActionApprovalRule,
  AvatarStyle,
  PermissionLevel,
  PermissionSettings,
} from "@rakazo/contracts";
import { PermissionLevelSchema } from "@rakazo/contracts";
import { toolStepLabel } from "@rakazo/core";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppMark } from "../../components/app-mark";
import { useAvatarStyle } from "../../components/avatar-style";
import { BotAvatar } from "../../components/bot-avatar";
import { DataExportRow } from "../../components/data-export-row";
import type { MenuPickerChoice } from "../../components/menu-picker";
import { MenuPickerMenu } from "../../components/menu-picker";
import { NativeActionButton } from "../../components/native-action-button";
import { NativeSegmentedControl } from "../../components/native-segmented-control";
import { NativeSymbol } from "../../components/native-symbol";
import {
  SettingsGroup,
  SettingsLabel,
  SettingsRow,
  SettingsSwitch,
  useStackedSettings,
} from "../../components/settings-group";
import type { MobileBot, MobileMe } from "../../lib/api";
import {
  currentApiBase,
  deleteAccount,
  fetchAccountSecurity,
  loadSessionToken,
  requestAccountDeletionCode,
  rpc,
  selectedSpaceId,
  signOut,
} from "../../lib/api";
import { formatUpdateLabel, getAppVersionInfo } from "../../lib/app-version";
import {
  getCachedAppearancePreference,
  mobileTokens,
  setAppearancePreference,
} from "../../lib/appearance";
import { replaceWithSignIn } from "../../lib/auth-routing";
import { promptAccountDeletion } from "../../lib/delete-account-prompt";
import { setHideAmounts, useHideAmounts } from "../../lib/hide-amounts";
import { setUiLocale, useI18n } from "../../lib/i18n";
import type { LiveNotificationSettings } from "../../lib/live-notifications";
import {
  canPostPromotedNotifications,
  DEFAULT_LIVE_NOTIFICATION_SETTINGS,
  getLiveNotificationSettings,
  openLiveNotificationSettings,
  openPromotedNotificationSettings,
  setLiveNotificationSettings,
} from "../../lib/live-notifications";
import { presentMessageActionSheet } from "../../lib/message-action-sheet";
import { native, useResolvedAppearance, useThemedStyles } from "../../lib/native";
import { registerPushToken } from "../../lib/push";
import {
  getCachedRemoteImagesEnabled,
  setRemoteImagesPreference,
  subscribeRemoteImages,
} from "../../lib/remote-images-preference";
import {
  getCachedResponseStreamingEnabled,
  setResponseStreamingPreference,
  subscribeResponseStreaming,
} from "../../lib/response-streaming";
import { continueWithSso } from "../../lib/sso";
import type { UiLocale } from "../../lib/ui-locale";
import { UI_LOCALE_LABELS, UI_LOCALES } from "../../lib/ui-locale";
import { errorText } from "../../lib/user-error";

/** Render account settings, including the entry point for voice configuration. */
export default function Account() {
  const { t, locale } = useI18n();
  const colorScheme = useResolvedAppearance();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [me, setMe] = useState<MobileMe | null>(null);
  const [meLoadFailed, setMeLoadFailed] = useState(false);
  const [phonePushLoadFailed, setPhonePushLoadFailed] = useState(false);
  const [securityLoadFailed, setSecurityLoadFailed] = useState(false);
  // One retry at a time, so a late answer cannot undo a newer one or a toggle changed since.
  const [retrying, setRetrying] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [security, setSecurity] = useState<AccountSecurity | null>(null);
  const canChangePassword = security?.hasPassword && security.passwordChangeEnabled !== false;
  const [deletionCodeSent, setDeletionCodeSent] = useState(false);
  const [ssoReauthenticated, setSsoReauthenticated] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [localeSaving, setLocaleSaving] = useState(false);
  const [localeError, setLocaleError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const deletionDisabled =
    pending ||
    (security?.hasPassword
      ? !deletePassword
      : !ssoReauthenticated && (!deletionCodeSent || !deletePassword.trim()));
  const [avatarPending, setAvatarPending] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<LiveNotificationSettings>(
    DEFAULT_LIVE_NOTIFICATION_SETTINGS,
  );
  const [phonePush, setPhonePush] = useState<boolean | null>(null);
  const [phonePushPending, setPhonePushPending] = useState(false);
  const [notificationsReady, setNotificationsReady] = useState(Platform.OS !== "android");
  const [notificationPending, setNotificationPending] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archivedBots, setArchivedBots] = useState<MobileBot[]>([]);
  const [permissions, setPermissions] = useState<PermissionSettings | null>(null);
  const [permissionsLoadFailed, setPermissionsLoadFailed] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [savedApprovalRules, setSavedApprovalRules] = useState<ActionApprovalRule[] | null>(null);
  const [savedApprovalRulesLoadFailed, setSavedApprovalRulesLoadFailed] = useState(false);
  const [savedApprovalRulesError, setSavedApprovalRulesError] = useState<string | null>(null);
  const [savedApprovalRulesOpen, setSavedApprovalRulesOpen] = useState(false);
  const [removingApprovalRuleId, setRemovingApprovalRuleId] = useState<string | null>(null);
  // A newer read or a save's answer outranks a permissions read still in flight.
  const permissionLoadId = useRef(0);
  const approvalRulesLoadId = useRef(0);
  const [usage, setUsage] = useState<{
    runs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens?: number | null;
  } | null>(null);
  const { avatarStyle, updateAvatarStyle } = useAvatarStyle();
  const appearance = getCachedAppearancePreference();
  const streamReplies = useSyncExternalStore(
    subscribeResponseStreaming,
    getCachedResponseStreamingEnabled,
    () => false,
  );
  const loadRemoteImages = useSyncExternalStore(
    subscribeRemoteImages,
    getCachedRemoteImagesEnabled,
    () => false,
  );
  const hideAmounts = useHideAmounts();
  const loadRemoteImagesLabel = t("Load web images automatically");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const stackOptions = useStackedSettings();
  const styles = useThemedStyles(createAccountStyles);
  const versionInfo = getAppVersionInfo();
  const updateLabel = formatUpdateLabel(versionInfo.update, t);
  const versionAccessibility = [versionInfo.nativeLabel, updateLabel].filter(Boolean).join(". ");

  const loadMe = useCallback(async () => {
    try {
      setMe(await rpc<MobileMe>("me"));
      setMeLoadFailed(false);
    } catch {
      setMeLoadFailed(true);
    }
  }, []);

  const loadPhonePush = useCallback(async () => {
    try {
      const prefs = await rpc<{ channels: { push?: boolean }; hasPhone: boolean }>(
        "notifications/preferences",
      );
      setPhonePush(prefs.hasPhone ? prefs.channels.push !== false : null);
      setPhonePushLoadFailed(false);
    } catch {
      setPhonePushLoadFailed(true);
    }
  }, []);

  const loadSecurity = useCallback(async () => {
    try {
      setSecurity(await fetchAccountSecurity());
      setSecurityLoadFailed(false);
    } catch {
      setSecurityLoadFailed(true);
    }
  }, []);

  const retryAccountLoads = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await Promise.all([
        meLoadFailed ? loadMe() : Promise.resolve(),
        phonePushLoadFailed ? loadPhonePush() : Promise.resolve(),
        securityLoadFailed ? loadSecurity() : Promise.resolve(),
      ]);
    } finally {
      setRetrying(false);
    }
  }, [
    retrying,
    meLoadFailed,
    phonePushLoadFailed,
    securityLoadFailed,
    loadMe,
    loadPhonePush,
    loadSecurity,
  ]);

  useEffect(() => {
    void loadMe();
    void rpc<{
      runs: number;
      inputTokens: number | null;
      outputTokens: number | null;
      totalTokens?: number | null;
    }>("usage/summary")
      .then(setUsage)
      .catch(() => undefined);
    void loadPhonePush();
    void loadSecurity();
    if (Platform.OS === "android") {
      void getLiveNotificationSettings()
        .then(setNotifications)
        .catch(() => undefined)
        .finally(() => setNotificationsReady(true));
    }
  }, [loadMe, loadPhonePush, loadSecurity]);

  const usageBlock = (
    <SettingsRow
      accessible
      title={t("Usage")}
      detail={
        usage
          ? t("{runs} runs · {tokens} tokens", {
              runs: usage.runs,
              tokens: usage.totalTokens ?? "—",
            })
          : undefined
      }
    />
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void rpc<MobileBot[]>("bots/listArchived")
        .then((bots) => {
          if (active) setArchivedBots(bots);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  async function selectAvatarStyle(next: AvatarStyle) {
    if (next === avatarStyle) return;
    setAvatarPending(true);
    setAvatarError(null);
    try {
      await updateAvatarStyle(next);
    } catch {
      setAvatarError(t("Couldn't update avatars"));
    } finally {
      setAvatarPending(false);
    }
  }

  async function handleSignOut() {
    setPending(true);
    setSignOutError(null);
    try {
      await signOut();
      replaceWithSignIn();
    } catch (err) {
      setSignOutError(errorText(err, t("Could not sign out")));
      setPending(false);
    }
  }

  async function updateNotifications(next: LiveNotificationSettings) {
    const previous = notifications;
    setNotifications(next);
    setNotificationPending(true);
    setNotificationError(null);
    try {
      await setLiveNotificationSettings(
        next,
        currentApiBase(),
        await loadSessionToken(),
        selectedSpaceId() ?? "",
      );
      if (next.liveConnection && !(await canPostPromotedNotifications())) {
        await openPromotedNotificationSettings();
      }
      await registerPushToken();
    } catch (cause) {
      setNotifications(previous);
      setNotificationError(errorText(cause, t("Could not update notifications")));
    } finally {
      setNotificationPending(false);
    }
  }

  async function updatePhonePush(push: boolean) {
    if (phonePushPending) return;
    const previous = phonePush;
    setPhonePushPending(true);
    setPhonePush(push);
    setNotificationError(null);
    try {
      await rpc("notifications/updatePreferences", { channels: { push } });
    } catch (cause) {
      setPhonePush(previous);
      setNotificationError(errorText(cause, t("Could not update notifications")));
    } finally {
      setPhonePushPending(false);
    }
  }

  async function securityAction(run: () => Promise<void>) {
    setPending(true);
    setDeleteError(null);
    try {
      await run();
    } catch (err) {
      setDeleteError(errorText(err, t("Could not continue")));
    } finally {
      setPending(false);
    }
  }
  function closeDeletePrompt() {
    if (pending) return;
    setDeleteOpen(false);
    setDeletePassword("");
  }

  async function requestDeletion() {
    if (pending) return;
    setDeleteError(null);
    try {
      const value = await fetchAccountSecurity();
      setSecurity(value);
      setSecurityLoadFailed(false);
      if (!value.hasPassword) {
        setDeletePassword("");
        setDeletionCodeSent(false);
        setSsoReauthenticated(value.freshOidcAuth);
        setDeleteOpen(true);
        return;
      }
    } catch (err) {
      setDeleteError(errorText(err, t("Could not continue")));
      return;
    }

    const prompted = promptAccountDeletion({
      title: t("Delete your account?"),
      message: t(
        "This permanently deletes your account, bots, conversations, memories, files, and saved connections. This cannot be undone.",
      ),
      cancelLabel: t("Cancel"),
      deleteLabel: t("Delete"),
      onSubmit: (password) => void handleDeletion(password, true),
    });
    if (!prompted) {
      setDeletePassword("");
      setDeleteOpen(true);
    }
  }

  function applyLocale(code: UiLocale) {
    if (code === locale || localeSaving) return;
    setLocaleSaving(true);
    setLocaleError(null);
    void setUiLocale(code)
      .catch(() => {
        setLocaleError(t("Could not change language"));
      })
      .finally(() => setLocaleSaving(false));
  }

  const loadPermissions = useCallback(() => {
    const requestId = ++permissionLoadId.current;
    setPermissionsLoadFailed(false);
    void rpc<PermissionSettings>("permissions/get")
      .then((next) => {
        if (permissionLoadId.current !== requestId) return;
        setPermissions(next);
        setPermissionsLoadFailed(false);
      })
      .catch(() => {
        if (permissionLoadId.current === requestId) setPermissionsLoadFailed(true);
      });
  }, []);

  const loadSavedApprovalRules = useCallback(() => {
    const requestId = ++approvalRulesLoadId.current;
    setSavedApprovalRulesLoadFailed(false);
    setSavedApprovalRulesError(null);
    void rpc<ActionApprovalRule[]>("approvalRules/list")
      .then((rules) => {
        if (approvalRulesLoadId.current !== requestId) return;
        setSavedApprovalRules(rules);
        setSavedApprovalRulesLoadFailed(false);
      })
      .catch(() => {
        if (approvalRulesLoadId.current === requestId) setSavedApprovalRulesLoadFailed(true);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPermissions();
      return () => {
        permissionLoadId.current += 1;
      };
    }, [loadPermissions]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!savedApprovalRulesOpen) return;
      loadSavedApprovalRules();
      return () => {
        approvalRulesLoadId.current += 1;
      };
    }, [loadSavedApprovalRules, savedApprovalRulesOpen]),
  );

  // A change while a save is in flight is ignored, so the row keeps showing the stored level.
  async function choosePermission(key: string) {
    if (!permissions || permissionsSaving) return;
    const level: PermissionLevel | null = key === "" ? null : (key as PermissionLevel);
    if (level === permissions.level) return;
    setPermissionsSaving(true);
    setPermissionsError(null);
    permissionLoadId.current += 1;
    try {
      const next = await rpc<PermissionSettings>("permissions/set", { level });
      permissionLoadId.current += 1;
      setPermissions(next);
    } catch (cause) {
      setPermissionsError(errorText(cause, t("Could not save permissions")));
    } finally {
      setPermissionsSaving(false);
    }
  }

  async function removeSavedApprovalRule(rule: ActionApprovalRule) {
    if (removingApprovalRuleId) return;
    setRemovingApprovalRuleId(rule.id);
    setSavedApprovalRulesError(null);
    approvalRulesLoadId.current += 1;
    try {
      await rpc("approvalRules/remove", { id: rule.id });
      approvalRulesLoadId.current += 1;
      setSavedApprovalRules((current) => current?.filter((item) => item.id !== rule.id) ?? []);
    } catch (cause) {
      setSavedApprovalRulesError(errorText(cause, t("Could not remove saved rule.")));
    } finally {
      setRemovingApprovalRuleId(null);
    }
  }

  function confirmRemoveSavedApprovalRule(rule: ActionApprovalRule) {
    if (removingApprovalRuleId) return;
    const name = savedRuleName(rule);
    Alert.alert(t("Remove saved rule?"), `${name} · ${savedRuleDetail(rule)}`, [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Remove"),
        style: "destructive",
        onPress: () => void removeSavedApprovalRule(rule),
      },
    ]);
  }

  const permissionLevelLabels: Record<PermissionLevel, string> = {
    open: t("Open"),
    ask_changes: t("Ask for changes"),
    ask_everything: t("Ask for everything"),
  };
  const permissionChoices: MenuPickerChoice[] = permissions
    ? [
        {
          key: "",
          label: t("Default ({level})", {
            level: permissionLevelLabels[permissions.effectiveDefault],
          }),
        },
        ...PermissionLevelSchema.options.map((level) => ({
          key: level,
          label: permissionLevelLabels[level],
        })),
      ]
    : [];
  const permissionLabel =
    permissionChoices.find((choice) => choice.key === (permissions?.level ?? ""))?.label ??
    permissions?.level ??
    "";

  const approvalEffectLabels = {
    always_allow: t("Allow"),
    require_approval: t("Ask"),
    block: t("Block"),
  };
  const approvalMatchKindLabels = {
    tool: t("Tool"),
    connector: t("Connector"),
    category: t("Category"),
    site: t("Site"),
  };
  function savedRuleName(rule: ActionApprovalRule): string {
    if (rule.botId && rule.matchKind === "tool" && rule.matchValue === "web_fetch") {
      return rule.botName ?? t("For this agent");
    }
    return rule.matchKind === "site" ? rule.matchValue : toolStepLabel(rule.matchValue);
  }
  function savedRuleDetail(rule: ActionApprovalRule): string {
    const kind =
      rule.botId && rule.matchKind === "tool" && rule.matchValue === "web_fetch"
        ? t("Fetches any site")
        : approvalMatchKindLabels[rule.matchKind];
    const scope = rule.routineName
      ? t("Routine: {name}", { name: rule.routineName })
      : rule.botName
        ? t("Agent: {name}", { name: rule.botName })
        : rule.routineId
          ? t("For this routine")
          : rule.botId
            ? t("For this agent")
            : t("In this space");
    return `${approvalEffectLabels[rule.effect]} · ${kind} · ${scope}`;
  }

  function openLanguagePicker() {
    if (localeSaving) return;
    presentMessageActionSheet({
      title: t("Language"),
      actions: UI_LOCALES.map((code) => ({
        text: UI_LOCALE_LABELS[code],
        onPress: () => applyLocale(code),
      })),
      colorScheme,
      cancel: t("Cancel"),
      more: t("More"),
    });
  }

  async function handleDeletion(password: string, hasPassword = security?.hasPassword === true) {
    if ((!password && !ssoReauthenticated) || pending) return;
    setPending(true);
    setDeleteError(null);
    try {
      if (hasPassword) await deleteAccount(password);
      else {
        const current = await fetchAccountSecurity();
        setSecurity(current);
        setSsoReauthenticated(current.freshOidcAuth);
        const token = deletionCodeSent ? password.trim() : undefined;
        if (current.hasPassword || (!current.freshOidcAuth && !token)) return;
        await deleteAccount(undefined, token);
      }
      setDeleteOpen(false);
      replaceWithSignIn("/sign-in");
    } catch (err) {
      setDeleteError(errorText(err, t("Could not delete account")));
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, stackOptions && styles.compactContent]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {meLoadFailed || phonePushLoadFailed || securityLoadFailed ? (
          <SettingsGroup>
            <SettingsRow accessible title={t("Could not load this page.")} />
            <NativeActionButton
              busy={retrying}
              label={t("Try again")}
              onPress={() => void retryAccountLoads()}
            />
          </SettingsGroup>
        ) : null}
        {focus === "usage" ? <SettingsGroup>{usageBlock}</SettingsGroup> : null}
        <SettingsGroup>
          <SettingsRow
            accessible
            detail={me?.email || undefined}
            prominent
            title={me?.name || t("Your account")}
          />
          {focus !== "usage" ? usageBlock : null}
        </SettingsGroup>

        {(security?.sso && !security.ssoLinked) || canChangePassword ? (
          <SettingsGroup>
            {security?.sso && !security.ssoLinked ? (
              <SettingsRow
                accessibilityRole="button"
                chevron="right"
                disabled={pending}
                dimmed={pending}
                title={t("Link SSO")}
                onPress={() =>
                  void securityAction(async () => {
                    if (await continueWithSso("link")) setSecurity(await fetchAccountSecurity());
                  })
                }
              />
            ) : null}
            {canChangePassword ? (
              <SettingsRow
                accessibilityRole="button"
                chevron="right"
                onPress={() => router.push("/change-password")}
                title={t("Change password")}
              />
            ) : null}
          </SettingsGroup>
        ) : null}

        <View accessibilityLabel={t("Appearance")} style={styles.section}>
          <SettingsLabel>{t("Appearance")}</SettingsLabel>
          <NativeSegmentedControl
            accessibilityLabel={t("Appearance")}
            onChange={(value) => void setAppearancePreference(value)}
            options={[
              { value: "system", label: t("System") },
              { value: "light", label: t("Light") },
              { value: "dark", label: t("Dark") },
            ]}
            value={appearance}
          />
        </View>

        <View accessibilityLabel={t("Avatar style")} style={styles.section}>
          <SettingsLabel>{t("Avatars")}</SettingsLabel>
          <View style={[styles.options, stackOptions && styles.optionsStacked]}>
            {(["organic", "robot"] as const).map((style) => {
              const selected = avatarStyle === style;
              const styleLabel = style === "robot" ? t("Robot") : t("Organic");
              return (
                <Pressable
                  key={style}
                  accessibilityLabel={t("{style} avatars", { style: styleLabel })}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: avatarPending }}
                  disabled={avatarPending}
                  onPress={() => void selectAvatarStyle(style)}
                  style={({ pressed }) => [
                    styles.option,
                    styles.avatarOption,
                    !stackOptions && styles.optionSideBySide,
                    pressed && styles.pressed,
                  ]}
                >
                  <BotAvatar
                    color={style === "robot" ? "#8B5CF6" : "#D62F8B"}
                    identity="avatar-preview"
                    size={42}
                    variant={style}
                  />
                  <Text style={styles.optionLabel}>{styleLabel}</Text>
                  <NativeSymbol
                    android={selected ? "checkmark-circle" : "ellipse-outline"}
                    color={selected ? native.label : native.tertiaryLabel}
                    ios={selected ? "checkmark.circle.fill" : "circle"}
                    size={22}
                  />
                </Pressable>
              );
            })}
          </View>
          <SettingsGroup>
            {avatarError ? <Text style={styles.error}>{avatarError}</Text> : null}
          </SettingsGroup>
        </View>

        <SettingsGroup>
          <SettingsRow
            accessibilityRole="button"
            accessibilityLabel={t("Language")}
            accessibilityValue={{ text: UI_LOCALE_LABELS[locale] }}
            accessibilityState={{ disabled: localeSaving }}
            chevron="right"
            dimmed={localeSaving}
            disabled={localeSaving}
            onPress={openLanguagePicker}
            title={t("Language")}
            value={UI_LOCALE_LABELS[locale]}
          />
          {localeError ? <Text style={styles.error}>{localeError}</Text> : null}
        </SettingsGroup>

        {phonePush !== null && Platform.OS !== "android" ? (
          <SettingsGroup>
            <SettingsSwitch
              label={t("Phone notifications")}
              value={phonePush}
              disabled={phonePushPending}
              onChange={(push) => void updatePhonePush(push)}
            />
            {notificationError ? <Text style={styles.error}>{notificationError}</Text> : null}
          </SettingsGroup>
        ) : null}

        {Platform.OS === "android" ? (
          <SettingsGroup accessibilityLabel={t("Notifications")} label={t("Notifications")}>
            {phonePush !== null ? (
              <SettingsSwitch
                label={t("Phone notifications")}
                value={phonePush}
                disabled={phonePushPending}
                onChange={(push) => void updatePhonePush(push)}
              />
            ) : null}
            <SettingsSwitch
              label={t("Live working status")}
              detail={t("While agents are working")}
              value={notifications.liveConnection}
              disabled={notificationPending || !notificationsReady}
              onChange={(liveConnection) =>
                void updateNotifications({ ...notifications, liveConnection })
              }
            />
            <SettingsSwitch
              label={t("Agent messages")}
              detail={t("Replies and completed work")}
              value={notifications.messages}
              disabled={notificationPending || !notificationsReady}
              onChange={(messages) => void updateNotifications({ ...notifications, messages })}
            />
            <SettingsSwitch
              label={t("Scheduled tasks")}
              detail={t("Alerts from routines")}
              value={notifications.scheduledTasks}
              disabled={notificationPending || !notificationsReady}
              onChange={(scheduledTasks) =>
                void updateNotifications({ ...notifications, scheduledTasks })
              }
            />
            <SettingsSwitch
              label={t("Needs attention")}
              detail={t("Questions, approvals, takeover")}
              value={notifications.needsAttention}
              disabled={notificationPending || !notificationsReady}
              onChange={(needsAttention) =>
                void updateNotifications({ ...notifications, needsAttention })
              }
            />
            <SettingsRow
              accessibilityRole="button"
              onPress={() => void openPromotedNotificationSettings()}
              title={t("Live update settings")}
            />
            <SettingsRow
              accessibilityRole="button"
              onPress={() => void openLiveNotificationSettings()}
              title={t("Notification settings")}
            />
            {notificationError ? <Text style={styles.error}>{notificationError}</Text> : null}
          </SettingsGroup>
        ) : null}

        <SettingsGroup>
          <SettingsRow
            accessibilityRole="button"
            chevron="right"
            disabled={pending}
            onPress={() => router.push("/models")}
            title={t("Models")}
          />
          <SettingsRow
            accessibilityRole="button"
            chevron="right"
            disabled={pending}
            onPress={() => router.push("/voice")}
            title={t("Voice")}
          />
          <SettingsRow
            accessibilityRole="button"
            chevron="right"
            disabled={pending}
            onPress={() => router.push("/integrations")}
            title={t("Integrations")}
          />
          <SettingsRow
            accessibilityRole="button"
            chevron="right"
            disabled={pending}
            onPress={() => router.push("/ai-data-sharing")}
            title={t("AI data sharing")}
          />
          {me?.isDeploymentOwner ? (
            <SettingsRow
              accessibilityRole="button"
              chevron="right"
              onPress={() => router.push("/integration-setup")}
              title={t("Server integrations")}
            />
          ) : null}
        </SettingsGroup>

        {permissions ? (
          <SettingsGroup
            footer={
              permissionsError ??
              ((permissions.level ?? permissions.effectiveDefault) === "open"
                ? t(
                    "Sending to new people, payments, permanent deletes and access requests always ask.",
                  )
                : undefined)
            }
          >
            {permissionsSaving ? (
              // No menu to open while the save is in flight, so a newer choice cannot race it.
              <View
                accessibilityLabel={t("Permissions")}
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityValue={{ text: permissionLabel }}
                accessible
                style={[styles.menuRow, stackOptions && styles.compactMenuRow, styles.disabled]}
              >
                <Text numberOfLines={1} style={styles.menuRowTitle}>
                  {t("Permissions")}
                </Text>
                <Text numberOfLines={1} style={styles.menuRowValue}>
                  {permissionLabel}
                </Text>
              </View>
            ) : (
              <MenuPickerMenu
                choices={permissionChoices}
                label={t("Permissions")}
                onChange={(key) => void choosePermission(key)}
                value={permissions.level ?? ""}
              >
                <View
                  accessibilityLabel={t("Permissions")}
                  accessibilityRole="button"
                  accessibilityValue={{ text: permissionLabel }}
                  accessible
                  style={[styles.menuRow, stackOptions && styles.compactMenuRow]}
                >
                  <Text numberOfLines={1} style={styles.menuRowTitle}>
                    {t("Permissions")}
                  </Text>
                  <Text numberOfLines={1} style={styles.menuRowValue}>
                    {permissionLabel}
                  </Text>
                  <NativeSymbol
                    android="chevron-expand"
                    color={native.tertiaryLabel}
                    ios="chevron.up.chevron.down"
                    size={13}
                  />
                </View>
              </MenuPickerMenu>
            )}
          </SettingsGroup>
        ) : null}
        {permissionsLoadFailed ? (
          <SettingsGroup>
            <SettingsRow
              accessible
              detail={t("Could not load permissions.")}
              title={t("Permissions")}
            />
            <SettingsRow
              accessibilityRole="button"
              onPress={loadPermissions}
              title={t("Try again")}
            />
          </SettingsGroup>
        ) : null}

        <SettingsGroup>
          <SettingsRow
            accessibilityRole="button"
            accessibilityState={{ expanded: savedApprovalRulesOpen }}
            chevron={savedApprovalRulesOpen ? "down" : "right"}
            onPress={() => setSavedApprovalRulesOpen((open) => !open)}
            title={t("Saved rules")}
          />
          {savedApprovalRulesOpen &&
          savedApprovalRules === null &&
          !savedApprovalRulesLoadFailed ? (
            <SettingsRow accessible title={t("Loading saved rules…")} />
          ) : null}
          {savedApprovalRulesOpen && savedApprovalRulesLoadFailed ? (
            <>
              <SettingsRow accessible title={t("Could not load saved rules.")} />
              <SettingsRow
                accessibilityRole="button"
                onPress={loadSavedApprovalRules}
                title={t("Try again")}
              />
            </>
          ) : null}
          {savedApprovalRulesOpen && savedApprovalRules ? (
            savedApprovalRules.length === 0 ? (
              <SettingsRow accessible title={t("No saved rules.")} />
            ) : (
              savedApprovalRules.map((rule) => {
                const name = savedRuleName(rule);
                return (
                  <SettingsRow
                    accessibilityLabel={t("Remove {name}", { name })}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: removingApprovalRuleId !== null }}
                    detail={savedRuleDetail(rule)}
                    disabled={removingApprovalRuleId !== null}
                    destructive
                    key={rule.id}
                    onPress={() => confirmRemoveSavedApprovalRule(rule)}
                    title={name}
                    trailing={
                      <NativeSymbol
                        android="trash"
                        color={mobileTokens().destructive}
                        ios="trash"
                        size={18}
                      />
                    }
                  />
                );
              })
            )
          ) : null}
          {savedApprovalRulesOpen && savedApprovalRulesError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {savedApprovalRulesError}
            </Text>
          ) : null}
        </SettingsGroup>

        <SettingsGroup>
          <DataExportRow onError={setExportError} />
          {exportError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {exportError}
            </Text>
          ) : null}
        </SettingsGroup>

        <SettingsGroup>
          <SettingsSwitch
            label={t("Hide amounts")}
            value={hideAmounts}
            onChange={(hidden) => void setHideAmounts(hidden)}
          />
          <SettingsRow
            accessibilityRole="button"
            accessibilityLabel={t("Advanced")}
            accessibilityState={{ expanded: advancedOpen }}
            chevron={advancedOpen ? "down" : "right"}
            onPress={() => setAdvancedOpen((open) => !open)}
            title={t("Advanced")}
          />
          {advancedOpen ? (
            <SettingsSwitch
              label={t("Stream replies")}
              value={streamReplies}
              onChange={(checked) => void setResponseStreamingPreference(checked ? "on" : "off")}
            />
          ) : null}
          {advancedOpen ? (
            <SettingsSwitch
              label={loadRemoteImagesLabel}
              value={loadRemoteImages}
              onChange={(checked) => void setRemoteImagesPreference(checked ? "on" : "off")}
            />
          ) : null}
        </SettingsGroup>

        <View style={styles.section}>
          <NativeActionButton
            disabled={pending}
            fill
            label={t("Sign out")}
            onPress={() => void handleSignOut()}
            prominence="secondary"
          />
          <SettingsGroup>
            {signOutError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {signOutError}
              </Text>
            ) : null}
          </SettingsGroup>
        </View>

        {archivedBots.length > 0 ? (
          <SettingsGroup>
            <SettingsRow
              accessibilityRole="button"
              chevron="right"
              onPress={() => router.push("/archived-bots")}
              title={t("Archived bots")}
              value={String(archivedBots.length)}
            />
          </SettingsGroup>
        ) : null}

        <View style={styles.about}>
          <AppMark />
          {versionInfo.nativeLabel || updateLabel ? (
            <View
              accessibilityLabel={versionAccessibility}
              accessibilityRole="summary"
              style={styles.versionFooter}
            >
              {versionInfo.nativeLabel ? (
                <Text style={styles.versionLine}>{versionInfo.nativeLabel}</Text>
              ) : null}
              {updateLabel ? <Text style={styles.versionLine}>{updateLabel}</Text> : null}
            </View>
          ) : null}
        </View>

        <SettingsGroup>
          <SettingsRow
            accessibilityRole="button"
            destructive
            dimmed={pending}
            disabled={pending}
            onPress={requestDeletion}
            title={t("Delete account")}
            trailing={
              pending ? <ActivityIndicator color={mobileTokens().destructive} /> : undefined
            }
          />
          {!deleteOpen && deleteError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {deleteError}
            </Text>
          ) : null}
        </SettingsGroup>
      </ScrollView>
      {deleteOpen ? (
        <Modal transparent animationType="fade" onRequestClose={closeDeletePrompt}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.dialogOverlay}
          >
            <Pressable
              accessibilityLabel={t("Cancel")}
              style={StyleSheet.absoluteFill}
              onPress={closeDeletePrompt}
            />
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.dialog}
              keyboardShouldPersistTaps="handled"
              style={styles.dialogScroll}
            >
              <Text style={styles.dialogTitle}>{t("Delete your account?")}</Text>
              <Text style={styles.dialogBody}>
                {t(
                  "This permanently deletes your account, bots, conversations, memories, files, and saved connections. This cannot be undone.",
                )}
              </Text>
              {!security?.hasPassword ? (
                <>
                  {security?.sso ? (
                    <NativeActionButton
                      label={t("Sign in again")}
                      disabled={pending}
                      onPress={() =>
                        void securityAction(async () => {
                          setSsoReauthenticated(await continueWithSso("reauthenticate"));
                        })
                      }
                    />
                  ) : null}
                  {security?.emailDeletion ? (
                    <NativeActionButton
                      label={t("Send deletion code")}
                      disabled={pending}
                      onPress={() =>
                        void securityAction(async () => {
                          await requestAccountDeletionCode();
                          setDeletionCodeSent(true);
                        })
                      }
                    />
                  ) : null}
                </>
              ) : null}
              {security?.hasPassword || deletionCodeSent ? (
                <TextInput
                  accessibilityLabel={
                    security?.hasPassword ? t("Current password") : t("Deletion code")
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  editable={!pending}
                  onChangeText={(value) => {
                    setDeletePassword(value);
                    setDeleteError(null);
                  }}
                  placeholder={security?.hasPassword ? t("Current password") : t("Deletion code")}
                  placeholderTextColor={native.tertiaryLabel}
                  secureTextEntry={security?.hasPassword}
                  style={styles.dialogInput}
                  textContentType={security?.hasPassword ? "password" : "oneTimeCode"}
                  value={deletePassword}
                />
              ) : null}
              {deleteError ? (
                <Text accessibilityRole="alert" style={styles.dialogError}>
                  {deleteError}
                </Text>
              ) : null}
              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={closeDeletePrompt}
                  style={styles.dialogAction}
                >
                  <Text style={styles.dialogCancel}>{t("Cancel")}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={deletionDisabled}
                  onPress={() => void handleDeletion(deletePassword)}
                  style={styles.dialogAction}
                >
                  <Text style={[styles.dialogDelete, deletionDisabled && styles.disabled]}>
                    {t("Delete")}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

function createAccountStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: native.groupedPage,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 32,
      gap: 28,
    },
    compactContent: {
      paddingHorizontal: 8,
    },
    section: {
      gap: 7,
    },
    options: {
      flexDirection: "row",
      gap: 8,
    },
    optionsStacked: {
      flexDirection: "column",
    },
    option: {
      minHeight: 48,
      borderRadius: 14,
      borderCurve: "continuous",
      borderWidth: 2,
      borderColor: "transparent",
      backgroundColor: native.groupedCell,
      paddingHorizontal: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    optionSideBySide: {
      flex: 1,
    },
    avatarOption: {
      minHeight: 96,
      gap: 8,
    },
    optionLabel: {
      color: native.label,
      fontSize: 15,
      fontWeight: "600",
      textAlign: "center",
    },
    about: {
      alignItems: "center",
      gap: 16,
      paddingTop: 8,
      paddingBottom: 22,
    },
    versionFooter: {
      alignItems: "center",
    },
    versionLine: {
      color: native.secondaryLabel,
      fontSize: 13,
      textAlign: "center",
    },
    error: {
      color: tokens.destructive,
      fontSize: 15,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    menuRow: {
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    compactMenuRow: { paddingHorizontal: 12, gap: 8 },
    menuRowTitle: { flex: 1, flexShrink: 1, color: native.label, fontSize: 17 },
    menuRowValue: { flexShrink: 1, color: native.secondaryLabel, fontSize: 17 },
    dialogOverlay: {
      flex: 1,
      justifyContent: "center",
      padding: 24,
      backgroundColor: "rgba(0, 0, 0, 0.62)",
    },
    dialogScroll: {
      flexGrow: 0,
      flexShrink: 1,
      maxHeight: "100%",
      borderRadius: 14,
      backgroundColor: native.page,
    },
    dialog: {
      padding: 18,
      gap: 12,
    },
    dialogTitle: {
      color: native.label,
      fontSize: 17,
      fontWeight: "600",
    },
    dialogBody: {
      color: native.secondaryLabel,
      fontSize: 14,
      lineHeight: 20,
    },
    dialogInput: {
      height: 48,
      borderRadius: 12,
      backgroundColor: native.fill,
      color: native.label,
      paddingHorizontal: 14,
      fontSize: 16,
    },
    dialogError: {
      color: tokens.destructive,
      fontSize: 14,
    },
    dialogActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 12,
    },
    dialogAction: {
      minHeight: 48,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    dialogCancel: {
      color: native.label,
      fontSize: 16,
      fontWeight: "600",
    },
    dialogDelete: {
      color: tokens.destructive,
      fontSize: 16,
      fontWeight: "600",
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      backgroundColor: native.fillPressed,
    },
  });
}
