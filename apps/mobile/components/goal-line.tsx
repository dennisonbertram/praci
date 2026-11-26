import { Text, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { t } from "../lib/i18n";
import type { GoalLine as GoalLineState } from "../lib/thread-goal";
import { NativeActionButton } from "./native-action-button";

/** The open goal above the composer, with a status word only when it is not working. */
export function GoalLine({ goal, onClear }: { goal: GoalLineState; onClear: () => void }) {
  const tokens = mobileTokens();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: tokens.foreground, fontSize: 13 }} numberOfLines={1}>
          {goal.text}
        </Text>
        {goal.status ? (
          <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>
            {goal.status === "Paused" ? t("Paused") : t("Waiting on you")}
          </Text>
        ) : null}
      </View>
      <NativeActionButton
        accessibilityLabel={t("Clear goal")}
        icon={{ ios: "xmark.circle.fill", android: "close-circle" }}
        prominence="quiet"
        size="compact"
        fill={false}
        onPress={onClear}
      />
    </View>
  );
}
