import type {
  AppControlPolicy,
  AppControlProvider,
  AppControlScope,
  AppControlSnapshot,
} from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { AgentDesktopAppControl } from "./agent-desktop.js";
import { FakeAppControl, InMemoryAppControlStore } from "./fake.js";
import calculatorSnapshot from "./fixtures/calculator-snapshot.json" with { type: "json" };
import type { AgentDesktopRunner, AgentDesktopRunResult } from "./runners.js";
import { AgentDesktopNotInstalledError } from "./runners.js";

type Node = Record<string, unknown>;

const context = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space",
  userId: "user",
  signal: new AbortController().signal,
};
const scope = (runId = "run1"): AppControlScope => ({
  spaceId: "space",
  userId: "user",
  botId: "bot",
  runId,
});
const MUSIC = { id: "com.apple.Music", name: "Music" };
const CALC = { id: "com.apple.calculator", name: "Calculator" };
const TERMINAL = { id: "com.apple.Terminal", name: "Terminal" };
const policy = (headed = false, allowed = [MUSIC, CALC]): AppControlPolicy => ({ allowed, headed });

const ok = (data: unknown = {}): AgentDesktopRunResult => ({
  exitCode: 0,
  stdout: JSON.stringify({ ok: true, data }),
  stderr: "",
});
const fail = (code: string, delivery: string, retry: string): AgentDesktopRunResult => ({
  exitCode: 1,
  stdout: JSON.stringify({
    ok: false,
    error: { code, message: `${code} happened`, disposition: { delivery, retry } },
  }),
  stderr: "",
});

/** A scripted stand-in for the agent-desktop CLI that records every argv. */
class Desktop {
  calls: string[][] = [];
  apps: Node[] = [
    { bundle_id: "com.apple.Music", name: "Music", pid: 10 },
    { bundle_id: "com.apple.calculator", name: "Calculator", pid: 20 },
    { bundle_id: "com.apple.Terminal", name: "Terminal", pid: 30 },
  ];
  windows: Node[] = [
    { id: "w-music", app_name: "Music", pid: 10, title: "Library" },
    { id: "w-calc", app_name: "Calculator", pid: 20, title: "Calculator" },
    { id: "w-term", app_name: "Terminal", pid: 30, title: "zsh" },
  ];
  surfaces: unknown[] = [];
  trees: Record<string, (id: string) => Node> = {};
  focused?: (id: string) => Node;
  focusedReply?: () => AgentDesktopRunResult;
  titles: Record<string, string> = {};
  reply?: (argv: string[]) => AgentDesktopRunResult;
  launches: Node[] = [];
  reset = 0;
  private count = 0;
  private owner = new Map<string, string>();

  readonly runner: AgentDesktopRunner = Object.assign(
    async (argv: string[]) => {
      this.calls.push(argv);
      const flag = (name: string) =>
        argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined;
      switch (argv[0]) {
        case "list-apps": {
          const only = flag("--app");
          return ok({ apps: this.apps.filter((a) => !only || a.name === only) });
        }
        case "list-windows": {
          const only = flag("--app");
          return ok(this.windows.filter((w) => !only || w.app_name === only));
        }
        case "list-surfaces":
          return ok({ surfaces: this.surfaces });
        case "status":
          return ok({ permissions: { accessibility: { state: "granted" } } });
        case "launch":
          this.apps.push(...this.launches);
          return ok({ app: flag("--activate") });
        case "snapshot": {
          const root = flag("--root");
          // A --root drill-down answers with the parent's snapshot id, as the real CLI does.
          if (!root) this.count += 1;
          const id = root ? (root.slice(1).split(":")[0] as string) : `s${this.count}`;
          if (!root && flag("--surface") === "focused" && this.focusedReply) {
            return this.focusedReply();
          }
          const app = root
            ? (this.owner.get(root.slice(1).split(":")[0] as string) as string)
            : (flag("--app") as string);
          this.owner.set(id, app);
          const build =
            (flag("--surface") === "focused" ? this.focused : undefined) ??
            this.trees[app] ??
            ((sid: string) => ({
              role: "window",
              name: app,
              children: [
                { ref_id: `@${sid}:e1`, role: "button", name: "Play" },
                { ref_id: `@${sid}:e2`, role: "textfield", name: "Search", value: "" },
              ],
            }));
          return ok({ app, complete: true, snapshot_id: id, tree: build(id) });
        }
        case "get":
          return ok({ text: this.titles[argv.find((a) => a.startsWith("@")) ?? ""] ?? "Play" });
        default:
          return this.reply?.(argv) ?? ok({});
      }
    },
    {
      reset: async () => {
        this.reset += 1;
      },
    },
  );

  /** Argv of everything that is not a read. */
  get writes() {
    return this.calls.filter(
      (c) =>
        !["list-apps", "list-windows", "list-surfaces", "status", "get", "snapshot"].includes(
          c[0] as string,
        ),
    );
  }
  get snapshots() {
    return this.calls.filter((c) => c[0] === "snapshot");
  }
}

function setup(headed = false, allowed = [MUSIC, CALC]) {
  const desktop = new Desktop();
  const store = new InMemoryAppControlStore();
  const provider = new AgentDesktopAppControl({
    runner: desktop.runner,
    store,
    platform: "darwin",
  });
  const snap = (appId: string, extra: object = {}, s = scope()) =>
    provider.snapshot(s, policy(headed, allowed), { appId, ...extra }, context);
  const act = (
    appId: string,
    action: Parameters<AppControlProvider["act"]>[2]["action"],
    s = scope(),
  ) => provider.act(s, policy(headed, allowed), { appId, action }, context);
  return { desktop, store, provider, snap, act };
}

const refOf = (snapshot: AppControlSnapshot, n: number) => `@${snapshot.snapshotId}:e${n}`;
const secretTree = (id: string): Node => ({
  role: "window",
  name: "Account",
  children: [
    { ref_id: `@${id}:e1`, role: "securetextfield", name: "Password", value: "hunter2" },
    { ref_id: `@${id}:e2`, role: "textfield", name: "Verification code", value: "493021" },
  ],
});

describe("AgentDesktopAppControl policy", () => {
  it("refuses an app that is not allowed without calling agent-desktop", async () => {
    const t = setup(false, [MUSIC]);
    await expect(t.snap(CALC.id)).rejects.toMatchObject({ code: "app_not_allowed" });
    expect(t.desktop.calls).toEqual([]);
  });

  it("refuses a denylisted app even when the owner allowed it", async () => {
    const t = setup(false, [TERMINAL]);
    await expect(t.snap(TERMINAL.id)).rejects.toMatchObject({ code: "app_denied" });
    expect(await t.act(TERMINAL.id, { kind: "launch" })).toMatchObject({
      ok: false,
      delivery: "not_delivered",
      code: "app_denied",
    });
    expect(t.desktop.calls).toEqual([]);
  });

  it("refuses when the running app's bundle id differs from the allowed entry", async () => {
    const t = setup(false, [{ id: "com.evil.Music", name: "Music" }]);
    await expect(t.snap("com.evil.Music")).rejects.toMatchObject({ code: "app_not_running" });
    expect(t.desktop.snapshots).toEqual([]);
  });

  it("launches by bundle id and verifies the new process", async () => {
    const t = setup();
    t.desktop.apps = [];
    t.desktop.launches = [{ bundle_id: "com.apple.Music", name: "Music", pid: 11 }];
    const result = await t.act(MUSIC.id, { kind: "launch" });
    expect(result).toEqual({ ok: true, delivery: "delivered" });
    expect(t.desktop.calls[0]).toEqual(["launch", "com.apple.Music"]);
    expect(t.desktop.calls[1]?.[0]).toBe("list-apps");
  });

  it("does not trust a launch that starts a different app", async () => {
    const t = setup();
    t.desktop.apps = [];
    t.desktop.launches = [{ bundle_id: "com.other.Music", name: "Music", pid: 11 }];
    expect(await t.act(MUSIC.id, { kind: "launch" })).toMatchObject({
      ok: false,
      delivery: "uncertain",
    });
  });

  it("accepts only windows listed for the verified process", async () => {
    const t = setup();
    await expect(t.snap(MUSIC.id, { windowId: "w-calc" })).rejects.toMatchObject({
      code: "window_not_allowed",
    });
    expect(t.desktop.snapshots).toEqual([]);
    const snapshot = await t.snap(MUSIC.id, { windowId: "w-music" });
    expect(snapshot.windowId).toBe("w-music");
    expect(t.desktop.snapshots[0]).toContain("--window-id");
  });

  it("refuses menubar and unknown surfaces", async () => {
    const t = setup();
    await expect(t.snap(MUSIC.id, { surface: "menubar" })).rejects.toMatchObject({
      code: "surface_not_allowed",
    });
    expect(t.desktop.snapshots).toEqual([]);
  });
});

describe("ref ownership", () => {
  it("refuses refs and roots from another app, an older snapshot, or another scope", async () => {
    const t = setup();
    const music1 = await t.snap(MUSIC.id);
    const calc = await t.snap(CALC.id);
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(calc, 1) })).toMatchObject({
      code: "stale_ref",
    });
    const music2 = await t.snap(MUSIC.id);
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(music1, 1) })).toMatchObject({
      code: "stale_ref",
    });
    expect(
      await t.act(MUSIC.id, { kind: "click", ref: refOf(music2, 1) }, scope("other")),
    ).toMatchObject({
      code: "stale_ref",
    });
    await expect(t.snap(MUSIC.id, { root: refOf(music1, 1) })).rejects.toMatchObject({
      code: "stale_ref",
    });
    await expect(t.snap(CALC.id, { root: refOf(music2, 1) })).rejects.toMatchObject({
      code: "stale_ref",
    });
    await expect(
      t.snap(MUSIC.id, { root: refOf(music2, 1) }, scope("other")),
    ).rejects.toMatchObject({
      code: "stale_ref",
    });
    expect(t.desktop.writes).toEqual([]);
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(music2, 1) })).toEqual({
      ok: true,
      delivery: "delivered",
    });
  });

  it("allows a drill-down from the latest snapshot and shares its snapshot id", async () => {
    const t = setup();
    const full = await t.snap(MUSIC.id);
    const drill = await t.snap(MUSIC.id, { root: refOf(full, 1) });
    expect(t.desktop.snapshots[1]).toContain("--root");
    expect(t.desktop.snapshots[1]).not.toContain("--app");
    expect(drill.snapshotId).toBe(full.snapshotId);
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(drill, 1) })).toMatchObject({
      ok: true,
    });
  });

  it("marks a snapshot spent when delivery is uncertain and refuses its refs afterwards", async () => {
    const t = setup();
    const snapshot = await t.snap(MUSIC.id);
    t.desktop.reply = () => fail("APP_UNRESPONSIVE", "delivered_unverified", "unsafe");
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(snapshot, 1) })).toMatchObject({
      ok: false,
      delivery: "uncertain",
      code: "APP_UNRESPONSIVE",
    });
    expect(await t.store.latest(scope(), MUSIC.id)).toMatchObject({ spent: true });
    t.desktop.reply = undefined;
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(snapshot, 1) })).toMatchObject({
      code: "ref_spent",
    });
    await expect(t.snap(MUSIC.id, { root: refOf(snapshot, 1) })).rejects.toMatchObject({
      code: "ref_spent",
    });
  });

  it("treats a runner failure or timeout as uncertain", async () => {
    const t = setup();
    const snapshot = await t.snap(MUSIC.id);
    const inner = t.desktop.runner;
    const failing = Object.assign(async (argv: string[], options: { timeoutMs: number }) => {
      if (argv[0] === "click") throw new Error("agent-desktop timed out after 15000 ms.");
      return inner(argv, options);
    }, {});
    const provider = new AgentDesktopAppControl({
      runner: failing,
      store: t.store,
      platform: "darwin",
    });
    const result = await provider.act(
      scope(),
      policy(),
      { appId: MUSIC.id, action: { kind: "click", ref: refOf(snapshot, 1) } },
      context,
    );
    expect(result).toMatchObject({ ok: false, delivery: "uncertain" });
    expect(await t.store.latest(scope(), MUSIC.id)).toMatchObject({ spent: true });
  });

  it("keeps the snapshot usable when agent-desktop proves nothing was delivered", async () => {
    const t = setup();
    const snapshot = await t.snap(MUSIC.id);
    t.desktop.reply = () => fail("STALE_REF", "not_delivered", "safe");
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(snapshot, 1) })).toMatchObject({
      delivery: "not_delivered",
      code: "STALE_REF",
    });
    expect(await t.store.latest(scope(), MUSIC.id)).toMatchObject({ spent: false });
  });
});

describe("secrets and sign-in", () => {
  it("masks secret values, marks the snapshot sensitive and refuses typing into it", async () => {
    const t = setup();
    t.desktop.trees.Music = secretTree;
    const snapshot = await t.snap(MUSIC.id);
    const dumped = JSON.stringify(snapshot);
    expect(snapshot.sensitive).toBe(true);
    expect(dumped).not.toContain("hunter2");
    expect(dumped).not.toContain("493021");
    expect(dumped).toContain("[redacted]");
    for (const kind of ["type", "set_value"] as const) {
      expect(await t.act(MUSIC.id, { kind, ref: refOf(snapshot, 1), text: "x" })).toMatchObject({
        code: "sensitive",
      });
    }
    expect(await t.act(MUSIC.id, { kind: "clear", ref: refOf(snapshot, 2) })).toMatchObject({
      code: "sensitive",
    });
    await expect(t.snap(MUSIC.id, { root: refOf(snapshot, 1) })).rejects.toMatchObject({
      code: "sensitive",
    });
    expect(t.desktop.writes).toEqual([]);
  });

  it("marks sign-in sheets, alerts and windows sensitive", async () => {
    const t = setup();
    const prompt = (id: string): Node => ({
      role: "sheet",
      children: [{ ref_id: `@${id}:e1`, role: "button", name: "Sign In" }],
    });
    t.desktop.trees.Music = prompt;
    expect((await t.snap(MUSIC.id, { surface: "sheet" })).sensitive).toBe(true);
    expect((await t.snap(MUSIC.id, { surface: "alert" })).sensitive).toBe(true);
    // A window that reads like a sign-in prompt is read-only for that snapshot (v1).
    expect((await t.snap(MUSIC.id)).sensitive).toBe(true);
  });
});

describe("keys", () => {
  it("refuses keys outside the list and any modifier", async () => {
    const t = setup();
    for (const key of ["cmd+v", "shift+tab", "delete", "f5", "a"]) {
      expect(await t.act(MUSIC.id, { kind: "key", key: key as "return" })).toMatchObject({
        code: "key_not_allowed",
      });
    }
    expect(t.desktop.writes).toEqual([]);
  });

  it("presses an allowed key after a quiet focused-surface check", async () => {
    const t = setup();
    expect(await t.act(MUSIC.id, { kind: "key", key: "return" })).toEqual({
      ok: true,
      delivery: "delivered",
    });
    const [surfaces, focus, press] = [
      t.desktop.calls.at(-4),
      t.desktop.calls.at(-2),
      t.desktop.calls.at(-1),
    ];
    expect(surfaces?.[0]).toBe("list-surfaces");
    expect(focus).toContain("--window-id");
    expect(focus?.[0]).toBe("snapshot");
    expect(focus).toContain("focused");
    expect(press?.slice(0, 3)).toEqual(["press", "--app", "Music"]);
    expect(press?.at(-1)).toBe("return");
  });

  it("refuses a key when the focused surface is sensitive or a sheet is open", async () => {
    const t = setup();
    t.desktop.focused = secretTree;
    expect(await t.act(MUSIC.id, { kind: "key", key: "return" })).toMatchObject({
      code: "sensitive",
    });
    t.desktop.focused = undefined;
    t.desktop.surfaces = [{ kind: "sheet" }];
    expect(await t.act(MUSIC.id, { kind: "key", key: "return" })).toMatchObject({
      code: "surface_open",
    });
    expect(t.desktop.writes).toEqual([]);
  });
});

describe("action rules", () => {
  it("refuses to click an element named Paste", async () => {
    const t = setup();
    const snapshot = await t.snap(MUSIC.id);
    t.desktop.titles[refOf(snapshot, 1)] = "Paste";
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(snapshot, 1) })).toMatchObject({
      code: "paste_not_allowed",
    });
    expect(t.desktop.writes).toEqual([]);
  });

  it("adds --headed only when the owner asked for it", async () => {
    for (const headed of [false, true]) {
      const t = setup(headed);
      const snapshot = await t.snap(MUSIC.id);
      await t.act(MUSIC.id, { kind: "click", ref: refOf(snapshot, 1) });
      await t.act(MUSIC.id, { kind: "launch" });
      for (const call of t.desktop.calls) {
        const mutates = ["click", "launch"].includes(call[0] as string);
        expect(call.includes("--headed")).toBe(headed && mutates);
      }
      expect(t.desktop.calls.some((c) => c[0] === "launch" && c.includes("--activate"))).toBe(
        headed,
      );
    }
  });

  it("passes text that looks like a flag only after --", async () => {
    const t = setup();
    const snapshot = await t.snap(MUSIC.id);
    await t.act(MUSIC.id, { kind: "type", ref: refOf(snapshot, 2), text: "--force" });
    const call = t.desktop.writes.at(-1) as string[];
    expect(call.indexOf("--force")).toBeGreaterThan(call.indexOf("--"));
  });

  it("only ever sends fixed commands and flags", async () => {
    const t = setup(true);
    const first = await t.snap(MUSIC.id);
    const actions = [
      { kind: "click" },
      { kind: "toggle" },
      { kind: "check" },
      { kind: "uncheck" },
      { kind: "expand" },
      { kind: "collapse" },
      { kind: "scroll_to" },
      { kind: "focus" },
      { kind: "clear" },
      { kind: "type", text: "x" },
      { kind: "set_value", text: "x" },
      { kind: "select", option: "Jazz" },
      { kind: "scroll", direction: "down", amount: 99 },
    ] as const;
    for (const action of actions) {
      await t.act(MUSIC.id, { ...action, ref: refOf(first, 1) } as never);
    }
    await t.act(MUSIC.id, { kind: "key", key: "tab" });
    await t.act(MUSIC.id, { kind: "launch" });
    await t.provider.listApps(context);
    await t.provider.listAllowed(scope(), policy(true), context);
    await t.provider.status(context);
    const commands = new Set([
      "list-apps",
      "list-windows",
      "list-surfaces",
      "launch",
      "snapshot",
      "get",
      "click",
      "type",
      "set-value",
      "clear",
      "select",
      "toggle",
      "check",
      "uncheck",
      "expand",
      "collapse",
      "scroll",
      "scroll-to",
      "focus",
      "press",
      "status",
    ]);
    const forbidden = [
      "--force",
      "--screenshot",
      "--trace",
      "--debug",
      "--cdp",
      "--xy",
      "--env",
      "--arg",
    ];
    expect(t.desktop.calls.length).toBeGreaterThan(20);
    for (const call of t.desktop.calls) {
      expect(commands.has(call[0] as string)).toBe(true);
      const flags = call.slice(1, call.includes("--") ? call.indexOf("--") : undefined);
      expect(flags.some((f) => forbidden.includes(f))).toBe(false);
    }
    expect(t.desktop.calls.find((c) => c[0] === "scroll")).toContain("50");
  });
});

describe("output", () => {
  it("bounds the serialized tree and says it was truncated", async () => {
    const t = setup();
    t.desktop.trees.Music = (id) => ({
      role: "window",
      children: Array.from({ length: 2000 }, (_, i) => ({
        ref_id: `@${id}:e${i + 1}`,
        role: "button",
        name: `Track number ${i} with a fairly long descriptive name`,
      })),
    });
    const snapshot = await t.snap(MUSIC.id);
    expect(snapshot.truncated).toBe(true);
    expect(JSON.stringify(snapshot.tree).length).toBeLessThanOrEqual(40_000);
  });

  it("reads a real Calculator snapshot", async () => {
    const t = setup();
    t.desktop.trees.Calculator = () => calculatorSnapshot.data.tree as Node;
    const snapshot = await t.snap(CALC.id);
    expect(snapshot.sensitive).toBe(false);
    expect(JSON.stringify(snapshot.tree)).toContain("Change Sign");
  });

  it("lists running apps without denied ones, and allowed apps with their windows", async () => {
    const t = setup();
    expect((await t.provider.listApps(context)).map((a) => a.name).sort()).toEqual([
      "Calculator",
      "Music",
    ]);
    const allowed = await t.provider.listAllowed(
      scope(),
      policy(false, [MUSIC, TERMINAL, { id: "com.apple.Notes", name: "Notes" }]),
      context,
    );
    expect(allowed).toEqual([
      { ...MUSIC, running: true, windows: [{ id: "w-music", title: "Library" }] },
      { id: "com.apple.Notes", name: "Notes", running: false, windows: [] },
    ]);
  });

  it("reports permission state and clears the run", async () => {
    const t = setup();
    expect(await t.provider.status(context)).toEqual({ available: true, accessibility: "granted" });
    const snapshot = await t.snap(MUSIC.id);
    await t.provider.endRun(scope(), context);
    expect(await t.store.get(scope(), snapshot.snapshotId)).toBeUndefined();
    expect(t.desktop.reset).toBe(1);
  });
});

describe("review fixes", () => {
  it("refuses a same-name process with another bundle id that owns the only window", async () => {
    const t = setup();
    t.desktop.apps = [
      { bundle_id: "com.apple.Music", name: "Music", pid: 10 },
      { bundle_id: "com.evil.Music", name: "Music", pid: 11 },
    ];
    t.desktop.windows = [{ id: "w-evil", app_name: "Music", pid: 11, title: "Music" }];
    await expect(t.snap(MUSIC.id)).rejects.toMatchObject({ code: "window_not_found" });
    expect(t.desktop.snapshots).toEqual([]);
  });

  it("always snapshots a window of the verified process", async () => {
    const t = setup();
    t.desktop.windows = [
      { id: "w-other", app_name: "Music", pid: 99, title: "Other" },
      { id: "w-hidden", app_name: "Music", pid: 10, visible: false },
      { id: "w-music", app_name: "Music", pid: 10, visible: true, is_focused: true },
    ];
    const snapshot = await t.snap(MUSIC.id);
    expect(snapshot.windowId).toBe("w-music");
    expect(t.desktop.snapshots[0]).toEqual(expect.arrayContaining(["--window-id", "w-music"]));
  });

  it.each(["api_token", "pinInput", "clientSecret", "card-cvv", "ssn_field"])(
    "treats identifier %s as a secret",
    async (identifier) => {
      const t = setup();
      t.desktop.trees.Music = (id) => ({
        role: "window",
        children: [
          {
            ref_id: `@${id}:e1`,
            role: "textfield",
            name: "Field",
            value: "s3cr3t-value",
            native_id: { kind: "ax_identifier", value: identifier },
          },
        ],
      });
      const snapshot = await t.snap(MUSIC.id);
      expect(snapshot.sensitive).toBe(true);
      expect(JSON.stringify(snapshot)).not.toContain("s3cr3t-value");
      expect(
        await t.act(MUSIC.id, { kind: "type", ref: refOf(snapshot, 1), text: "x" }),
      ).toMatchObject({
        code: "sensitive",
      });
      expect(await t.act(MUSIC.id, { kind: "clear", ref: refOf(snapshot, 1) })).toMatchObject({
        code: "sensitive",
      });
      expect(t.desktop.writes).toEqual([]);
    },
  );

  it.each(["Buy now", "Payment details", "Credit card", "Authorize", "Apple Account"])(
    "marks a window that reads %s sensitive",
    async (label) => {
      const t = setup();
      t.desktop.trees.Music = (id) => ({
        role: "window",
        children: [{ ref_id: `@${id}:e1`, role: "button", name: label }],
      });
      expect((await t.snap(MUSIC.id)).sensitive).toBe(true);
    },
  );

  it("marks any sheet, alert or dialog inside a window sensitive", async () => {
    const t = setup();
    t.desktop.trees.Music = (id) => ({
      role: "window",
      children: [
        { role: "sheet", children: [{ ref_id: `@${id}:e1`, role: "button", name: "OK" }] },
      ],
    });
    expect((await t.snap(MUSIC.id)).sensitive).toBe(true);
  });

  it("refuses to select a Paste option", async () => {
    const t = setup();
    const snapshot = await t.snap(MUSIC.id);
    expect(
      await t.act(MUSIC.id, { kind: "select", ref: refOf(snapshot, 1), option: "Paste" }),
    ).toMatchObject({ code: "paste_not_allowed" });
    expect(t.desktop.writes).toEqual([]);
  });

  it("refuses a key when the focused observation is incomplete or has no tree", async () => {
    const t = setup();
    t.desktop.focusedReply = () =>
      ok({ complete: false, snapshot_id: "sx", tree: { role: "window" } });
    expect(await t.act(MUSIC.id, { kind: "key", key: "return" })).toMatchObject({
      code: "observation_incomplete",
    });
    t.desktop.focusedReply = () => ok({ complete: true, snapshot_id: "sx" });
    expect(await t.act(MUSIC.id, { kind: "key", key: "return" })).toMatchObject({
      code: "observation_incomplete",
    });
    t.desktop.focusedReply = () => fail("TIMEOUT", "not_delivered", "safe");
    expect(await t.act(MUSIC.id, { kind: "key", key: "return" })).toMatchObject({
      code: "observation_incomplete",
    });
    expect(t.desktop.writes).toEqual([]);
  });

  it("refuses a key when the focused snapshot holds a sheet though list-surfaces is clean", async () => {
    const t = setup();
    t.desktop.focused = (id) => ({
      role: "window",
      children: [
        { role: "sheet", children: [{ ref_id: `@${id}:e1`, role: "button", name: "OK" }] },
      ],
    });
    expect(await t.act(MUSIC.id, { kind: "key", key: "return" })).toMatchObject({
      code: "sensitive",
    });
    expect(t.desktop.writes).toEqual([]);
  });

  it("refuses keys entirely when real input is on", async () => {
    const t = setup(true);
    expect(await t.act(MUSIC.id, { kind: "key", key: "return" })).toMatchObject({
      code: "keys_headless_only",
    });
    expect(t.desktop.writes).toEqual([]);
  });

  it("keeps a drill-down's snapshot spent after an uncertain action", async () => {
    const t = setup();
    const full = await t.snap(MUSIC.id);
    const drill = await t.snap(MUSIC.id, { root: refOf(full, 1) });
    t.desktop.reply = () => fail("APP_UNRESPONSIVE", "delivered_unverified", "unsafe");
    await t.act(MUSIC.id, { kind: "click", ref: refOf(drill, 1) });
    t.desktop.reply = undefined;
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(drill, 2) })).toMatchObject({
      code: "ref_spent",
    });
    await expect(t.snap(MUSIC.id, { root: refOf(drill, 1) })).rejects.toMatchObject({
      code: "ref_spent",
    });
  });

  it("spends the latest snapshot when launch verification fails", async () => {
    const t = setup();
    const snapshot = await t.snap(MUSIC.id);
    t.desktop.apps = [];
    t.desktop.launches = [{ bundle_id: "com.other.Music", name: "Music", pid: 11 }];
    expect(await t.act(MUSIC.id, { kind: "launch" })).toMatchObject({ delivery: "uncertain" });
    t.desktop.apps = [{ bundle_id: "com.apple.Music", name: "Music", pid: 10 }];
    expect(await t.act(MUSIC.id, { kind: "click", ref: refOf(snapshot, 1) })).toMatchObject({
      code: "ref_spent",
    });
    await expect(t.snap(MUSIC.id, { root: refOf(snapshot, 1) })).rejects.toMatchObject({
      code: "ref_spent",
    });
  });
});

// The same contract holds for the fake provider used by tests and the demo stack.
interface Harness {
  snap: (appId: string, extra?: object, s?: AppControlScope) => Promise<AppControlSnapshot>;
  act: (appId: string, action: never, s?: AppControlScope) => Promise<unknown>;
}
const harnesses: Array<[string, () => Harness]> = [
  ["agent-desktop", () => setup()],
  [
    "fake",
    () => {
      const store = new InMemoryAppControlStore();
      const provider = new FakeAppControl({ store });
      return {
        provider,
        snap: (appId: string, extra: object = {}, s = scope()) =>
          provider.snapshot(s, policy(), { appId, ...extra }, context),
        act: (appId: string, action: never, s = scope()) =>
          provider.act(s, policy(), { appId, action }, context),
      };
    },
  ],
];

describe.each(harnesses)("%s conformance", (_name, make) => {
  it("refuses unknown and denied apps, other windows, stale refs and bad keys", async () => {
    const t = make();
    await expect(t.snap("com.example.Unlisted")).rejects.toMatchObject({ code: "app_not_allowed" });
    const denied = new AgentDesktopAppControl({
      runner: new Desktop().runner,
      store: new InMemoryAppControlStore(),
    });
    await expect(
      denied.snapshot(scope(), policy(false, [TERMINAL]), { appId: TERMINAL.id }, context),
    ).rejects.toMatchObject({ code: "app_denied" });
    await expect(t.snap(MUSIC.id, { windowId: "w-calc" })).rejects.toMatchObject({
      code: "window_not_allowed",
    });
    const music = await t.snap(MUSIC.id);
    const calc = await t.snap(CALC.id);
    const fresh = await t.snap(MUSIC.id);
    const click = (ref: string, s = scope()) => t.act(MUSIC.id, { kind: "click", ref } as never, s);
    expect(await click(`@${calc.snapshotId}:e1`)).toMatchObject({ code: "stale_ref" });
    expect(await click(`@${music.snapshotId}:e1`)).toMatchObject({ code: "stale_ref" });
    expect(await click(`@${fresh.snapshotId}:e1`, scope("other"))).toMatchObject({
      code: "stale_ref",
    });
    expect(await click(`@${fresh.snapshotId}:e1`)).toMatchObject({ ok: true });
    expect(await t.act(MUSIC.id, { kind: "key", key: "cmd+v" } as never)).toMatchObject({
      code: "key_not_allowed",
    });
  });
});

describe("status on a bridged host", () => {
  it("reports the host platform, not this process's, when a bridge runs the CLI", async () => {
    const runner = Object.assign(
      async () => ok({ platform: "macos", permissions: { accessibility: { state: "granted" } } }),
      {},
    );
    const provider = new AgentDesktopAppControl({
      runner,
      store: new InMemoryAppControlStore(),
      platform: null,
    });
    expect(await provider.status(context)).toEqual({
      available: true,
      accessibility: "granted",
      platform: "macos",
    });
  });
});

describe("status when agent-desktop is missing", () => {
  const providerFor = (runner: AgentDesktopRunner) =>
    new AgentDesktopAppControl({ runner, store: new InMemoryAppControlStore(), platform: null });

  it("flags a missing binary as not installed", async () => {
    const status = await providerFor(async () => {
      throw new AgentDesktopNotInstalledError();
    }).status(context);
    expect(status).toMatchObject({ available: false, installed: false });
  });

  it("sets no flag for any other runner error", async () => {
    const status = await providerFor(async () => {
      throw new Error("The app control bridge is unreachable.");
    }).status(context);
    expect(status.available).toBe(false);
    expect(status).not.toHaveProperty("installed");
  });
});
