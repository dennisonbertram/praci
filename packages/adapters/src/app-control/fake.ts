import type {
  AdapterContext,
  AdapterDescriptor,
  AppControlAction,
  AppControlActResult,
  AppControlCapabilities,
  AppControlPolicy,
  AppControlProvider,
  AppControlScope,
  AppControlSnapshot,
  AppControlSnapshotRecord,
  AppControlSnapshotRequest,
  AppControlStatus,
  AppControlStore,
  AppControlWindow,
} from "@rakazo/adapter-kit";
import { AppControlRefusedError } from "@rakazo/adapter-kit";
import type { AppControlApp } from "@rakazo/contracts";
import { isDeniedApp } from "@rakazo/contracts";
import { allowedEntry, requireActionableRef, requireKey } from "./policy.js";

const scopeKey = (scope: AppControlScope) =>
  JSON.stringify([scope.spaceId, scope.userId, scope.botId, scope.runId]);

export class InMemoryAppControlStore implements AppControlStore {
  private readonly rows: Array<{ scope: string; row: AppControlSnapshotRecord }> = [];

  async record(scope: AppControlScope, snapshot: Omit<AppControlSnapshotRecord, "spent">) {
    const found = await this.get(scope, snapshot.snapshotId);
    if (!found) {
      this.rows.push({ scope: scopeKey(scope), row: { ...snapshot, spent: false } });
      return;
    }
    // Never un-spend or un-flag: a drill-down reuses its parent's snapshot id.
    Object.assign(found, snapshot, {
      spent: found.spent,
      sensitive: found.sensitive || snapshot.sensitive,
    });
  }

  async get(scope: AppControlScope, snapshotId: string) {
    return this.rows.find((r) => r.scope === scopeKey(scope) && r.row.snapshotId === snapshotId)
      ?.row;
  }

  async latest(scope: AppControlScope, appId: string) {
    return this.rows.findLast((r) => r.scope === scopeKey(scope) && r.row.appId === appId)?.row;
  }

  async markSpent(scope: AppControlScope, snapshotId: string) {
    const found = await this.get(scope, snapshotId);
    if (found) found.spent = true;
  }

  async clearRun(scope: AppControlScope) {
    const key = scopeKey(scope);
    for (let i = this.rows.length - 1; i >= 0; i -= 1) {
      if (this.rows[i]?.scope === key) this.rows.splice(i, 1);
    }
  }
}

export const FAKE_APPS: AppControlApp[] = [
  { id: "com.apple.Music", name: "Music" },
  { id: "com.apple.calculator", name: "Calculator" },
  { id: "com.apple.Terminal", name: "Terminal" },
];

/** Deterministic provider for tests and the demo stack. Same policy, no real apps. */
export class FakeAppControl implements AppControlProvider {
  private counter = 0;

  constructor(private readonly opts: { store: AppControlStore }) {}

  describe(): AdapterDescriptor<AppControlCapabilities> {
    return {
      id: "fake",
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { headed: false },
    };
  }

  async status(_context: AdapterContext): Promise<AppControlStatus> {
    return { available: true, accessibility: "granted" };
  }

  async listApps(_context: AdapterContext) {
    return FAKE_APPS.filter((app) => !isDeniedApp(app));
  }

  async listAllowed(
    _scope: AppControlScope,
    policy: AppControlPolicy,
    _context: AdapterContext,
  ): Promise<Array<AppControlApp & { running: boolean; windows: AppControlWindow[] }>> {
    return policy.allowed
      .filter((app) => !isDeniedApp(app))
      .map((app) => {
        const running = FAKE_APPS.some((fake) => fake.id === app.id);
        return {
          ...app,
          running,
          windows: running ? [{ id: windowId(app), title: app.name }] : [],
        };
      });
  }

  async snapshot(
    scope: AppControlScope,
    policy: AppControlPolicy,
    request: AppControlSnapshotRequest,
    _context: AdapterContext,
  ): Promise<AppControlSnapshot> {
    const app = this.running(allowedEntry(policy, request.appId));
    if (request.windowId && request.windowId !== windowId(app)) {
      throw new AppControlRefusedError("window_not_allowed", "That window belongs to another app.");
    }
    if (request.root) await requireActionableRef(this.opts.store, scope, app.id, request.root);
    this.counter += 1;
    const snapshotId = `fake${this.counter}`;
    await this.opts.store.record(scope, {
      snapshotId,
      appId: app.id,
      windowId: windowId(app),
      surface: request.surface ?? "window",
      sensitive: false,
    });
    return {
      snapshotId,
      app,
      windowId: windowId(app),
      surface: request.surface ?? "window",
      sensitive: false,
      truncated: false,
      tree: {
        role: "window",
        name: app.name,
        children: [
          { ref_id: `@${snapshotId}:e1`, role: "button", name: "Play" },
          { ref_id: `@${snapshotId}:e2`, role: "textfield", name: "Search", value: "" },
        ],
      },
    };
  }

  async act(
    scope: AppControlScope,
    policy: AppControlPolicy,
    request: { appId: string; action: AppControlAction },
    _context: AdapterContext,
  ): Promise<AppControlActResult> {
    try {
      const app = this.running(allowedEntry(policy, request.appId));
      const { action } = request;
      if (action.kind === "key") requireKey(action.key);
      else if (action.kind !== "launch") {
        await requireActionableRef(this.opts.store, scope, app.id, action.ref);
      }
      return { ok: true, delivery: "delivered" };
    } catch (error) {
      if (!(error instanceof AppControlRefusedError)) throw error;
      return { ok: false, delivery: "not_delivered", code: error.code, error: error.message };
    }
  }

  async endRun(scope: AppControlScope, _context: AdapterContext) {
    await this.opts.store.clearRun(scope);
  }

  private running(entry: AppControlApp): AppControlApp {
    const app = FAKE_APPS.find((fake) => fake.id === entry.id && fake.name === entry.name);
    if (!app) throw new AppControlRefusedError("app_not_running", "That app is not running.");
    return app;
  }
}

const windowId = (app: AppControlApp) => `w-${app.name.toLowerCase()}`;
