import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { getSpreadsheetPreview } from "../lib/artifacts";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";

type Cell = string | number | boolean | null;
type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unsupported" }
  | { status: "ready"; header: Cell[]; rows: Cell[][] };

const show = (cell: Cell) => (cell === null ? "" : String(cell));

/** A read-only table of the first sheet (up to 200 rows). The server reads the file. */
export function SheetArtifactPreview({ artifactId }: { artifactId: string }) {
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void getSpreadsheetPreview(artifactId)
      .then((page) => {
        if (cancelled) return;
        setState(
          page.status === "ready"
            ? { status: "ready", header: page.header, rows: page.rows.map((row) => row.cells) }
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
    };
  }, [artifactId, t]);

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
  const table = [state.header, ...state.rows];
  return (
    <ScrollView horizontal>
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
                  typeof cell === "number" && styles.number,
                ]}
              >
                {show(cell)}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

function createStyles() {
  return StyleSheet.create({
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
