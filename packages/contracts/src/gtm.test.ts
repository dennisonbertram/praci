import { describe, expect, it } from "vitest";
import { pageAgentColor } from "./agent-colors.js";
import { BUILTIN_TOOL_NAMES } from "./builtin-tools.js";
import {
  GTM_AGENT_BUILTIN_TOOLS,
  GTM_CHANNELS,
  GTM_POST_TOOL,
  GTM_WORK_ROUTINE_NAME,
  GtmPostInputSchema,
  GtmQueueInputSchema,
  GtmQueueOutputSchema,
  gtmAgentSpawnKey,
  isGtmAgentSpawnKey,
} from "./gtm.js";
import { BOT_COLORS } from "./ids.js";

describe("GTM contracts", () => {
  it("accepts strict half-open queue windows of at most 31 days", () => {
    const input = { from: "2030-01-01T00:00:00Z", to: "2030-02-01T00:00:00+00:00" };
    expect(GtmQueueInputSchema.parse(input)).toEqual(input);
    for (const invalid of [
      { from: input.to, to: input.from },
      { from: input.from, to: "2030-02-01T00:00:01Z" },
      { from: "2030-01-01T00:00:00", to: input.to },
      { ...input, serverId: "caller-controlled" },
    ]) {
      expect(GtmQueueInputSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("validates normalized queue results without requiring provider fields", () => {
    const result = {
      status: "ready",
      complete: true,
      posts: [
        {
          id: "post-1",
          content: "",
          status: "scheduled",
          scheduledFor: "2030-01-01T12:00:00.000Z",
          platforms: [{ platform: "twitter", accountId: "account-1", status: "pending" }],
        },
      ],
    };
    expect(GtmQueueOutputSchema.parse(result)).toEqual(result);
    expect(GtmQueueOutputSchema.safeParse({ ...result, status: "unavailable" }).success).toBe(
      false,
    );
    for (const url of ["ftp://example.test/post", "https://user:pass@example.test/post"]) {
      expect(
        GtmQueueOutputSchema.safeParse({
          ...result,
          posts: [
            {
              ...result.posts[0],
              platforms: [
                {
                  platform: "twitter",
                  accountId: "account-1",
                  status: "published",
                  platformPostUrl: url,
                },
              ],
            },
          ],
        }).success,
      ).toBe(false);
    }
    expect(
      GtmQueueOutputSchema.safeParse({
        ...result,
        posts: [{ ...result.posts[0], accountId: "secret" }],
      }).success,
    ).toBe(false);
  });

  it("recognizes the user-scoped spawn key and uses the assigned colour", () => {
    expect(gtmAgentSpawnKey("u1")).toBe("gtm-agent:u1");
    expect(isGtmAgentSpawnKey(gtmAgentSpawnKey("u1"))).toBe(true);
    expect(isGtmAgentSpawnKey("legal-agent:u1")).toBe(false);
    expect(isGtmAgentSpawnKey(null)).toBe(false);
    expect(isGtmAgentSpawnKey(undefined)).toBe(false);
    expect(pageAgentColor("gtm")).toBe(BOT_COLORS[5]);
    expect(GTM_WORK_ROUTINE_NAME).toBe("Work the plan");
  });

  it("the GTM tool list has no delegation, desktop or mail-write tool", () => {
    expect(GTM_AGENT_BUILTIN_TOOLS).toEqual([
      "web_search",
      "web_fetch",
      "browser_navigate",
      "browser_snapshot",
      "browser_act",
      "request_takeover",
      "request_secret",
      "list_secrets",
      "scratchpad_list",
      "scratchpad_add",
      "scratchpad_update",
      "scratchpad_complete",
      "scratchpad_remove",
      "page_read",
      "page_write",
      "page_edit",
      "mail_search",
      "mail_grep",
      "mail_get",
      "message_user",
      "remember",
      "save_memory",
      "recall_memory",
      "forget_memory",
    ]);
    for (const name of GTM_AGENT_BUILTIN_TOOLS) expect(BUILTIN_TOOL_NAMES).toContain(name);
    // Runtime registration and approval-gated exposure belong to S3c, not this fixed list.
    expect(GTM_AGENT_BUILTIN_TOOLS).not.toContain(GTM_POST_TOOL);
  });

  it("keeps posts and email founder-approved and community channels draft-only", () => {
    expect(Object.keys(GTM_CHANNELS)).toEqual([
      "x",
      "linkedin",
      "threads",
      "bluesky",
      "reddit",
      "hn",
      "producthunt",
      "directory",
      "email",
    ]);
    for (const channel of ["x", "linkedin", "threads", "bluesky", "email"] as const)
      expect(GTM_CHANNELS[channel].approval).toBe("every_item");
    for (const channel of ["reddit", "hn", "producthunt"] as const)
      expect(GTM_CHANNELS[channel]).toMatchObject({ category: "draft", approval: "draft_only" });
    expect(GTM_CHANNELS.directory).toMatchObject({
      category: "create_account",
      approval: "directory_policy",
    });
    expect(GTM_CHANNELS.x.platform).toBe("twitter");
  });
});

describe("app-owned posting input", () => {
  const input = {
    content: " Approved text\n",
    scheduledFor: "2030-01-01T10:00:00Z",
    accountId: "synthetic-account",
  };

  it("preserves exact text and accepts only an absolute time and one account", () => {
    expect(GTM_POST_TOOL).toBe("gtm_post");
    expect(GtmPostInputSchema.parse(input)).toEqual(input);
    expect(
      GtmPostInputSchema.safeParse({ ...input, scheduledFor: "2030-01-01T11:00:00+01:00" }).success,
    ).toBe(true);
  });

  it("rejects missing fields, relative times and all posting overrides", () => {
    for (const field of ["content", "scheduledFor", "accountId"] as const) {
      const incomplete: Record<string, unknown> = { ...input };
      delete incomplete[field];
      expect(GtmPostInputSchema.safeParse(incomplete).success).toBe(false);
      expect(GtmPostInputSchema.safeParse({ ...input, [field]: "" }).success).toBe(false);
    }
    for (const scheduledFor of ["2030-01-01T10:00:00", "in 10 minutes", "2030-02-30T10:00:00Z"])
      expect(GtmPostInputSchema.safeParse({ ...input, scheduledFor }).success).toBe(false);
    for (const field of [
      "platform",
      "platforms",
      "publishNow",
      "isDraft",
      "media_urls",
      "mediaItems",
      "customContent",
      "schedule_minutes",
      "title",
    ])
      expect(GtmPostInputSchema.safeParse({ ...input, [field]: "override" }).success).toBe(false);
    expect(GtmPostInputSchema.safeParse({ ...input, accountId: ["one", "two"] }).success).toBe(
      false,
    );
  });
});
