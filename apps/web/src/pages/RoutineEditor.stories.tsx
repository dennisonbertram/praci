import type { Routine } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { mockRpc, resetRpc } from "../stories/fixtures-2";
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
    resetRpc();
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
  render: () => <RoutineListHeader onCreate={() => undefined} />,
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
  saving = false,
  running = false,
  error = null,
}: {
  editing: Routine | null;
  initial: ReturnType<typeof emptyRoutineDraft>;
  webhook?: { path: string; secret: string | null; configured: boolean };
  messageProviders?: string[];
  saving?: boolean;
  running?: boolean;
  error?: string | null;
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
      saving={saving}
      running={running}
      error={error}
      onBack={() => undefined}
      onClose={() => undefined}
      onSave={() => undefined}
      onTestRun={() => undefined}
      onDelete={() => undefined}
      onEnsureWebhook={async () => undefined}
    />
  );
}

export const NewRoutine: Story = {
  render: () => <Editor editing={null} initial={emptyRoutineDraft()} />,
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

export const WithInboundTriggersSaved: Story = {
  render: () => (
    <Editor
      editing={webhookRoutine}
      initial={draftFromRoutine(webhookRoutine)}
      webhook={{ path: "/hooks/bot_demo/abc123", secret: "demo-secret-value", configured: true }}
    />
  ),
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
