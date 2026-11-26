import type { Bot } from "@rakazo/contracts";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { NativeActionButton } from "../components/native-action-button";
import { currentApiBase, rpc, selectedSpaceId } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { currentSessionGeneration } from "../lib/session";
import { errorText } from "../lib/user-error";
import DataRoomScreen from "./data-room";

export default function ScannerScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  useFocusEffect(
    useCallback(() => {
      void rpc("scanner/agent").catch(() => undefined);
      return () => {
        generation.current += 1;
      };
    }, []),
  );
  const openAgent = async () => {
    if (pending.current) return;
    pending.current = true;
    const current = generation.current;
    const scope = () =>
      JSON.stringify([currentSessionGeneration(), currentApiBase(), selectedSpaceId()]);
    const started = scope();
    setBusy(true);
    try {
      const bot = await rpc<Bot>("scanner/agent");
      if (current === generation.current && started === scope())
        router.push({ pathname: "/thread", params: { botId: bot.id, name: bot.name } });
    } catch (cause) {
      if (current === generation.current && started === scope())
        Alert.alert(t("Scanner"), errorText(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <NativeActionButton
              label={t("Ask agent")}
              accessibilityLabel={t("Ask Scanner agent")}
              prominence="plain"
              busy={busy}
              onPress={() => void openAgent()}
            />
          ),
        }}
      />
      <DataRoomScreen source="scan" />
    </>
  );
}
