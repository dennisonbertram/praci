import { describe, expect, it, vi } from "vitest";
import type { TaughtSkillRow } from "./teaching-session.js";
import {
  appendRecordingEvent,
  applyTeachingDesktopInput,
  captureTeachingSnapshot,
  completeTeachingSession,
  emptyRecording,
  expireTaughtSkillTeaching,
  recordTeachingInputEvent,
  scrubTaughtSkillRow,
} from "./teaching-session.js";

function skillRow(
  overrides: Partial<ReturnType<typeof emptySkill>> = {},
): ReturnType<typeof emptySkill> {
  return { ...emptySkill(), ...overrides };
}

function emptySkill() {
  return {
    id: "skill-1",
    spaceId: "workspace-1",
    botId: "bot-1",
    userId: "user-1",
    name: "",
    goal: "Export the list",
    status: "recording",
    playbook: {},
    recording: emptyRecording(),
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    stoppedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function recordingDeps(skill: ReturnType<typeof skillRow>) {
  let current = structuredClone(skill);
  const tx = {
    $executeRaw: vi.fn(),
    taughtSkill: {
      findUniqueOrThrow: vi.fn(async () => current),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        current = { ...current, ...data };
        return current;
      }),
    },
    message: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "message-1", blocks: [{ kind: "skill_draft", skillId: "skill-1" }] },
        ]),
    },
    bot: {
      findUnique: vi.fn(),
    },
    thread: {
      update: vi.fn(async () => ({ nextEventSeq: 2 })),
    },
    event: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "event-1",
        seq: 1,
        createdAt: new Date(),
        ...data,
      })),
    },
  };
  return {
    current: () => current,
    tx,
    deps: {
      prisma: {
        $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
        taughtSkill: {
          findUnique: vi.fn(async () => current),
          findFirst: vi.fn(async () => (current.status === "recording" ? current : null)),
        },
        bot: {
          findUnique: vi.fn(),
        },
        message: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { id: "message-1", blocks: [{ kind: "skill_draft", skillId: "skill-1" }] },
            ]),
        },
        event: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      events: { append: vi.fn(), notify: vi.fn(), finalizeComputerControlRelease: vi.fn() },
      jobs: { enqueue: vi.fn(), cancel: vi.fn() },
      sandbox: { observe: vi.fn(), setScreenControl: vi.fn(), sendInput: vi.fn(), act: vi.fn() },
      home: {},
      dataDir: "/tmp",
    },
  };
}

describe("appendRecordingEvent", () => {
  it("keeps the same key pressed at different times", async () => {
    const { deps, current } = recordingDeps(skillRow());
    await appendRecordingEvent(deps as never, "skill-1", {
      at: "2026-01-01T00:00:00.000Z",
      kind: "key",
      key: "o",
    });
    await appendRecordingEvent(deps as never, "skill-1", {
      at: "2026-01-01T00:00:00.100Z",
      kind: "key",
      key: "o",
    });
    expect(current().recording.events).toHaveLength(2);
  });

  it("skips an exact duplicate event", async () => {
    const { deps, current } = recordingDeps(skillRow());
    const event = { at: "2026-01-01T00:00:00.000Z", kind: "key" as const, key: "o" };
    await appendRecordingEvent(deps as never, "skill-1", event);
    await appendRecordingEvent(deps as never, "skill-1", event);
    expect(current().recording.events).toHaveLength(1);
  });

  it("never stores the payload of an event marked protected", async () => {
    const { deps, current } = recordingDeps(skillRow());
    await appendRecordingEvent(deps as never, "skill-1", {
      at: "2026-01-01T00:00:00.000Z",
      kind: "clipboard",
      text: "hunter2",
      sensitive: true,
    });
    expect(current().recording.events).toEqual([
      { at: "2026-01-01T00:00:00.000Z", kind: "clipboard", sensitive: true },
    ]);
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");
  });
});

describe("expireTaughtSkillTeaching", () => {
  it("leaves a live recording session untouched", async () => {
    const { deps } = recordingDeps(skillRow());
    const result = await expireTaughtSkillTeaching(deps as never, "skill-1");
    expect(result?.status).toBe("recording");
    expect(deps.jobs.cancel).not.toHaveBeenCalled();
  });

  it("retries leftover computer release after the session is already a draft", async () => {
    const { deps, tx } = recordingDeps(
      skillRow({
        status: "draft",
        expiresAt: new Date(Date.now() - 1000),
        recording: { ...emptyRecording(), controlLeaseId: "lease-1" },
      }),
    );
    const bot = {
      id: "bot-1",
      thread: { id: "thread-1" },
      computer: {
        id: "computer-1",
        homeKey: "bot-1",
        kind: "cloud",
        providerRef: "box-1",
        controlHolder: "user",
        controlBotId: "bot-1",
        controlLeaseId: "lease-1",
      },
    };
    deps.prisma.bot.findUnique = vi.fn().mockResolvedValue(bot);
    await expireTaughtSkillTeaching(deps as never, "skill-1");
    expect(deps.jobs.cancel).toHaveBeenCalledWith("computer.control-expire:computer-1:lease-1");
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "thread.message.created",
          payload: expect.objectContaining({ messageId: "message-1" }),
        }),
      }),
    );
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "skill.draft.created",
          payload: expect.objectContaining({ skillId: "skill-1" }),
        }),
      }),
    );
    expect(deps.events.notify).toHaveBeenCalled();
  });

  it("does not steal a later manual takeover when retrying a draft", async () => {
    const { deps } = recordingDeps(
      skillRow({
        status: "draft",
        recording: { ...emptyRecording(), controlLeaseId: "teach-lease" },
      }),
    );
    deps.prisma.bot.findUnique = vi.fn().mockResolvedValue({
      id: "bot-1",
      thread: { id: "thread-1" },
      computer: {
        id: "computer-1",
        homeKey: "bot-1",
        kind: "cloud",
        providerRef: "box-1",
        controlHolder: "user",
        controlBotId: "bot-1",
        controlLeaseId: "manual-lease",
      },
    });
    await expireTaughtSkillTeaching(deps as never, "skill-1");
    expect(deps.jobs.cancel).not.toHaveBeenCalled();
    expect(deps.events.finalizeComputerControlRelease).not.toHaveBeenCalled();
  });

  it("does not republish draft events once they already exist", async () => {
    const { deps, tx } = recordingDeps(skillRow({ status: "draft" }));
    deps.prisma.bot.findUnique = vi.fn().mockResolvedValue({
      id: "bot-1",
      thread: { id: "thread-1" },
      computer: null,
    });
    tx.event.findMany = vi.fn().mockResolvedValue([{ payload: { skillId: "skill-1" } }]);
    await expireTaughtSkillTeaching(deps as never, "skill-1");
    expect(tx.event.create).not.toHaveBeenCalled();
    expect(deps.events.notify).not.toHaveBeenCalled();
  });
});

describe("completeTeachingSession", () => {
  it("publishes the stopped event atomically with finalization, once", async () => {
    const { deps, tx, current } = recordingDeps(skillRow());
    const bot = { id: "bot-1", thread: { id: "thread-1" }, computer: null };
    deps.prisma.bot.findUnique = vi.fn().mockResolvedValue(bot);
    tx.bot.findUnique = vi.fn().mockResolvedValue(bot);
    const actor = { spaceId: "workspace-1", userId: "user-1" } as never;

    await completeTeachingSession(deps as never, actor, "skill-1", "stopped");
    const stoppedEvents = () =>
      tx.event.create.mock.calls.filter(
        (call) => (call[0] as { data: { type: string } }).data.type === "skill.teaching.stopped",
      );
    expect(current().status).toBe("draft");
    expect(stoppedEvents()).toHaveLength(1);
    expect(deps.events.notify).toHaveBeenCalled();

    // A retry after the finalize commit must not lose or duplicate the stopped event.
    await completeTeachingSession(deps as never, actor, "skill-1", "stopped");
    expect(stoppedEvents()).toHaveLength(1);
  });
});

describe("recordTeachingInputEvent", () => {
  it("does not claim a click that landed after the session was finalized", async () => {
    const { deps } = recordingDeps(skillRow({ status: "draft" }));
    deps.prisma.taughtSkill.findFirst = vi
      .fn()
      .mockResolvedValue(skillRow({ status: "recording" }));
    const recorded = await recordTeachingInputEvent(
      deps as never,
      { spaceId: "workspace-1", userId: "user-1" } as never,
      "bot-1",
      { kind: "key", key: "x" },
    );
    expect(recorded).toBe("stale");
  });

  it("rejects input after the recording window", async () => {
    const { deps, current } = recordingDeps(skillRow({ expiresAt: new Date(Date.now() - 1000) }));
    const outcome = await recordTeachingInputEvent(
      deps as never,
      { spaceId: "workspace-1", userId: "user-1" } as never,
      "bot-1",
      { kind: "key", key: "x" },
    );
    expect(outcome).toBe("stale");
    expect(current().recording.events).toHaveLength(0);
  });

  it("applies input before persisting the recording", async () => {
    const { deps, current, tx } = recordingDeps(skillRow());
    const computer = {
      id: "computer-1",
      homeKey: "bot-1",
      kind: "e2b",
      providerRef: "box-1",
      controlHolder: "user",
      controlBotId: "bot-1",
      controlLeaseId: "lease-1",
    };
    const order: string[] = [];
    tx.taughtSkill.update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      order.push("persist");
      Object.assign(current(), data);
      return current();
    });
    tx.bot.findUnique = vi.fn(async () => ({ id: "bot-1", computer }));
    deps.sandbox.sendInput = vi.fn(async () => {
      order.push("send");
    });
    await expect(
      recordTeachingInputEvent(
        deps as never,
        { spaceId: "workspace-1", userId: "user-1" } as never,
        "bot-1",
        { kind: "pointer", x: 12, y: 40, button: "left", type: "click" },
      ),
    ).resolves.toBe("recorded");
    expect(order).toEqual(["send", "persist"]);
    expect(current().recording.events).toHaveLength(1);
    expect(deps.prisma.taughtSkill.findFirst).toHaveBeenCalledTimes(1);
  });

  it("records repeated identical inputs in the same millisecond", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    try {
      const { deps, current, tx } = recordingDeps(skillRow());
      tx.bot.findUnique = vi.fn(async () => ({
        id: "bot-1",
        computer: {
          id: "computer-1",
          homeKey: "bot-1",
          kind: "e2b",
          providerRef: "box-1",
          controlHolder: "user",
          controlBotId: "bot-1",
          controlLeaseId: "lease-1",
        },
      }));
      const input = { kind: "key" as const, key: "o" };
      await expect(
        recordTeachingInputEvent(
          deps as never,
          { spaceId: "workspace-1", userId: "user-1" } as never,
          "bot-1",
          input,
        ),
      ).resolves.toBe("recorded");
      await expect(
        recordTeachingInputEvent(
          deps as never,
          { spaceId: "workspace-1", userId: "user-1" } as never,
          "bot-1",
          input,
        ),
      ).resolves.toBe("recorded");
      expect(deps.sandbox.sendInput).toHaveBeenCalledTimes(2);
      expect(current().recording.events).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not persist an event when sandbox input fails", async () => {
    const { deps, current, tx } = recordingDeps(skillRow());
    tx.bot.findUnique = vi.fn(async () => ({
      id: "bot-1",
      computer: {
        id: "computer-1",
        homeKey: "bot-1",
        kind: "e2b",
        providerRef: "box-1",
        controlHolder: "user",
        controlBotId: "bot-1",
        controlLeaseId: "lease-1",
      },
    }));
    deps.sandbox.sendInput = vi.fn(async () => {
      throw new Error("sandbox unavailable");
    });
    await expect(
      recordTeachingInputEvent(
        deps as never,
        { spaceId: "workspace-1", userId: "user-1" } as never,
        "bot-1",
        { kind: "key", key: "x" },
      ),
    ).rejects.toThrow("sandbox unavailable");
    expect(current().recording.events).toHaveLength(0);
  });

  it("does not apply protected input into a different active recording", async () => {
    const { deps, current, tx } = recordingDeps(skillRow({ id: "skill-b" }));
    const computer = {
      id: "computer-1",
      homeKey: "bot-1",
      kind: "e2b",
      providerRef: "box-1",
      controlHolder: "user",
      controlBotId: "bot-1",
      controlLeaseId: "lease-1",
    };
    tx.bot.findUnique = vi.fn(async () => ({ id: "bot-1", computer }));
    const actor = { spaceId: "workspace-1", userId: "user-1" } as never;
    await expect(
      recordTeachingInputEvent(deps as never, actor, "bot-1", {
        kind: "clipboard",
        text: "hunter2",
        sensitive: true,
        skillId: "skill-a",
      }),
    ).resolves.toBe("stale");
    expect(deps.sandbox.sendInput).not.toHaveBeenCalled();
    expect(current().recording.events).toHaveLength(0);
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");

    await expect(
      recordTeachingInputEvent(deps as never, actor, "bot-1", {
        kind: "clipboard",
        text: "hunter2",
        sensitive: true,
        skillId: "skill-b",
      }),
    ).resolves.toBe("recorded");
    expect(deps.sandbox.sendInput).toHaveBeenCalledTimes(1);
    expect(deps.sandbox.sendInput).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "clipboard", text: "hunter2", sensitive: true },
      expect.anything(),
      expect.anything(),
    );
    expect(current().recording.events).toEqual([
      { at: expect.any(String), kind: "clipboard", sensitive: true },
    ]);
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");
  });

  it("drops protected input when the recording changes before it is typed", async () => {
    const { deps, current, tx } = recordingDeps(skillRow({ id: "skill-a" }));
    const computer = {
      id: "computer-1",
      homeKey: "bot-1",
      kind: "e2b",
      providerRef: "box-1",
      controlHolder: "user",
      controlBotId: "bot-1",
      controlLeaseId: "lease-1",
    };
    tx.bot.findUnique = vi.fn(async () => ({ id: "bot-1", computer }));
    let reads = 0;
    deps.prisma.taughtSkill.findFirst = vi.fn(async () => {
      reads += 1;
      return reads === 1 ? current() : skillRow({ id: "skill-b" });
    });
    await expect(
      recordTeachingInputEvent(
        deps as never,
        { spaceId: "workspace-1", userId: "user-1" } as never,
        "bot-1",
        { kind: "clipboard", text: "hunter2", sensitive: true, skillId: "skill-a" },
      ),
    ).resolves.toBe("stale");
    expect(reads).toBe(2);
    expect(deps.sandbox.sendInput).not.toHaveBeenCalled();
    expect(current().recording.events).toHaveLength(0);
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");
  });

  it("still types protected input into the sandbox but stores only a marker", async () => {
    const { deps, current, tx } = recordingDeps(skillRow());
    const computer = {
      id: "computer-1",
      homeKey: "bot-1",
      kind: "e2b",
      providerRef: "box-1",
      controlHolder: "user",
      controlBotId: "bot-1",
      controlLeaseId: "lease-1",
    };
    tx.bot.findUnique = vi.fn(async () => ({ id: "bot-1", computer }));
    await expect(
      recordTeachingInputEvent(
        deps as never,
        { spaceId: "workspace-1", userId: "user-1" } as never,
        "bot-1",
        { kind: "clipboard", text: "hunter2", sensitive: true },
      ),
    ).resolves.toBe("recorded");
    expect(deps.sandbox.sendInput).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "clipboard", text: "hunter2", sensitive: true },
      expect.anything(),
      expect.anything(),
    );
    expect(current().recording.events).toEqual([
      { at: expect.any(String), kind: "clipboard", sensitive: true },
    ]);
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");
  });

  it("stores a protected keystroke without its key", async () => {
    const { deps, current, tx } = recordingDeps(skillRow());
    tx.bot.findUnique = vi.fn(async () => ({ id: "bot-1", computer: null }));
    await expect(
      recordTeachingInputEvent(
        deps as never,
        { spaceId: "workspace-1", userId: "user-1" } as never,
        "bot-1",
        { kind: "key", key: "x", sensitive: true },
      ),
    ).resolves.toBe("recorded");
    expect(current().recording.events).toEqual([
      { at: expect.any(String), kind: "key", sensitive: true },
    ]);
  });

  it("keeps protected input out of the generated playbook", async () => {
    const { deps, current, tx } = recordingDeps(skillRow());
    const bot = { id: "bot-1", thread: { id: "thread-1" }, computer: null };
    tx.bot.findUnique = vi.fn(async () => bot);
    deps.prisma.bot.findUnique = vi.fn().mockResolvedValue(bot);
    await recordTeachingInputEvent(
      deps as never,
      { spaceId: "workspace-1", userId: "user-1" } as never,
      "bot-1",
      { kind: "clipboard", text: "hunter2", sensitive: true },
    );
    await recordTeachingInputEvent(
      deps as never,
      { spaceId: "workspace-1", userId: "user-1" } as never,
      "bot-1",
      { kind: "key", key: "Enter" },
    );
    await completeTeachingSession(
      deps as never,
      { spaceId: "workspace-1", userId: "user-1" } as never,
      "skill-1",
      "stopped",
    );
    const playbook = current().playbook as { steps: string[] };
    expect(JSON.stringify(playbook)).not.toContain("hunter2");
    expect(playbook.steps.join(" ")).toContain("[redacted input]");
    expect(playbook.steps.join(" ")).toContain("Enter");
  });
});

describe("password detection without Protected input", () => {
  const actor = { spaceId: "workspace-1", userId: "user-1" } as never;

  it("never stores keys typed into a field labelled Password, in the recording or playbook", async () => {
    const { deps, current, tx } = recordingDeps(skillRow());
    const bot = { id: "bot-1", thread: { id: "thread-1" }, computer: null };
    tx.bot.findUnique = vi.fn(async () => bot);
    deps.prisma.bot.findUnique = vi.fn().mockResolvedValue(bot);
    for (const key of ["h", "u", "n", "t", "e", "r", "2"]) {
      await recordTeachingInputEvent(deps as never, actor, "bot-1", {
        kind: "key",
        key,
        field: "Password",
      });
    }
    await completeTeachingSession(deps as never, actor, "skill-1", "stopped");
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");
    expect(
      current().recording.events.every((event: { sensitive?: boolean }) => event.sensitive),
    ).toBe(true);
    expect((current().playbook as { steps: string[] }).steps).toEqual(['Type "[redacted input]".']);
  });
});

/** Adds in-memory held-value storage so typed passwords can be tracked without Postgres. */
function withHeldValues(harness: ReturnType<typeof recordingDeps>) {
  const rows = new Map<number, Record<string, unknown>>();
  const table = {
    findUnique: vi.fn(
      async ({ where }: { where: { skillId_segment: { segment: number } } }) =>
        rows.get(where.skillId_segment.segment) ?? null,
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { skillId_segment: { segment: number } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const key = where.skillId_segment.segment;
        rows.set(key, {
          ...(rows.get(key) ?? create),
          ...update,
          ...(rows.has(key) ? {} : create),
        });
      },
    ),
    findMany: vi.fn(async () => [...rows.values()]),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    updateMany: vi.fn(async () => ({ count: 0 })),
  };
  Object.assign(harness.tx, { teachHeldValue: table });
  Object.assign(harness.deps.prisma, { teachHeldValue: table });
  Object.assign(harness.deps, {
    secrets: {
      put: async (value: string) => ({ ciphertext: value }),
      load: async (ciphertext: string) => ciphertext,
    },
  });
  return table;
}

const computerRow = {
  id: "computer-1",
  homeKey: "bot-1",
  kind: "e2b",
  providerRef: "box-1",
  controlHolder: "user",
  controlBotId: "bot-1",
  controlLeaseId: "lease-1",
};

describe("password detection from the sandbox browser", () => {
  const actor = { spaceId: "workspace-1", userId: "user-1" } as never;

  function setup(skillId: string) {
    const harness = recordingDeps(skillRow({ id: skillId }));
    harness.tx.bot.findUnique = vi.fn(async () => ({
      id: "bot-1",
      thread: { id: "thread-1" },
      computer: computerRow,
    }));
    harness.deps.prisma.bot.findUnique = harness.tx.bot.findUnique as never;
    const sandbox = harness.deps.sandbox as Record<string, unknown>;
    sandbox.sendInput = vi.fn();
    sandbox.observe = vi.fn(async () => ({ activeWindow: { title: "Inbox" } }));
    return harness;
  }
  const type = async (deps: unknown, text: string) => {
    for (const key of text) {
      await recordTeachingInputEvent(deps as never, actor, "bot-1", { kind: "key", key });
    }
  };
  const focused = (fields: Record<string, unknown>) => ({
    ok: true,
    focus: { hasFocus: true, tag: "input", type: "text", ...fields },
  });

  it("never stores keys typed into a password input, with no label from the client", async () => {
    const { deps, current } = setup("skill-focus-1");
    (deps.sandbox as Record<string, unknown>).pageBrowser = vi.fn(async () =>
      focused({ type: "password", name: "pw" }),
    );
    await type(deps, "hunter2");
    const events = current().recording.events as { sensitive?: boolean; key?: string }[];
    expect(events).toHaveLength(7);
    expect(events.every((event) => event.sensitive && event.key === undefined)).toBe(true);
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");
    // One check per focus, not per keystroke.
    expect((deps.sandbox as unknown as { pageBrowser: unknown }).pageBrowser).toHaveBeenCalledTimes(
      1,
    );
  });

  it("checks again after a click, and records ordinary fields normally", async () => {
    const { deps, current } = setup("skill-focus-2");
    const pageBrowser = vi
      .fn()
      .mockResolvedValueOnce(focused({ type: "password" }))
      .mockResolvedValueOnce(focused({ type: "text", name: "search" }));
    (deps.sandbox as Record<string, unknown>).pageBrowser = pageBrowser;
    await type(deps, "ab");
    await recordTeachingInputEvent(deps as never, actor, "bot-1", {
      kind: "pointer",
      x: 1,
      y: 2,
      button: "left",
      type: "click",
    });
    await type(deps, "cd");
    expect(pageBrowser).toHaveBeenCalledTimes(2);
    const keys = (current().recording.events as { kind: string; key?: string }[])
      .filter((event) => event.kind === "key")
      .map((event) => event.key);
    expect(keys).toEqual([undefined, undefined, "c", "d"]);
  });

  it("treats an autocomplete current-password field as protected", async () => {
    const { deps, current } = setup("skill-focus-3");
    (deps.sandbox as Record<string, unknown>).pageBrowser = vi.fn(async () =>
      focused({ autocomplete: "current-password" }),
    );
    await type(deps, "x");
    expect(current().recording.events[0]?.sensitive).toBe(true);
  });

  it("falls back to a sign-in window title when the browser cannot answer", async () => {
    const { deps, current } = setup("skill-focus-4");
    const sandbox = deps.sandbox as Record<string, unknown>;
    sandbox.pageBrowser = vi.fn(async () => {
      throw new Error("detached");
    });
    sandbox.observe = vi.fn(async () => ({ activeWindow: { title: "Sign in - Acme" } }));
    await type(deps, "hunter2");
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");
    expect(current().recording.events.every((e: { sensitive?: boolean }) => e.sensitive)).toBe(
      true,
    );
  });

  it("keeps recording ordinary typing when neither check finds a credential", async () => {
    const { deps, current } = setup("skill-focus-5");
    (deps.sandbox as Record<string, unknown>).pageBrowser = vi.fn(async () => ({ ok: false }));
    await type(deps, "hi");
    expect(current().recording.events.map((e: { key?: string }) => e.key)).toEqual(["h", "i"]);
  });
});

describe("held passwords echoed in window titles and snapshots", () => {
  const actor = { spaceId: "workspace-1", userId: "user-1" } as never;

  it("never persists the held value, or an app name derived from it, before or after Stop", async () => {
    const harness = recordingDeps(skillRow({ id: "skill-echo-1" }));
    withHeldValues(harness);
    const { deps, current, tx } = harness;
    const bot = { id: "bot-1", thread: { id: "thread-1" }, computer: computerRow };
    tx.bot.findUnique = vi.fn(async () => bot);
    tx.message.findMany = vi
      .fn()
      .mockResolvedValue([
        { id: "message-1", blocks: [{ kind: "skill_draft", skillId: "skill-echo-1" }] },
      ]);
    deps.prisma.bot.findUnique = vi.fn().mockResolvedValue(bot);
    const sandbox = deps.sandbox as Record<string, unknown>;
    sandbox.sendInput = vi.fn();
    sandbox.observe = vi.fn(async () => ({ activeWindow: { title: "Document - hunter2" } }));
    for (const key of "hunter2") {
      await recordTeachingInputEvent(deps as never, actor, "bot-1", {
        kind: "key",
        key,
        field: "Password",
      });
    }
    await recordTeachingInputEvent(deps as never, actor, "bot-1", {
      kind: "pointer",
      x: 1,
      y: 2,
      button: "left",
      type: "click",
    });
    await captureTeachingSnapshot(deps as never, actor, bot as never, current() as never);
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");
    const windows = current().recording.events.filter((e: { kind: string }) => e.kind === "window");
    expect(windows).toHaveLength(1);
    expect(windows[0]?.app).toBe("[redacted]");
    await completeTeachingSession(deps as never, actor, "skill-echo-1", "stopped");
    expect(JSON.stringify(current().recording)).not.toContain("hunter2");
    expect(JSON.stringify(current().playbook)).not.toContain("hunter2");
  });

  it("scrubs a recording it returns to the user while recording", async () => {
    const harness = recordingDeps(
      skillRow({
        id: "skill-echo-2",
        recording: {
          events: [{ at: "1", kind: "window", title: "Doc - hunter2", app: "hunter2" }],
          snapshots: [{ at: "1", summary: "Doc - hunter2" }],
        } as never,
      }),
    );
    const held = withHeldValues(harness);
    await held.upsert({
      where: { skillId_segment: { segment: 0 } },
      create: { ciphertext: "hunter2", segment: 0 },
      update: {},
    } as never);
    const row = await scrubTaughtSkillRow(
      harness.deps as never,
      harness.current() as unknown as TaughtSkillRow,
    );
    expect(JSON.stringify(row.recording)).not.toContain("hunter2");
  });
});

describe("whole desktop events", () => {
  it("stores a written file as its path, a command without its token, and no content", async () => {
    const { deps, current } = recordingDeps(skillRow());
    await appendRecordingEvent(deps as never, "skill-1", {
      at: "2026-01-01T00:00:00.000Z",
      kind: "file",
      path: "shared/report.csv",
      text: "a,b,c",
    });
    await appendRecordingEvent(deps as never, "skill-1", {
      at: "2026-01-01T00:00:01.000Z",
      kind: "command",
      command: "deploy --token=abc123 --env prod",
    });
    const stored = JSON.stringify(current().recording.events);
    expect(stored).toContain("shared/report.csv");
    expect(stored).not.toContain("a,b,c");
    expect(stored).not.toContain("abc123");
  });
});

describe("plain steps at Stop", () => {
  const actor = { spaceId: "workspace-1", userId: "user-1" } as never;
  async function stopWith(describeSteps: unknown) {
    const { deps, current, tx } = recordingDeps(skillRow());
    const bot = { id: "bot-1", thread: { id: "thread-1" }, computer: null };
    tx.bot.findUnique = vi.fn(async () => bot);
    deps.prisma.bot.findUnique = vi.fn().mockResolvedValue(bot);
    await appendRecordingEvent(deps as never, "skill-1", {
      at: "2026-01-01T00:00:00.000Z",
      kind: "pointer",
      x: 10,
      y: 20,
      type: "click",
    });
    await appendRecordingEvent(deps as never, "skill-1", {
      at: "2026-01-01T00:00:01.000Z",
      kind: "key",
      key: "Enter",
    });
    await completeTeachingSession({ ...deps, describeSteps } as never, actor, "skill-1", "stopped");
    return (current().playbook as { steps: string[] }).steps;
  }

  it("uses the model's steps, and the model sees only sanitized coordinate steps", async () => {
    const describeSteps = vi.fn(async () => ["Click Export in the CRM toolbar.", "Press Enter."]);
    expect(await stopWith(describeSteps)).toEqual([
      "Click Export in the CRM toolbar.",
      "Press Enter.",
    ]);
    expect(describeSteps).toHaveBeenCalledWith({
      scope: { userId: "user-1", spaceId: "workspace-1", botId: "bot-1" },
      goal: "Export the list",
      steps: ["Click left button at (10, 20).", "Press key: Enter."],
    });
  });

  it("keeps the coordinate steps when the model fails or returns nothing", async () => {
    const coordinates = ["Click left button at (10, 20).", "Press key: Enter."];
    expect(await stopWith(vi.fn(async () => null))).toEqual(coordinates);
    expect(
      await stopWith(
        vi.fn(async () => {
          throw new Error("model down");
        }),
      ),
    ).toEqual(coordinates);
    expect(await stopWith(undefined)).toEqual(coordinates);
  });
});

describe("applyTeachingDesktopInput", () => {
  const computer = {
    homeKey: "bot-1",
    kind: "e2b",
    providerRef: "box-1",
    controlLeaseId: "lease-1",
  };

  it("types printable characters that have no keysym", async () => {
    const sandbox = { sendInput: vi.fn(), act: vi.fn() };
    await applyTeachingDesktopInput(
      sandbox as never,
      computer,
      { kind: "key", key: " " },
      {} as never,
    );
    expect(sandbox.sendInput).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "clipboard", text: " " },
      expect.anything(),
      expect.anything(),
    );
  });

  it("sends browser key names as X11 keysyms", async () => {
    const sandbox = { sendInput: vi.fn(), act: vi.fn() };
    await applyTeachingDesktopInput(
      sandbox as never,
      computer,
      { kind: "key", key: "ArrowLeft" },
      {} as never,
    );
    expect(sandbox.sendInput).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "key", key: "Left" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("leaves pointer input untouched", async () => {
    const sandbox = { sendInput: vi.fn(), act: vi.fn() };
    const pointer = {
      kind: "pointer" as const,
      x: 5,
      y: 6,
      button: "left" as const,
      type: "click" as const,
    };
    await applyTeachingDesktopInput(sandbox as never, computer, pointer, {} as never);
    expect(sandbox.sendInput).toHaveBeenCalledWith(
      expect.anything(),
      pointer,
      expect.anything(),
      expect.anything(),
    );
  });
});
