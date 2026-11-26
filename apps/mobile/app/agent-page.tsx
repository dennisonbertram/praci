import { ChatMarkdown } from "@rakazo/chat-ui/native";
import type { BotPage, BotPageSummary, PageData } from "@rakazo/contracts";
import { htmlPageSourcesFor } from "@rakazo/core";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { CappedList } from "../components/capped-list";
import { MenuPicker } from "../components/menu-picker";
import { NativeActionButton } from "../components/native-action-button";
import { NativeSymbol } from "../components/native-symbol";
import { SandboxedHtmlPreview } from "../components/sandboxed-html-preview";
import type { LiveCell } from "../lib/agent-page";
import { pageBlocks } from "../lib/agent-page";
import { rpc } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import {
  maskAmountsWhenHidden,
  maskSvgWhenHidden,
  setHideAmounts,
  useHideAmounts,
} from "../lib/hide-amounts";
import { useI18n } from "../lib/i18n";
import { native, useResolvedAppearance, useThemedStyles } from "../lib/native";
import { iosAtLeast } from "../lib/native-controls";
import { errorText } from "../lib/user-error";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; page: BotPage | null };
type State = { botId: string; pageId?: string; value: PageState } | PageState;

export default function AgentPageScreen() {
  const { botId, pageId: openPageId } = useLocalSearchParams<{
    botId: string;
    pageId?: string;
  }>();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const tokens = mobileTokens();
  const colorScheme = useResolvedAppearance();
  const [state, setState] = useState<State>({ status: "loading" });
  // A bot with several pages shows a menu to switch; without a choice, the first page opens.
  const [pages, setPages] = useState<{ botId: string; rows: BotPageSummary[] }>({
    botId,
    rows: [],
  });
  const [pagesError, setPagesError] = useState(false);
  const [pagesReload, setPagesReload] = useState(0);
  const [selection, setSelection] = useState<{
    botId: string;
    pageId?: string;
  }>({ botId, pageId: openPageId });
  const pageId = selection.botId === botId ? selection.pageId : openPageId;
  const visibleState =
    "botId" in state && state.botId === botId && state.pageId === pageId
      ? state.value
      : { status: "loading" as const };
  const visiblePages = pages.botId === botId ? pages.rows : [];
  const [live, setLive] = useState<PageData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<{
    botId: string;
    pageId?: string;
    message: string;
  } | null>(null);
  const currentSelection = useRef({ botId, pageId });
  currentSelection.current = { botId, pageId };
  const navigation = useNavigation();
  const switchPage = (next: string) => {
    setLive(null);
    setRefreshError(null);
    setSelection({ botId, pageId: next });
  };
  const hidden = useHideAmounts();

  useEffect(() => {
    setLive(null);
    setRefreshError(null);
  }, [botId, pageId]);

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
                icon: {
                  type: "sfSymbol" as const,
                  name: hidden ? "eye.slash" : "eye",
                },
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
      rpc<BotPageSummary[]>("pages/list", { botId })
        .then((list) => {
          if (cancelled) return;
          setPages({ botId, rows: list });
          setPagesError(false);
        })
        .catch(() => !cancelled && setPagesError(true));
      rpc<BotPage | null>("pages/get", { botId, pageId, chartSvgs: true })
        .then((page) => !cancelled && setState({ botId, pageId, value: { status: "ready", page } }))
        .catch((error: unknown) => {
          // Keep an already-loaded page on screen when a refresh fails.
          if (!cancelled) {
            const notFound =
              typeof error === "object" &&
              error !== null &&
              "status" in error &&
              error.status === 404;
            if (notFound) setLive(null);
            setState((prev) => {
              return "value" in prev &&
                prev.botId === botId &&
                prev.pageId === pageId &&
                prev.value.status === "ready" &&
                !notFound
                ? prev
                : {
                    botId,
                    pageId,
                    value: {
                      status: "error",
                      message: errorText(error, t("Could not load this page.")),
                    },
                  };
            });
          }
        });
      // Live data is optional: a failed request leaves the blocks on their last data.
      rpc<PageData | null>("pages/data", { botId, pageId })
        .then((data) => !cancelled && setLive(data))
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [botId, pageId, pagesReload, t]),
  );

  const retryPages = () => {
    setPagesError(false);
    setPagesReload((value) => value + 1);
  };

  const refresh = useCallback(async () => {
    const requested = { botId, pageId };
    setRefreshing(true);
    try {
      const data = await rpc<PageData | null>("pages/refresh", requested);
      if (
        currentSelection.current.botId === requested.botId &&
        currentSelection.current.pageId === requested.pageId
      ) {
        setLive(data);
        setRefreshError(null);
      }
    } catch (error) {
      if (
        currentSelection.current.botId === requested.botId &&
        currentSelection.current.pageId === requested.pageId
      ) {
        const message = errorText(error);
        setRefreshError({ ...requested, message });
        AccessibilityInfo.announceForAccessibility(message);
      }
    } finally {
      setRefreshing(false);
    }
  }, [botId, pageId]);

  const page = visibleState.status === "ready" ? visibleState.page : null;
  // Data for another revision would pair with the wrong blocks, so it is ignored until refetched.
  const liveBlocks =
    page && live && "blocks" in live && live.pageId === page.id && live.revision === page.revision
      ? live.blocks
      : undefined;
  // Only data for this page and revision reaches the preview; it starts empty after a page switch.
  const htmlSources = htmlPageSourcesFor(page, live);
  const blocks = useMemo(
    () => (page ? pageBlocks(page.content, page.chartSvgs, liveBlocks) : []),
    [page, liveBlocks],
  );
  const placeholder = (status: string) =>
    status === "pending"
      ? t("Waiting for approval")
      : status === "denied"
        ? t("Not approved")
        : status === "missing"
          ? t("Source not found")
          : status === "paused"
            ? t("Paused")
            : t("No data yet");
  const cellText = ({ text, usd }: LiveCell) => (usd ? maskAmountsWhenHidden(text) : text);
  const warning = (status: string) => (
    <View
      accessible
      accessibilityLabel={status === "paused" ? t("Source paused") : t("Source failed")}
    >
      <NativeSymbol
        ios="exclamationmark.triangle.fill"
        android="warning-outline"
        size={14}
        color={tokens.warning}
      />
    </View>
  );

  if (visibleState.status !== "ready" || !page) {
    return (
      <View style={styles.centered}>
        {visibleState.status === "loading" ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={styles.message}>
              {visibleState.status === "error" ? visibleState.message : t("No page yet.")}
            </Text>
            {visibleState.status === "error" ? (
              <NativeActionButton label={t("Try again")} onPress={retryPages} />
            ) : null}
          </>
        )}
      </View>
    );
  }

  if (page.kind === "html") {
    return (
      <View style={styles.screen}>
        {pagesError ? (
          <View style={styles.pagePickerError}>
            <Text style={styles.error}>{t("Could not load this page.")}</Text>
            <NativeActionButton label={t("Try again")} onPress={retryPages} />
          </View>
        ) : null}
        {visiblePages.length > 1 ? (
          <View style={styles.content}>
            <MenuPicker
              label={t("Page")}
              choices={visiblePages.map((entry) => ({
                key: entry.id,
                label: entry.title,
              }))}
              value={pageId ?? page.id}
              onChange={switchPage}
            />
          </View>
        ) : null}
        <SandboxedHtmlPreview
          key={`${page.id}:${page.revision}`}
          html={page.content}
          data={htmlSources}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {pagesError ? (
        <View style={styles.pagePickerError}>
          <Text style={styles.error}>{t("Could not load this page.")}</Text>
          <NativeActionButton label={t("Try again")} onPress={retryPages} />
        </View>
      ) : null}
      {refreshError?.botId === botId && refreshError.pageId === pageId ? (
        <View style={styles.pagePickerError}>
          <Text style={styles.error}>{refreshError.message}</Text>
        </View>
      ) : null}
      {visiblePages.length > 1 ? (
        <MenuPicker
          label={t("Page")}
          choices={visiblePages.map((entry) => ({
            key: entry.id,
            label: entry.title,
          }))}
          value={pageId ?? page.id}
          onChange={switchPage}
        />
      ) : null}
      {blocks.map((block, index) =>
        block.kind === "markdown" ? (
          <ChatMarkdown key={index} palette={tokens} colorScheme={colorScheme}>
            {block.text}
          </ChatMarkdown>
        ) : block.kind === "chart" ? (
          <View key={index} accessible accessibilityLabel={block.name} style={styles.chart}>
            <SvgXml xml={hidden ? maskSvgWhenHidden(block.svg) : block.svg} width="100%" />
          </View>
        ) : block.kind === "metric" ? (
          <View key={index}>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{block.label}</Text>
              {block.status === "failed" || block.status === "paused"
                ? warning(block.status)
                : null}
              <Text style={styles.value}>
                {block.value ? cellText(block.value) : placeholder(block.status)}
              </Text>
            </View>
            {(block.status === "failed" || block.status === "paused") && block.error ? (
              <Text style={styles.error}>{block.error}</Text>
            ) : null}
          </View>
        ) : block.kind === "table" ? (
          <View key={index} style={styles.table}>
            <Text style={styles.caption}>{block.name}</Text>
            {block.hasRows ? (
              <View style={styles.group}>
                <CappedList
                  items={block.rows.map((row, rowIndex) => ({ row, rowIndex }))}
                  title={block.name}
                  keyOf={({ rowIndex }) => String(rowIndex)}
                  searchFields={({ row }) =>
                    [row.title, ...row.details].map((cell) => cellText(cell))
                  }
                  renderItem={({ row }) => (
                    <View style={styles.tableRow}>
                      <Text style={styles.rowTitle}>{cellText(row.title)}</Text>
                      {row.details.length > 0 ? (
                        <Text style={styles.detail}>
                          {row.details.map((detail) => cellText(detail)).join(" · ")}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />
              </View>
            ) : (
              <Text style={styles.detail}>{placeholder(block.status)}</Text>
            )}
            {block.status === "failed" || block.status === "paused" ? (
              <View style={styles.failed}>
                {warning(block.status)}
                {block.error ? <Text style={styles.error}>{block.error}</Text> : null}
              </View>
            ) : null}
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
    message: {
      color: native.secondaryLabel,
      fontSize: 14,
      textAlign: "center",
    },
    chart: { width: "100%" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: native.groupedCell,
    },
    rowTitle: { flex: 1, color: native.label, fontSize: 16 },
    value: { color: native.label, fontSize: 16, fontVariant: ["tabular-nums"] },
    detail: { color: native.secondaryLabel, fontSize: 14 },
    error: {
      color: native.secondaryLabel,
      fontSize: 13,
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    failed: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
    },
    caption: {
      color: native.secondaryLabel,
      fontSize: 13,
      paddingHorizontal: 16,
    },
    table: { gap: 6 },
    group: {
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: native.groupedCell,
    },
    tableRow: {
      gap: 2,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: native.separator,
    },
    headerButton: { padding: 8 },
    pagePickerError: { alignItems: "flex-start", gap: 4, paddingVertical: 6 },
  });
}
