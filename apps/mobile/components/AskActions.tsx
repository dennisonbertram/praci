import { useState } from "react";
import type { ViewProps } from "react-native";
import { Alert, Pressable, Text, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native } from "../lib/native";
import { errorText } from "../lib/user-error";
import { Chevron } from "./row-accessories";

type AskAction = { id: string; label: string };

const KNOWN_ASK_ACTION_LABELS: Record<string, string> = {
  allow: "Allow once",
  always: "Always allow",
  deny: "Deny",
};

/** The desktop app card: one approval covers the rest of the run in that app. */
const RUN_ALLOW_LABEL = "Allow for this run";
const ACCESS_ALWAYS_LABEL = "Always for this agent";

const CONSENT_ASK_ACTION_LABELS: Record<string, string> = { allow: "Allow", deny: "Not now" };

export function AskContext({
  approvalReason,
  detail,
  detailFolded,
  warning,
}: {
  approvalReason?: string | null;
  detail?: string | null;
  detailFolded?: boolean;
  /** The reason is a warning to act on (mail already sent), shown in the warning colour. */
  warning?: boolean;
}) {
  const { t } = useI18n();
  const tokens = mobileTokens();
  const [detailOpen, setDetailOpen] = useState(false);

  if (!approvalReason && !detail) return null;

  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      {approvalReason ? (
        <Text
          style={
            warning
              ? { color: tokens.warning, fontSize: 13.5, fontWeight: "600" }
              : { color: tokens.mutedForeground, fontSize: 13.5, lineHeight: 19 }
          }
        >
          {approvalReason}
        </Text>
      ) : null}
      {detail && detailFolded ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: detailOpen }}
            onPress={() => setDetailOpen((open) => !open)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Text style={{ color: tokens.mutedForeground, fontSize: 13 }}>
              {t(detailOpen ? "Show less" : "Show more")}
            </Text>
            <Chevron expanded={detailOpen} />
          </Pressable>
          {detailOpen ? (
            <Text style={{ color: tokens.mutedForeground, fontSize: 13.5, lineHeight: 20 }}>
              {detail.trim()}
            </Text>
          ) : null}
        </>
      ) : detail ? (
        <Text style={{ color: tokens.mutedForeground, fontSize: 13.5, lineHeight: 20 }}>
          {detail.trim()}
        </Text>
      ) : null}
    </View>
  );
}

export function AskActions({
  actions,
  consent,
  disabled,
  onAnswer,
  accessibilityActions,
  onAccessibilityAction,
}: {
  actions: AskAction[];
  /** An AI data sharing request: its buttons read Allow and Not now. */
  consent?: boolean;
  disabled?: boolean;
  onAnswer: (answer: string) => Promise<void>;
  accessibilityActions?: ViewProps["accessibilityActions"];
  onAccessibilityAction?: ViewProps["onAccessibilityAction"];
}) {
  const { t } = useI18n();
  const tokens = mobileTokens();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const submitting = pendingAction !== null;
  const labels = consent ? CONSENT_ASK_ACTION_LABELS : KNOWN_ASK_ACTION_LABELS;

  async function submit(answer: string) {
    if (disabled || submitting) return;
    setPendingAction(answer);
    try {
      await onAnswer(answer);
    } catch (error) {
      Alert.alert(t("Could not submit answer"), errorText(error, t("Please try again.")));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <View style={{ marginTop: 12, gap: 6 }}>
      {!consent &&
      actions.some((action) => action.id === "always" && action.label !== ACCESS_ALWAYS_LABEL) ? (
        <Text style={{ color: tokens.mutedForeground, fontSize: 12.5 }}>
          {t("Won't ask again anywhere in this space.")}
        </Text>
      ) : null}
      {actions.map((action) => {
        const emphasized = action.id === "allow" || action.id === "always";
        return (
          <Pressable
            accessibilityRole="button"
            key={action.id}
            accessibilityActions={accessibilityActions}
            onAccessibilityAction={onAccessibilityAction}
            disabled={disabled || submitting}
            onPress={() => void submit(action.id)}
            style={{
              alignSelf: "stretch",
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: emphasized ? native.fillPressed : native.fill,
              opacity: disabled || submitting ? 0.5 : 1,
            }}
          >
            <Text
              style={{
                color: tokens.foreground,
                fontSize: 15,
                fontWeight: emphasized ? "600" : "400",
              }}
            >
              {pendingAction === action.id
                ? t("Sending…")
                : action.id === "allow" && action.label === RUN_ALLOW_LABEL
                  ? t(RUN_ALLOW_LABEL)
                  : Object.hasOwn(labels, action.id)
                    ? t(labels[action.id]!)
                    : action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
