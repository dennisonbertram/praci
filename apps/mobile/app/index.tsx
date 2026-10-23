import { MenuView } from "@expo/ui/community/menu";
import type { RunActivityRow, SearchHit, SpaceBot, SpaceGroup } from "@rakazo/contracts";
import { normalizeCreateBotProfile } from "@rakazo/contracts";
import { Redirect, useFocusEffect, useNavigation, useRouter } from "expo-router";
import type { ReactNode } from "react";
import {
  memo,
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
  AppState,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BotAvatar } from "../components/bot-avatar";
import { BotOrganizeModal } from "../components/bot-organize-modal";
import { ConversationRow } from "../components/conversation-row";
import type { InboxItem } from "../components/inbox-render-item";
import { useInboxRenderItem } from "../components/inbox-render-item";
import { BotRow, FALLBACK_COLOR, GroupRow } from "../components/inbox-rows";
import { createHomeStyles } from "../components/inbox-styles";
import { NativeSymbol } from "../components/native-symbol";
import {
  activityStatusLabel,
  fetchSpaceActivity,
  formatActivityRelativeTime,
} from "../lib/activity";
import { loadActivityMode, saveActivityMode } from "../lib/activity-mode";
import type {
  MobileBot,
  MobileBotSection,
  MobileGroup,
  MobileMe,
  MobileSpace,
  MobileSpaceNavigation,
} from "../lib/api";
import {
  currentApiBase,
  loadSessionToken,
  rpc,
  selectedSpaceId,
  selectInitialSpace,
  selectSpace,
} from "../lib/api";
import { mobileTokens, resolveMobileAppearance } from "../lib/appearance";
import { t, useI18n } from "../lib/i18n";
import { filterBots, userInitials } from "../lib/inbox";
import { retainInboxValue } from "../lib/inbox-retention";
import type { InboxSpace, InboxSpaceItem } from "../lib/inbox-spaces";
import {
  canDeleteInboxSpace,
  inboxNeedsCreateHint,
  removeInboxSpace,
  renameInboxSpace,
  retryInboxSpaceFallback,
  selectInboxSpace,
  spaceInboxItems,
} from "../lib/inbox-spaces";
import { dismissThreadNotifications, resumeLiveNotifications } from "../lib/live-notifications";
import { native, useThemedStyles } from "../lib/native";
import { iosAtLeast } from "../lib/native-controls";
import { registerPushToken } from "../lib/push";
import { loadSavedInbox, saveInbox } from "../lib/saved-chats";
import { querySpaceSearch } from "../lib/search";
import { mobileSearchDestination } from "../lib/search-destination";
import { dedupeSearchHits, searchHitListKey, searchHitRowPreview } from "../lib/search-list";
import {
  currentReadySessionGeneration,
  currentSessionGeneration,
  subscribeSessionGeneration,
} from "../lib/session";
import { reportTimezone } from "../lib/timezone";
import { refreshUnseenCounts, useUnseenCount } from "../lib/unseen-notifications";
import { useInboxDay } from "../lib/use-inbox-day";
import { errorText } from "../lib/user-error";

async function openMobileSpace(spaceId: string | undefined, open: () => void) {
  if (spaceId && !(await selectSpace(spaceId))) {
    Alert.alert(t("Could not switch spaces"), t("Try again."));
    return;
  }
  open();
}

export default function HomeSession() {
  const generation = useSyncExternalStore(subscribeSessionGeneration, currentSessionGeneration);
  const ready = useSyncExternalStore(subscribeSessionGeneration, currentReadySessionGeneration);
  return <Home key={`${generation}:${ready}`} />;
}

function Home() {
  const tokens = mobileTokens();
  const appearance = resolveMobileAppearance();
  const styles = useThemedStyles(createHomeStyles);
  const { t, locale } = useI18n();
  const day = useInboxDay();
  const [bots, setBots] = useState<MobileBot[]>([]);
  const [groups, setGroups] = useState<MobileGroup[]>([]);
  const [botSections, setBotSections] = useState<MobileBotSection[]>([]);
  const [spaces, setSpaces] = useState<MobileSpace[]>([]);
  const [me, setMe] = useState<Pick<MobileMe, "userId" | "spaceId" | "name"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [organizeTarget, setOrganizeTarget] = useState<{
    kind: "bot" | "group";
    id: string;
  } | null>(null);
  const [activityMode, setActivityMode] = useState(false);
  const [activity, setActivity] = useState<{ active: RunActivityRow[]; recent: RunActivityRow[] }>({
    active: [],
    recent: [],
  });
  const activityRequestId = useRef(0);
  const inboxRequestId = useRef(0);
  const inboxLoaded = useRef(false);
  const creatingBotRef = useRef(false);
  const spaceActionRef = useRef<{ busy: boolean; recoveryId: string | null }>({
    busy: false,
    recoveryId: null,
  });
  const [spaceBusy, setSpaceBusy] = useState(false);
  const [spaceRecoveryId, setSpaceRecoveryId] = useState<string | null>(null);
  const [collapsedRosterParents, setCollapsedRosterParents] = useState(() => new Set<string>());
  const toggleRosterParent = useCallback((botId: string) => {
    setCollapsedRosterParents((previous) => {
      const next = new Set(previous);
      if (next.has(botId)) next.delete(botId);
      else next.add(botId);
      return next;
    });
  }, []);

  useEffect(() => {
    void loadActivityMode().then(setActivityMode);
  }, []);

  const toggleActivityMode = useCallback(() => {
    setActivityMode((on) => {
      const next = !on;
      void saveActivityMode(next);
      return next;
    });
  }, []);

  const loadBots = useCallback(async () => {
    if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
    const requestId = ++inboxRequestId.current;
    const apiBase = currentApiBase();
    const generation = currentSessionGeneration();
    setError(null);
    try {
      const [navigation, nextMe] = await Promise.all([
        rpc<MobileSpaceNavigation>("spaces/list"),
        rpc<MobileMe>("me"),
      ]);
      if (
        requestId !== inboxRequestId.current ||
        generation !== currentSessionGeneration() ||
        apiBase !== currentApiBase()
      )
        return;
      if (!(await selectInitialSpace(nextMe.spaceId))) {
        throw new Error(t("Could not save the default space"));
      }
      if (
        requestId !== inboxRequestId.current ||
        generation !== currentSessionGeneration() ||
        apiBase !== currentApiBase()
      )
        return;
      setBots((current) => retainInboxValue(current, navigation.current.bots));
      setBotSections((current) => retainInboxValue(current, navigation.current.botSections));
      setGroups((current) => retainInboxValue(current, navigation.current.groups));
      setSpaces((current) => retainInboxValue(current, navigation.spaces));
      setMe((current) => retainInboxValue(current, nextMe));
      inboxLoaded.current = true;
      saveInbox(
        {
          apiBase,
          userId: nextMe.userId,
          spaceId: navigation.current.id,
          sessionGeneration: generation,
          selectionId: selectedSpaceId(),
        },
        navigation,
        nextMe,
      );
    } catch (err) {
      if (
        requestId !== inboxRequestId.current ||
        generation !== currentSessionGeneration() ||
        apiBase !== currentApiBase()
      )
        return;
      setError(errorText(err, t("Could not load bots")));
    }
  }, []);

  const refreshBots = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBots();
    } finally {
      setRefreshing(false);
    }
  }, [loadBots]);

  useEffect(() => {
    void loadSessionToken().then((token) => {
      setHasSession(Boolean(token));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!hasSession) return;
    void registerPushToken().catch(() => undefined);
    void reportTimezone().catch(() => undefined);
  }, [hasSession]);

  // Show the inbox saved on this device until the first live load replaces it.
  useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    void loadSavedInbox().then((saved) => {
      if (cancelled || !saved || inboxLoaded.current) return;
      setBots(saved.bots);
      setBotSections(saved.botSections);
      setGroups(saved.groups);
      setSpaces(saved.spaces);
      setMe(saved.me);
    });
    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  useFocusEffect(
    useCallback(() => {
      if (!hasSession) return;
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tick = async () => {
        if (AppState.currentState === "active") {
          void refreshUnseenCounts();
          await loadBots();
        }
        if (!cancelled) timer = setTimeout(() => void tick(), 5_000);
      };
      void tick();
      return () => {
        cancelled = true;
        if (timer !== undefined) clearTimeout(timer);
      };
    }, [hasSession, loadBots]),
  );

  const loadActivity = useCallback(async () => {
    if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
    if (!hasSession || !activityMode || searching || query.trim()) {
      activityRequestId.current += 1;
      setActivity({ active: [], recent: [] });
      return;
    }
    const requestId = ++activityRequestId.current;
    try {
      const next = await fetchSpaceActivity();
      if (requestId !== activityRequestId.current) return;
      setActivity(next);
    } catch {
      // Keep the last good snapshot on transient RPC failures; only drop stale responses.
      if (requestId !== activityRequestId.current) return;
    }
  }, [activityMode, hasSession, query, searching]);

  useFocusEffect(
    useCallback(() => {
      if (!hasSession || !activityMode || searching || query.trim()) return;
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const tick = async () => {
        await loadActivity();
        if (!cancelled) {
          timer = setTimeout(() => void tick(), 15_000);
        }
      };

      void tick();
      return () => {
        cancelled = true;
        activityRequestId.current += 1;
        if (timer !== undefined) clearTimeout(timer);
      };
    }, [activityMode, hasSession, loadActivity, query, searching]),
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!searching || !trimmed) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setSearchLoading(true);
      void querySpaceSearch(trimmed)
        .then((hits) => {
          if (!abort.signal.aborted) setSearchHits(hits);
        })
        .catch(() => {
          if (!abort.signal.aborted) setSearchHits([]);
        })
        .finally(() => {
          if (!abort.signal.aborted) setSearchLoading(false);
        });
    }, 200);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [query, searching]);

  const visible = useMemo(() => filterBots(bots, query), [bots, query]);
  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((group) =>
      `${group.name} ${group.preview}`.toLowerCase().includes(needle),
    );
  }, [groups, query]);
  const listData = useMemo((): InboxItem[] => {
    if (query.trim() && searching) {
      return dedupeSearchHits(searchHits).map((hit) => ({ type: "search" as const, hit }));
    }
    const sidebarSpaces =
      spaces.length > 0
        ? spaces.map((space) =>
            space.id === me?.spaceId
              ? { ...space, bots: visible, groups: visibleGroups, botSections }
              : {
                  ...space,
                  bots: filterBots(space.bots, query),
                  groups: space.groups.filter((group) =>
                    `${group.name} ${group.preview}`
                      .toLowerCase()
                      .includes(query.trim().toLowerCase()),
                  ),
                },
          )
        : me
          ? [
              {
                id: me.spaceId,
                name: t("Personal"),
                isDefault: true,
                hasContent: true,
                bots: visible,
                groups: visibleGroups,
                botSections,
              },
            ]
          : [];
    return spaceInboxItems(sidebarSpaces, collapsedRosterParents);
  }, [
    botSections,
    collapsedRosterParents,
    locale,
    me,
    spaces,
    query,
    searching,
    searchHits,
    visible,
    visibleGroups,
  ]);
  const initials = userInitials(me?.name ?? "");
  const organizeChat = organizeTarget
    ? organizeTarget.kind === "bot"
      ? bots.find((bot) => bot.id === organizeTarget.id)
      : groups.find((group) => group.id === organizeTarget.id)
    : null;
  const insets = useSafeAreaInsets();
  // Liquid Glass uses the native bar: glass bar items, a native menu, and bottom search.
  const nativeHeader = iosAtLeast(26);
  const navigation = useNavigation();
  const router = useRouter();

  const chooseInboxSpace = useCallback(
    async (spaceId: string) => {
      if (spaceActionRef.current.busy) return;
      spaceActionRef.current.busy = true;
      setSpaceBusy(true);
      inboxRequestId.current += 1;
      activityRequestId.current += 1;
      setActivity({ active: [], recent: [] });
      try {
        const refresh = async () => {
          spaceActionRef.current.recoveryId = null;
          setSpaceRecoveryId(null);
          spaceActionRef.current.busy = false;
          await refreshBots();
          await loadActivity();
        };
        const selected =
          spaceActionRef.current.recoveryId === spaceId
            ? await retryInboxSpaceFallback(spaceId, refresh)
            : await selectInboxSpace(spaceId, refresh);
        if (!selected) throw new Error(t("Could not switch spaces"));
      } catch (err) {
        const message = errorText(err, t("Could not switch spaces"));
        setError(message);
        Alert.alert(message, t("Try again."));
      } finally {
        spaceActionRef.current.busy = false;
        setSpaceBusy(false);
      }
    },
    [refreshBots, loadActivity, t],
  );

  const deleteInboxSpace = useCallback(
    async (space: InboxSpace) => {
      if (
        !canDeleteInboxSpace(space) ||
        spaceActionRef.current.busy ||
        spaceActionRef.current.recoveryId
      )
        return;
      spaceActionRef.current.busy = true;
      setSpaceBusy(true);
      inboxRequestId.current += 1;
      activityRequestId.current += 1;
      try {
        const recoveryId = await removeInboxSpace(space.id, async () => {
          spaceActionRef.current.busy = false;
          setActivity({ active: [], recent: [] });
          await refreshBots();
          await loadActivity();
        });
        if (recoveryId) {
          spaceActionRef.current.recoveryId = recoveryId;
          setSpaceRecoveryId(recoveryId);
          setError(t("Could not switch spaces"));
        }
      } catch (err) {
        Alert.alert(t("Could not delete space"), errorText(err, t("Try again.")));
      } finally {
        spaceActionRef.current.busy = false;
        setSpaceBusy(false);
      }
    },
    [refreshBots, loadActivity, t],
  );

  const confirmDeleteSpace = useCallback(
    (space: InboxSpace) => {
      if (
        !canDeleteInboxSpace(space) ||
        spaceActionRef.current.busy ||
        spaceActionRef.current.recoveryId
      )
        return;
      Alert.alert(
        t("Delete {name}?", { name: space.name }),
        t("This removes the empty space for everyone."),
        [
          { text: t("Cancel"), style: "cancel" },
          {
            text: t("Delete"),
            style: "destructive",
            onPress: () => void deleteInboxSpace(space),
          },
        ],
      );
    },
    [deleteInboxSpace, t],
  );

  const renameSpace = useCallback(
    (space: InboxSpace) => {
      if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
      if (Platform.OS !== "ios") {
        router.push({ pathname: "/new-space", params: { spaceId: space.id, name: space.name } });
        return;
      }
      Alert.prompt(
        t("Rename space"),
        undefined,
        [
          { text: t("Cancel"), style: "cancel" },
          {
            text: t("Rename"),
            onPress: (value?: string) => {
              renameInboxSpace(space.id, value ?? "", refreshBots).catch((err) =>
                Alert.alert(t("Could not rename space"), errorText(err, t("Try again."))),
              );
            },
          },
        ],
        "plain-text",
        space.name,
      );
    },
    [refreshBots, router, t],
  );

  const createQuickBot = useCallback(async () => {
    if (creatingBotRef.current || spaceActionRef.current.busy || spaceActionRef.current.recoveryId)
      return;
    creatingBotRef.current = true;
    try {
      const bot = await rpc<MobileBot>("bots/create", {
        ...normalizeCreateBotProfile({ name: "New Bot", title: "", description: "" }),
        notifyOnFinish: true,
        computerMode: "team",
      });
      void refreshBots().catch(() => undefined);
      router.push({ pathname: "/thread", params: { botId: bot.id, name: bot.name } });
    } catch (err) {
      setError(errorText(err, t("Could not create bot")));
    } finally {
      creatingBotRef.current = false;
    }
  }, [refreshBots, router, t]);

  const runCreateAction = useCallback(
    (action: "bot" | "group" | "space") => {
      if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
      if (action === "bot") void createQuickBot();
      else if (action === "group") router.push("/new-group");
      else router.push("/new-space");
    },
    [createQuickBot, router],
  );

  useLayoutEffect(() => {
    if (!nativeHeader) return;
    const signedIn = ready && hasSession;
    navigation.setOptions({
      headerShown: signedIn,
      headerTransparent: true,
      headerStyle: { backgroundColor: "transparent" },
      title: "",
      unstable_headerLeftItems: () => [
        {
          type: "button" as const,
          label: initials,
          labelStyle: { fontSize: 15, fontWeight: "600" },
          accessibilityLabel: t("Account"),
          onPress: () => router.push("/account"),
        },
      ],
      unstable_headerRightItems: () => [
        {
          type: "button" as const,
          accessibilityLabel: t("Activity"),
          icon: { type: "sfSymbol" as const, name: activityMode ? "bell.fill" : "bell" },
          selected: activityMode,
          onPress: toggleActivityMode,
        },
        {
          type: "button" as const,
          accessibilityLabel: t("Artifacts"),
          icon: { type: "sfSymbol" as const, name: "square.stack.3d.up" },
          onPress: () => router.push("/artifacts"),
        },
        {
          type: "button" as const,
          accessibilityLabel: t("Data room"),
          icon: { type: "sfSymbol" as const, name: "folder" },
          onPress: () => router.push("/data-room"),
        },
        {
          type: "menu" as const,
          accessibilityLabel: t("Create"),
          icon: { type: "sfSymbol" as const, name: "plus" },
          menu: {
            items: [
              {
                type: "action" as const,
                label: t("New bot"),
                icon: { type: "sfSymbol" as const, name: "person.crop.circle.badge.plus" },
                onPress: () => runCreateAction("bot"),
              },
              {
                type: "action" as const,
                label: t("New group"),
                icon: { type: "sfSymbol" as const, name: "person.2" },
                onPress: () => runCreateAction("group"),
              },
              {
                type: "action" as const,
                label: t("New space"),
                icon: { type: "sfSymbol" as const, name: "square.grid.2x2" },
                onPress: () => runCreateAction("space"),
              },
            ],
          },
        },
      ],
      headerSearchBarOptions: {
        placeholder: t("Search"),
        hideWhenScrolling: false,
        autoCapitalize: "none",
        onFocus: () => setSearching(true),
        onChangeText: (event: { nativeEvent: { text: string } }) =>
          setQuery(event.nativeEvent.text),
        onCancelButtonPress: () => {
          setSearching(false);
          setQuery("");
        },
      },
    });
  }, [
    nativeHeader,
    navigation,
    ready,
    hasSession,
    initials,
    activityMode,
    toggleActivityMode,
    runCreateAction,
    router,
    t,
    locale,
  ]);

  const openSearchHit = useCallback(
    (hit: SearchHit) => {
      setQuery("");
      setSearchHits([]);
      // Wait for the search keyboard to close before sizing the destination composer.
      void KeyboardController.dismiss().then(() => router.push(mobileSearchDestination(hit)));
    },
    [router],
  );
  const openBot = useCallback(
    (bot: MobileBot | SpaceBot) => {
      if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
      void openMobileSpace(bot.spaceId, () =>
        router.push({ pathname: "/thread", params: { botId: bot.id, name: bot.name } }),
      );
    },
    [router],
  );
  const openGroup = useCallback(
    (group: MobileGroup | SpaceGroup) => {
      if (spaceActionRef.current.busy || spaceActionRef.current.recoveryId) return;
      void openMobileSpace(group.spaceId, () =>
        router.push({ pathname: "/group-thread", params: { groupId: group.id, name: group.name } }),
      );
    },
    [router],
  );
  const organizeBot = useCallback((bot: MobileBot | SpaceBot) => {
    setOrganizeTarget({ kind: "bot", id: bot.id });
  }, []);
  const organizeGroup = useCallback((group: MobileGroup | SpaceGroup) => {
    setOrganizeTarget({ kind: "group", id: group.id });
  }, []);

  const renderItem = useInboxRenderItem({
    appearance,
    chooseInboxSpace,
    collapsedRosterParents,
    confirmDeleteSpace,
    renameSpace,
    day,
    meSpaceId: me?.spaceId,
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
  });

  if (!ready) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={native.secondaryLabel} />
      </View>
    );
  }
  if (!hasSession) return <Redirect href="/sign-in" />;

  return (
    <View style={styles.screen}>
      {nativeHeader ? null : (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
          <View style={styles.circleButton}>
            <HeaderButton accessibilityLabel={t("Account")} onPress={() => router.push("/account")}>
              <Text style={styles.profileInitials}>{initials}</Text>
            </HeaderButton>
          </View>
          <View style={styles.headerActions}>
            <HeaderButton
              accessibilityLabel={t("Activity")}
              active={activityMode}
              accent
              onPress={toggleActivityMode}
            >
              <NativeSymbol
                ios={activityMode ? "bell.fill" : "bell"}
                android={activityMode ? "notifications" : "notifications-outline"}
                size={17}
                color={activityMode ? tokens.primaryForeground : tokens.foreground}
              />
            </HeaderButton>
            <HeaderButton
              accessibilityLabel={t("Search")}
              active={searching}
              onPress={() =>
                setSearching((open) => {
                  if (open) setQuery("");
                  return !open;
                })
              }
            >
              <NativeSymbol ios="magnifyingglass" android="search" size={17} />
            </HeaderButton>
            <HeaderButton
              accessibilityLabel={t("Artifacts")}
              onPress={() => router.push("/artifacts")}
            >
              <NativeSymbol ios="square.stack.3d.up" android="layers-outline" size={17} />
            </HeaderButton>
            <HeaderButton
              accessibilityLabel={t("Data room")}
              onPress={() => router.push("/data-room")}
            >
              <NativeSymbol ios="folder" android="folder-outline" size={17} />
            </HeaderButton>
            <MenuView
              actions={[
                { id: "bot", title: t("New bot"), image: "person.crop.circle.badge.plus" },
                { id: "group", title: t("New group"), image: "person.2" },
                { id: "space", title: t("New space"), image: "square.grid.2x2" },
              ]}
              colorScheme={appearance}
              onPressAction={({ nativeEvent }) => {
                const action = nativeEvent.event;
                if (action === "bot" || action === "group" || action === "space") {
                  runCreateAction(action);
                }
              }}
            >
              <View
                accessibilityLabel={t("Create")}
                accessibilityRole="button"
                style={styles.headerButton}
              >
                <NativeSymbol ios="plus" android="add" size={18} />
              </View>
            </MenuView>
          </View>
        </View>
      )}

      <FlatList<InboxItem>
        style={{ flex: 1 }}
        data={listData}
        keyExtractor={(item) => {
          if (item.type === "heading") return `heading-${item.key}`;
          if (item.type === "bot") return item.bot.id;
          if (item.type === "group") return `group-${item.group.id}`;
          return searchHitListKey(item.hit);
        }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        indicatorStyle={appearance === "dark" ? "white" : "black"}
        contentContainerStyle={[
          styles.list,
          // iOS moves the active search bar to the bottom and removes the navigation inset.
          nativeHeader && searching ? { paddingTop: insets.top + 12 } : undefined,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshBots();
              void loadActivity();
            }}
            tintColor={native.secondaryLabel}
            colors={[tokens.mutedForeground]}
            progressBackgroundColor={tokens.muted}
          />
        }
        ListHeaderComponent={
          <>
            {searching && !nativeHeader ? (
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={t("Search")}
                placeholderTextColor={tokens.mutedForeground}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                keyboardAppearance={appearance}
                clearButtonMode="while-editing"
                style={styles.searchField}
              />
            ) : null}

            {!searching && !query.trim() ? (
              <MailInboxRow onPress={() => router.push("/inbox")} />
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {spaceRecoveryId ? (
              <Pressable
                accessibilityRole="button"
                disabled={spaceBusy}
                onPress={() => void chooseInboxSpace(spaceRecoveryId)}
                style={styles.recoveryAction}
              >
                <Text style={styles.spaceTitle}>{t("Try again.")}</Text>
              </Pressable>
            ) : null}
            {activityMode &&
            !searching &&
            !query.trim() &&
            (activity.active.length > 0 || activity.recent.length > 0) ? (
              <ActivitySection activity={activity} bots={bots} />
            ) : null}
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query.trim() && searching
              ? searchLoading
                ? t("Searching…")
                : t("No results")
              : query.trim()
                ? t("No matching bots")
                : searching
                  ? t("Search conversations, files, and routines")
                  : // Before any load (an offline launch with nothing saved) the bots are unknown.
                    me
                    ? t("Tap + to create a bot")
                    : null}
          </Text>
        }
        ListFooterComponent={
          inboxNeedsCreateHint(listData) ? (
            <Text style={styles.empty}>{t("Tap + to create a bot")}</Text>
          ) : null
        }
        renderItem={renderItem}
      />
      {organizeChat && organizeTarget ? (
        <BotOrganizeModal
          bot={organizeChat}
          sections={botSections}
          onClose={() => setOrganizeTarget(null)}
          onUpdate={async (update) => {
            await rpc(`${organizeTarget.kind}s/update`, {
              [`${organizeTarget.kind}Id`]: organizeChat.id,
              ...update,
            });
            if (organizeTarget.kind === "bot" && update.notifyOnFinish !== undefined) {
              await resumeLiveNotifications(
                currentApiBase(),
                await loadSessionToken(),
                selectedSpaceId() ?? "",
              ).catch(() => undefined);
              if (!update.notifyOnFinish && "threadId" in organizeChat) {
                await dismissThreadNotifications({ threadId: organizeChat.threadId }).catch(
                  () => undefined,
                );
              }
            }
            await loadBots();
          }}
          onCreateSection={async (name) => {
            await rpc("botSections/create", {
              [`${organizeTarget.kind}Id`]: organizeChat.id,
              name,
            });
            await loadBots();
          }}
          onRenameSection={async (sectionId, name) => {
            await rpc("botSections/update", { sectionId, name });
            await loadBots();
          }}
        />
      ) : null}
    </View>
  );
}

function ActivitySection({
  activity,
  bots,
}: {
  activity: { active: RunActivityRow[]; recent: RunActivityRow[] };
  bots: MobileBot[];
}) {
  const styles = useThemedStyles(createHomeStyles);
  const { t } = useI18n();
  const router = useRouter();
  const botsById = useMemo(() => new Map(bots.map((bot) => [bot.id, bot])), [bots]);
  const openRun = (run: RunActivityRow) => {
    if (run.groupId) {
      router.push({
        pathname: "/group-thread",
        params: { groupId: run.groupId, name: run.groupName ?? t("Group") },
      });
      return;
    }
    router.push({ pathname: "/thread", params: { botId: run.botId, name: run.botName } });
  };

  return (
    <View style={styles.activitySection}>
      {activity.active.length > 0 ? (
        <>
          <Text style={styles.sectionHeading}>{t("Now")}</Text>
          {activity.active.map((run) => (
            <ActivityRow
              key={run.runId}
              run={run}
              bot={botsById.get(run.botId)}
              onPress={() => openRun(run)}
            />
          ))}
        </>
      ) : null}
      {activity.recent.length > 0 ? (
        <>
          <Text style={[styles.sectionHeading, activity.active.length > 0 && styles.activityGap]}>
            {t("Recent")}
          </Text>
          {activity.recent.map((run) => (
            <ActivityRow
              key={run.runId}
              run={run}
              bot={botsById.get(run.botId)}
              onPress={() => openRun(run)}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

function ActivityRow({
  run,
  bot,
  onPress,
}: {
  run: RunActivityRow;
  bot?: MobileBot;
  onPress: () => void;
}) {
  const title = run.groupName ? `${run.botName} · ${run.groupName}` : run.botName;
  const status = activityStatusLabel(run.status);
  const preview = run.promptSnippet ? `${run.promptSnippet} · ${status}` : status;
  return (
    <ConversationRow
      title={title}
      preview={preview}
      time={formatActivityRelativeTime(run.updatedAt)}
      accessibilityLabel={`${title}, ${status}`}
      onPress={onPress}
      avatar={
        <BotAvatar identity={run.botId} color={bot?.color ?? FALLBACK_COLOR} status={run.status} />
      }
    />
  );
}

function MailInboxRow({ onPress }: { onPress: () => void }) {
  const styles = useThemedStyles(createHomeStyles);
  const { t } = useI18n();
  const unseen = useUnseenCount("inbox") > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unseen ? `${t("Inbox")}, ${t("unread")}` : t("Inbox")}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.mailInboxIcon}>
        <NativeSymbol ios="tray" android="file-tray-outline" size={22} />
      </View>
      <Text style={styles.name}>{t("Inbox")}</Text>
      {unseen ? <View accessibilityElementsHidden style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

function HeaderButton({
  children,
  onPress,
  accessibilityLabel,
  active = false,
  accent = false,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  accent?: boolean;
}) {
  const styles = useThemedStyles(createHomeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.headerButton,
        accent && active
          ? styles.headerButtonAccent
          : (active || pressed) && styles.headerButtonActive,
      ]}
    >
      {children}
    </Pressable>
  );
}
