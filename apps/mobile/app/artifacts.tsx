import { mimeBadgeLabel } from "@rakazo/core";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BotAvatar } from "../components/bot-avatar";
import { NativeSymbol } from "../components/native-symbol";
import { formatActivityRelativeTime } from "../lib/activity";
import type { MobileBot } from "../lib/api";
import {
  currentApiBase,
  currentSpaceSelectionGeneration,
  rpc,
  subscribeApiBase,
  subscribeSpaceSelection,
} from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import type { MobileArtifactSummary } from "../lib/artifacts";
import { listSpaceArtifacts, removeArtifact } from "../lib/artifacts";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { currentSessionGeneration, subscribeSessionGeneration } from "../lib/session";
import { errorText } from "../lib/user-error";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

export default function ArtifactsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const session = useSyncExternalStore(subscribeSessionGeneration, currentSessionGeneration);
  const endpoint = useSyncExternalStore(subscribeApiBase, currentApiBase);
  const selection = useSyncExternalStore(subscribeSpaceSelection, currentSpaceSelectionGeneration);

  const [bots, setBots] = useState<MobileBot[]>([]);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [items, setItems] = useState<MobileArtifactSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [listedQuery, setListedQuery] = useState<string | null>("");
  const [searchPageFailed, setSearchPageFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const loadingMoreRef = useRef(false);
  const generationRef = useRef(0);
  const botsGenerationRef = useRef(0);
  const contextRef = useRef({ session, endpoint, selection });
  const autoFetchedCursorRef = useRef<string | null>(null);
  const activeBotIdRef = useRef(activeBotId);
  const settledQueryRef = useRef(settledQuery);
  const didFocusRef = useRef(false);
  activeBotIdRef.current = activeBotId;
  settledQueryRef.current = settledQuery;

  useEffect(() => {
    const timeout = setTimeout(() => setSettledQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: t("Search artifacts…"),
        hideWhenScrolling: false,
        autoCapitalize: "none",
        onChangeText: (event: { nativeEvent: { text: string } }) =>
          setQuery(event.nativeEvent.text),
        onCancelButtonPress: () => setQuery(""),
        onClose: () => setQuery(""),
      },
    });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      const generation = ++botsGenerationRef.current;
      rpc<MobileBot[]>("bots/list")
        .then((nextBots) => {
          if (generation === botsGenerationRef.current) setBots(nextBots);
        })
        .catch(() => undefined);
    }, []),
  );

  useEffect(() => {
    const previous = contextRef.current;
    contextRef.current = { session, endpoint, selection };
    if (
      previous.session === session &&
      previous.endpoint === endpoint &&
      previous.selection === selection
    )
      return;

    const generation = ++botsGenerationRef.current;
    setActiveBotId(null);
    setBots([]);
    rpc<MobileBot[]>("bots/list")
      .then((nextBots) => {
        if (generation === botsGenerationRef.current) setBots(nextBots);
      })
      .catch(() => undefined);
  }, [endpoint, selection, session]);

  const load = useCallback(
    async (botId: string | null, mode: "replace" | "refresh", q: string) => {
      const generation = ++generationRef.current;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      autoFetchedCursorRef.current = null;
      setSearchPageFailed(false);
      setLoadError(null);
      if (mode === "replace") {
        setItems(null);
        setNextCursor(null);
        setListedQuery(q);
      }
      try {
        const page = await listSpaceArtifacts({
          botId: botId ?? undefined,
          q: q || undefined,
          limit: PAGE_SIZE,
        });
        if (generation !== generationRef.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setListedQuery(q);
      } catch (error) {
        if (generation !== generationRef.current) return undefined;
        if (mode === "replace") {
          setLoadError(errorText(error, t("Could not load artifacts.")));
        }
        return error;
      }
      return undefined;
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      if (!didFocusRef.current) {
        didFocusRef.current = true;
        return;
      }
      void load(activeBotIdRef.current, "refresh", settledQueryRef.current);
    }, [load]),
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    const generation = generationRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setSearchPageFailed(false);
    try {
      const page = await listSpaceArtifacts({
        botId: activeBotId ?? undefined,
        cursor: nextCursor,
        limit: PAGE_SIZE,
        q: settledQuery || undefined,
      });
      if (generation !== generationRef.current) return;
      setItems((current) => (current ?? []).concat(page.items));
      setNextCursor(page.nextCursor);
      setSearchPageFailed(false);
    } catch {
      if (generation === generationRef.current) setSearchPageFailed(true);
    } finally {
      if (generation === generationRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [activeBotId, nextCursor, settledQuery]);

  async function refresh() {
    setRefreshing(true);
    try {
      const error = await load(activeBotId, "refresh", settledQuery);
      if (error !== undefined)
        Alert.alert(t("Could not load artifacts."), errorText(error, t("Try again.")));
    } finally {
      setRefreshing(false);
    }
  }

  function confirmDelete(item: MobileArtifactSummary) {
    Alert.alert(
      t('Delete "{name}"?', { name: item.name }),
      item.versionCount > 1
        ? t("This deletes all {count} versions of this artifact. This can't be undone.", {
            count: item.versionCount,
          })
        : t("This can't be undone."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: () =>
            void removeArtifact(item.id)
              .then(() =>
                setItems((current) => current?.filter((row) => row.id !== item.id) ?? current),
              )
              .catch((error: unknown) =>
                Alert.alert(t("Could not delete this artifact"), errorText(error, t("Try again."))),
              ),
        },
      ],
    );
  }

  const queryActive = settledQuery.length > 0;
  const queryPending = query.trim() !== settledQuery || listedQuery !== settledQuery;
  const filtered = queryPending ? null : items;
  const botsById = useMemo(() => new Map(bots.map((bot) => [bot.id, bot])), [bots]);

  useEffect(() => {
    autoFetchedCursorRef.current = null;
    setSearchPageFailed(false);
  }, [settledQuery, activeBotId]);

  useEffect(() => {
    if (
      searchPageFailed ||
      !queryActive ||
      !nextCursor ||
      loadingMore ||
      items === null ||
      queryPending
    )
      return;
    if (filtered && filtered.length > 0) return;
    if (autoFetchedCursorRef.current === nextCursor) return;
    autoFetchedCursorRef.current = nextCursor;
    void loadMore();
  }, [
    filtered,
    items,
    loadMore,
    loadingMore,
    nextCursor,
    queryActive,
    queryPending,
    searchPageFailed,
  ]);

  useEffect(() => {
    void load(activeBotId, "replace", settledQuery);
  }, [activeBotId, endpoint, load, selection, session, settledQuery, reloadKey]);

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <FlatList<MobileArtifactSummary>
        ListHeaderComponent={
          <ScrollView
            horizontal
            contentInsetAdjustmentBehavior="never"
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            <Chip
              label={t("All bots")}
              active={activeBotId === null}
              onPress={() => setActiveBotId(null)}
            />
            {bots.map((bot) => (
              <Chip
                key={bot.id}
                label={bot.name}
                active={activeBotId === bot.id}
                onPress={() => setActiveBotId(bot.id)}
                avatar={<BotAvatar color={bot.color} identity={bot.id} size={16} />}
              />
            ))}
          </ScrollView>
        }
        style={styles.listView}
        contentInsetAdjustmentBehavior="automatic"
        data={filtered ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        indicatorStyle="default"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={native.secondaryLabel}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadMore()}
        ListEmptyComponent={
          queryPending ? (
            <View style={styles.centered}>
              <ActivityIndicator color={native.secondaryLabel} />
            </View>
          ) : items === null ? (
            <View style={styles.centered}>
              {loadError ? (
                <>
                  <Text style={styles.empty}>{loadError}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setReloadKey((value) => value + 1)}
                    style={styles.retry}
                  >
                    <Text style={styles.empty}>{t("Try again.")}</Text>
                  </Pressable>
                </>
              ) : (
                <ActivityIndicator color={native.secondaryLabel} />
              )}
            </View>
          ) : queryActive &&
            filtered?.length === 0 &&
            nextCursor &&
            (loadingMore || autoFetchedCursorRef.current !== nextCursor) ? (
            <View style={styles.centered}>
              <ActivityIndicator color={native.secondaryLabel} />
            </View>
          ) : (
            <Text style={styles.empty}>
              {queryActive ? t("No matching artifacts") : t("No artifacts yet")}
            </Text>
          )
        }
        ListFooterComponent={
          searchPageFailed ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadMore()}
              style={styles.footer}
            >
              <Text style={styles.empty}>{t("Could not load artifacts.")}</Text>
              <Text style={styles.empty}>{t("Try again.")}</Text>
            </Pressable>
          ) : loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={native.secondaryLabel} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ArtifactRow
            item={item}
            bot={activeBotId === null && item.botId ? botsById.get(item.botId) : undefined}
            onPress={() =>
              router.push({
                pathname: "/artifact",
                params: { artifactId: item.id },
              })
            }
            onLongPress={() => confirmDelete(item)}
          />
        )}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  avatar,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  avatar?: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      {avatar}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ArtifactRow({
  item,
  bot,
  onPress,
  onLongPress,
}: {
  item: MobileArtifactSummary;
  bot?: MobileBot;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const isCode = item.mimeType === "text/html";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bot ? `${item.name}, ${bot.name}` : item.name}
      accessibilityHint={t("Long press to delete")}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <NativeSymbol
          ios={isCode ? "chevron.left.forwardslash.chevron.right" : "doc.text"}
          android={isCode ? "code-slash-outline" : "document-text-outline"}
          size={16}
        />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.versionCount > 1 ? <Text style={styles.badge}>{`v${item.version}`}</Text> : null}
          <Text style={styles.badge}>{mimeBadgeLabel(item.mimeType)}</Text>
        </View>
        {item.description ? (
          <Text style={styles.rowDescription} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.rowFooter}>
          {bot ? (
            <>
              <BotAvatar color={bot.color} identity={bot.id} size={14} />
              <Text style={styles.rowBotName} numberOfLines={1}>
                {bot.name}
              </Text>
            </>
          ) : null}
          <Text style={styles.rowMeta}>{formatActivityRelativeTime(item.createdAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    centered: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 40,
    },
    chipsScroll: { flexGrow: 0, flexShrink: 0 },
    chipsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexGrow: 0,
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      flexGrow: 0,
      flexShrink: 0,
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: native.fill,
    },
    chipActive: { backgroundColor: tokens.primary },
    chipLabel: { color: native.label, fontSize: 13, fontWeight: "600" },
    chipLabelActive: { color: tokens.primaryForeground },
    listView: { flex: 1 },
    list: { paddingBottom: 32 },
    empty: {
      color: native.secondaryLabel,
      fontSize: 15,
      textAlign: "center",
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    footer: { paddingVertical: 20 },
    retry: { paddingTop: 8 },
    row: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    rowPressed: { opacity: 0.6 },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: native.fill,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBody: { flex: 1, minWidth: 0, gap: 3 },
    rowTop: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowName: {
      flex: 1,
      minWidth: 0,
      color: native.label,
      fontSize: 15,
      fontWeight: "600",
    },
    badge: {
      color: native.secondaryLabel,
      fontSize: 10.5,
      fontWeight: "700",
      backgroundColor: native.fill,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      overflow: "hidden",
    },
    rowDescription: { color: native.secondaryLabel, fontSize: 12.5 },
    rowFooter: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowBotName: { flexShrink: 1, color: native.secondaryLabel, fontSize: 11.5 },
    rowMeta: { color: native.secondaryLabel, fontSize: 11.5 },
  });
}
