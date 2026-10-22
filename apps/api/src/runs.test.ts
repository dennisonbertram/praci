import { describe, expect, it, vi } from "vitest";
import {
  activityNotificationsEnabled,
  activityPromptSnippet,
  listPendingApprovalNotifications,
  pendingAskSnippet,
} from "./runs.js";

describe("run activity copy", () => {
  it("presents structured agent messages instead of their internal wake prompt", () => {
    expect(
      activityPromptSnippet({
        trigger: "bot_message",
        prompt: "[bot] A message just arrived from another bot with internal routing data",
        sourceBlocks: [
          {
            kind: "bot_message_received",
            fromBotId: "maya",
            fromBotName: "Maya",
            text: "Please check the release workflow.",
            intent: "request",
          },
        ],
      }),
    ).toBe("Maya asked: Please check the release workflow.");
  });

  it("strips markdown from an agent message", () => {
    const snippet = activityPromptSnippet({
      trigger: "bot_message",
      prompt: "x",
      sourceBlocks: [
        {
          kind: "bot_message_received",
          fromBotId: "maya",
          fromBotName: "Maya",
          text: "## Summary\n**Northwind** renewed: see [the file](https://example.com/a).",
          intent: "result",
        },
      ],
    });
    expect(snippet).toBe("Update from Maya: Summary Northwind renewed: see the file.");
    expect(snippet).not.toMatch(/[*#]/);
  });

  it("fails closed when an agent message has no valid structured source", () => {
    expect(
      activityPromptSnippet({
        trigger: "bot_message",
        prompt: "[bot] private internal routing envelope",
        sourceBlocks: [{ kind: "text", text: "not a peer message" }],
      }),
    ).toBe("Message from another agent");
  });
});

it("never shows a new bot's internal introduction prompt", () => {
  expect(
    activityPromptSnippet({
      trigger: "created",
      prompt: "You were just created. In one reply, say what you understood your role to be",
    }),
  ).toBe("Introduced itself");
});

describe("run activity notification preference", () => {
  it("silences only direct messages", () => {
    expect(activityNotificationsEnabled(null, false)).toBe(false);
    expect(activityNotificationsEnabled("group-1", false)).toBe(true);
  });
});

it("previews the pending question on a held run and skips answered cards", () => {
  const ask = (text: string, status?: "pending" | "answered") => ({
    blocks: [{ kind: "ask", text, status }],
  });
  expect(pendingAskSnippet([ask("Old one", "answered"), ask("Send $1,200 to Acme?")])).toBe(
    "Send $1,200 to Acme?",
  );
  expect(pendingAskSnippet([ask("Done", "answered")])).toBeUndefined();
  expect(pendingAskSnippet([{ blocks: [{ kind: "text", text: "hi" }] }])).toBeUndefined();
});

describe("listPendingApprovalNotifications", () => {
  const actor = { spaceId: "s", userId: "u" } as never;
  const fake = (runs: unknown[], messages: unknown[]) => {
    const notificationFind = vi.fn(async () => [{ id: "n1" }]);
    const runFind = vi.fn(async () => runs);
    const prisma = {
      run: { findMany: runFind },
      message: { findMany: vi.fn(async () => messages) },
      notification: { findMany: notificationFind },
    } as never;
    return { prisma, runFind, notificationFind };
  };

  it("looks only at held runs of existing agents, however old the notification", async () => {
    const { prisma, runFind, notificationFind } = fake(
      [{ id: "r1", threadId: "t1" }],
      [{ runId: "r1", blocks: [{ kind: "ask", text: "Send?", status: "pending" }] }],
    );
    await listPendingApprovalNotifications(prisma, actor);
    expect(runFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "waiting_input", bot: { archivedAt: null } }),
      }),
    );
    const where = (
      notificationFind.mock.calls[0] as unknown as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).toMatchObject({ runId: { in: ["r1"] }, seenAt: null });
    expect(where).not.toHaveProperty("createdAt");
  });

  it("matches by run, so a stale approval from another agent in the same group thread stays out", async () => {
    const { prisma, notificationFind } = fake(
      [
        { id: "r1", threadId: "g" },
        { id: "r2", threadId: "g" },
      ],
      [
        { runId: "r1", blocks: [{ kind: "ask", text: "Send?", status: "answered" }] },
        { runId: "r2", blocks: [{ kind: "ask", text: "Pay?", status: "pending" }] },
      ],
    );
    await listPendingApprovalNotifications(prisma, actor);
    const call = notificationFind.mock.calls[0] as unknown as [{ where: Record<string, unknown> }];
    expect(call[0].where).toMatchObject({ runId: { in: ["r2"] } });
    expect(call[0].where).not.toHaveProperty("threadId");
  });

  it("returns nothing when the card was answered", async () => {
    const { prisma, notificationFind } = fake(
      [{ id: "r1", threadId: "t1" }],
      [{ runId: "r1", blocks: [{ kind: "ask", text: "Send?", status: "answered" }] }],
    );
    expect(await listPendingApprovalNotifications(prisma, actor)).toEqual([]);
    expect(notificationFind).not.toHaveBeenCalled();
  });
});
