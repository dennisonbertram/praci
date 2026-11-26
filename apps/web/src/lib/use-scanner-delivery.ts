import { useEffect } from "react";
import { desktopBridge } from "./desktop";
import { startScannerDelivery } from "./scanner-delivery";

export function useScannerDelivery(userId?: string | null, spaceId?: string | null) {
  useEffect(() => {
    const scanner = desktopBridge()?.scanner;
    if (!scanner || !userId || !spaceId) return;
    return startScannerDelivery(scanner, { userId, spaceId });
  }, [userId, spaceId]);
}
