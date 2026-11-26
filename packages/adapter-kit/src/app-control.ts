import type { AppControlApp, AppControlKey } from "@rakazo/contracts";
import type { AdapterContext, AdapterDescriptor } from "./types.js";

/**
 * Provider-neutral control of apps on the owner's own computer
 * (docs/local-desktop-control). Not part of SandboxProvider: it controls the host,
 * not a computer workspace.
 */

export interface AppControlScope {
  spaceId: string;
  userId: string;
  botId: string;
  runId: string;
}

export interface AppControlPolicy {
  allowed: AppControlApp[];
  /** Use the real pointer and keyboard. Off unless the owner turned it on. */
  headed: boolean;
}

export interface AppControlCapabilities {
  headed: boolean;
}

export interface AppControlStatus {
  available: boolean;
  accessibility: "granted" | "denied" | "unknown";
  /** The host that runs agent-desktop, when known. */
  platform?: "macos" | "windows" | "linux";
  /** False only when the agent-desktop binary is known to be missing. */
  installed?: boolean;
  reason?: string;
}

export interface AppControlWindow {
  id: string;
  title?: string;
}

export type AppControlSurface = "window" | "focused" | "sheet" | "popover" | "alert" | "menu";

export type AppControlAction =
  | {
      kind:
        | "click"
        | "toggle"
        | "check"
        | "uncheck"
        | "expand"
        | "collapse"
        | "scroll_to"
        | "focus"
        | "clear";
      ref: string;
    }
  | { kind: "type" | "set_value"; ref: string; text: string }
  | { kind: "select"; ref: string; option: string }
  | {
      kind: "scroll";
      ref: string;
      direction: "up" | "down" | "left" | "right";
      amount?: number;
    }
  | { kind: "key"; key: AppControlKey }
  | { kind: "launch" };

export interface AppControlSnapshotRequest {
  appId: string;
  windowId?: string;
  surface?: AppControlSurface;
  /** A ref from the latest snapshot of the same app, to read one subtree. */
  root?: string;
}

export interface AppControlSnapshot {
  snapshotId: string;
  app: AppControlApp;
  windowId?: string;
  surface: AppControlSurface;
  /** Sign-in or secret content was seen: values are masked and no ref is actionable. */
  sensitive: boolean;
  truncated: boolean;
  tree: unknown;
}

export interface AppControlActResult {
  ok: boolean;
  delivery: "delivered" | "not_delivered" | "uncertain";
  code?: string;
  error?: string;
}

export interface AppControlSnapshotRecord {
  snapshotId: string;
  appId: string;
  windowId?: string;
  surface: AppControlSurface;
  sensitive: boolean;
  spent: boolean;
}

/** Durable ref ownership: a run can pause and resume in another process. */
export interface AppControlStore {
  /** Upsert by (scope, snapshotId); never clears `spent` or `sensitive` of an existing row. */
  record(scope: AppControlScope, snapshot: Omit<AppControlSnapshotRecord, "spent">): Promise<void>;
  get(scope: AppControlScope, snapshotId: string): Promise<AppControlSnapshotRecord | undefined>;
  /** The most recently recorded snapshot of the app in this scope, spent or not. */
  latest(scope: AppControlScope, appId: string): Promise<AppControlSnapshotRecord | undefined>;
  markSpent(scope: AppControlScope, snapshotId: string): Promise<void>;
  clearRun(scope: AppControlScope): Promise<void>;
}

/** A call the policy refused. Nothing reached the app. */
export class AppControlRefusedError extends Error {
  override readonly name = "AppControlRefusedError";
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface AppControlProvider {
  describe(): AdapterDescriptor<AppControlCapabilities>;
  status(context: AdapterContext): Promise<AppControlStatus>;
  /** Running apps without the apps that can never be used, for the settings picker. */
  listApps(context: AdapterContext): Promise<AppControlApp[]>;
  listAllowed(
    scope: AppControlScope,
    policy: AppControlPolicy,
    context: AdapterContext,
  ): Promise<Array<AppControlApp & { running: boolean; windows: AppControlWindow[] }>>;
  snapshot(
    scope: AppControlScope,
    policy: AppControlPolicy,
    request: AppControlSnapshotRequest,
    context: AdapterContext,
  ): Promise<AppControlSnapshot>;
  act(
    scope: AppControlScope,
    policy: AppControlPolicy,
    request: { appId: string; action: AppControlAction },
    context: AdapterContext,
  ): Promise<AppControlActResult>;
  endRun(scope: AppControlScope, context: AdapterContext): Promise<void>;
}
