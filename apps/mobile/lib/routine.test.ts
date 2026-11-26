import type { Routine } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { activateUiLocale } from "./i18n";
import { routineActivityLine, routineStatusLine } from "./routine.js";

function routine(partial: Partial<Routine>): Routine {
  return {
    id: "routine-1",
    botId: "bot-1",
    name: "Weekly review",
    prompt: "Review the week.",
    crons: [],
    timezone: "UTC",
    active: true,
    notify: true,
    webhookEnabled: false,
    githubEnabled: false,
    messageProvider: null,
    modelProvider: null,
    modelId: null,
    thinkingLevel: null,
    lastRunAt: null,
    nextRunAt: null,
    quiet: false,
    watch: null,
    managedKind: null,
    status: {
      lastRunAt: null,
      nextRunAt: null,
      lastCheckedAt: null,
      lastChangedAt: null,
      pausedReason: null,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("routineStatusLine", () => {
  it("shows the app name for a connector watch", () => {
    const connectorWatch = routine({
      watch: {
        kind: "connector",
        connectorId: "linear",
        toolName: "issues.list",
        arguments: {},
        appName: "Linear",
        intervalMinutes: 60,
      },
    });
    expect(routineStatusLine(connectorWatch)).toBe("Active · Watches Linear · UTC");
  });
  it("shows readable schedules instead of cron expressions", () => {
    expect(routineStatusLine(routine({ crons: ["0 6 * * *"] }))).toBe(
      "Active · Every day at 6:00 AM · UTC",
    );
    expect(routineStatusLine(routine({ crons: ["0 6 * * 0"] }))).toBe(
      "Active · Every Sunday at 6:00 AM · UTC",
    );
    expect(routineStatusLine(routine({ crons: ["30 8 * * 1-5"] }))).toBe(
      "Active · Weekdays at 8:30 AM · UTC",
    );
    expect(routineStatusLine(routine({ crons: ["0 * * * *"] }))).toBe("Active · Every hour · UTC");
  });

  it("keeps the routine's time zone and other triggers", () => {
    expect(
      routineStatusLine(
        routine({
          active: false,
          crons: ["0 9 * * 1"],
          timezone: "Europe/Berlin",
          webhookEnabled: true,
        }),
      ),
    ).toBe("Paused · Every Monday at 9:00 AM, Webhook · Europe/Berlin");
  });

  it("omits the trigger segment when there are no triggers", () => {
    expect(routineStatusLine(routine({}))).toBe("Active · UTC");
  });
});

describe("routineActivityLine", () => {
  const now = new Date("2026-02-02T12:00:00Z");
  it("formats relative dates with the selected app locale", async () => {
    activateUiLocale("fr");
    try {
      const watch = routine({
        watch: { kind: "page", url: "https://example.com", intervalMinutes: 60 },
        status: { ...routine({}).status, lastCheckedAt: "2026-02-02T11:56:00Z" },
      });
      expect(routineActivityLine(watch, now)).toBe("Vérifié il y a 4 minutes");
    } finally {
      activateUiLocale("en");
    }
  });
  it("says when a watch last checked and changed", () => {
    const watch = routine({
      watch: { kind: "page", url: "https://example.com/pricing", intervalMinutes: 60 },
      status: {
        lastRunAt: null,
        nextRunAt: null,
        lastCheckedAt: "2026-02-02T11:56:00Z",
        lastChangedAt: null,
        pausedReason: null,
      },
    });
    expect(routineActivityLine(watch, now)).toBe("Checked 4 minutes ago");
    expect(routineStatusLine(watch)).toBe("Active · Watches example.com · UTC");
  });
  it("says when the last run failed, unless the routine is paused", () => {
    const base = routine({ crons: ["0 8 * * *"], nextRunAt: null });
    const status = { ...base.status, nextRunAt: "2026-02-03T08:00:00Z", lastRunFailed: true };
    expect(routineActivityLine(routine({ status }), now)).toMatch(/^Last run failed · Next /);
    const watch = routine({
      watch: { kind: "page", url: "https://example.com/pricing", intervalMinutes: 60 },
      status: { ...status, lastCheckedAt: "2026-02-02T11:56:00Z" },
    });
    expect(routineActivityLine(watch, now)).toBe("Last run failed · Checked 4 minutes ago");
    const paused = routine({ status: { ...status, pausedReason: "noisy" } });
    expect(routineActivityLine(paused, now)).toBe("Paused: the page changes too often");
  });
  it("says why a watch is paused and has nothing to say for a new routine", () => {
    const paused = routine({
      status: { ...routine({}).status, pausedReason: "noisy" },
    });
    expect(routineActivityLine(paused, now)).toBe("Paused: the page changes too often");
    expect(routineActivityLine(routine({}), now)).toBeNull();
  });
  it("says a routine is held because its model connection ran out of credit", () => {
    const held = routine({ status: { ...routine({}).status, pausedReason: "credit" } });
    expect(routineActivityLine(held, now)).toBe("Paused: model connection out of credit");
  });
});
