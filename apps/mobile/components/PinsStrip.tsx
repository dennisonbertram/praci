import { maskPinFigures } from "@rakazo/chat-ui/mask-currency";
import type { BotPins } from "@rakazo/contracts";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getPins, refreshPins } from "../lib/agent-pins";
import { useHideAmounts } from "../lib/hide-amounts";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { NativeSymbol } from "./native-symbol";

/** The bot's pins. Reloads on focus and whenever `tick` changes (the `pins.updated` event). */
export function useBotPins(botId: string | undefined, enabled: boolean, tick: number) {
  const [pins, setPins] = useState<BotPins | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!botId || !enabled) return;
      let cancelled = false;
      getPins(botId)
        .then((next) => !cancelled && setPins(next))
        .catch(() => undefined); // keep what is on screen
      return () => {
        cancelled = true;
      };
    }, [botId, enabled, tick]),
  );
  return { pins: enabled ? pins : null, setPins };
}

export function PinsStrip({
  botId,
  stats,
  topInset,
  onRefreshed,
}: {
  botId: string;
  stats: BotPins["stats"];
  topInset: number;
  onRefreshed: (pins: BotPins) => void;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [running, setRunning] = useState(false);
  const hidden = useHideAmounts();
  const shown = (text: string) => (hidden ? maskPinFigures(text) : text);

  async function refresh() {
    setRunning(true);
    try {
      onRefreshed((await refreshPins(botId)).pins);
    } catch {
      // The cards keep their last values.
    } finally {
      setRunning(false);
    }
  }

  return (
    <View style={{ marginTop: topInset, zIndex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroll}
      >
        {stats.map((stat) => (
          <View key={stat.id} style={styles.card}>
            <View style={styles.labelRow}>
              <Text numberOfLines={1} style={styles.label}>
                {stat.label}
              </Text>
              {stat.error ? (
                <NativeSymbol
                  ios="exclamationmark.triangle"
                  android="warning-outline"
                  size={12}
                  color={native.secondaryLabel}
                />
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.value}>
              {shown(stat.value)}
            </Text>
            {stat.detail ? (
              <Text numberOfLines={1} style={styles.detail}>
                {shown(stat.detail)}
              </Text>
            ) : null}
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Refresh")}
          disabled={running}
          hitSlop={8}
          onPress={() => void refresh()}
          style={styles.refresh}
        >
          {running ? (
            <ActivityIndicator />
          ) : (
            <NativeSymbol ios="arrow.clockwise" android="refresh-outline" size={18} />
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    scroll: { flexGrow: 0, marginHorizontal: -20 },
    row: { paddingHorizontal: 20, paddingVertical: 8, gap: 8, alignItems: "center" },
    card: {
      minWidth: 96,
      maxWidth: 180,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: native.fill,
      gap: 2,
    },
    labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    label: { color: native.secondaryLabel, fontSize: 12, flexShrink: 1 },
    value: { color: native.label, fontSize: 18, fontWeight: "600" },
    detail: { color: native.secondaryLabel, fontSize: 11 },
    refresh: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  });
}
