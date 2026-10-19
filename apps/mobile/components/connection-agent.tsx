import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileBot } from "../lib/api";
import { rpc } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { closeSettingsSheet } from "../lib/settings-sheet";
import { errorText } from "../lib/user-error";
import { NativeSwitch } from "./native-switch";
import { Chevron } from "./row-accessories";

/** The agent that owns a connection, with a switch to share the connection with every agent. */
export function ConnectionAgent({ connectionId, botId }: { connectionId: string; botId: string }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [shared, setShared] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sequence = useRef(0);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    const mine = ++sequence.current;
    setLoadFailed(false);
    Promise.all([
      rpc<{ allAgents: boolean; botIds: string[] }>("connections/access", { connectionId }),
      rpc<MobileBot[]>("bots/list"),
    ])
      .then(([access, bots]) => {
        if (mine !== sequence.current) return;
        setShared(access.allAgents);
        setName(bots.find((bot) => bot.id === botId)?.name ?? "");
      })
      .catch(() => {
        if (mine === sequence.current) setLoadFailed(true);
      });
  }, [connectionId, botId]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        sequence.current++;
      };
    }, [load]),
  );

  async function setAll(next: boolean) {
    const previous = shared;
    setShared(next);
    setSaving(true);
    setError(null);
    try {
      // Read the current selection right before saving so a change made elsewhere is kept.
      const fresh = await rpc<{ botIds: string[] }>("connections/access", { connectionId });
      await rpc("connections/setAccess", { connectionId, allAgents: next, botIds: fresh.botIds });
    } catch (cause) {
      setShared(previous);
      setError(errorText(cause, t("Try again.")));
    } finally {
      setSaving(false);
    }
  }

  if (loadFailed)
    return (
      <Pressable accessibilityRole="button" onPress={load} style={styles.row}>
        <Text style={styles.error}>{t("Try again.")}</Text>
      </Pressable>
    );
  if (!name) return null;
  return (
    <View style={styles.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        onPress={() => {
          closeSettingsSheet();
          router.push({ pathname: "/thread", params: { botId, name } });
        }}
        style={styles.row}
      >
        <Text numberOfLines={1} style={styles.label}>
          {name}
        </Text>
        <Chevron />
      </Pressable>
      {shared === null ? null : (
        <View style={styles.row}>
          <Text style={styles.label}>{t("Share with all agents")}</Text>
          <NativeSwitch
            accessibilityLabel={t("Share with all agents")}
            disabled={saving}
            onValueChange={(next) => void setAll(next)}
            value={shared}
          />
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    box: { gap: 6 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    label: { flex: 1, color: native.label, fontSize: 15 },
    error: { color: mobileTokens().destructive, fontSize: 13 },
  });
}
