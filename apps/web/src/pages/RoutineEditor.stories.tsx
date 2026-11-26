import type { AgentSkillCatalogEntry, Routine } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { screen, userEvent, within } from "storybook/test";
import { mockRpc, resetRpcMocks } from "../lib/__mocks__/rpc";
import { mockModelCatalog, mockModelCredentials } from "../stories/fixtures/models";
import {
  draftFromRoutine,
  emptyRoutineDraft,
  RoutineEditor,
  RoutineListHeader,
  RoutineListRow,
} from "./RoutineEditor";

const routine: Routine = {
  id: "routine_demo",
  botId: "bot_demo",
  name: "Morning summary",
  prompt: "Summarize yesterday's activity and list what needs attention today.",
  crons: ["0 9 * * 1-5"],
  timezone: "UTC",
  active: true,
  notify: true,
  webhookEnabled: false,
  githubEnabled: false,
  messageProvider: null,
  modelProvider: null,
  modelId: null,
  thinkingLevel: null,
  lastRunAt: "2026-01-01T09:00:00.000Z",
  nextRunAt: "2026-01-02T09:00:00.000Z",
  quiet: false,
  watch: null,
  managedKind: null,
  status: {
    lastRunAt: "2026-01-01T09:00:00.000Z",
    nextRunAt: "2026-01-02T09:00:00.000Z",
    lastCheckedAt: null,
    lastChangedAt: null,
    pausedReason: null,
  },
  createdAt: "2026-01-01T00:00:00.000Z",
};

const webhookRoutine: Routine = {
  ...routine,
  id: "routine_hooks",
  name: "Inbound events",
  crons: ["*/15 * * * *"],
  webhookEnabled: true,
  githubEnabled: true,
  messageProvider: "slack",
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const watchRoutine: Routine = {
  ...routine,
  id: "routine_watch",
  name: "Pricing page",
  crons: [],
  quiet: true,
  watch: { kind: "page", url: "https://example.com/pricing", intervalMinutes: 60 },
  lastRunAt: null,
  nextRunAt: null,
  status: {
    lastRunAt: null,
    nextRunAt: null,
    lastCheckedAt: minutesAgo(4),
    lastChangedAt: minutesAgo(26 * 60),
    pausedReason: null,
  },
};

const pausedWatchRoutine: Routine = {
  ...watchRoutine,
  id: "routine_paused",
  name: "Pricing page, held by the system",
  status: { ...watchRoutine.status, pausedReason: "noisy" },
};

const creditRoutine: Routine = {
  ...routine,
  id: "routine_credit",
  name: "Daily digest, out of credit",
  status: { ...routine.status, pausedReason: "credit" },
};

const checkInRoutine: Routine = {
  ...routine,
  id: "routine_check_in",
  name: "Check in",
  crons: ["0 9 * * *"],
  managedKind: "check_in",
  quiet: true,
};

const meta = {
  title: "Routines/RoutineEditor",
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: MessageTriggerCard (Slack message trigger) and InboundTriggerCard (webhook and Git event triggers).",
      },
    },
  },
  beforeEach: () => {
    resetRpcMocks();
    mockRpc({
      "models.credentials": [],
      "models.list": [],
      "routines.history": { runs: [], nextCursor: null },
    });
  },
  decorators: [
    (Story) => (
      <div className="w-[520px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const ListHeader: Story = {
  render: () => <RoutineListHeader empty onCreate={() => undefined} />,
};

export const ListHeaderWithRoutines: Story = {
  render: () => <RoutineListHeader empty={false} onCreate={() => undefined} />,
};

/** The status line wraps under the title instead of cutting off next to the Running pill. */
export const RunningNarrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[340px]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <RoutineListRow
      routine={{
        ...routine,
        status: {
          ...routine.status,
          lastRunAt: "2026-01-05T22:04:00.000Z",
          nextRunAt: "2026-01-06T22:04:00.000Z",
        },
      }}
      running
      onOpen={() => undefined}
      onStop={() => undefined}
    />
  ),
};

export const ListRows: Story = {
  render: () => (
    <div>
      <RoutineListRow
        routine={routine}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
      />
      <RoutineListRow
        routine={{ ...routine, id: "r2", name: "Paused weekly review", active: false }}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
      />
      <RoutineListRow
        routine={{ ...routine, id: "r3", name: "Running now" }}
        running
        onOpen={() => undefined}
        onStop={() => undefined}
      />
      <RoutineListRow
        routine={webhookRoutine}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
      />
      <RoutineListRow
        routine={watchRoutine}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
      />
      <RoutineListRow
        routine={{
          ...watchRoutine,
          id: "r6",
          name: "Pricing page, paused",
          active: false,
          status: { ...watchRoutine.status, pausedReason: "errors" },
        }}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
      />
      <RoutineListRow
        routine={{
          ...watchRoutine,
          id: "r7",
          name: "Changes too often",
          active: false,
          status: { ...watchRoutine.status, pausedReason: "noisy" },
        }}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
      />
      <RoutineListRow
        routine={{
          ...routine,
          id: "r_credit",
          name: "Daily digest, out of credit",
          status: { ...routine.status, pausedReason: "credit" },
        }}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
      />
      <RoutineListRow
        routine={{
          ...watchRoutine,
          id: "r8",
          name: "Bank balance",
          watch: {
            kind: "connector",
            connectorId: "mcp",
            resourceId: "server_1",
            toolName: "mcp__bank__get_accounts",
            arguments: {},
            appName: "Bank",
            intervalMinutes: 60,
          },
        }}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
      />
      <RoutineListRow
        routine={checkInRoutine}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
        onToggleActive={() => undefined}
      />
      <RoutineListRow
        routine={{ ...checkInRoutine, id: "r8", active: false, crons: ["0 */4 * * *"] }}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
        onToggleActive={() => undefined}
      />
      <RoutineListRow
        routine={{
          ...routine,
          id: "r5",
          name: "A routine with a very long name that cannot fit on one line of the list",
          modelProvider: "sample",
          modelId: "sample-model-1",
        }}
        running={false}
        onOpen={() => undefined}
        onStop={() => undefined}
      />
    </div>
  ),
};

function Editor({
  editing,
  initial,
  webhook = { path: "/hooks/bot_demo/abc123", secret: null, configured: false },
  messageProviders = ["slack"],
  skills = [],
  taughtSkills = [],
  saving = false,
  running = false,
  error = null,
  onOpenModelSettings,
  onOpenBotSettings,
  onResume,
}: {
  editing: Routine | null;
  initial: ReturnType<typeof emptyRoutineDraft>;
  webhook?: { path: string; secret: string | null; configured: boolean };
  messageProviders?: string[];
  skills?: AgentSkillCatalogEntry[];
  taughtSkills?: { id: string; name: string }[];
  saving?: boolean;
  running?: boolean;
  error?: string | null;
  onOpenModelSettings?: () => void;
  onOpenBotSettings?: () => void;
  onResume?: (routine: Routine) => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <RoutineEditor
      draft={draft}
      onChange={setDraft}
      editing={editing}
      timezone="UTC"
      webhook={webhook}
      githubPath="/hooks/github/bot_demo"
      messageProviders={messageProviders}
      skills={skills}
      taughtSkills={taughtSkills}
      saving={saving}
      running={running}
      error={error}
      onBack={() => undefined}
      onClose={() => undefined}
      onSave={() => undefined}
      onTestRun={() => undefined}
      onDelete={() => undefined}
      onEnsureWebhook={async () => undefined}
      onOpenModelSettings={onOpenModelSettings}
      onOpenBotSettings={onOpenBotSettings}
      onResume={onResume}
    />
  );
}

const skillOptions: AgentSkillCatalogEntry[] = [
  {
    id: "skill_1",
    name: "Weekly cash check",
    description: "Reads balances and flags changes.",
    source: "user",
    readOnly: false,
  },
  {
    id: "skill_2",
    name: "finance-monthly-review",
    description: "Spend, changes, and new or upcoming charges.",
    source: "builtin",
    readOnly: true,
  },
];

/** The bot's skills can be added to the instruction; choosing one inserts its @mention. */
export const WithSkills: Story = {
  render: () => <Editor editing={null} initial={emptyRoutineDraft()} skills={skillOptions} />,
};

/** A failed model request leaves the saved connection id intact and offers a retry. */
export const ModelLoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "models.credentials": () => Promise.reject(new Error("offline")),
      "models.list": mockModelCatalog,
      "routines.history": { runs: [], nextCursor: null },
    }),
  render: () => (
    <Editor
      editing={null}
      initial={{ ...emptyRoutineDraft(), credentialId: "credential_unavailable" }}
    />
  ),
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
  },
};

/** Back asks before dropping a changed draft. */
export const DiscardConfirmation: Story = {
  render: () => <Editor editing={routine} initial={draftFromRoutine(routine)} />,
  play: async () => {
    const name = screen.getByLabelText("Name");
    await userEvent.type(name, " updated");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
  },
};

/** A forced skill shows in the picker and the instruction stays plain. */
export const WithForcedSkill: Story = {
  render: () => (
    <Editor
      editing={null}
      initial={{ ...emptyRoutineDraft(), prompt: "@Weekly cash check Post the note." }}
      skills={skillOptions}
    />
  ),
};

const taughtOptions = [
  { id: "taught_1", name: "Export the weekly report" },
  { id: "taught_2", name: "File sample invoices" },
];

/** The picker lists taught skills in their own group. */
export const WithTaughtSkills: Story = {
  render: () => (
    <Editor
      editing={null}
      initial={emptyRoutineDraft()}
      skills={skillOptions}
      taughtSkills={taughtOptions}
    />
  ),
};

/** A taught skill is stored by reference, so the instruction can stay empty. */
export const RunsTaughtSkill: Story = {
  render: () => (
    <Editor
      editing={null}
      initial={{
        ...emptyRoutineDraft(),
        name: "Export the weekly report",
        taughtSkill: taughtOptions[0] ?? null,
        schedules: [],
      }}
      skills={skillOptions}
      taughtSkills={taughtOptions}
    />
  ),
};

export const NewRoutine: Story = {
  render: () => <Editor editing={null} initial={emptyRoutineDraft()} />,
};

/** With no name typed, the placeholder previews the name the routine will get. */
export const NewRoutineLongInstruction: Story = {
  render: () => (
    <Editor
      editing={null}
      initial={{
        ...emptyRoutineDraft(),
        prompt: "Summarize every unread email from investors and draft replies for my review",
      }}
    />
  ),
};

/** With several connections the routine can run on one; a subscription sign-in says so. */
export const EditingPinnedConnection: Story = {
  beforeEach: () => {
    resetRpcMocks();
    mockRpc({
      "models.credentials": mockModelCredentials,
      "models.list": mockModelCatalog,
      "routines.history": { runs: [], nextCursor: null },
    });
  },
  render: () => {
    const pinned = {
      ...routine,
      modelProvider: "example-sub",
      modelId: "example-pro",
      modelCredentialId: "cred_2",
    };
    return <Editor editing={pinned} initial={draftFromRoutine(pinned)} />;
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Advanced" }));
    await screen.findByLabelText("Connection");
  },
};

export const EditingScheduled: Story = {
  render: () => <Editor editing={routine} initial={draftFromRoutine(routine)} />,
};

export const WithMessageTrigger: Story = {
  render: () => (
    <Editor
      editing={null}
      initial={{ ...emptyRoutineDraft(), name: "Reply in Slack", messageProvider: "slack" }}
    />
  ),
};

export const WithInboundTriggersUnsaved: Story = {
  render: () => (
    <Editor
      editing={null}
      initial={{
        ...emptyRoutineDraft(),
        name: "Inbound",
        webhookEnabled: true,
        githubEnabled: true,
      }}
    />
  ),
};

export const WithInboundKeyRevealed: Story = {
  render: () => (
    <Editor
      editing={webhookRoutine}
      initial={draftFromRoutine(webhookRoutine)}
      webhook={{ path: "/hooks/bot_demo/abc123", secret: "demo-secret-value", configured: true }}
    />
  ),
};

export const RotateInboundKey: Story = {
  render: () => (
    <Editor
      editing={webhookRoutine}
      initial={draftFromRoutine(webhookRoutine)}
      webhook={{ path: "/hooks/bot_demo/abc123", secret: null, configured: true }}
    />
  ),
  play: async ({ canvasElement }) => {
    // The demo routine has both a webhook and a Git trigger; rotate the webhook's key.
    await userEvent.click(within(canvasElement).getAllByRole("button", { name: "Rotate key" })[0]!);
    await screen.findByRole("alertdialog");
  },
};

export const WithInboundSecretHidden: Story = {
  render: () => (
    <Editor
      editing={webhookRoutine}
      initial={draftFromRoutine(webhookRoutine)}
      webhook={{ path: "/hooks/bot_demo/abc123", secret: null, configured: true }}
    />
  ),
};

export const SlackNotEnabled: Story = {
  render: () => <Editor editing={null} initial={emptyRoutineDraft()} messageProviders={[]} />,
};

export const Saving: Story = {
  render: () => <Editor editing={routine} initial={draftFromRoutine(routine)} saving />,
};

export const TestRunning: Story = {
  render: () => <Editor editing={routine} initial={draftFromRoutine(routine)} running />,
};

export const PausedWithError: Story = {
  render: () => (
    <Editor
      editing={routine}
      initial={{ ...draftFromRoutine(routine), active: false }}
      error="Could not save this routine"
    />
  ),
};

/** Choosing "Watch a page" on a new routine adds this card and turns the quiet switch on. */
export const NewWatch: Story = {
  render: () => (
    <Editor
      editing={null}
      initial={{
        ...emptyRoutineDraft(),
        name: "Pricing page",
        quiet: true,
        watch: { kind: "page", url: "", intervalMinutes: 60 },
      }}
    />
  ),
};

export const EditingWatch: Story = {
  render: () => <Editor editing={watchRoutine} initial={draftFromRoutine(watchRoutine)} />,
};

/** A system pause keeps Active on; the reason line under it says why nothing is running. */
export const EditingPausedNoisy: Story = {
  render: () => (
    <Editor editing={pausedWatchRoutine} initial={draftFromRoutine(pausedWatchRoutine)} />
  ),
};

/** A credit hold names the cause and offers the place that fixes it. */
export const EditingPausedCredit: Story = {
  render: () => (
    <Editor
      editing={creditRoutine}
      initial={draftFromRoutine(creditRoutine)}
      onOpenModelSettings={() => undefined}
    />
  ),
};

/** Resume clears the system pause; the reason line is gone once the call returns. */
export const EditingPausedResumed: Story = {
  beforeEach: () =>
    mockRpc({
      "routines.resume": {
        ...pausedWatchRoutine,
        status: { ...pausedWatchRoutine.status, pausedReason: null },
      },
    }),
  render: () => (
    <Editor editing={pausedWatchRoutine} initial={draftFromRoutine(pausedWatchRoutine)} />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Resume" }));
  },
};

export const QuietOff: Story = {
  render: () => <Editor editing={routine} initial={draftFromRoutine(routine)} />,
};

export const WatchRejected: Story = {
  render: () => (
    <Editor
      editing={null}
      initial={{
        ...emptyRoutineDraft(),
        name: "Pricing page",
        prompt: "Tell me what changed.",
        quiet: true,
        watch: { kind: "page", url: "https://example.com/pricing", intervalMinutes: 15 },
      }}
      error="This bot already watches 5 pages."
    />
  ),
};
