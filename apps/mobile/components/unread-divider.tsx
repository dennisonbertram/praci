import { useContext } from "react";
import { StyleSheet, Text, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { BotAccentContext } from "../lib/bot-accent";
import { useI18n } from "../lib/i18n";

/** A thin line in the bot's accent (neutral without one) with a small label, where unread messages start. */
export function UnreadDivider() {
  const { t } = useI18n();
  const accent = useContext(BotAccentContext);
  const color = accent ?? mobileTokens().mutedForeground;
  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <Text selectable={false} style={[styles.label, { color }]}>
        {t("New")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
});
