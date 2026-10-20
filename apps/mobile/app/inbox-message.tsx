import type { InboxMessage } from "@rakazo/contracts";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeSymbol } from "../components/native-symbol";
import { SandboxedHtmlPreview } from "../components/sandboxed-html-preview";
import { dateLocaleForUi, useI18n } from "../lib/i18n";
import { askMailThreadAgent, ensureMailAgent, getMailMessage } from "../lib/mail-inbox";
import { native, useMobileTokens, useThemedStyles } from "../lib/native";
import { iosAtLeast } from "../lib/native-controls";
import { errorText } from "../lib/user-error";

const AGENT_SYMBOL = "bubble.left";
const ASK_SYMBOL = "sparkles";

export default function InboxMessageScreen() {
  const { messageId } = useLocalSearchParams<{ messageId: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const tokens = useMobileTokens();
  // The iOS 26 header floats over the content, so the message starts below it.
  const headerHeight = useHeaderHeight();
  const [message, setMessage] = useState<InboxMessage | null>(null);
  const [error, setError] = useState("");
  const openingAgentRef = useRef(false);

  useEffect(() => {
    let current = true;
    getMailMessage(messageId)
      .then((next) => current && setMessage(next))
      .catch((cause: unknown) => current && setError(errorText(cause, t("Could not load mail."))));
    return () => {
      current = false;
    };
  }, [messageId, t]);

  const openAgent = useCallback(
    async (thread = false) => {
      if (openingAgentRef.current) return;
      openingAgentRef.current = true;
      try {
        // Each returns the same bot every time, creating it only if it does not exist yet.
        const bot = await (thread ? askMailThreadAgent(messageId) : ensureMailAgent());
        router.push({ pathname: "/thread", params: { botId: bot.id, name: bot.name } });
      } catch (cause) {
        Alert.alert(errorText(cause));
      } finally {
        openingAgentRef.current = false;
      }
    },
    [router, messageId],
  );

  useLayoutEffect(() => {
    const label = t("Inbox agent");
    const askLabel = t("Ask agent");
    navigation.setOptions({
      title: message?.subject ?? "",
      ...(iosAtLeast(26)
        ? {
            unstable_headerRightItems: () => [
              {
                type: "button" as const,
                accessibilityLabel: label,
                icon: { type: "sfSymbol" as const, name: AGENT_SYMBOL },
                onPress: () => void openAgent(),
              },
              {
                type: "button" as const,
                accessibilityLabel: askLabel,
                icon: { type: "sfSymbol" as const, name: ASK_SYMBOL },
                onPress: () => void openAgent(true),
              },
            ],
          }
        : {
            headerRight: () => (
              <View style={styles.headerButtons}>
                <Pressable
                  accessibilityLabel={askLabel}
                  hitSlop={8}
                  onPress={() => void openAgent(true)}
                  style={styles.headerButton}
                >
                  <NativeSymbol ios={ASK_SYMBOL} android="sparkles-outline" size={19} />
                </Pressable>
                <Pressable
                  accessibilityLabel={label}
                  hitSlop={8}
                  onPress={() => void openAgent()}
                  style={styles.headerButton}
                >
                  <NativeSymbol ios={AGENT_SYMBOL} android="chatbubble-outline" size={19} />
                </Pressable>
              </View>
            ),
          }),
    });
  }, [message?.subject, navigation, openAgent, styles, t]);

  // Links open in the system browser; the module is loaded on first use so older binaries still start.
  const openLink = useCallback(async (url: string) => {
    try {
      const { openBrowserAsync } = await import("expo-web-browser");
      await openBrowserAsync(url);
    } catch (cause) {
      Alert.alert(errorText(cause));
    }
  }, []);

  if (!message) {
    return (
      <View style={styles.centered}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const sent = new Date(message.date);
  const date = Number.isNaN(sent.getTime())
    ? message.date
    : sent.toLocaleString(dateLocaleForUi(), { dateStyle: "medium", timeStyle: "short" });
  return (
    <View style={[styles.screen, iosAtLeast(26) && { paddingTop: headerHeight }]}>
      <View style={styles.meta}>
        <Text style={styles.from} selectable>
          {message.from}
        </Text>
        <Text style={styles.metaLine} selectable>
          {message.to}
        </Text>
        <View style={styles.dateRow}>
          <Text style={styles.metaLine}>{date}</Text>
          {message.fromSelf ? (
            <View style={styles.sent} accessible accessibilityLabel={t("Sent")}>
              <NativeSymbol ios="checkmark" android="checkmark" size={12} color={tokens.success} />
              <Text style={styles.metaLine}>{t("Sent")}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {message.html ? (
        <SandboxedHtmlPreview html={message.html} email onOpenLink={openLink} />
      ) : (
        <ScrollView contentContainerStyle={styles.text}>
          <Text style={styles.body} selectable>
            {message.text}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    error: { color: native.secondaryLabel, fontSize: 15, textAlign: "center" },
    meta: { paddingHorizontal: 16, paddingVertical: 10, gap: 2 },
    from: { color: native.label, fontSize: 15, fontWeight: "600" },
    metaLine: { color: native.secondaryLabel, fontSize: 12.5 },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sent: { flexDirection: "row", alignItems: "center", gap: 3 },
    text: { padding: 16 },
    body: { color: native.label, fontSize: 15, lineHeight: 21 },
    headerButton: { padding: 8 },
    headerButtons: { flexDirection: "row" },
  });
}
