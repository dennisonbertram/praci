import type { DataRoomApiFolder, DataRoomApiItem } from "@rakazo/contracts";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeActionButton } from "../components/native-action-button";
import { NativeSymbol } from "../components/native-symbol";
import { currentApiBase, selectedSpaceId } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { dataRoomStatus, listDataRoomFolders, listDataRoomItems } from "../lib/data-room";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { currentSessionGeneration, subscribeSessionGeneration } from "../lib/session";
import { errorText } from "../lib/user-error";

export default function DataRoomScreen() {
  const { folderId } = useLocalSearchParams<{ folderId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [folders, setFolders] = useState<DataRoomApiFolder[]>([]);
  const [items, setItems] = useState<DataRoomApiItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [failedMore, setFailedMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  const more = useRef(false);
  const focusScope = useRef("");
  const scope = () =>
    JSON.stringify([currentSessionGeneration(), currentApiBase(), selectedSpaceId()]);
  const title = folders.find((folder) => folder.id === folderId)?.name ?? t("Data room");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerSearchBarOptions:
        Platform.OS === "ios"
          ? {
              placeholder: t("Search files"),
              hideWhenScrolling: false,
              autoCapitalize: "none",
              onChangeText: (event: { nativeEvent: { text: string } }) =>
                setQuery(event.nativeEvent.text.slice(0, 500)),
              onCancelButtonPress: () => setQuery(""),
              onClose: () => setQuery(""),
            }
          : undefined,
    });
  }, [navigation, title, t]);

  const load = useCallback(
    async (refresh = false) => {
      const request = ++generation.current;
      const started = scope();
      focusScope.current = started;
      more.current = false;
      setLoadingMore(false);
      setError("");
      setFailedMore(false);
      setRefreshing(refresh);
      if (!refresh) {
        setItems(null);
        setFolders([]);
        setCursor(null);
      }
      try {
        const [nextFolders, page] = await Promise.all([
          listDataRoomFolders(),
          listDataRoomItems({ folderId, query: search }),
        ]);
        if (request !== generation.current || started !== scope()) return;
        setFolders(nextFolders);
        setItems(page.items);
        setCursor(page.nextCursor);
      } catch (cause) {
        if (request === generation.current && started === scope()) {
          setError(errorText(cause, t("Could not load files.")));
          if (!refresh) setItems([]);
        }
      } finally {
        if (request === generation.current) setRefreshing(false);
      }
    },
    [folderId, search, t],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        generation.current += 1;
      };
    }, [load]),
  );

  useEffect(
    () =>
      subscribeSessionGeneration(() => {
        generation.current += 1;
        setItems(null);
        setFolders([]);
        setCursor(null);
        setRefreshing(false);
        setLoadingMore(false);
        setError(t("The session changed. Open the file again."));
      }),
    [t],
  );

  async function loadMore() {
    if (!cursor || more.current || focusScope.current !== scope()) return;
    const request = generation.current;
    const started = scope();
    more.current = true;
    setLoadingMore(true);
    setError("");
    try {
      const page = await listDataRoomItems({ folderId, query: search, cursor });
      if (request !== generation.current || started !== scope()) return;
      setItems((previous) => [
        ...new Map([...(previous ?? []), ...page.items].map((item) => [item.id, item])).values(),
      ]);
      setCursor(page.nextCursor);
    } catch (cause) {
      if (request === generation.current && started === scope()) {
        setFailedMore(true);
        setError(errorText(cause, t("Could not load files.")));
      }
    } finally {
      if (request === generation.current) {
        more.current = false;
        setLoadingMore(false);
      }
    }
  }

  const children = search ? [] : folders.filter((folder) => folder.parentId === (folderId ?? null));
  return (
    <View style={styles.screen}>
      {Platform.OS !== "ios" ? (
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel={t("Search files")}
            placeholder={t("Search files")}
            placeholderTextColor={native.secondaryLabel}
            selectionColor={native.label}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={500}
            style={styles.searchInput}
          />
          {query ? (
            <NativeActionButton
              label={t("Clear")}
              accessibilityLabel={t("Clear search")}
              prominence="plain"
              size="compact"
              onPress={() => setQuery("")}
            />
          ) : null}
        </View>
      ) : null}
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
        ListHeaderComponent={
          children.length ? (
            <View>
              {children.map((folder) => (
                <Pressable
                  key={folder.id}
                  accessibilityRole="button"
                  accessibilityLabel={folder.name}
                  onPress={() =>
                    router.push({ pathname: "/data-room", params: { folderId: folder.id } })
                  }
                  style={styles.row}
                >
                  <NativeSymbol ios="folder" android="folder-outline" size={24} />
                  <Text style={styles.name}>{folder.name}</Text>
                  <NativeSymbol ios="chevron.right" android="chevron-forward" size={16} />
                </Pressable>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() =>
              router.push({ pathname: "/data-room-item", params: { itemId: item.id } })
            }
            style={styles.row}
          >
            <NativeSymbol ios="doc" android="document-outline" size={24} />
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[styles.status, item.status === "failed" && styles.failed]}>
                {dataRoomStatus(item)}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          items === null ? (
            <ActivityIndicator style={styles.centered} />
          ) : !error ? (
            <Text style={styles.empty}>{search ? t("No matching files") : t("No files")}</Text>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {error ? (
              <>
                <Text style={styles.failed}>{error}</Text>
                <NativeActionButton
                  label={t("Retry")}
                  prominence="quiet"
                  onPress={() => void (failedMore ? loadMore() : load())}
                />
              </>
            ) : null}
            {loadingMore ? (
              <ActivityIndicator />
            ) : cursor && !error ? (
              <NativeActionButton
                label={t("Load more")}
                prominence="quiet"
                onPress={() => void loadMore()}
              />
            ) : null}
          </View>
        }
      />
    </View>
  );
}

function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20 },
    searchInput: { flex: 1, minHeight: 48, color: native.label, fontSize: 16 },
    list: { paddingBottom: 32 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: native.separator,
    },
    body: { flex: 1, gap: 4 },
    name: { flex: 1, color: native.label, fontSize: 16 },
    status: { color: native.secondaryLabel, fontSize: 12 },
    failed: { color: tokens.destructive, fontSize: 14 },
    centered: { padding: 32 },
    empty: { padding: 24, color: native.secondaryLabel, textAlign: "center" },
    footer: { padding: 20, gap: 12, alignItems: "center" },
  });
}
