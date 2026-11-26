import type { PipelineImportCard as CardData, MessageBlock } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { PipelineImportCard } from "./PipelineImportCard";

// Every name, address and count is invented.
const review: CardData = {
  status: "reviewing",
  hash: "invented",
  add: 96,
  update: 0,
  questions: [
    {
      id: "p:1:0",
      row: 1,
      kind: "person",
      name: "Avery Example",
      firm: "Sample Street Capital",
      referred: 0,
      newRecord: true,
      candidates: [
        {
          id: "c1",
          name: "Avery Example",
          email: "avery@example.test",
          organization: "Elsewhere Partners",
          stays: null,
        },
        {
          id: "c2",
          name: "Avery Example",
          email: null,
          organization: "Peak Example",
          stays: "Peak Example",
        },
      ],
      allowNew: true,
    },
    {
      id: "r:sam",
      row: null,
      kind: "referrer",
      name: "Sam Example",
      firm: null,
      referred: 12,
      newRecord: false,
      candidates: [
        {
          id: "c3",
          name: "Sam Example",
          email: "sam@example.test",
          organization: null,
          stays: null,
        },
      ],
      allowNew: true,
    },
  ],
  newContacts: Array.from(
    { length: 84 },
    (_, i) => `Taylor Sample${i + 1} · Placeholder Fund ${i + 1}`,
  ),
  savedContacts: [
    "Casey Placeholder · casey@examplepeak.example.test",
    "Kai Sample · kai@example.test",
  ],
  noPerson: ["Riverside Example Fund", "Lantern Ventures 63"],
  existing: [],
  result: null,
};
const answeredAll: CardData = { ...review, questions: [] };
const onlyUpdates: CardData = {
  ...review,
  add: 0,
  update: 3,
  questions: [],
  newContacts: [],
  savedContacts: [],
  noPerson: [],
  existing: ["Sample Street Capital", "Peak Example", "Lantern Ventures 63"],
};
const done = (failed: { firm: string; reason: string }[]): CardData => ({
  ...review,
  status: "done",
  result: { added: 95, updated: 0, newContacts: 84, savedContacts: 23, failed },
});

const card: Extract<MessageBlock, { kind: "ask" }> = {
  kind: "ask",
  text: "Add 96 prospects to Fundraising",
  detail: "Saved contacts are not overwritten.",
  approvalEffectId: "effect-1",
  status: "pending",
  pipelineImport: { importId: "import-1" },
  actions: [{ id: "deny", label: "Deny" }],
};

const meta = {
  title: "Chat/PipelineImportCard",
  component: PipelineImportCard,
  args: {
    block: card,
    botId: "bot-1",
    message: { id: "message-1", runId: "run-1" },
    canAnswer: true,
    onAnswer: async () => undefined,
    fallback: <div>The plain card</div>,
  },
} satisfies Meta<typeof PipelineImportCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const withCard = (data: CardData) => () =>
  mockRpc({
    "threads.pipelineImport": () => data,
    "threads.applyPipelineImport": () => ({ ok: true }),
  });

/** Nothing pre-answered, people and referrers once each, lists open. Add waits for every answer. */
export const Questions: Story = { beforeEach: withCard(review) };
/** No doubt on the list: Add is open at once. */
export const NoQuestions: Story = { beforeEach: withCard(answeredAll) };
/** Everyone is on the Pipeline already; the list only fills empty fields. */
export const OnlyUpdates: Story = { beforeEach: withCard(onlyUpdates) };
/** The worker is adding the rows. */
export const Adding: Story = {
  args: { block: { ...card, status: "answered", answer: "allow" } },
  beforeEach: withCard({ ...review, status: "applying" }),
};
/** The result, with the way to the Pipeline. */
export const Result: Story = {
  args: { block: { ...card, status: "answered", answer: "allow" } },
  beforeEach: withCard(done([])),
};
/** A row that failed is named; the others were saved. */
export const ResultWithFailedRow: Story = {
  args: { block: { ...card, status: "answered", answer: "allow" } },
  beforeEach: withCard(done([{ firm: "Maple Fund 21", reason: "Could not be saved." }])),
};
/** Denied or replaced: the plain card. */
export const Closed: Story = { beforeEach: withCard({ ...review, status: "closed" }) };
