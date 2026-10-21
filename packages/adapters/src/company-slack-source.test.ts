import type {
  AdapterContext,
  CompanyConnectionReader,
  CompanyImportSourceDescriptor,
} from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { createCompanySlackReader } from "./company-slack-source.js";

const source: CompanyImportSourceDescriptor = {
  id: "source",
  sourceKind: "slack",
  connectionId: "connection",
  scope: {},
};
const context: AdapterContext = {
  spaceId: "space",
  userId: "owner",
  operationId: "operation",
  traceId: "trace",
  signal: new AbortController().signal,
};
const names = [
  "SLACK_LIST_CONVERSATIONS",
  "SLACK_RETRIEVE_CONVERSATION_INFORMATION",
  "SLACK_FETCH_CONVERSATION_HISTORY",
  "SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION",
  "SLACK_RETRIEVE_DETAILED_USER_INFORMATION",
];
function harness(respond: (name: string, args: Record<string, unknown>) => unknown) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const reader: CompanyConnectionReader = {
    listTools: async () =>
      names.map((name) => ({
        name,
        description: name,
        readOnly: true,
        inputSchema: {
          type: "object",
          properties: Object.fromEntries(
            [
              "types",
              "limit",
              "cursor",
              "channel",
              "oldest",
              "latest",
              "inclusive",
              "ts",
              "user",
            ].map((key) => [key, {}]),
          ),
        },
      })),
    callTool: async (_source, name, args) => {
      calls.push({ name, args });
      return { successful: true, data: respond(name, args) };
    },
  };
  return { slack: createCompanySlackReader(reader), calls };
}
const publicChannel = {
  id: "CPUBLIC1",
  name: "general",
  is_channel: true,
  is_private: false,
  is_im: false,
};
describe("Company Slack source", () => {
  it("lists only public channels by default and preserves the bounded cursor", async () => {
    const { slack, calls } = harness(() => ({
      channels: [publicChannel, { id: "GPRIVATE1", name: "private", is_private: true }],
      response_metadata: { next_cursor: "next" },
    }));
    const page = await slack.discover(source, null, 10, context);
    expect(page.units.map((unit) => unit.cursor.channelId)).toEqual(["CPUBLIC1"]);
    expect(page.nextCursor).toEqual({ pageToken: "next" });
    expect(page.cooldownMs).toBe(60_000);
    expect(calls[0]?.args).toMatchObject({ types: "public_channel", limit: 10 });
  });
  it("refuses private history even when its ID was selected as public", async () => {
    const { slack, calls } = harness(() => ({ channel: { id: "GPRIVATE1", is_private: true } }));
    await expect(
      slack.read(
        { ...source, scope: { channelIds: ["GPRIVATE1"] } },
        { channelId: "GPRIVATE1" },
        context,
      ),
    ).rejects.toThrow("source_access_denied");
    expect(calls.map((call) => call.name)).toEqual([names[1]]);
  });
  it("reads an explicitly selected private channel and paginates replies without storing bodies in cursors", async () => {
    const privateSource = {
      ...source,
      scope: { channelIds: [], privateChannelIds: ["GPRIVATE1"], allTime: true },
    };
    const { slack, calls } = harness((name) => {
      if (name === names[1])
        return { channel: { id: "GPRIVATE1", is_private: true, name: "selected" } };
      if (name === names[2])
        return {
          messages: [
            {
              ts: "1700000000.000001",
              text: "We launched the invented workshop.",
              user: "UAUTHOR1",
              reply_count: 1,
            },
          ],
        };
      if (name === names[3])
        return {
          messages: [
            { ts: "1700000001.000001", text: "The invented project is ready.", user: "UAUTHOR1" },
          ],
        };
      return {
        user: {
          id: "UAUTHOR1",
          profile: {
            real_name: "Casey Example",
            email: "casey@example.test",
            phone: "must not reach extraction",
            status_text: "must not reach extraction",
          },
        },
      };
    });
    const first = await slack.read(privateSource, { channelId: "GPRIVATE1" }, context);
    expect(first.done).toBe(false);
    expect(first.document?.text).toContain("Work email: casey@example.test");
    expect(first.document?.text).not.toContain("must not reach extraction");
    expect(first.nextCursor).toEqual({
      channelId: "GPRIVATE1",
      historyCursor: null,
      historyDone: true,
      threadTs: "1700000000.000001",
    });
    const reply = await slack.read(privateSource, first.nextCursor, context);
    expect(reply.document?.id).toBe("GPRIVATE1:1700000001.000001");
    expect(reply.done).toBe(true);
    expect(calls.find((call) => call.name === names[3])?.args).toMatchObject({
      channel: "GPRIVATE1",
      ts: "1700000000.000001",
      limit: 1,
    });
  });
  it("reports a provider rate limit as a delayed retry and rejects stalled pagination", async () => {
    const limited = harness(() => ({ ok: false, error: "ratelimited", retry_after: 120 }));
    await expect(limited.slack.channels({ source }, context)).rejects.toMatchObject({
      code: "source_rate_limited",
      retryAfterMs: 120_000,
    });
    expect(limited.calls).toHaveLength(1);
    const stalled = harness(() => ({ channels: [], response_metadata: { next_cursor: "same" } }));
    await expect(stalled.slack.channels({ source, cursor: "same" }, context)).rejects.toThrow(
      "source_cursor_stalled",
    );
  });
});
