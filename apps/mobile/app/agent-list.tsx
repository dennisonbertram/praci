import type { BotPins, PinList } from "@rakazo/contracts";
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
import { NativeSymbol } from "../components/native-symbol";
import { getPins, savePins } from "../lib/agent-pins";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { addItem, deleteItem, editItem, toggleItem } from "../lib/pin-list";
import { errorText } from "../lib/user-error";

const newId = () =>
  globalThis.crypto?.randomUUID?.().slice(0, 36) ?? Math.random().toString(36).slice(2, 12);

export default function AgentListScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [list, setList] = useState<PinList | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState("");
  // The latest list and revision, read by the save queue after earlier saves finish.
  const listRef = useRef<PinList | null>(null);
  const revision = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  function adopt(pins: BotPins) {
    revision.current = pins.revision;
    listRef.current = pins.list;
    setList(pins.list);
  }

  useEffect(() => {
    getPins(botId)
      .then((pins) => (pins ? adopt(pins) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [botId]);

  function change(edit: (current: PinList) => PinList) {
    const current = listRef.current;
    if (!current) return;
    const next = edit(current);
    if (next === current) return;
    listRef.current = next;
    setList(next);
    queue.current = queue.current.then(async () => {
      try {
        const result = await savePins(botId, listRef.current, revision.current);
        if (result.ok) revision.current = result.pins.revision;
        else {
          adopt(result.pins);
          Alert.alert(t("The bot changed this list. Your last edit wasn't saved."));
        }
      } catch (error) {
        Alert.alert(errorText(error, t("Could not save this list.")));
      }
    });
  }

  function confirmDelete(id: string) {
    Alert.alert(t("Delete"), undefined, [
      { text: t("Cancel"), style: "cancel" },
      { text: t("Delete"), style: "destructive", onPress: () => change((l) => deleteItem(l, id)) },
    ]);
  }

  if (!list) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t("List") }} />
        {failed ? (
          <Text style={styles.message}>{t("Could not load this list.")}</Text>
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
            accessibilityState={{ checked: item.done }}
            accessibilityLabel={item.text}
            hitSlop={8}
            onPress={() => change((l) => toggleItem(l, item.id))}
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
            maxLength={300}
            multiline
            blurOnSubmit
            returnKeyType="done"
            onEndEditing={(event) => change((l) => editItem(l, item.id, event.nativeEvent.text))}
            style={[styles.input, item.done && styles.done]}
          />
        </Pressable>
      ))}
      <View style={styles.row}>
        <NativeSymbol ios="plus.circle" android="add-circle-outline" size={24} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t("Add item")}
          placeholderTextColor={native.secondaryLabel}
          maxLength={300}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            change((l) => addItem(l, newId(), draft));
            setDraft("");
          }}
          style={styles.input}
        />
      </View>
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
    message: { color: native.secondaryLabel, fontSize: 14, textAlign: "center" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
    input: { flex: 1, color: native.label, fontSize: 16, padding: 0 },
    done: { color: native.secondaryLabel, textDecorationLine: "line-through" },
  });
}
