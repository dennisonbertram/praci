import type { MessageBlock } from "@rakazo/contracts";
import { goalEvidenceRows, toolPhrase } from "@rakazo/core";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { maskAmountsWhenHidden, useHideAmounts } from "../lib/hide-amounts";
import { t } from "../lib/i18n";
import { Chevron } from "./row-accessories";

/** How a goal ended: the outcome, then the reason, and for `met` the evidence behind a trigger. */
export function GoalCard({ block }: { block: Extract<MessageBlock, { kind: "goal" }> }) {
  const tokens = mobileTokens();
  // Tool results can carry money; the evidence follows the owner's Hide amounts switch.
  useHideAmounts();
  const [open, setOpen] = useState(false);
  const title =
    block.outcome === "met"
      ? t("Goal met")
      : block.outcome === "blocked"
        ? t("Goal blocked")
        : t("Goal stopped");
  const evidence = goalEvidenceRows(block);
  return (
    <View style={{ width: "100%", paddingVertical: 4, alignItems: "center" }}>
      <Text style={{ color: tokens.foreground, fontSize: 13.5, fontWeight: "600" }}>{title}</Text>
      {block.reason ? (
        <Text style={{ color: tokens.mutedForeground, fontSize: 13.5, textAlign: "center" }}>
          {block.reason}
        </Text>
      ) : null}
      {evidence.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((wasOpen) => !wasOpen)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2 }}
        >
          <Chevron expanded={open} />
          <Text style={{ color: tokens.mutedForeground, fontSize: 13 }}>
            {t("Evidence · {n}", { n: evidence.length })}
          </Text>
        </Pressable>
      ) : null}
      {open
        ? evidence.map((row, index) => (
            <Text
              key={index}
              numberOfLines={1}
              style={{
                alignSelf: "stretch",
                color: tokens.mutedForeground,
                fontSize: 12.5,
                textAlign: "left",
              }}
            >
              {maskAmountsWhenHidden(
                row.tool
                  ? // A call that recorded no result keeps its name, without a dangling separator.
                    [toolPhrase(row.tool, "done") || row.tool, row.result]
                      .filter(Boolean)
                      .join(": ")
                  : row.result,
              )}
            </Text>
          ))
        : null}
    </View>
  );
}
