import { ChatMarkdown } from "@rakazo/chat-ui/native";
import type { BotPage } from "@rakazo/contracts";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { NativeSymbol } from "../components/native-symbol";
import { pageBlocks } from "../lib/agent-page";
import { rpc } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { maskSvgWhenHidden, setHideAmounts, useHideAmounts } from "../lib/hide-amounts";
import { useI18n } from "../lib/i18n";
import { native, useResolvedAppearance, useThemedStyles } from "../lib/native";
import { iosAtLeast } from "../lib/native-controls";
import { errorText } from "../lib/user-error";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; page: BotPage | null };

export default function AgentPageScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const tokens = mobileTokens();
  const colorScheme = useResolvedAppearance();
  const [state, setState] = useState<State>({ status: "loading" });
  const navigation = useNavigation();
  const hidden = useHideAmounts();

  useLayoutEffect(() => {
    const label = hidden ? t("Show amounts") : t("Hide amounts");
    const toggle = () => void setHideAmounts(!hidden);
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityLabel={label}
          hitSlop={8}
          onPress={toggle}
          style={styles.headerButton}
        >
          <NativeSymbol
            ios={hidden ? "eye.slash" : "eye"}
            android={hidden ? "eye-off-outline" : "eye-outline"}
            size={19}
          />
        </Pressable>
      ),
      ...(iosAtLeast(26)
        ? {
            unstable_headerRightItems: () => [
              {
                type: "button" as const,
                label,
                icon: { type: "sfSymbol" as const, name: hidden ? "eye.slash" : "eye" },
                onPress: toggle,
              },
            ],
          }
        : {}),
    });
  }, [hidden, navigation, styles, t]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      rpc<BotPage | null>("pages/get", { botId, chartSvgs: true })
        .then((page) => !cancelled && setState({ status: "ready", page }))
        .catch((error: unknown) => {
          // Keep an already-loaded page on screen when a refresh fails.
          if (!cancelled)
            setState((prev) =>
              prev.status === "ready"
                ? prev
                : { status: "error", message: errorText(error, t("Could not load this page.")) },
            );
        });
      return () => {
        cancelled = true;
      };
    }, [botId, t]),
  );

  const page = state.status === "ready" ? state.page : null;
  const blocks = useMemo(() => (page ? pageBlocks(page.content, page.chartSvgs) : []), [page]);

  if (state.status !== "ready" || !page) {
    return (
      <View style={styles.centered}>
        {state.status === "loading" ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.message}>
            {state.status === "error" ? state.message : t("No page yet.")}
          </Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      {blocks.map((block, index) =>
        block.kind === "markdown" ? (
          <ChatMarkdown key={index} palette={tokens} colorScheme={colorScheme}>
            {block.text}
          </ChatMarkdown>
        ) : block.kind === "chart" ? (
          <View key={index} accessible accessibilityLabel={block.name} style={styles.chart}>
            <SvgXml xml={hidden ? maskSvgWhenHidden(block.svg) : block.svg} width="100%" />
          </View>
        ) : (
          <Text key={index} style={styles.message}>
            {t("Chart could not be drawn.")}
          </Text>
        ),
      )}
    </ScrollView>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    content: { padding: 20, gap: 12 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: native.page,
    },
    message: { color: native.secondaryLabel, fontSize: 14, textAlign: "center" },
    chart: { width: "100%" },
    headerButton: { padding: 8 },
  });
}
