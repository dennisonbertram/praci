import type { BotPinsSaveOutput, PinList, PinOp } from "@rakazo/contracts";
import {
  addItem,
  BOT_PINS_ITEM_TEXT_MAX,
  BOT_PINS_MAX_ITEMS,
  deleteItem,
  editItem,
  rebasePins,
  setItemDone,
} from "@rakazo/contracts";
import { newClientId } from "@rakazo/core";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeActionButton } from "../components/native-action-button";
import { NativeSymbol } from "../components/native-symbol";
import { getPins, savePins } from "../lib/agent-pins";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";

export default function AgentListScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [loaded, setLoaded] = useState<{
    botId: string;
    list: PinList | null;
  } | null>(null);
  const list = loaded?.botId === botId ? loaded.list : null;
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState("");
  const draftRef = useRef("");
  // The latest list (with unsaved edits), the last list the server accepted, and its revision.
  const listRef = useRef<PinList | null>(null);
  const savedRef = useRef<PinList | null>(null);
  const revision = useRef(0);
  // Edits not yet saved, oldest first. A conflict replays the rest onto the server list.
  const pending = useRef<PinOp[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // The agent on screen now: a save that finishes after a switch must not touch the new agent's list.
  const currentBot = useRef(botId);
  currentBot.current = botId;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setLoaded(null);
    listRef.current = null;
    savedRef.current = null;
    getPins(botId)
      .then((pins) => {
        if (cancelled) return;
        if (pins) {
          revision.current = pins.revision;
          savedRef.current = pins.list;
          const next = pins.list && rebasePins(pins.list, pending.current);
          listRef.current = next;
          setLoaded({ botId, list: next });
        } else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [botId, reload]);

  function change(op: PinOp, onFailure?: () => void) {
    const current = listRef.current;
    if (!current) return;
    const next = op(current);
    if (next === current) return;
    listRef.current = next;
    setLoaded({ botId, list: next });
    pending.current.push(op);
    queue.current = queue.current.then(async () => {
      const mine = pending.current.shift();
      const saved = savedRef.current;
      if (!mine || !saved) return;
      try {
        const candidate = mine(saved);
        const baseRevision = revision.current;
        let result: BotPinsSaveOutput;
        try {
          result = await savePins(botId, candidate, baseRevision);
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          result = await savePins(botId, candidate, baseRevision);
        }
        if (currentBot.current !== botId) return;
        if (result.ok) {
          revision.current = result.pins.revision;
          savedRef.current = candidate;
        } else {
          revision.current = result.pins.revision;
          savedRef.current = result.pins.list;
          if (JSON.stringify(result.pins.list) === JSON.stringify(candidate)) return;
          const rebased = result.pins.list && rebasePins(result.pins.list, pending.current);
          listRef.current = rebased;
          setLoaded({ botId, list: rebased });
          Alert.alert(t("The bot changed this list. Your last edit wasn't saved."));
        }
      } catch (error) {
        if (currentBot.current !== botId) return;
        const rebased = savedRef.current && rebasePins(savedRef.current, pending.current);
        listRef.current = rebased;
        setLoaded({ botId, list: rebased });
        onFailure?.();
        Alert.alert(errorText(error, t("Could not save this list.")));
      }
    });
  }

  function confirmDelete(id: string) {
    Alert.alert(t("Delete"), undefined, [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: () => change((l) => deleteItem(l, id)),
      },
    ]);
  }

  if (!list) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t("List") }} />
        {failed ? (
          <>
            <Text style={styles.message}>{t("Could not load this list.")}</Text>
            <NativeActionButton
              label={t("Try again")}
              onPress={() => setReload((value) => value + 1)}
            />
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: list.title }} />
      {list.items.map((item) => (
        <Pressable key={item.id} onLongPress={() => confirmDelete(item.id)} style={styles.row}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityActions={[{ name: "delete", label: t("Delete") }]}
            accessibilityState={{ checked: item.done }}
            accessibilityLabel={item.text}
            hitSlop={8}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "delete") confirmDelete(item.id);
            }}
            onPress={() => change((l) => setItemDone(l, item.id, !item.done))}
          >
            <NativeSymbol
              ios={item.done ? "checkmark.circle.fill" : "circle"}
              android={item.done ? "checkmark-circle" : "ellipse-outline"}
              size={24}
            />
          </Pressable>
          <TextInput
            // Remounting on a saved change drops a rejected blank edit.
            key={`${item.id}:${item.text}`}
            defaultValue={item.text}
            maxLength={BOT_PINS_ITEM_TEXT_MAX}
            multiline
            blurOnSubmit
            returnKeyType="done"
            onEndEditing={(event) => change((l) => editItem(l, item.id, event.nativeEvent.text))}
            style={[styles.input, item.done && styles.done]}
          />
        </Pressable>
      ))}
      {list.items.length < BOT_PINS_MAX_ITEMS ? (
        <View style={styles.row}>
          <NativeSymbol ios="plus.circle" android="add-circle-outline" size={24} />
          <TextInput
            value={draft}
            onChangeText={(text) => {
              draftRef.current = text;
              setDraft(text);
            }}
            placeholder={t("Add item")}
            placeholderTextColor={native.secondaryLabel}
            maxLength={BOT_PINS_ITEM_TEXT_MAX}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              const text = draft;
              change(
                (l) => addItem(l, newClientId(), text),
                () => {
                  if (!draftRef.current) {
                    draftRef.current = text;
                    setDraft(text);
                  }
                },
              );
              draftRef.current = "";
              setDraft("");
            }}
            style={styles.input}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    content: { padding: 20, gap: 4 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: native.page,
    },
    message: {
      color: native.secondaryLabel,
      fontSize: 14,
      textAlign: "center",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    input: { flex: 1, color: native.label, fontSize: 16, padding: 0 },
    done: { color: native.secondaryLabel, textDecorationLine: "line-through" },
  });
}
