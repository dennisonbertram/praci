import { GROUP_MEMBER_MAX, GROUP_MEMBER_MIN, GROUP_NAME_MAX } from "@rakazo/contracts";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput } from "react-native";
import { BotMemberPicker } from "../components/bot-member-picker";
import { NativeActionButton } from "../components/native-action-button";
import type { MobileBot } from "../lib/api";
import { rpc } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { native, useMobileTokens } from "../lib/native";
import { errorText } from "../lib/user-error";

export default function NewGroup() {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const router = useRouter();
  const [bots, setBots] = useState<MobileBot[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingBots, setLoadingBots] = useState(true);
  const [botsLoadFailed, setBotsLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const mounted = useRef(false);

  async function loadBots() {
    setLoadingBots(true);
    setBotsLoadFailed(false);
    try {
      const nextBots = await rpc<MobileBot[]>("bots/list");
      if (mounted.current) setBots(nextBots.filter((bot) => !bot.archivedAt));
    } catch {
      if (mounted.current) setBotsLoadFailed(true);
    } finally {
      if (mounted.current) setLoadingBots(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void loadBots();
    return () => {
      mounted.current = false;
    };
  }, []);

  async function create() {
    if (
      !name.trim() ||
      selected.length < GROUP_MEMBER_MIN ||
      selected.length > GROUP_MEMBER_MAX ||
      pending
    )
      return;
    setPending(true);
    setError(null);
    try {
      const group = await rpc<{ id: string; name: string }>("groups/create", {
        name: name.trim(),
        botIds: selected,
      });
      if (!mounted.current) return;
      router.replace({
        pathname: "/group-thread",
        params: { groupId: group.id, name: group.name },
      });
    } catch (err) {
      if (!mounted.current) return;
      setError(errorText(err, t("Could not create group")));
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t("New group") }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{ padding: 24 }}
      >
        <Text style={{ color: tokens.mutedForeground, fontSize: 14 }}>{t("Name")}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={GROUP_NAME_MAX}
          returnKeyType="done"
          onSubmitEditing={() => void create()}
          placeholder={t("Name this group")}
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
        {loadingBots ? <ActivityIndicator /> : null}
        {!loadingBots && botsLoadFailed ? (
          <>
            <Text style={{ color: tokens.destructive, marginTop: 12 }}>
              {t("Could not load bots")}
            </Text>
            <NativeActionButton
              label={t("Try again")}
              onPress={() => void loadBots()}
              prominence="secondary"
              style={{ marginTop: 12 }}
            />
          </>
        ) : null}
        {!loadingBots && !botsLoadFailed ? (
          <BotMemberPicker
            bots={bots}
            selected={selected}
            onChange={setSelected}
            disabled={pending}
          />
        ) : null}
        {error ? <Text style={{ color: tokens.destructive, marginTop: 12 }}>{error}</Text> : null}
        <NativeActionButton
          disabled={
            !name.trim() ||
            selected.length < GROUP_MEMBER_MIN ||
            selected.length > GROUP_MEMBER_MAX ||
            pending
          }
          label={pending ? t("Creating…") : t("Create group")}
          onPress={() => void create()}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </>
  );
}
