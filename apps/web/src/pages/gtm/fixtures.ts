import type { GtmOverview, ScratchpadItem } from "@rakazo/contracts";

export const item: ScratchpadItem = {
  id: "gtm_post_demo",
  botId: "bot_gtm",
  title: "Introduce the beta",
  notes: "We’re opening our beta to small teams. Join us at https://example.com/beta",
  status: "parked",
  category: "public_post",
  channel: "x",
  target: "account_demo",
  scheduledFor: "2026-11-01T15:00:00.000Z",
  createdAt: "2026-10-20T12:00:00.000Z",
  updatedAt: "2026-10-20T12:00:00.000Z",
  approvedAt: null,
  approvedBy: null,
  proof: null,
};
export const overview: GtmOverview = {
  goal: {
    ...item,
    id: "goal_demo",
    title: "Find our first 50 design partners",
    notes: "",
    category: "goal",
    channel: null,
    target: null,
    scheduledFor: null,
    status: "open",
  },
  groups: {
    needs_you: [
      item,
      {
        ...item,
        id: "directory_demo",
        title: "Submit to Example Directory",
        notes: "List the beta in the productivity category.",
        category: "create_account",
        channel: "directory",
        target: "https://example.com/directory",
        scheduledFor: null,
      },
    ],
    in_progress: [
      {
        ...item,
        id: "research_demo",
        title: "Research founder communities",
        notes: "Find communities that welcome product feedback.",
        status: "open",
        category: "research",
        channel: null,
        target: null,
        scheduledFor: null,
      },
    ],
    drafts: [
      {
        ...item,
        id: "draft_demo",
        title: "A question for Hacker News",
        category: "draft",
        channel: "hn",
        target: null,
        scheduledFor: null,
      },
    ],
    done: [
      {
        ...item,
        id: "done_demo",
        title: "Publish the launch note",
        status: "done",
        proof: "https://example.com/launch",
      },
    ],
  },
  counts: { needs_you: 2, in_progress: 1, drafts: 1, done: 1 },
  channels: [
    {
      channel: "x",
      status: "connected",
      accounts: [{ id: "account_demo", platform: "twitter", label: "@example" }],
    },
    { channel: "linkedin", status: "not_connected", accounts: [] },
    { channel: "threads", status: "not_connected", accounts: [] },
    { channel: "bluesky", status: "not_connected", accounts: [] },
    { channel: "directory", status: "ready", accounts: [] },
    { channel: "email", status: "not_connected", accounts: [] },
    { channel: "reddit", status: "draft_only", accounts: [] },
    { channel: "hn", status: "draft_only", accounts: [] },
    { channel: "producthunt", status: "draft_only", accounts: [] },
  ],
  gmailAccounts: [],
  zernioLinked: true,
  postingCapability: "ready",
  nextRunAt: "2026-11-01T13:00:00.000Z",
  directoryPolicy: { founderApprovals: 2, autoOpenings: 1, approvalsBeforeAuto: 3, dailyCap: 5 },
};
export const emptyOverview: GtmOverview = {
  ...overview,
  goal: null,
  groups: { needs_you: [], in_progress: [], drafts: [], done: [] },
  counts: { needs_you: 0, in_progress: 0, drafts: 0, done: 0 },
  zernioLinked: false,
  postingCapability: "not_connected",
  nextRunAt: null,
  channels: [],
  directoryPolicy: { ...overview.directoryPolicy, founderApprovals: 0, autoOpenings: 0 },
};
export const page = {
  botId: "bot_gtm",
  content:
    "## Launch notes\n\nFocus this week: talk to small teams and learn what they need before expanding to new channels.",
  revision: 1,
  updatedBy: "bot" as const,
  updatedAt: "2026-10-20T12:00:00.000Z",
};
