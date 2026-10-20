import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Shows a cached local PDF in WKWebView (iOS), which renders PDFs natively. Scripts are off, only
 * file URLs load, and every navigation away from the document is blocked.
 */
export function PdfPreview({ uri }: { uri: string }) {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
        style={styles.webview}
        originWhitelist={["file://*"]}
        allowingReadAccessToURL={uri}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled={false}
        cacheEnabled={false}
        onShouldStartLoadWithRequest={({ url }) => url === uri}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: "white" },
});
