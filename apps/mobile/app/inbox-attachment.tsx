import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeActionButton } from "../components/native-action-button";
import { PdfPreview } from "../components/pdf-preview";
import { SheetArtifactPreview } from "../components/sheet-artifact-preview";
import { shareLocalFile } from "../lib/artifact-open";
import { useI18n } from "../lib/i18n";
import type { MailAttachmentRef } from "../lib/mail-attachment";
import { attachmentKind, downloadMailAttachment } from "../lib/mail-attachment";
import { native, useThemedStyles } from "../lib/native";
import { errorText } from "../lib/user-error";

/** Opens one mail attachment: the native PDF, sheet or image preview, or the share sheet for the rest. */
export default function InboxAttachmentScreen() {
  const params = useLocalSearchParams<{
    messageId: string;
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: string;
  }>();
  const attachment: MailAttachmentRef = {
    id: params.attachmentId,
    filename: params.filename,
    mimeType: params.mimeType,
    size: Number(params.size) || 0,
  };
  const kind = attachmentKind(attachment);
  const { t } = useI18n();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const [file, setFile] = useState<{ uri: string; key: string } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [imageError, setImageError] = useState(false);
  const requestGeneration = useRef(0);
  const shareBusy = useRef(false);
  const key = `${params.messageId}:${params.attachmentId}`;
  // Sheets are read by the server; everything else needs the bytes on the device.
  const needsFile = kind !== "sheet";
  const share = (uri: string) => {
    if (shareBusy.current) return;
    shareBusy.current = true;
    void shareLocalFile(uri, attachment.mimeType, attachment.filename)
      .catch((cause) => Alert.alert(t("Could not share this file"), errorText(cause)))
      .finally(() => {
        shareBusy.current = false;
      });
  };

  useLayoutEffect(() => {
    navigation.setOptions({ title: attachment.filename });
  }, [navigation, attachment.filename]);

  useEffect(() => {
    if (!needsFile) return;
    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    setFile(null);
    setError(null);
    setImageError(false);
    downloadMailAttachment(params.messageId, attachment, controller.signal)
      .then((next) => {
        if (generation !== requestGeneration.current) return;
        setFile({ uri: next.uri, key });
        // Types without an in-app preview open the system share sheet right away.
        if (kind === "other") share(next.uri);
      })
      .catch(
        (cause: unknown) =>
          generation === requestGeneration.current && setError({ key, message: errorText(cause) }),
      );
    return () => {
      requestGeneration.current++;
      controller.abort();
    };
  }, [params.messageId, params.attachmentId, attempt]);

  if (kind === "sheet") {
    return (
      <View style={styles.screen}>
        <SheetArtifactPreview
          source={{ mailAttachment: { messageId: params.messageId, attachmentId: attachment.id } }}
        />
      </View>
    );
  }
  if (error?.key === key) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>{error.message}</Text>
        {imageError && file?.key === key ? (
          <NativeActionButton
            label={t("Share")}
            prominence="secondary"
            onPress={() => share(file.uri)}
          />
        ) : null}
        <NativeActionButton
          label={t("Try again")}
          prominence="secondary"
          onPress={() => setAttempt((value) => value + 1)}
        />
      </View>
    );
  }
  if (!file || file.key !== key) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }
  if (kind === "image") {
    return (
      <Image
        source={{ uri: file.uri }}
        style={styles.screen}
        resizeMode="contain"
        accessibilityLabel={attachment.filename}
        onError={() => {
          setImageError(true);
          setError({ key, message: t("Could not load image") });
        }}
      />
    );
  }
  if (kind === "pdf" && Platform.OS !== "android") {
    return (
      <View style={styles.screen}>
        <PdfPreview uri={file.uri} />
      </View>
    );
  }
  // Android cannot render a PDF in its WebView; other types have no preview.
  return (
    <View style={styles.centered}>
      {kind === "other" ? (
        <Text style={styles.message}>{t("No preview for this file type.")}</Text>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => share(file.uri)} style={styles.button}>
        <Text style={styles.buttonText}>{t("Share")}</Text>
      </Pressable>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
    message: { color: native.secondaryLabel, fontSize: 15, textAlign: "center" },
    button: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: native.separator,
    },
    buttonText: { color: native.label, fontSize: 15, fontWeight: "600" },
  });
}
