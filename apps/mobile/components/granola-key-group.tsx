import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { rpc } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { NativeActionButton } from "./native-action-button";
import { SettingsGroup, SettingsRow } from "./settings-group";

type MeetingsStatus = {
  status: "connected" | "needs_reconnect" | "disconnected";
  syncedThrough: string | null;
  syncedCount: number;
  consentOff: boolean;
} | null;

/** Granola API-key connection. It is not in the connection catalog, so it has its own fixed group. */
export function GranolaKeyGroup() {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [status, setStatus] = useState<MeetingsStatus>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await rpc<MeetingsStatus>("meetings/status"));
    } catch {
      // The group stays on its last known state; Connect still works.
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      await rpc("meetings/connect", { apiKey });
      setApiKey("");
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        message === "Granola rejected this key"
          ? t("Granola rejected this key")
          : t("Could not reach Granola"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await rpc("meetings/disconnect");
      await load();
    } catch {
      // Status stays as it was; the row remains for another try.
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.status === "connected";
  const needsReconnect = status?.status === "needs_reconnect";
  const showKey = !connected;
  const syncing = connected && !status.consentOff && status.syncedThrough === null;
  const statusRow = connected ? (
    status.consentOff ? (
      <SettingsRow
        key="status"
        accessibilityRole="button"
        chevron="right"
        onPress={() => router.push("/ai-data-sharing")}
        title={t("AI data sharing off")}
      />
    ) : (
      <SettingsRow
        key="status"
        accessible
        title={syncing ? t("Syncing") : t("Synced {n} meetings", { n: status.syncedCount })}
        trailing={syncing ? <ActivityIndicator color={native.secondaryLabel} /> : undefined}
      />
    )
  ) : needsReconnect ? (
    <View key="status" style={styles.warningRow}>
      <Text style={styles.warning}>{t("Reconnect needed")}</Text>
    </View>
  ) : null;

  return (
    <SettingsGroup
      footer={showKey ? t("Sends your meeting notes and transcripts to your AI model.") : undefined}
      label={t("Granola")}
    >
      {status?.status === "disconnected" ? (
        <SettingsRow key="keep" accessible title={t("Praci keeps your meetings and to-dos.")} />
      ) : null}
      {statusRow}
      {status && status.status !== "disconnected" ? (
        <SettingsRow
          key="disconnect"
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void disconnect()}
          title={t("Disconnect")}
        />
      ) : null}
      {showKey ? (
        <View key="key" style={styles.keyRow}>
          <Text style={styles.label}>
            {t("Granola API key")} <Text style={styles.muted}>{t("Business plan")}</Text>
          </Text>
          <TextInput
            accessibilityLabel={t("Granola API key")}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            importantForAutofill="no"
            onChangeText={(value) => {
              setApiKey(value);
              setError(null);
            }}
            secureTextEntry
            style={styles.input}
            textContentType="none"
            value={apiKey}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
      {showKey ? (
        <View key="connect" style={styles.connectRow}>
          <NativeActionButton
            busy={busy}
            disabled={busy || apiKey.trim().length === 0}
            label={t("Connect")}
            onPress={() => void connect()}
          />
        </View>
      ) : null}
    </SettingsGroup>
  );
}

function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    warningRow: { minHeight: 52, paddingHorizontal: 16, justifyContent: "center" },
    warning: { color: tokens.warning, fontSize: 17 },
    keyRow: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    label: { color: native.label, fontSize: 17 },
    muted: { color: native.secondaryLabel },
    input: {
      minHeight: 44,
      borderRadius: 10,
      backgroundColor: native.fillPressed,
      color: native.label,
      paddingHorizontal: 12,
      fontSize: 15,
    },
    error: { color: native.secondaryLabel, fontSize: 13 },
    connectRow: {
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 8,
      justifyContent: "center",
    },
  });
}
