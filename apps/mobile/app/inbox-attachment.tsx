import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  const [file, setFile] = useState<{ uri: string } | null>(null);
  const [error, setError] = useState("");
  // Sheets are read by the server; everything else needs the bytes on the device.
  const needsFile = kind !== "sheet";

  useLayoutEffect(() => {
    navigation.setOptions({ title: attachment.filename });
  }, [navigation, attachment.filename]);

  useEffect(() => {
    if (!needsFile) return;
    let current = true;
    downloadMailAttachment(params.messageId, attachment)
      .then((next) => {
        if (!current) return;
        setFile(next);
        // Types without an in-app preview open the system share sheet right away.
        if (kind === "other")
          void shareLocalFile(next.uri, attachment.mimeType, attachment.filename);
      })
      .catch((cause: unknown) => current && setError(errorText(cause)));
    return () => {
      current = false;
    };
  }, [params.messageId, params.attachmentId]);

  if (kind === "sheet") {
    return (
      <View style={styles.screen}>
        <SheetArtifactPreview
          source={{ mailAttachment: { messageId: params.messageId, attachmentId: attachment.id } }}
        />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>{error}</Text>
      </View>
    );
  }
  if (!file) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }
  const share = () => void shareLocalFile(file.uri, attachment.mimeType, attachment.filename);
  if (kind === "image") {
    return (
      <Image
        source={{ uri: file.uri }}
        style={styles.screen}
        resizeMode="contain"
        accessibilityLabel={attachment.filename}
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
      <Pressable accessibilityRole="button" onPress={share} style={styles.button}>
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
