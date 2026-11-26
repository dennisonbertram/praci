import type { InboxMessage } from "@rakazo/contracts";
import { htmlHasVisibleContent } from "@rakazo/core";
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
import { NativeActionButton } from "../components/native-action-button";
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
  const [messageForId, setMessageForId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const openingAgentRef = useRef(false);
  const currentMessage = messageForId === messageId ? message : null;

  useEffect(() => {
    let current = true;
    setMessage(null);
    setMessageForId(null);
    setError("");
    void getMailMessage(messageId)
      .then((next) => {
        if (!current) return;
        setMessage(next);
        setMessageForId(messageId);
      })
      .catch((cause: unknown) => current && setError(errorText(cause, t("Could not load mail."))));
    return () => {
      current = false;
    };
  }, [attempt, messageId, t]);

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
      title: currentMessage?.subject ?? "",
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
  }, [currentMessage?.subject, navigation, openAgent, styles, t]);

  // Links open in the system browser; the module is loaded on first use so older binaries still start.
  const openLink = useCallback(async (url: string) => {
    try {
      const { openBrowserAsync } = await import("expo-web-browser");
      await openBrowserAsync(url);
    } catch (cause) {
      Alert.alert(errorText(cause));
    }
  }, []);

  if (!currentMessage) {
    return (
      <View style={styles.centered}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <NativeActionButton
              label={t("Try again")}
              fill={false}
              onPress={() => setAttempt((n) => n + 1)}
            />
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  const sent = new Date(currentMessage.date);
  const date = Number.isNaN(sent.getTime())
    ? currentMessage.date
    : sent.toLocaleString(dateLocaleForUi(), { dateStyle: "medium", timeStyle: "short" });
  return (
    <View style={[styles.screen, iosAtLeast(26) && { paddingTop: headerHeight }]}>
      <View style={styles.meta}>
        <Text style={styles.from} selectable>
          {currentMessage.from}
        </Text>
        <Text style={styles.metaLine} selectable>
          {currentMessage.to}
        </Text>
        {currentMessage.cc ? (
          <Text style={styles.metaLine} selectable>
            {t("Cc")} {currentMessage.cc}
          </Text>
        ) : null}
        <View style={styles.dateRow}>
          <Text style={styles.metaLine}>{date}</Text>
          {currentMessage.fromSelf ? (
            <View style={styles.sent} accessible accessibilityLabel={t("Sent")}>
              <NativeSymbol ios="checkmark" android="checkmark" size={12} color={tokens.success} />
              <Text style={styles.metaLine}>{t("Sent")}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {currentMessage.attachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chips}
          contentContainerStyle={styles.chipsRow}
        >
          {currentMessage.attachments.map((attachment) => (
            <Pressable
              key={attachment.id}
              accessibilityRole="button"
              accessibilityLabel={attachment.filename}
              style={styles.chip}
              onPress={() =>
                router.push({
                  pathname: "/inbox-attachment",
                  params: {
                    messageId,
                    attachmentId: attachment.id,
                    filename: attachment.filename,
                    mimeType: attachment.mimeType,
                    size: String(attachment.size),
                  },
                })
              }
            >
              <NativeSymbol ios="paperclip" android="attach-outline" size={14} />
              <Text style={styles.chipText} numberOfLines={1}>
                {attachment.filename}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {currentMessage.html && htmlHasVisibleContent(currentMessage.html) ? (
        <SandboxedHtmlPreview html={currentMessage.html} email onOpenLink={openLink} />
      ) : (
        <ScrollView contentContainerStyle={styles.text}>
          <Text style={styles.body} selectable>
            {currentMessage.text}
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
    chips: { flexGrow: 0, flexShrink: 0 },
    chipsRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: 220,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: native.separator,
    },
    chipText: { color: native.label, fontSize: 13, flexShrink: 1 },
  });
}
