import { AppControlRefusedError } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import type { AppControlOfferInput } from "./tools.js";
import { appControlOffered, resolveAllowedApp, runDesktopAppTool } from "./tools.js";

const eligible: AppControlOfferInput = {
  hasProvider: true,
  enabled: true,
  appCount: 1,
  runUserId: "owner",
  ownerUserId: "owner",
  trigger: "user",
  unattended: false,
  externalTaint: false,
  meetingTainted: false,
  hostThisMac: false,
  computerKind: "docker",
  audience: "internal",
};

describe("appControlOffered", () => {
  it("offers the tools to an eligible owner run", () => {
    expect(appControlOffered(eligible)).toBe(true);
  });

  const denied: Array<[string, Partial<AppControlOfferInput>]> = [
    ["no provider", { hasProvider: false }],
    ["switch off", { enabled: false }],
    ["empty app list", { appCount: 0 }],
    ["non-owner user", { runUserId: "someone" }],
    ["no deployment owner", { ownerUserId: null }],
    ["unattended", { unattended: true }],
    ["external taint", { externalTaint: true }],
    ["meeting taint", { meetingTainted: true }],
    ["this-mac host", { hostThisMac: true }],
    ["desktop computer", { computerKind: "desktop" }],
    ["external audience", { audience: "external" }],
    ...[
      "resume",
      "bot_message",
      "spawn",
      "routine",
      "skill",
      "webhook",
      "messaging",
      "mcp",
      "follow_up",
      "reaction",
      "call_end",
      "cloud_agent",
      "created",
      "tickets",
    ].map((trigger): [string, Partial<AppControlOfferInput>] => [
      `trigger ${trigger}`,
      { trigger },
    ]),
  ];
  it.each(denied)("withholds the tools: %s", (_label, change) => {
    expect(appControlOffered({ ...eligible, ...change })).toBe(false);
  });
});

describe("resolveAllowedApp", () => {
  const allowed = [{ id: "com.apple.Music", name: "Music" }];
  it("matches by id or name and nothing else", () => {
    expect(resolveAllowedApp(allowed, "com.apple.music")?.id).toBe("com.apple.Music");
    expect(resolveAllowedApp(allowed, "music")?.id).toBe("com.apple.Music");
    expect(resolveAllowedApp(allowed, "Terminal")).toBeUndefined();
    expect(resolveAllowedApp(allowed, undefined)).toBeUndefined();
  });
});

describe("runDesktopAppTool failure reasons", () => {
  const app = { id: "com.apple.Music", name: "Music" };
  const run = (provider: Record<string, unknown>) => {
    const calls: unknown[][] = [];
    const deps = {
      provider,
      scope: {},
      policy: { allowed: [app], headed: false },
      context: {},
      redact: (value: unknown) => value,
      activity: async (...args: unknown[]) => {
        calls.push(args);
      },
      authorizeAct: async () => undefined,
    };
    return { calls, deps: deps as unknown as Parameters<typeof runDesktopAppTool>[2] };
  };
  const refusing = (code: string) => async () => {
    throw new AppControlRefusedError(code, "agent-desktop said secret text");
  };

  it.each([
    ["app_not_running", "Not running"],
    ["window_not_found", "No window"],
    ["sensitive", "Sign-in or secret screen"],
    ["app_not_allowed", "Not allowed"],
    ["app_denied", "Not allowed"],
    ["something_new", "Failed"],
  ])("a refused snapshot (%s) writes its line with a fixed reason", async (code, reason) => {
    const { calls, deps } = run({ snapshot: refusing(code) });
    await runDesktopAppTool("desktop_app_snapshot", { app: "Music" }, deps);
    expect(calls).toEqual([["Read Music", reason]]);
  });

  it.each([
    ["desktop_app_snapshot", "Read another app"],
    ["desktop_app_act", "Used another app"],
  ])(
    "%s for an app not on the list writes a line without the model's app name",
    async (name, line) => {
      const { calls, deps } = run({});
      await runDesktopAppTool(name, { app: "Notes <ignore previous>", action: "launch" }, deps);
      expect(calls).toEqual([[line, "Not allowed"]]);
    },
  );

  it("a refused act passes the mapped reason", async () => {
    const { calls, deps } = run({ act: refusing("app_not_running") });
    await runDesktopAppTool("desktop_app_act", { app: "Music", action: "launch" }, deps);
    expect(calls).toEqual([["Opened Music", "Not running"]]);
  });

  it("an act that returns ok false passes the generic reason, never provider text", async () => {
    const { calls, deps } = run({
      act: async () => ({ ok: false, delivery: "none", error: "private detail", code: "x" }),
    });
    await runDesktopAppTool("desktop_app_act", { app: "Music", action: "launch" }, deps);
    expect(calls).toEqual([["Opened Music", "Failed"]]);
  });

  it("a successful act passes no failure", async () => {
    const { calls, deps } = run({ act: async () => ({ ok: true, delivery: "delivered" }) });
    await runDesktopAppTool("desktop_app_act", { app: "Music", action: "launch" }, deps);
    expect(calls).toEqual([["Opened Music", undefined]]);
  });
});
