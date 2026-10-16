import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { useThemedStyles } from "../lib/native";
import { createHomeStyles } from "./inbox-styles";
import { NativeSymbol } from "./native-symbol";

export function ConversationRow({
  title,
  preview,
  time,
  avatar,
  indicator,
  tag,
  unread,
  depth = 0,
  hasChildren = false,
  collapsed = false,
  onToggleChildren,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  preview: string;
  time: string;
  avatar: ReactNode;
  indicator?: ReactNode;
  tag?: string | null;
  unread?: boolean;
  depth?: number;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleChildren?: () => void;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const styles = useThemedStyles(createHomeStyles);
  const { t } = useI18n();
  const toggleLabel = collapsed
    ? t("Expand {name}", { name: title })
    : t("Collapse {name}", { name: title });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // Screen readers treat the row as one element, so the chevron is offered as a row action.
      accessibilityState={hasChildren ? { expanded: !collapsed } : undefined}
      accessibilityActions={
        hasChildren ? [{ name: "toggleChildren", label: toggleLabel }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "toggleChildren") onToggleChildren?.();
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        depth > 0 ? { paddingInlineStart: 16 + depth * 16 } : null,
        pressed && styles.rowPressed,
      ]}
    >
      {hasChildren ? (
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          hitSlop={8}
          onPress={onToggleChildren}
          style={styles.treeToggle}
        >
          <NativeSymbol
            ios={collapsed ? "chevron.right" : "chevron.down"}
            android={collapsed ? "chevron-forward" : "chevron-down"}
            size={14}
          />
        </Pressable>
      ) : null}
      {avatar}
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            {tag ? (
              <View style={styles.tag}>
                <Text style={styles.tagLabel} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.rowMeta}>
            {indicator}
            {time ? <Text style={styles.time}>{time}</Text> : null}
            {unread ? <View accessibilityElementsHidden style={styles.unreadDot} /> : null}
          </View>
        </View>
        <Text style={[styles.preview, unread && styles.unreadPreview]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
    </Pressable>
  );
}
