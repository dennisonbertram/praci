import type { InboxPile, InboxTodo, MailRow } from "@rakazo/contracts";
import type { SenderGroup } from "@rakazo/core";
import {
  archivableIds,
  dueTone,
  groupBySender,
  groupInbox,
  inboxLabel,
  isSuspiciousCategory,
  localDaysUntil,
  rowSummary,
} from "@rakazo/core";
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
import { MailRowMenu } from "../components/mail-row-menu";
import { MenuPicker } from "../components/menu-picker";
import { NativeActionButton } from "../components/native-action-button";
import { NativeSegmentedControl } from "../components/native-segmented-control";
import { NativeSymbol } from "../components/native-symbol";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { formatThreadTime } from "../lib/inbox";
import {
  archiveMailMessages,
  completeMailTodo,
  ensureMailAgent,
  listMailInbox,
  listMailTodos,
  refreshMailInbox,
  todoDueLabel,
} from "../lib/mail-inbox";
import { native, useThemedStyles } from "../lib/native";
import { iosAtLeast } from "../lib/native-controls";
import { setOpenSurface } from "../lib/open-surface";
import { markSurfaceSeen } from "../lib/unseen-notifications";
import { errorText } from "../lib/user-error";

const ALL = "all";
// Triage runs after the sync returns, so refetch a few times while the list reports it pending.
const TRIAGE_POLL_MS = 5_000;
const TRIAGE_MAX_POLLS = 6;
const AGENT_SYMBOL = "bubble.left";

/** A list entry: a message, or the header of a sender's group (`group` set, `row` is its newest message). */
interface ListItem {
  id: string;
  row: MailRow;
  group?: SenderGroup<MailRow>;
  /** A message inside an open group. */
  child?: boolean;
}
const messageItem = (row: MailRow, child = false): ListItem => ({ id: row.id, row, child });

export default function InboxScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);

  const [tab, setTab] = useState<string | undefined>();
  const [pile, setPile] = useState<InboxPile>("important");
  // The pile `data` answers, so a pile switch shows loading, not the previous pile's rows.
  const [dataPile, setDataPile] = useState<InboxPile>();
  // Open sender groups, by group key.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
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
  const pileRef = useRef(pile);
  pileRef.current = pile;
  const openingAgentRef = useRef(false);

  const fetchList = useCallback(async (connectionId: string | undefined, generation: number) => {
    const asked = pileRef.current;
    const list = await listMailInbox(connectionId, asked);
    if (generation !== generationRef.current) return null;
    setData(list);
    setDataPile(asked);
    // To-dos belong to the Important pile.
    if (asked !== "important" || list.accounts.length === 0 || !list.enabled) {
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
      setOpenSurface("inbox");
      void markSurfaceSeen("inbox");
      return () => setOpenSurface(null);
    }, []),
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

  const selectPile = (value: InboxPile) => {
    if (value === pileRef.current) return;
    setPile(value);
    pileRef.current = value;
    setExpanded(new Set());
    void load(tabRef.current, false);
  };

  // The rows leave the list at once; a failure puts them back by reloading, and says so.
  const archiveRows = async (rows: MailRow[]) => {
    const spamView = pileRef.current === "spam";
    const ids = archivableIds(rows, spamView);
    if (ids.length === 0) return;
    const gone = new Set(ids);
    setData((current) =>
      current ? { ...current, rows: current.rows.filter((row) => !gone.has(row.id)) } : current,
    );
    try {
      const result = await archiveMailMessages(ids, spamView);
      if (result.failed.length > 0)
        Alert.alert(t("Could not archive {count}", { count: result.failed.length }));
      // A failed thread comes back with the real list; the Spam count follows the archive.
      if (result.failed.length > 0 || spamView) void load(tabRef.current, false);
    } catch (cause) {
      Alert.alert(errorText(cause, t("Could not archive {count}", { count: ids.length })));
      void load(tabRef.current, false);
    }
  };
  const confirmArchiveGroup = (group: SenderGroup<MailRow>) => {
    const count = archivableIds(group.rows, pileRef.current === "spam").length;
    if (count === 0) return;
    Alert.alert(
      t("Archive {count} conversations from {sender}?", { count, sender: group.sender }),
      undefined,
      [
        { text: t("Cancel"), style: "cancel" },
        { text: t("Archive"), onPress: () => void archiveRows(group.rows) },
      ],
    );
  };
  const toggleGroup = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

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

  const current = dataPile === pile;
  const rows = useMemo(() => (current ? (data?.rows ?? []) : []), [current, data]);
  const sections = useMemo(() => {
    if (pile === "updates" || pile === "newsletters") {
      // A sender with one message is that message; a larger group is a header, then its messages when open.
      const items = groupBySender(rows).flatMap((group): ListItem[] =>
        group.count === 1
          ? [messageItem(group.newest)]
          : [
              { id: `group:${group.key}`, row: group.newest, group },
              ...(expanded.has(group.key) ? group.rows.map((row) => messageItem(row, true)) : []),
            ],
      );
      return items.length > 0 ? [{ key: pile, title: "", data: items }] : [];
    }
    if (pile === "spam")
      return rows.length > 0
        ? [{ key: pile, title: "", data: rows.map((row) => messageItem(row)) }]
        : [];
    const groups = groupInbox(rows, new Date());
    return [
      {
        key: "needsReply",
        title: t("Needs reply"),
        data: groups.needsReply.map((row) => messageItem(row)),
      },
      { key: "today", title: t("Today"), data: groups.today.map((row) => messageItem(row)) },
      { key: "earlier", title: t("Earlier"), data: groups.earlier.map((row) => messageItem(row)) },
    ].filter((section) => section.data.length > 0);
  }, [pile, rows, expanded, t]);

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

  const spamCount = data?.pileCounts?.spam ?? 0;
  const pileOptions = [
    { value: "important" as const, label: t("Important") },
    { value: "updates" as const, label: t("Updates") },
    { value: "newsletters" as const, label: t("Newsletters") },
    // Spam shows behind its count, and stays while it is the open pile.
    ...(spamCount > 0 || pile === "spam"
      ? [{ value: "spam" as const, label: t("Spam {count}", { count: spamCount }) }]
      : []),
  ];
  const pilePicker =
    accounts.length > 0 ? (
      <View style={styles.picker}>
        <NativeSegmentedControl
          accessibilityLabel={t("Inbox")}
          value={pile}
          onChange={selectPile}
          options={pileOptions}
        />
      </View>
    ) : null;

  const loading = !data || !current || (rows.length === 0 && !synced);
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
      <SectionList<ListItem, { key: string; title: string; data: ListItem[] }>
        style={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        sections={sections}
        keyExtractor={(item) => item.id}
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
            {pilePicker}
            {error && !loading ? <Text style={styles.empty}>{error}</Text> : null}
            {pile === "important" && todos.length > 0 ? (
              <TodoCard todos={todos} onComplete={completeTodo} />
            ) : null}
          </>
        }
        ListEmptyComponent={empty}
        renderSectionHeader={({ section }) =>
          section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null
        }
        renderItem={({ item }) =>
          item.group ? (
            <MailRowMenu onArchive={() => confirmArchiveGroup(item.group as SenderGroup<MailRow>)}>
              <MailGroupRow
                group={item.group}
                expanded={expanded.has(item.group.key)}
                onPress={() => toggleGroup((item.group as SenderGroup<MailRow>).key)}
              />
            </MailRowMenu>
          ) : (
            <MailRowMenu onArchive={() => void archiveRows([item.row])}>
              <MailListRow
                row={item.row}
                indented={item.child}
                onPress={() =>
                  router.push({ pathname: "/inbox-message", params: { messageId: item.id } })
                }
              />
            </MailRowMenu>
          )
        }
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

/** One sender's header in the Updates and Newsletters piles: the count, and the newest mail's summary. */
function MailGroupRow({
  group,
  expanded,
  onPress,
}: {
  group: SenderGroup<MailRow>;
  expanded: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { newest } = group;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={styles.row}
    >
      <View style={[styles.unreadDot, group.unreadCount === 0 && styles.readDot]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.sender, group.unreadCount > 0 && styles.unread]} numberOfLines={1}>
            {group.sender}
          </Text>
          <Text style={styles.meta}>{group.count}</Text>
          <NativeSymbol
            ios={expanded ? "chevron.down" : "chevron.right"}
            android={expanded ? "chevron-down" : "chevron-forward"}
            size={12}
            color={native.secondaryLabel}
          />
          <Text style={styles.meta}>{formatThreadTime(newest.receivedAt)}</Text>
        </View>
        <Text style={styles.subject} numberOfLines={1}>
          {newest.subject}
        </Text>
        {rowSummary(newest) ? (
          <Text style={styles.meta} numberOfLines={1}>
            {rowSummary(newest)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function MailListRow({
  row,
  onPress,
  indented = false,
}: {
  row: MailRow;
  onPress: () => void;
  indented?: boolean;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const label = inboxLabel(row);
  const labelNames = {
    attention: t("Needs attention"),
    newsletter: t("Newsletter"),
    spam: t("Spam"),
    junk: t("Junk"),
  };
  return (
    <Pressable onPress={onPress} style={[styles.row, indented && styles.indented]}>
      <View style={[styles.unreadDot, !row.unread && styles.readDot]} />
      <View style={[styles.rowBody, row.feedback === "noise" && styles.dimmed]}>
        <View style={styles.rowTop}>
          {isSuspiciousCategory(row.category) ? (
            <View accessible accessibilityRole="image" accessibilityLabel={t("Suspicious")}>
              <NativeSymbol
                ios="exclamationmark.triangle.fill"
                android="warning"
                size={14}
                color={mobileTokens().destructive}
              />
            </View>
          ) : null}
          <Text style={[styles.sender, row.unread && styles.unread]} numberOfLines={1}>
            {row.from}
          </Text>
          {label ? (
            <Text
              style={[
                styles.label,
                (label === "spam" || label === "junk") && { color: mobileTokens().warning },
              ]}
              numberOfLines={1}
            >
              {labelNames[label]}
            </Text>
          ) : null}
          <Text style={styles.meta}>{formatThreadTime(row.receivedAt)}</Text>
        </View>
        <Text style={styles.subject} numberOfLines={1}>
          {row.subject}
        </Text>
        {rowSummary(row) ? (
          <Text style={styles.meta} numberOfLines={1}>
            {rowSummary(row)}
          </Text>
        ) : null}
      </View>
    </Pressable>
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
    indented: { paddingStart: 32 },
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
    label: {
      color: native.secondaryLabel,
      backgroundColor: native.fill,
      fontSize: 11,
      fontWeight: "600",
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
      overflow: "hidden",
    },
    dimmed: { opacity: 0.55 },
    headerButton: { padding: 8 },
  });
}
