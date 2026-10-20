import type { UiBlock } from "@rakazo/ui-artifact";
import { parseUiArtifact } from "@rakazo/ui-artifact";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";

type Chart = Extract<UiBlock, { type: "chart" }>;

/**
 * A stored UI artifact drawn with native views. The source is parsed into a closed set of blocks
 * and every string is a Text child, so nothing in it can add a link, an image or a request.
 */
export function UiArtifactPreview({ source }: { source: string }) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const parsed = useMemo(() => parseUiArtifact(source), [source]);
  return (
    <ScrollView contentContainerStyle={styles.page} contentInsetAdjustmentBehavior="automatic">
      {parsed.blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
      {parsed.problems.length || parsed.blocks.length === 0 ? (
        <Text style={styles.unsupported}>{t("Part of this can't be shown.")}</Text>
      ) : null}
    </ScrollView>
  );
}

function BlockView({ block }: { block: UiBlock }) {
  const styles = useThemedStyles(createStyles);
  const tokens = mobileTokens();
  const kids = (children: UiBlock[]) =>
    children.map((child, index) => <BlockView key={index} block={child} />);
  switch (block.type) {
    case "heading":
      return (
        <Text
          accessibilityRole="header"
          style={[
            styles.heading,
            (block.level ?? 2) === 1 && styles.h1,
            block.level === 3 && styles.h3,
          ]}
        >
          {block.text}
        </Text>
      );
    case "text":
      return <Text style={[styles.body, block.muted && styles.muted]}>{block.text}</Text>;
    case "metric": {
      const delta = block.delta;
      return (
        <View style={styles.metric}>
          <Text style={styles.small} numberOfLines={1}>
            {block.label}
          </Text>
          <Text style={styles.metricValue} numberOfLines={1}>
            {block.value}
          </Text>
          {delta ? (
            <Text
              style={[
                styles.small,
                delta.startsWith("+") && { color: tokens.success },
                delta.startsWith("-") && { color: tokens.destructive },
              ]}
              numberOfLines={1}
            >
              {delta}
            </Text>
          ) : null}
        </View>
      );
    }
    case "table":
      return (
        <ScrollView horizontal style={styles.table}>
          <View>
            <View style={styles.row}>
              {block.columns.map((column, index) => (
                <Text key={index} numberOfLines={1} style={[styles.cell, styles.head]}>
                  {column}
                </Text>
              ))}
            </View>
            {block.rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.row}>
                {block.columns.map((_, index) => {
                  const cell = row[index] ?? null;
                  return (
                    <Text
                      key={index}
                      numberOfLines={1}
                      style={[styles.cell, typeof cell === "number" && styles.number]}
                    >
                      {cell === null ? "" : String(cell)}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    case "list":
      return (
        <View style={styles.list}>
          {block.items.map((item, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.marker}>{block.ordered ? `${index + 1}.` : "•"}</Text>
              <Text style={[styles.body, styles.listText]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "badge": {
      const color =
        block.tone === "success"
          ? tokens.success
          : block.tone === "warning"
            ? tokens.warning
            : block.tone === "destructive"
              ? tokens.destructive
              : undefined;
      return (
        <View style={[styles.badge, color ? { borderColor: color } : null]}>
          <Text style={[styles.badgeText, color ? { color } : null]}>{block.text}</Text>
        </View>
      );
    }
    case "divider":
      return <View style={styles.divider} />;
    case "chart":
      return <ChartView chart={block} />;
    case "card":
      return (
        <View style={styles.card}>
          {block.title ? <Text style={styles.cardTitle}>{block.title}</Text> : null}
          {kids(block.children)}
        </View>
      );
    case "stack":
    case "grid":
      // A phone is too narrow for columns; a grid reads as a stack.
      return <View style={styles.stack}>{kids(block.children)}</View>;
    default:
      return null;
  }
}

const HEIGHT = 200;
const compact = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);

function ChartView({ chart }: { chart: Chart }) {
  const styles = useThemedStyles(createStyles);
  const tokens = mobileTokens();
  const [width, setWidth] = useState(0);
  const all = chart.series.flatMap((s) => s.values);
  const hi = Math.max(...all, 0);
  const lo = Math.min(...all, 0);
  const span = hi - lo || 1;
  const left = 40;
  const right = 8;
  const top = 8;
  const bottom = 20;
  const plotW = Math.max(width - left - right, 1);
  const plotH = HEIGHT - top - bottom;
  const y = (v: number) => top + plotH - ((v - lo) / span) * plotH;
  const n = chart.labels.length;
  const x = (i: number) => left + (plotW / n) * (i + 0.5);
  const barW = Math.min(24, ((plotW / n) * 0.7) / chart.series.length);
  const every = Math.ceil(n / Math.max(1, Math.floor(plotW / 56)));
  // Series are told apart by lightness: the app is monochrome.
  const opacity = (s: number) => [1, 0.7, 0.5, 0.38, 0.28, 0.2][s % 6];
  return (
    <View
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
      style={{ height: HEIGHT }}
    >
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {[lo, (lo + hi) / 2, hi].map((v, i) => (
            <G key={i}>
              <Line
                x1={left}
                x2={width - right}
                y1={y(v)}
                y2={y(v)}
                stroke={tokens.border}
                strokeWidth={1}
              />
              <SvgText
                x={left - 6}
                y={y(v) + 4}
                fontSize={11}
                fill={tokens.mutedForeground}
                textAnchor="end"
              >
                {compact(v)}
              </SvgText>
            </G>
          ))}
          {chart.labels.map((label, i) =>
            i % every === 0 ? (
              <SvgText
                key={i}
                x={x(i)}
                y={HEIGHT - 5}
                fontSize={11}
                fill={tokens.mutedForeground}
                textAnchor="middle"
              >
                {label.slice(0, 10)}
              </SvgText>
            ) : null,
          )}
          {chart.series.map((series, s) =>
            chart.kind === "bar" ? (
              series.values.map((v, i) => (
                <Rect
                  key={`${s}-${i}`}
                  x={x(i) - (barW * chart.series.length) / 2 + s * barW}
                  y={Math.min(y(v), y(0))}
                  width={Math.max(barW - 2, 1)}
                  height={Math.abs(y(v) - y(0))}
                  rx={2}
                  fill={tokens.foreground}
                  fillOpacity={opacity(s)}
                />
              ))
            ) : (
              <Polyline
                key={s}
                fill="none"
                stroke={tokens.foreground}
                strokeOpacity={opacity(s)}
                strokeWidth={2}
                points={series.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              />
            ),
          )}
        </Svg>
      ) : null}
    </View>
  );
}

function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    page: { padding: 16, gap: 14 },
    heading: { color: native.label, fontSize: 18, fontWeight: "600" },
    h1: { fontSize: 24 },
    h3: { fontSize: 16 },
    body: { color: native.label, fontSize: 15, lineHeight: 22 },
    muted: { color: native.secondaryLabel },
    small: { color: native.secondaryLabel, fontSize: 12 },
    unsupported: {
      color: native.secondaryLabel,
      fontSize: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: "dashed",
      borderColor: tokens.border,
      borderRadius: 10,
      padding: 10,
    },
    metric: { backgroundColor: native.groupedCell, borderRadius: 14, padding: 14, gap: 4 },
    metricValue: {
      color: native.label,
      fontSize: 24,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    card: { backgroundColor: native.groupedCell, borderRadius: 14, padding: 14, gap: 12 },
    cardTitle: { color: native.label, fontSize: 15, fontWeight: "600" },
    stack: { gap: 12 },
    table: { borderRadius: 12, backgroundColor: native.groupedCell, flexGrow: 0 },
    row: {
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.border,
    },
    cell: {
      width: 120,
      paddingHorizontal: 10,
      paddingVertical: 9,
      color: native.label,
      fontSize: 13,
    },
    head: { fontWeight: "600" },
    number: { textAlign: "right", fontVariant: ["tabular-nums"] },
    list: { gap: 6 },
    listItem: { flexDirection: "row", gap: 8 },
    marker: { color: native.secondaryLabel, fontSize: 15, lineHeight: 22, minWidth: 18 },
    listText: { flex: 1 },
    badge: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: tokens.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    badgeText: { color: native.label, fontSize: 12, fontWeight: "500" },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.border },
  });
}
