import { formatSheetCell, isNumericSheetCell } from "@rakazo/core";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SheetSource } from "../lib/artifacts";
import { getSpreadsheetPreview } from "../lib/artifacts";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";
import { NativeSegmentedControl } from "./native-segmented-control";

type Cell = string | number | boolean | null;
type Ready = {
  status: "ready";
  sheets: string[];
  sheet: string;
  header: Cell[];
  rows: Cell[][];
  truncated: boolean;
  note?: string;
};
type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unsupported" }
  | Ready;

/** A read-only table of one sheet. The server reads the file; more rows load on request. */
export function SheetArtifactPreview({ source }: { source: SheetSource }) {
  const { t, locale } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [sheet, setSheet] = useState<string | undefined>(undefined);
  const [state, setState] = useState<State>({ status: "loading" });
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  // Bumped whenever the artifact or sheet changes, so a late "Load more" page is dropped.
  const generation = useRef(0);
  const sourceKey = JSON.stringify(source);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    setMore("idle");
    void getSpreadsheetPreview(source, { sheet })
      .then((page) => {
        if (cancelled) return;
        setState(
          page.status === "ready"
            ? {
                status: "ready",
                sheets: page.sheets.map((entry) => entry.name),
                sheet: page.sheet,
                header: page.header,
                rows: page.rows.map((row) => row.cells),
                truncated: page.truncated,
                note: page.note,
              }
            : { status: "unsupported" },
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: errorText(error, t("Could not load this artifact.")),
          });
        }
      });
    return () => {
      cancelled = true;
      generation.current += 1;
    };
  }, [sourceKey, sheet, t]);

  const loadMore = () => {
    if (state.status !== "ready") return;
    const current = state;
    const started = generation.current;
    setMore("loading");
    getSpreadsheetPreview(source, { sheet: current.sheet, offset: current.rows.length })
      .then((next) => {
        if (started !== generation.current) return;
        if (next.status !== "ready") throw new Error("unsupported");
        // A page with no rows ends the sheet (a wide sheet can be cut short with nothing left).
        setState({
          ...current,
          rows: [...current.rows, ...next.rows.map((row) => row.cells)],
          truncated: next.truncated && next.rows.length > 0,
        });
        setMore("idle");
      })
      .catch(() => {
        if (started === generation.current) setMore("error");
      });
  };

  if (state.status === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={native.secondaryLabel} />
      </View>
    );
  }
  if (state.status !== "ready") {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          {state.status === "error" ? state.message : t("No preview for this file type.")}
        </Text>
      </View>
    );
  }
  const empty = state.header.length === 0 && state.rows.length === 0;
  const table = [state.header, ...state.rows];
  return (
    <View style={styles.fill}>
      {state.sheets.length > 1 ? (
        <View style={styles.sheets}>
          <NativeSegmentedControl
            accessibilityLabel={t("Sheets")}
            value={state.sheet}
            onChange={setSheet}
            options={state.sheets.map((name) => ({ value: name, label: name }))}
          />
        </View>
      ) : null}
      {state.note ? <Text style={styles.note}>{state.note}</Text> : null}
      {empty ? (
        <View style={styles.centered}>
          <Text style={styles.message}>{t("This sheet is empty.")}</Text>
        </View>
      ) : (
        <ScrollView horizontal style={styles.fill}>
          <ScrollView>
            {table.map((cells, index) => (
              <View key={index} style={styles.row}>
                {cells.map((cell, column) => (
                  <Text
                    key={column}
                    numberOfLines={1}
                    style={[
                      styles.cell,
                      index === 0 && styles.head,
                      isNumericSheetCell(cell) && styles.number,
                    ]}
                  >
                    {formatSheetCell(cell, locale)}
                  </Text>
                ))}
              </View>
            ))}
            {state.truncated ? (
              <View style={styles.footer}>
                {more === "loading" ? (
                  <ActivityIndicator color={native.secondaryLabel} />
                ) : (
                  <Pressable accessibilityRole="button" onPress={loadMore}>
                    <Text style={styles.action}>{t("Load more")}</Text>
                  </Pressable>
                )}
                {more === "error" ? (
                  <Text style={styles.message}>{t("Could not load more rows.")}</Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    fill: { flex: 1 },
    sheets: { paddingHorizontal: 12, paddingVertical: 8 },
    note: { color: native.secondaryLabel, fontSize: 12, paddingHorizontal: 12, paddingBottom: 8 },
    footer: { alignItems: "center", gap: 8, padding: 12 },
    action: { color: native.label, fontSize: 15, fontWeight: "600" },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    message: { color: native.secondaryLabel, fontSize: 14, textAlign: "center" },
    row: {
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: native.separator,
    },
    cell: {
      width: 120,
      paddingHorizontal: 8,
      paddingVertical: 8,
      color: native.label,
      fontSize: 13,
    },
    head: { fontWeight: "600" },
    number: { textAlign: "right", fontVariant: ["tabular-nums"] },
  });
}
