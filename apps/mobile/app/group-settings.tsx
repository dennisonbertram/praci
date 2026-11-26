import { GROUP_MEMBER_MAX, GROUP_MEMBER_MIN, GROUP_NAME_MAX } from "@rakazo/contracts";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from "react-native";
import { BotMemberPicker } from "../components/bot-member-picker";
import { glassHeaderOptions } from "../components/glass-title";
import { NativeActionButton } from "../components/native-action-button";
import type { MobileBot, MobileGroup } from "../lib/api";
import { rpc } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { native, useMobileTokens } from "../lib/native";
import { errorText } from "../lib/user-error";

export default function GroupSettingsScreen() {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [group, setGroup] = useState<MobileGroup | null>(null);
  const [bots, setBots] = useState<MobileBot[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(() => {
    if (!groupId) return;
    setLoadError(null);
    void Promise.all([
      rpc<MobileGroup[]>("groups/list").then(
        (groups) => groups.find((row) => row.id === groupId) ?? null,
      ),
      rpc<MobileBot[]>("bots/list"),
    ])
      .then(([nextGroup, nextBots]) => {
        if (!nextGroup) throw new Error(t("Group not found"));
        setGroup(nextGroup);
        setName(nextGroup.name);
        setSelected(nextGroup.members.map((member) => member.botId));
        setBots(nextBots.filter((bot) => !bot.archivedAt));
      })
      .catch((err) => setLoadError(errorText(err, t("Could not load group"))));
  }, [groupId, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!group) {
    return (
      <>
        <Stack.Screen options={glassHeaderOptions(t("Group settings"))} />
        <View
          style={{
            flex: 1,
            backgroundColor: tokens.background,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          {loadError ? (
            <>
              <Text
                accessibilityRole="alert"
                style={{ color: tokens.destructive, marginBottom: 16 }}
              >
                {loadError}
              </Text>
              <NativeActionButton label={t("Try again")} onPress={load} />
            </>
          ) : (
            <ActivityIndicator color={tokens.mutedForeground} />
          )}
        </View>
      </>
    );
  }

  async function save() {
    if (!groupId || !group || pending) return;
    setPending(true);
    setError(null);
    try {
      const input: { groupId: string; name?: string; botIds?: string[] } = { groupId };
      if (name.trim() !== group.name) input.name = name.trim();
      const memberIds = group.members.map((member) => member.botId).join(",");
      if (selected.join(",") !== memberIds) input.botIds = selected;
      if (input.name || input.botIds) await rpc("groups/update", input);
      router.back();
    } catch (err) {
      setError(errorText(err, t("Could not save group")));
    } finally {
      setPending(false);
    }
  }

  function remove() {
    if (!groupId || !group || pending) return;
    Alert.alert(
      group.name,
      `${t("Delete this group? Bots and their solo threads are kept.")} ${t("This can't be undone.")}`,
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: () => {
            if (pending) return;
            setPending(true);
            void rpc("groups/remove", { groupId })
              .then(() => router.replace("/"))
              .catch((err) => {
                setPending(false);
                Alert.alert(t("Could not delete group"), errorText(err, t("Try again.")));
              });
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={glassHeaderOptions(t("Group settings"))} />
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{ padding: 24 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={{ color: tokens.mutedForeground, fontSize: 14 }}>{t("Name")}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={GROUP_NAME_MAX}
          editable={!pending}
          placeholder={t("Group name")}
          placeholderTextColor={tokens.mutedForeground}
          style={{
            marginTop: 8,
            backgroundColor: native.fill,
            borderRadius: 11,
            padding: 14,
            color: tokens.foreground,
            fontSize: 16,
          }}
        />
        <Text style={{ color: tokens.mutedForeground, fontSize: 14, marginTop: 20 }}>
          {t("Members")}
        </Text>
        <BotMemberPicker
          bots={bots}
          selected={selected}
          onChange={(nextSelected) => {
            const originalMembers = group.members.map((member) => member.botId);
            const retainedMembers = originalMembers.filter((id) => nextSelected.includes(id));
            const addedMembers = nextSelected.filter((id) => !originalMembers.includes(id));
            setSelected([...retainedMembers, ...addedMembers]);
          }}
          disabled={pending}
        />
        {error ? <Text style={{ color: tokens.destructive, marginTop: 12 }}>{error}</Text> : null}
        <NativeActionButton
          disabled={
            !name.trim() ||
            selected.length < GROUP_MEMBER_MIN ||
            selected.length > GROUP_MEMBER_MAX ||
            pending
          }
          label={pending ? t("Saving…") : t("Save")}
          onPress={() => void save()}
          style={{ marginTop: 24 }}
        />
        <NativeActionButton
          disabled={pending}
          label={t("Delete group")}
          onPress={remove}
          prominence="destructive"
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </>
  );
}
