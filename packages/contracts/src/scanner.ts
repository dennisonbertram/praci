import { DataRoomApiName } from "./data-room-api.js";
import { pageAgentKindOf, pageAgentSpawnKey } from "./page-agents.js";

export const scannerAgentSpawnKey = (userId: string) => pageAgentSpawnKey("scanner", userId);

export const isScannerAgentSpawnKey = (spawnKey: string | null | undefined) =>
  pageAgentKindOf(spawnKey) === "scanner";

export const SCANNER_AGENT_BUILTIN_TOOLS = [
  "search_data_room",
  "read_data_room_item",
  "update_scan",
  "message_bot",
] as const;

export type ScannerKind = "sane-missing" | "not-found" | "busy" | "ready" | "scanning" | "error";

export const SCANNER_DEFAULT_FOLDER = ["Scans"] as const;

export function isScannerFolderPath(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 32 &&
    value.every(
      (part) =>
        typeof part === "string" &&
        part !== "." &&
        part !== ".." &&
        DataRoomApiName.safeParse(part).success,
    )
  );
}

export interface ScannerState {
  kind: ScannerKind;
  device?: string;
  error?: string;
  autoScan: boolean;
  folder: string[];
}

export interface ScannerDocument {
  id: string;
  name: string;
  bytes: Uint8Array;
  sha256: string;
  pages: number;
  folder: string[];
  userId: string;
  spaceId: string;
}

export interface RakazoDesktopScanner {
  state: () => Promise<ScannerState>;
  onState: (listener: (state: ScannerState) => void) => () => void;
  scan: () => Promise<void>;
  cancel: () => Promise<void>;
  setAutoScan: (enabled: boolean) => Promise<void>;
  setFolder: (folder: string[]) => Promise<void>;
  onDocument: (listener: (document: ScannerDocument) => void) => () => void;
  confirm: (id: string, storedSha256: string) => Promise<{ ok: boolean }>;
  setScope: (scope: { userId: string; spaceId: string } | null) => Promise<void>;
  pending: () => Promise<ScannerDocument[]>;
}
