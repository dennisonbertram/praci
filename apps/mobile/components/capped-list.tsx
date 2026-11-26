import type { ReactNode } from "react";
import { useState } from "react";
import { FlatList, Modal, Pressable, SafeAreaView, Text, TextInput, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { capItems, searchItems } from "../lib/capped-list";
import { useI18n } from "../lib/i18n";
import { NativeSegmentedControl } from "./native-segmented-control";

type Filter<T> = {
  label: string;
  options: { value: string; label: string }[];
  apply: (items: readonly T[], value: string) => readonly T[];
};

type Props<T> = {
  items: readonly T[];
  title: string;
  keyOf: (item: T) => string;
  searchFields: (item: T) => string[];
  renderItem: (item: T) => ReactNode;
  /** Optional segmented filter in the sheet; the first option is the default. */
  filter?: Filter<T>;
  /** The screen's current action error; the sheet covers the screen, so it shows it too. */
  error?: string | null;
};

/** Shows the first three rows inline; "See all (N)" opens a sheet with search and the filter. */
export function CappedList<T>(props: Props<T>) {
  const { t } = useI18n();
  const tokens = mobileTokens();
  const [open, setOpen] = useState(false);
  // Inline rows load their own state; remounting them after the sheet closes refreshes it.
  const [generation, setGeneration] = useState(0);
  const { shown, total, capped } = capItems(props.items);
  return (
    <>
      {shown.map((item) => (
        <View key={`${props.keyOf(item)}:${generation}`}>{props.renderItem(item)}</View>
      ))}
      {capped ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("See all ({count})", { count: total })}
          onPress={() => setOpen(true)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: tokens.primary, fontSize: 15 }}>
            {t("See all ({count})", { count: total })}
          </Text>
        </Pressable>
      ) : null}
      {open ? (
        <CappedListSheet
          {...props}
          onClose={() => {
            setOpen(false);
            setGeneration((n) => n + 1);
          }}
        />
      ) : null}
    </>
  );
}

// Its own component so the sheet's native views are only touched once it opens.
function CappedListSheet<T>({
  items,
  title,
  keyOf,
  searchFields,
  renderItem,
  filter,
  error,
  onClose,
}: Props<T> & { onClose: () => void }) {
  const { t } = useI18n();
  const tokens = mobileTokens();
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState(filter?.options[0]?.value ?? "");
  const results = searchItems(
    filter ? filter.apply(items, filterValue) : items,
    query,
    searchFields,
  );
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: tokens.foreground, fontSize: 17, fontWeight: "600" }}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Done")}
              onPress={onClose}
              style={{ flexShrink: 0 }}
            >
              <Text style={{ color: tokens.primary, fontSize: 17 }}>{t("Done")}</Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel={t("Search")}
            placeholder={t("Search")}
            placeholderTextColor={tokens.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            style={{
              color: tokens.foreground,
              backgroundColor: tokens.accent,
              borderRadius: 10,
              paddingHorizontal: 12,
              minHeight: 40,
            }}
          />
          {filter ? (
            <NativeSegmentedControl
              accessibilityLabel={filter.label}
              value={filterValue}
              onChange={setFilterValue}
              options={filter.options}
            />
          ) : null}
          {error ? <Text style={{ color: tokens.destructive, fontSize: 14 }}>{error}</Text> : null}
        </View>
        <FlatList
          automaticallyAdjustKeyboardInsets
          data={results}
          keyExtractor={keyOf}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => <>{renderItem(item)}</>}
        />
      </SafeAreaView>
    </Modal>
  );
}
