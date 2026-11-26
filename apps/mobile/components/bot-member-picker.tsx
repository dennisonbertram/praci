import { GROUP_MEMBER_MAX } from "@rakazo/contracts";
import { StyleSheet, Text, View } from "react-native";
import type { MobileBot } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useMobileTokens } from "../lib/native";
import { BotAvatar } from "./bot-avatar";
import { NativeSwitch } from "./native-switch";

export function BotMemberPicker({
  bots,
  selected,
  onChange,
  disabled = false,
}: {
  bots: MobileBot[];
  selected: string[];
  onChange: (botIds: string[]) => void;
  disabled?: boolean;
}) {
  const tokens = useMobileTokens();
  const { t } = useI18n();
  return bots.map((bot) => {
    const checked = selected.includes(bot.id);
    const first = selected[0] === bot.id;
    return (
      <View key={bot.id} style={styles.row}>
        <BotAvatar color={bot.color} identity={bot.id} size={34} status={bot.status} />
        <View style={styles.identity}>
          <Text style={[styles.name, { color: tokens.foreground }]}>{bot.name}</Text>
          {bot.firewall ? (
            <Text style={[styles.secondary, { color: tokens.mutedForeground }]}>
              {t("Firewall")}
            </Text>
          ) : null}
          {first ? (
            <Text style={[styles.secondary, { color: tokens.mutedForeground }]}>
              {t("Answers first")}
            </Text>
          ) : null}
        </View>
        <NativeSwitch
          accessibilityLabel={bot.name}
          disabled={disabled || (!checked && selected.length >= GROUP_MEMBER_MAX)}
          onValueChange={(next) => {
            if (next && selected.length >= GROUP_MEMBER_MAX) return;
            onChange(next ? [...selected, bot.id] : selected.filter((id) => id !== bot.id));
          }}
          thumbColor={checked ? tokens.primaryForeground : tokens.foreground}
          tintColor={tokens.primary}
          trackColor={{ false: tokens.border, true: tokens.primary }}
          value={checked}
        />
      </View>
    );
  });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  identity: { flex: 1, gap: 2 },
  name: { fontSize: 16 },
  secondary: { fontSize: 12 },
});
