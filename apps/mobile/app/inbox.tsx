import type { InboxTodo, MailRow } from "@rakazo/contracts";
import { dueTone, groupInbox, localDaysUntil } from "@rakazo/core";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MenuPicker } from "../components/menu-picker";
import { NativeActionButton } from "../components/native-action-button";
import { NativeSegmentedControl } from "../components/native-segmented-control";
import { NativeSymbol } from "../components/native-symbol";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { formatThreadTime } from "../lib/inbox";
import {
  completeMailTodo,
  ensureMailAgent,
  listMailInbox,
  listMailTodos,
  refreshMailInbox,
  todoDueLabel,
} from "../lib/mail-inbox";
import { native, useThemedStyles } from "../lib/native";
import { iosAtLeast } from "../lib/native-controls";
import { errorText } from "../lib/user-error";

const ALL = "all";
// Triage runs after the sync returns, so refetch a few times while the list reports it pending.
const TRIAGE_POLL_MS = 5_000;
const TRIAGE_MAX_POLLS = 6;
const AGENT_SYMBOL = "bubble.left";

export default function InboxScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);

  const [tab, setTab] = useState<string | undefined>();
  const [data, setData] = useState<Awaited<ReturnType<typeof listMailInbox>> | null>(null);
  const [todos, setTodos] = useState<InboxTodo[]>([]);
  const [error, setError] = useState("");
  const [synced, setSynced] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Each load takes a number; a response for an older number is dropped, so a slow account never
  // overwrites the current one. Losing focus bumps it, which also stops the triage refetches.
  const generationRef = useRef(0);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const openingAgentRef = useRef(false);

  const fetchList = useCallback(async (connectionId: string | undefined, generation: number) => {
    const list = await listMailInbox(connectionId);
    if (generation !== generationRef.current) return null;
    setData(list);
    if (list.accounts.length === 0 || !list.enabled) {
      setTodos([]);
      return list;
    }
    // The inbox list reports a failed load; a failed to-do load just hides the card.
    const next = await listMailTodos(connectionId).catch(() => null);
    if (generation !== generationRef.current) return null;
    setTodos(next?.todos.filter((todo) => todo.doneAt === null) ?? []);
    return list;
  }, []);

  const pollTriage = useCallback(
    async (connectionId: string | undefined, generation: number) => {
      for (let poll = 0; poll < TRIAGE_MAX_POLLS; poll++) {
        await new Promise((resolve) => setTimeout(resolve, TRIAGE_POLL_MS));
        if (generation !== generationRef.current) return;
        const list = await fetchList(connectionId, generation).catch(() => null);
        if (!list?.triagePending) return;
      }
    },
    [fetchList],
  );

  /** List, then (when `sync`) refresh and list again, as the web page does. */
  const load = useCallback(
    async (connectionId: string | undefined, sync: boolean) => {
      const generation = ++generationRef.current;
      setError("");
      try {
        let list = await fetchList(connectionId, generation);
        if (!list || list.accounts.length === 0) return;
        if (sync) {
          await refreshMailInbox().catch((cause: unknown) => {
            if (generation === generationRef.current) {
              setError(errorText(cause, t("Could not load mail.")));
            }
          });
          list = await fetchList(connectionId, generation);
          if (!list) return;
        }
        setSynced(true);
        if (list.triagePending) void pollTriage(connectionId, generation);
      } catch (cause) {
        if (generation !== generationRef.current) return;
        // A removed account leaves its tab behind; fall back to All.
        if (connectionId) {
          setTab(undefined);
          void load(undefined, false);
        } else {
          setError(errorText(cause, t("Could not load mail.")));
        }
      }
    },
    [fetchList, pollTriage, t],
  );

  useFocusEffect(
    useCallback(() => {
      void load(tabRef.current, true);
      return () => {
        generationRef.current++;
      };
    }, [load]),
  );

  const selectTab = (value: string) => {
    const next = value === ALL ? undefined : value;
    if (next === tabRef.current) return;
    setTab(next);
    void load(next, false);
  };

  async function pullToRefresh() {
    setRefreshing(true);
    try {
      await load(tabRef.current, true);
    } finally {
      setRefreshing(false);
    }
  }

  const completeTodo = (todo: InboxTodo) => {
    const index = todos.indexOf(todo);
    setTodos((current) => current.filter((item) => item.id !== todo.id));
    completeMailTodo(todo.id).catch((cause: unknown) => {
      setTodos((current) =>
        current.some((item) => item.id === todo.id)
          ? current
          : [...current.slice(0, index), todo, ...current.slice(index)],
      );
      Alert.alert(errorText(cause));
    });
  };

  const accounts = data?.accounts ?? [];
  const agent = data?.agent ?? null;
  const agentName = agent?.name ?? t("Inbox agent");
  const openAgent = useCallback(async () => {
    if (openingAgentRef.current) return;
    openingAgentRef.current = true;
    try {
      const bot = agent ? { id: agent.botId, name: agent.name } : await ensureMailAgent();
      router.push({ pathname: "/thread", params: { botId: bot.id, name: bot.name } });
    } catch (cause) {
      Alert.alert(errorText(cause));
    } finally {
      openingAgentRef.current = false;
    }
  }, [agent, router]);

  useLayoutEffect(() => {
    // An agent that searches mail has nothing to search until an account is connected.
    const show = accounts.length > 0;
    navigation.setOptions(
      iosAtLeast(26)
        ? {
            unstable_headerRightItems: () =>
              show
                ? [
                    {
                      type: "button" as const,
                      accessibilityLabel: agentName,
                      icon: { type: "sfSymbol" as const, name: AGENT_SYMBOL },
                      onPress: () => void openAgent(),
                    },
                  ]
                : [],
          }
        : {
            headerRight: () =>
              show ? (
                <Pressable
                  accessibilityLabel={agentName}
                  hitSlop={8}
                  onPress={() => void openAgent()}
                  style={styles.headerButton}
                >
                  <NativeSymbol ios={AGENT_SYMBOL} android="chatbubble-outline" size={19} />
                </Pressable>
              ) : null,
          },
    );
  }, [accounts.length, agentName, navigation, openAgent, styles]);

  const groups = useMemo(() => groupInbox(data?.rows ?? [], new Date()), [data]);
  const sections = useMemo(
    () =>
      [
        { key: "needsReply", title: t("Needs reply"), data: groups.needsReply },
        { key: "today", title: t("Today"), data: groups.today },
        { key: "earlier", title: t("Earlier"), data: groups.earlier },
      ].filter((section) => section.data.length > 0),
    [groups, t],
  );

  const choices = [
    { key: ALL, label: t("All") },
    ...accounts.map((account) => ({ key: account.connectionId, label: account.label })),
  ];
  const picker =
    accounts.length < 2 ? null : accounts.length <= 3 ? (
      <View style={styles.picker}>
        <NativeSegmentedControl
          accessibilityLabel={t("Account")}
          value={tab ?? ALL}
          onChange={selectTab}
          options={choices.map((choice) => ({ value: choice.key, label: choice.label }))}
        />
      </View>
    ) : (
      <MenuPicker label={t("Account")} choices={choices} value={tab ?? ALL} onChange={selectTab} />
    );

  const loading = !data || (data.rows.length === 0 && !synced);
  const empty =
    data && accounts.length === 0 ? (
      <View style={styles.centered}>
        <NativeActionButton
          label={t("Connect mail")}
          fill={false}
          onPress={() => router.push("/integrations")}
        />
      </View>
    ) : loading ? (
      <View style={styles.centered}>
        {error ? <Text style={styles.empty}>{error}</Text> : <ActivityIndicator />}
      </View>
    ) : (
      <Text style={styles.empty}>{t("No mail")}</Text>
    );

  return (
    <View style={styles.screen}>
      <SectionList<MailRow, { key: string; title: string; data: MailRow[] }>
        style={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        sections={sections}
        keyExtractor={(row) => row.id}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void pullToRefresh()}
            tintColor={native.secondaryLabel}
          />
        }
        ListHeaderComponent={
          <>
            {picker}
            {error && !loading ? <Text style={styles.empty}>{error}</Text> : null}
            {todos.length > 0 ? <TodoCard todos={todos} onComplete={completeTodo} /> : null}
          </>
        }
        ListEmptyComponent={empty}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => <MailListRow row={item} />}
      />
    </View>
  );
}

function TodoCard({
  todos,
  onComplete,
}: {
  todos: InboxTodo[];
  onComplete: (todo: InboxTodo) => void;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const tokens = mobileTokens();
  const now = new Date();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("To do")}</Text>
      {todos.map((todo) => {
        const days = todo.dueOn ? localDaysUntil(todo.dueOn, now) : null;
        const tone = dueTone(days, todo.priority);
        const detail = [todo.from, todo.detail].filter(Boolean).join(" · ");
        return (
          <View key={todo.id} style={styles.todoRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
              accessibilityLabel={todo.text}
              hitSlop={8}
              onPress={() => onComplete(todo)}
            >
              <NativeSymbol
                ios="circle"
                android="ellipse-outline"
                size={22}
                color={native.secondaryLabel}
              />
            </Pressable>
            <View style={styles.todoBody}>
              <Text style={styles.todoText}>{todo.text}</Text>
              {detail ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {detail}
                </Text>
              ) : null}
            </View>
            {todo.dueOn && days !== null ? (
              <Text
                style={[
                  styles.meta,
                  tone === "crit" && { color: tokens.destructive },
                  tone === "warn" && { color: tokens.warning },
                ]}
              >
                {todoDueLabel(todo.dueOn, days)}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function MailListRow({ row }: { row: MailRow }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <View style={[styles.unreadDot, !row.unread && styles.readDot]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.sender, row.unread && styles.unread]} numberOfLines={1}>
            {row.from}
          </Text>
          <Text style={styles.meta}>{formatThreadTime(row.receivedAt)}</Text>
        </View>
        <Text style={styles.subject} numberOfLines={1}>
          {row.subject}
        </Text>
        {row.snippet ? (
          <Text style={styles.meta} numberOfLines={1}>
            {row.snippet}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    list: { flex: 1 },
    centered: { alignItems: "center", justifyContent: "center", paddingTop: 40 },
    picker: { paddingHorizontal: 16, paddingVertical: 10 },
    empty: {
      color: native.secondaryLabel,
      fontSize: 15,
      textAlign: "center",
      paddingHorizontal: 24,
      paddingTop: 16,
    },
    sectionTitle: {
      color: native.secondaryLabel,
      fontSize: 13,
      fontWeight: "600",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
    },
    card: {
      marginHorizontal: 16,
      marginTop: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: native.fill,
    },
    cardTitle: { color: native.secondaryLabel, fontSize: 13, fontWeight: "600", paddingBottom: 4 },
    todoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
    todoBody: { flex: 1, minWidth: 0, gap: 2 },
    todoText: { color: native.label, fontSize: 15 },
    row: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
    rowBody: { flex: 1, minWidth: 0, gap: 2 },
    rowTop: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
      backgroundColor: tokens.foreground,
    },
    readDot: { backgroundColor: "transparent" },
    sender: { flex: 1, minWidth: 0, color: native.label, fontSize: 15 },
    unread: { fontWeight: "600" },
    subject: { color: native.label, fontSize: 14 },
    meta: { color: native.secondaryLabel, fontSize: 12.5 },
    headerButton: { padding: 8 },
  });
}
