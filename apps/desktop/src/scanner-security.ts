export interface ScannerFrame {
  url: string;
}

export function scannerIpcAuthorized(
  isMainWindow: boolean,
  senderFrame: ScannerFrame | null,
  mainFrame: ScannerFrame,
  trustedOrigin: string | null,
): boolean {
  if (
    !isMainWindow ||
    senderFrame === null ||
    senderFrame !== mainFrame ||
    trustedOrigin === null
  ) {
    return false;
  }
  try {
    const trusted = new URL(trustedOrigin);
    const frame = new URL(senderFrame.url);
    return (
      (trusted.protocol === "http:" || trusted.protocol === "https:") &&
      trusted.origin === trustedOrigin &&
      frame.origin === trustedOrigin
    );
  } catch {
    return false;
  }
}
