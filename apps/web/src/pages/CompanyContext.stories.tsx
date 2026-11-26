// Stories for the Context tab (CompanyContext.tsx) on the real Company page. The proposal and
// "found in" stories below are still the mockup for docs/company-context/PLAN.md: slice S3 adds the
// proposal to AskCard. Every name and fact is invented.
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { makeBot, mockBots, mockMe, mockSections } from "../stories/fixtures";
import { CompanyPage } from "./Company";
import { CompanyContext } from "./CompanyContext";
import { companyFixture } from "./company-fixtures";
import { ShellPage } from "./Shell";

function At({ path, children }: { path: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== path) navigate(path, { replace: true });
  }, [pathname, path, navigate]);
  return pathname === path ? children : null;
}

const at = (path: string) => (Story: () => ReactNode) => (
  <At path={path}>
    <Routes>
      <Route path="/app/company/*" element={<Story />} />
      <Route path="/app/:botId" element={<Story />} />
    </Routes>
  </At>
);

const quillfern = makeBot({ id: "bot_quillfern", name: "Quillfern" });

const message = (seq: number, role: "user" | "bot", blocks: unknown[]) => ({
  id: `msg_${seq}`,
  threadId: "thread_demo",
  seq,
  role,
  blocks,
  ...(role === "bot" ? { botId: quillfern.id, runId: "run_demo" } : {}),
  createdAt: `2026-01-01T10:0${seq}:00.000Z`,
});
const text = (value: string) => [{ kind: "text", text: value }];

function mocks(messages: ReturnType<typeof message>[]) {
  const waiting = messages.some((m) =>
    m.blocks.some((b) => (b as { kind: string }).kind === "ask"),
  );
  const current = {
    id: "space_demo",
    name: "Demo space",
    bots: [quillfern, ...mockBots],
    groups: [],
    externalConversations: [],
    botSections: mockSections,
  };
  return mockRpc({
    "spaces.list": {
      current,
      spaces: [{ ...current, isDefault: true, hasContent: true, bots: [], botSections: [] }],
    },
    me: mockMe,
    "threads.get": {
      threadId: "thread_demo",
      cursor: messages.length,
      messages,
      olderCursor: null,
      botId: quillfern.id,
      run: waiting
        ? {
            id: "run_demo",
            status: "waiting_input",
            threadId: "thread_demo",
            botId: quillfern.id,
            createdAt: "2026-01-01T10:02:00.000Z",
            updatedAt: "2026-01-01T10:02:00.000Z",
          }
        : null,
    },
    "threads.head": { threadId: "thread_demo", cursor: messages.length },
    "threads.messages": { threadId: "thread_demo", messages: [], olderCursor: null },
    "threads.remembered": { messageIds: [] },
    "routines.list": [],
    "skills.list": [],
    "connections.list": [],
    "connections.catalog": [],
    "connections.featured": [],
    "agentSkills.list": [],
    "threads.subscribe": () =>
      (async function* () {
        await new Promise(() => undefined);
      })(),
    usage: null,
    "company.page": companyFixture,
    "company.review": { items: [] },
    "finance.overview": null,
  });
}

const meta = {
  title: "Company/Context",
  component: CompanyContext,
} satisfies Meta<typeof CompanyContext>;
export default meta;
type Story = StoryObj<typeof meta>;

const section = (slug: string, title: string, text: string, updatedAt: string, revision = 1) => ({
  id: `doc_${slug}`,
  slug,
  title,
  summary: text.split(/(?<=\.)\s/)[0] ?? text,
  text,
  revision,
  updatedAt,
});

const SECTIONS = [
  section(
    "brand-voice",
    "Brand voice",
    "Plain and friendly. We write to clinic owners, not to software buyers.",
    "2026-10-28T10:00:00.000Z",
  ),
  section(
    "fernhollow-labs",
    "Fernhollow Labs",
    "The company: four people building tools for small clinics.",
    "2026-10-12T10:00:00.000Z",
  ),
  section(
    "quillfern",
    "Quillfern",
    "Invoice reminders for small vet clinics.\n\nClinics connect their billing system. Quillfern sends the reminder and stops when the invoice is paid.\n\nAda leads the product. Ben runs the pilot.",
    "2026-11-02T10:00:00.000Z",
    2,
  ),
];

const history = [
  {
    revision: 2,
    title: "Quillfern",
    text: SECTIONS[2]!.text,
    createdAt: "2026-11-02T10:00:00.000Z",
  },
  {
    revision: 1,
    title: "Quillfern",
    text: "Invoice reminders for small vet clinics.",
    createdAt: "2026-10-30T10:00:00.000Z",
  },
];

const context = (sections: typeof SECTIONS, initialEntry: string): Story => ({
  parameters: { initialEntries: [initialEntry] },
  beforeEach: () =>
    mockRpc({
      "companyContext.list": sections,
      "companyContext.history": history,
      "companyContext.save": SECTIONS[2],
    }),
});

/** The owner's sections, one open. Real tab on the real Company page. */
export const Page: Story = {
  ...context(SECTIONS, "/app/company?view=context&section=quillfern"),
  render: () => <CompanyPage />,
};
/** The owner writes the first entry. */
export const Empty: Story = {
  ...context([], "/app/company?view=context"),
  render: () => <CompanyPage />,
};
/** Editing an open section. */
export const Writing: Story = {
  ...context(SECTIONS, "/app/company?view=context&section=quillfern"),
  render: () => <CompanyPage />,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Edit" }));
  },
};
/** History of one section, with Restore on the older text. */
export const History: Story = {
  ...context(SECTIONS, "/app/company?view=context&section=quillfern"),
  render: () => <CompanyPage />,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "More" }));
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "History" }));
  },
};

const proposal = (flag?: string) => ({
  kind: "ask",
  text: "Add to Quillfern?",
  detail: "Reminders can also go out by text message. Clinics turn this on in their settings.",
  approvalEffectId: "effect_demo",
  status: "pending",
  ...(flag ? { approvalReason: flag } : {}),
  actions: [
    { id: "allow", label: "Approve" },
    { id: "edit", label: "Edit" },
    { id: "deny", label: "Reject" },
  ],
});

const thread = (blocks: unknown[], ask: string): Story => ({
  decorators: [at(`/app/${quillfern.id}`)],
  beforeEach: () => mocks([message(1, "user", text(ask)), message(2, "bot", blocks)]),
  render: () => (
    <div className="h-dvh">
      <ShellPage />
    </div>
  ),
});

export const Proposal = thread(
  [...text("Good to know. I'd like to keep this where every agent can find it."), proposal()],
  "Quillfern can send reminders by text message now.",
);

/** The run read a customer email first, so the card says so. */
export const ProposalFlagged = thread(
  [
    ...text("The customer's email mentions this. I'd like to add it."),
    proposal("This agent read outside content first."),
  ],
  "Go through the clinic's email and tell me what they asked for.",
);

export const FoundInContext = thread(
  text(
    "Quillfern is our invoice reminder product for small vet clinics, sold per clinic at a flat monthly price. I'll write the launch note for clinic owners and keep it plain and friendly.\n\nFrom [Company context: Quillfern](/app/company?view=context&section=quillfern)",
  ),
  "You're Quillfern. Write the launch note.",
);

export const FoundInAgentPage = thread(
  text(
    "Ben's launch plan says three clinics are in the pilot and Ben runs it. You haven't confirmed this, so tell me if it's out of date.\n\nFrom [Ben: Launch plan](/app/pages/bot_ben/page_launch)",
  ),
  "Who's in the Quillfern pilot?",
);
