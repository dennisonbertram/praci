import { MenuView } from "@expo/ui/community/menu";
import type { SearchHit, SpaceBot, SpaceGroup } from "@rakazo/contracts";
import { memo, useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import type { MobileBot, MobileGroup } from "../lib/api";
import type { InboxSpace, InboxSpaceItem } from "../lib/inbox-spaces";
import { canDeleteInboxSpace, canRenameInboxSpace } from "../lib/inbox-spaces";
import { useThemedStyles } from "../lib/native";
import { searchHitRowPreview } from "../lib/search-list";
import { BotRow, GroupRow } from "./inbox-rows";
import { createHomeStyles } from "./inbox-styles";
import { NativeSymbol } from "./native-symbol";

export type InboxItem = InboxSpaceItem | { type: "search"; hit: SearchHit };

export const SearchRow = memo(function SearchRow({
  hit,
  onPress,
}: {
  hit: SearchHit;
  onPress: (hit: SearchHit) => void;
}) {
  const styles = useThemedStyles(createHomeStyles);
  return (
    <Pressable
      onPress={() => onPress(hit)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {hit.title}
          </Text>
          <Text style={styles.time}>{hit.kind}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={2}>
          {searchHitRowPreview(hit)}
        </Text>
      </View>
    </Pressable>
  );
});

type Callback<A extends unknown[]> = (...args: A) => void;

export type InboxRenderItemDeps = {
  appearance: "light" | "dark";
  chooseInboxSpace: (id: string) => unknown;
  collapsedRosterParents: ReadonlySet<string>;
  confirmDeleteSpace: (space: InboxSpace) => void;
  day: number;
  renameSpace: (space: InboxSpace) => void;
  meSpaceId: string | undefined;
  openBot: Callback<[MobileBot | SpaceBot]>;
  openGroup: Callback<[MobileGroup | SpaceGroup]>;
  openSearchHit: Callback<[SearchHit]>;
  organizeBot: Callback<[MobileBot | SpaceBot]>;
  organizeGroup: Callback<[MobileGroup | SpaceGroup]>;
  spaceBusy: boolean;
  spaceRecoveryId: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: the screen's themed style sheet
  styles: Record<string, any>;
  t: (message: string, values?: Record<string, string | number>) => string;
  toggleRosterParent: Callback<[string]>;
};

/** The inbox list's row renderer; stable between renders unless one of its inputs changes. */
export function useInboxRenderItem({
  appearance,
  chooseInboxSpace,
  collapsedRosterParents,
  confirmDeleteSpace,
  day,
  renameSpace,
  meSpaceId,
  openBot,
  openGroup,
  openSearchHit,
  organizeBot,
  organizeGroup,
  spaceBusy,
  spaceRecoveryId,
  styles,
  t,
  toggleRosterParent,
}: InboxRenderItemDeps) {
  return useCallback(
    ({ item }: { item: InboxItem }) =>
      item.type === "search" ? (
        <SearchRow hit={item.hit} onPress={openSearchHit} />
      ) : item.type === "heading" ? (
        item.space ? (
          <View style={styles.spaceHeading}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityState={{
                selected: item.space.id === meSpaceId,
                disabled: spaceBusy,
              }}
              disabled={spaceBusy}
              onPress={() => {
                if (item.space) void chooseInboxSpace(item.space.id);
              }}
              style={({ pressed }) => [styles.spaceSelect, pressed && styles.rowPressed]}
            >
              <Text style={styles.spaceTitle}>{item.title}</Text>
            </Pressable>
            {canDeleteInboxSpace(item.space) || canRenameInboxSpace(item.space) ? (
              <MenuView
                actions={[
                  ...(canRenameInboxSpace(item.space)
                    ? [
                        {
                          id: "rename",
                          title: t("Rename space"),
                          image: "pencil" as const,
                          attributes: { disabled: spaceBusy || !!spaceRecoveryId },
                        },
                      ]
                    : []),
                  ...(canDeleteInboxSpace(item.space)
                    ? [
                        {
                          id: "delete",
                          title: t("Delete space"),
                          image: "trash" as const,
                          attributes: {
                            destructive: true,
                            disabled: spaceBusy || !!spaceRecoveryId,
                          },
                        },
                      ]
                    : []),
                ]}
                colorScheme={appearance}
                onPressAction={({ nativeEvent }) => {
                  if (!item.space) return;
                  if (nativeEvent.event === "rename") renameSpace(item.space);
                  else confirmDeleteSpace(item.space);
                }}
              >
                <View
                  accessibilityLabel={t("Space actions for {name}", { name: item.title })}
                  accessibilityRole="button"
                  style={styles.spaceActions}
                >
                  <NativeSymbol ios="ellipsis" android="ellipsis-horizontal" size={20} />
                </View>
              </MenuView>
            ) : null}
          </View>
        ) : item.kind === "folder" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: !item.collapsed }}
            onPress={() => toggleRosterParent(item.key)}
          >
            <Text style={styles.sectionHeading}>{item.title}</Text>
          </Pressable>
        ) : (
          <Text style={styles.sectionHeading}>
            {item.kind === "pinned"
              ? t("Pinned")
              : item.kind === "unassigned"
                ? t("Unassigned")
                : item.title}
          </Text>
        )
      ) : item.type === "group" ? (
        <GroupRow
          group={item.group}
          day={day}
          onPress={openGroup}
          onLongPress={item.group.spaceId === meSpaceId ? organizeGroup : undefined}
        />
      ) : (
        <BotRow
          bot={item.bot}
          day={day}
          depth={item.depth}
          hasChildren={item.hasChildren}
          collapsed={collapsedRosterParents.has(item.bot.id)}
          onToggleChildren={toggleRosterParent}
          onPress={openBot}
          onLongPress={item.bot.spaceId === meSpaceId ? organizeBot : undefined}
        />
      ),
    [
      appearance,
      chooseInboxSpace,
      collapsedRosterParents,
      confirmDeleteSpace,
      day,
      renameSpace,
      meSpaceId,
      openBot,
      openGroup,
      openSearchHit,
      organizeBot,
      organizeGroup,
      spaceBusy,
      spaceRecoveryId,
      styles,
      t,
      toggleRosterParent,
    ],
  );
}
