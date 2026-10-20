import { MenuView } from "@expo/ui/community/menu";
import type { CleanupKind, CleanupListOutput, CleanupSender, MailAction } from "@rakazo/contracts";
import type { CleanupFailure, CleanupRunResult } from "@rakazo/core";
import { cleanupChoiceCounts, cleanupTargets, runCleanup, senderKey } from "@rakazo/core";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeActionButton } from "../components/native-action-button";
import { NativeSymbol } from "../components/native-symbol";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { formatThreadTime } from "../lib/inbox";
import {
  cleanupArchive,
  forgetCleanupSender,
  listCleanup,
  listMailActions,
  undoMailAction,
  unsubscribeSender,
} from "../lib/mail-inbox";
import { native, useResolvedAppearance, useThemedStyles } from "../lib/native";
import { iosAtLeast } from "../lib/native-controls";
import { errorText } from "../lib/user-error";

const api = { archive: cleanupArchive, unsubscribe: unsubscribeSender };
const KINDS: CleanupKind[] = ["archive", "unsubscribe", "skip_inbox", "spam"];
const KIND_SYMBOL = {
  archive: "archivebox",
  unsubscribe: "envelope.badge",
  skip_inbox: "tray.and.arrow.down",
  spam: "xmark.bin",
} as const satisfies Record<CleanupKind, string>;

/** One entry of the screen's list: a sender, or a note about the last run. */
type Item =
  | { type: "sender"; sender: CleanupSender }
  | { type: "link"; sender: CleanupSender; url: string }
  | { type: "failure"; failure: CleanupFailure };

/** Senders ranked by unopened mail, bulk and rarely read ones ticked; one native menu applies a choice to the ticked ones. */
export default function InboxCleanupScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const scheme = useResolvedAppearance();
  const [list, setList] = useState<CleanupListOutput | null>(null);
  const [history, setHistory] = useState<MailAction[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Item[]>([]);
  const seeded = useRef(false);

  const load = useCallback(async () => {
    try {
      const [next, actions] = await Promise.all([listCleanup(), listMailActions()]);
      setError("");
      setList(next);
      setHistory(actions.actions);
      const keys = new Set(next.senders.map((s) => senderKey(s.connectionId, s.address)));
      // The first answer ticks the preselected senders; later ones keep what the user ticked.
      const first = !seeded.current;
      setSelected((now) =>
        first
          ? new Set(
              next.senders
                .filter((s) => s.preselected)
                .map((s) => senderKey(s.connectionId, s.address)),
            )
          : new Set([...now].filter((key) => keys.has(key))),
      );
      seeded.current = true;
    } catch (cause) {
      setError(errorText(cause, t("Could not load senders")));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const senders = list?.senders ?? [];
  const counts = cleanupChoiceCounts(senders, selected);
  const label = (kind: CleanupKind) =>
    kind === "archive"
      ? t("Archive {count}", { count: counts.archive })
      : kind === "unsubscribe"
        ? t("Unsubscribe {count}", { count: counts.unsubscribe })
        : kind === "skip_inbox"
          ? t("Skip inbox {count}", { count: counts.skip_inbox })
          : t("Spam {count}", { count: counts.spam });

  const record = (result: CleanupRunResult) =>
    setNotes((before) => [
      ...before,
      ...result.openLinks.map((link): Item => ({ type: "link", ...link })),
      ...result.failed.map((failure): Item => ({ type: "failure", failure })),
    ]);

  const askToSend = (pending: CleanupRunResult["confirm"]) => {
    const [next, ...rest] = pending;
    if (!next) return;
    Alert.alert(t("Send an unsubscribe email to {address}?", { address: next.mailTo }), undefined, [
      { text: t("Cancel"), style: "cancel", onPress: () => askToSend(rest) },
      {
        text: t("Send"),
        onPress: () =>
          void (async () => {
            setBusy(true);
            const result = await runCleanup("unsubscribe", [next.sender], api, {
              confirmMailto: true,
            });
            record(result);
            await load();
            setBusy(false);
            askToSend(rest);
          })(),
      },
    ]);
  };

  const run = async (kind: CleanupKind) => {
    const targets = cleanupTargets(kind, senders, selected);
    setBusy(true);
    setNotes([]);
    try {
      const result = await runCleanup(kind, targets, api);
      record(result);
      await load();
      askToSend(result.confirm);
    } finally {
      setBusy(false);
    }
  };

  // The menu lists the choices; a native alert confirms one before it runs.
  const choose = (kind: CleanupKind) => {
    if (busy || counts[kind] === 0) return;
    Alert.alert(label(kind), undefined, [
      { text: t("Cancel"), style: "cancel" },
      { text: label(kind), onPress: () => void run(kind) },
    ]);
  };

  const stop = async (sender: CleanupSender) => {
    try {
      await forgetCleanupSender(sender.connectionId, sender.address);
    } catch (cause) {
      Alert.alert(errorText(cause));
    }
    await load();
  };

  const undo = (action: MailAction) => {
    if (action.undone) return;
    Alert.alert(historyLine(action), undefined, [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Undo"),
        onPress: () =>
          void undoMailAction(action.batchId)
            .catch((cause: unknown) => Alert.alert(errorText(cause)))
            .then(() => load()),
      },
    ]);
  };

  const historyLine = (action: MailAction) => {
    const kind = {
      archive: t("Archive"),
      skip_inbox: t("Skip inbox"),
      unsubscribe: t("Unsubscribe"),
      spam: t("Spam"),
      not_spam: t("Not spam"),
      trash: t("Trash"),
    }[action.kind];
    const why =
      action.reason === "cleanup"
        ? t("Cleanup")
        : action.reason === "skip_inbox" && action.kind !== "skip_inbox"
          ? t("Skip inbox")
          : "";
    return `${kind} · ${action.threadCount} · ${action.senders[0] ?? ""}${
      action.senderCount > 1 ? ` +${action.senderCount - 1}` : ""
    }${why ? ` · ${why}` : ""}`;
  };

  const hasChoices = senders.length > 0;
  useLayoutEffect(() => {
    navigation.setOptions(
      iosAtLeast(26)
        ? {
            unstable_headerRightItems: () =>
              hasChoices
                ? [
                    {
                      type: "menu" as const,
                      label: t("Cleanup"),
                      accessibilityLabel: t("Cleanup"),
                      icon: { type: "sfSymbol" as const, name: "ellipsis" },
                      menu: {
                        items: KINDS.map((kind) => ({
                          type: "action" as const,
                          label: label(kind),
                          disabled: busy || counts[kind] === 0,
                          onPress: () => choose(kind),
                        })),
                      },
                    },
                  ]
                : [],
          }
        : {
            headerRight: () =>
              hasChoices ? (
                <MenuView
                  colorScheme={scheme}
                  actions={KINDS.map((kind) => ({
                    id: kind,
                    title: label(kind),
                    image: KIND_SYMBOL[kind],
                    attributes: { disabled: busy || counts[kind] === 0 },
                  }))}
                  onPressAction={({ nativeEvent }) => choose(nativeEvent.event as CleanupKind)}
                >
                  <View
                    accessibilityRole="button"
                    accessibilityLabel={t("Cleanup")}
                    style={styles.headerButton}
                  >
                    <NativeSymbol ios="ellipsis" android="ellipsis-horizontal" size={19} />
                  </View>
                </MenuView>
              ) : null,
          },
    );
  }, [
    navigation,
    hasChoices,
    busy,
    counts.archive,
    counts.unsubscribe,
    counts.skip_inbox,
    counts.spam,
    scheme,
    styles,
    t,
  ]);

  const items: Item[] = [...notes, ...senders.map((sender): Item => ({ type: "sender", sender }))];
  const toggle = (key: string) =>
    setSelected((now) => {
      const next = new Set(now);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const tokens = mobileTokens();

  return (
    <View style={styles.screen}>
      <FlatList<Item>
        style={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        data={items}
        keyExtractor={(item, index) => {
          if (item.type === "sender")
            return senderKey(item.sender.connectionId, item.sender.address);
          const sender = item.type === "failure" ? item.failure.sender : item.sender;
          // A note is never reordered, so its position keeps repeated notes for one sender apart.
          return `${item.type}:${senderKey(sender.connectionId, sender.address)}:${index}`;
        }}
        ListEmptyComponent={
          error ? (
            <View style={styles.centered}>
              <Text style={styles.empty}>{error}</Text>
              <NativeActionButton label={t("Retry")} fill={false} onPress={() => void load()} />
            </View>
          ) : !list ? (
            <View style={styles.centered}>
              <ActivityIndicator />
            </View>
          ) : (
            <Text style={styles.empty}>{t("Nothing to clean up")}</Text>
          )
        }
        renderItem={({ item }) => {
          if (item.type === "link")
            return (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(item.url)}
                style={styles.row}
              >
                <Text style={styles.name} numberOfLines={1}>
                  {item.sender.name}
                </Text>
                <Text style={styles.link}>{t("Open link")}</Text>
              </Pressable>
            );
          if (item.type === "failure") {
            const openUrl =
              item.failure.reason === "unsubscribe" ? item.failure.openUrl : undefined;
            return (
              <View style={styles.row}>
                <Text style={[styles.name, { color: tokens.destructive }]} numberOfLines={2}>
                  {t("Could not update {name}", { name: item.failure.sender.name })}
                </Text>
                {openUrl ? (
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={8}
                    onPress={() => void Linking.openURL(openUrl)}
                  >
                    <Text style={styles.link}>{t("Open link")}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }
          const { sender } = item;
          const key = senderKey(sender.connectionId, sender.address);
          const on = selected.has(key);
          const percent = Math.round((sender.readCount / Math.max(sender.messageCount, 1)) * 100);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={sender.name}
              onPress={() => toggle(key)}
              style={styles.row}
            >
              <NativeSymbol
                ios={on ? "checkmark.circle.fill" : "circle"}
                android={on ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={on ? tokens.foreground : native.secondaryLabel}
              />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {sender.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {sender.address}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {t("{count} messages · {percent}% read", { count: sender.messageCount, percent })}
                  {sender.lastReceivedAt ? ` · ${formatThreadTime(sender.lastReceivedAt)}` : ""}
                </Text>
                {sender.spamLike ? (
                  <Text style={[styles.meta, { color: tokens.warning }]}>
                    {t("Looks like spam")}
                  </Text>
                ) : null}
                {sender.skipInbox ? (
                  <View style={styles.skipping}>
                    <Text style={styles.meta}>{t("Skipping")}</Text>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => void stop(sender)}
                    >
                      <Text style={styles.link}>{t("Stop")}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          history.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>{t("History")}</Text>
              {history.map((action) => (
                <Pressable
                  key={action.batchId}
                  accessibilityRole="button"
                  disabled={action.undone}
                  onPress={() => undo(action)}
                  style={[styles.row, action.undone && styles.dimmed]}
                >
                  <Text style={styles.name} numberOfLines={1}>
                    {historyLine(action)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
      />
      {busy ? (
        <View pointerEvents="none" style={styles.busy}>
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    list: { flex: 1 },
    centered: { alignItems: "center", justifyContent: "center", paddingTop: 40, gap: 12 },
    empty: { color: native.secondaryLabel, fontSize: 15, textAlign: "center", paddingTop: 16 },
    row: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: "flex-start",
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    name: { flex: 1, color: native.label, fontSize: 15, fontWeight: "600" },
    meta: { color: native.secondaryLabel, fontSize: 12.5 },
    link: { color: native.label, fontSize: 13, textDecorationLine: "underline" },
    skipping: { flexDirection: "row", gap: 8, alignItems: "center" },
    sectionTitle: {
      color: native.secondaryLabel,
      fontSize: 13,
      fontWeight: "600",
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 6,
    },
    dimmed: { opacity: 0.5 },
    headerButton: { padding: 8 },
    busy: { position: "absolute", top: 12, alignSelf: "center" },
  });
}
