import type { DataRoomApiItem } from "@rakazo/contracts";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, View } from "react-native";
import { NativeActionButton } from "../components/native-action-button";
import { PdfPreview } from "../components/pdf-preview";
import { SheetArtifactPreview } from "../components/sheet-artifact-preview";
import { UiArtifactPreview } from "../components/ui-artifact-preview";
import { currentApiBase, selectedSpaceId } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { shareLocalFile } from "../lib/artifact-open";
import { dataRoomPreviewKind, dataRoomStatus, getDataRoomItem } from "../lib/data-room";
import type { DataRoomFile } from "../lib/data-room-file";
import { downloadDataRoomFile } from "../lib/data-room-file";
import { useFloatingHeaderInset } from "../lib/floating-header";
import { useI18n } from "../lib/i18n";
import { PREVIEW_MAX_BYTES } from "../lib/mail-attachment";
import { native, useThemedStyles } from "../lib/native";
import { currentSessionGeneration, subscribeSessionGeneration } from "../lib/session";
import { errorText } from "../lib/user-error";

export default function DataRoomItemScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const navigation = useNavigation();
  const headerInset = useFloatingHeaderInset();
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const [item, setItem] = useState<DataRoomApiItem | null>(null);
  const [preview, setPreview] = useState<{ uri: string; source?: string } | null>(null);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const file = useRef<DataRoomFile | null>(null);
  const request = useRef<AbortController | null>(null);
  const sharing = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      request.current = controller;
      const generation = currentSessionGeneration();
      const apiBase = currentApiBase();
      const spaceId = selectedSpaceId();
      const current = () =>
        !controller.signal.aborted &&
        generation === currentSessionGeneration() &&
        apiBase === currentApiBase() &&
        spaceId === selectedSpaceId();
      setItem(null);
      setPreview(null);
      setError("");
      setPreviewError("");
      setBusy(false);
      sharing.current = false;
      void getDataRoomItem(itemId)
        .then(async (next) => {
          if (!current()) return;
          setItem(next);
          const kind = dataRoomPreviewKind(next);
          if (kind === "sheet" || kind === "other" || (kind === "pdf" && Platform.OS === "android"))
            return;
          setBusy(true);
          try {
            const downloaded = await downloadDataRoomFile(next, controller.signal);
            if (!current()) {
              downloaded.dispose();
              return;
            }
            file.current = downloaded;
            if (downloaded.file.size > PREVIEW_MAX_BYTES)
              throw new Error(t("This file is too large to preview."));
            const source = kind === "ui" ? await downloaded.file.text() : undefined;
            downloaded.assertCurrent();
            if (current()) setPreview({ uri: downloaded.file.uri, source });
          } catch (cause) {
            if (current()) setPreviewError(errorText(cause, t("Could not preview this file.")));
          } finally {
            if (current()) setBusy(false);
          }
        })
        .catch((cause: unknown) => {
          if (current()) setError(errorText(cause, t("Could not load this file.")));
        });
      return () => {
        controller.abort();
        file.current?.dispose();
        file.current = null;
      };
    }, [itemId, attempt, t]),
  );

  useEffect(
    () =>
      subscribeSessionGeneration(() => {
        request.current?.abort();
        file.current?.dispose();
        file.current = null;
        setItem(null);
        setPreview(null);
        setError(t("The session changed. Open the file again."));
      }),
    [t],
  );

  const share = useCallback(async () => {
    const controller = request.current;
    if (!item || !controller || controller.signal.aborted || sharing.current || busy) return;
    sharing.current = true;
    setBusy(true);
    try {
      const downloaded = file.current ?? (await downloadDataRoomFile(item, controller.signal));
      downloaded.assertCurrent();
      file.current = downloaded;
      await shareLocalFile(downloaded.file.uri, item.mimeType, item.name);
    } catch (cause) {
      if (!controller.signal.aborted) Alert.alert(t("Could not share this file"), errorText(cause));
    } finally {
      if (!controller.signal.aborted) {
        sharing.current = false;
        setBusy(false);
      }
    }
  }, [item, busy, t]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: item?.name ?? t("File"),
      headerRight: () => (
        <NativeActionButton
          label={t("Share")}
          prominence="plain"
          size="compact"
          disabled={!item || busy}
          onPress={() => void share()}
        />
      ),
    });
  }, [navigation, item, busy, share, t]);

  if (error)
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <NativeActionButton
          label={t("Retry")}
          prominence="quiet"
          onPress={() => setAttempt((value) => value + 1)}
        />
      </View>
    );
  if (!item)
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  const kind = dataRoomPreviewKind(item);
  return (
    <View style={[styles.screen, { paddingTop: headerInset }]}>
      <View style={styles.details}>
        <Text style={[styles.status, item.status === "failed" && styles.error]}>
          {dataRoomStatus(item)}
        </Text>
        {item.error ? <Text style={styles.error}>{errorText(new Error(item.error))}</Text> : null}
      </View>
      {previewError ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{previewError}</Text>
          <NativeActionButton
            label={t("Retry")}
            prominence="quiet"
            onPress={() => setAttempt((value) => value + 1)}
          />
        </View>
      ) : kind === "sheet" ? (
        <SheetArtifactPreview key={item.id} source={{ dataRoomItemId: item.id }} />
      ) : busy ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : kind === "image" && preview ? (
        <Image
          source={{ uri: preview.uri }}
          resizeMode="contain"
          style={styles.screen}
          accessibilityLabel={item.name}
        />
      ) : kind === "pdf" && preview && Platform.OS !== "android" ? (
        <PdfPreview uri={preview.uri} />
      ) : kind === "ui" && preview?.source !== undefined ? (
        <UiArtifactPreview source={preview.source} />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.status}>{t("No preview for this file type.")}</Text>
          <NativeActionButton
            label={t("Share")}
            prominence="secondary"
            onPress={() => void share()}
          />
        </View>
      )}
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
    details: { paddingHorizontal: 20, paddingVertical: 12, gap: 6 },
    status: { color: native.secondaryLabel, fontSize: 14 },
    error: { color: mobileTokens().destructive, fontSize: 14 },
  });
}
