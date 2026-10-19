import { toolPhrase } from "@rakazo/core";
import { StyleSheet, Text } from "react-native";
import { useMobileTokens } from "../lib/native";

/** Native counterpart of the web ToolCallLabel: the same plain phrase from the shared function. */
export function ToolCallLabel({
  name,
  state = "done",
  count = 1,
}: {
  name: string;
  state?: "running" | "done" | "failed" | "waiting";
  count?: number;
}) {
  const tokens = useMobileTokens();
  const active = state === "running" || state === "waiting";
  const phrase = toolPhrase(name, active ? "activity" : "done") || name;
  return (
    <Text
      style={[
        styles.text,
        { color: state === "failed" ? tokens.destructive : tokens.mutedForeground },
      ]}
      numberOfLines={1}
    >
      {phrase}
      {count > 1 ? ` ×${count}` : ""}
    </Text>
  );
}

const styles = StyleSheet.create({ text: { fontSize: 13 } });
