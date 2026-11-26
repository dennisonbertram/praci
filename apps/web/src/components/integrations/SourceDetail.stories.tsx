import type { CapabilityInstall } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Navigate, Route, Routes } from "react-router-dom";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { makeBot, mockIntegrations } from "../../stories/fixtures";
import { SourceDetail } from "./SourceDetail";

const agent = makeBot({
  id: "bot_contacts",
  name: "Contacts API agent",
  spawnKey: "integration-agent:src_1",
});
const source = (patch: Partial<CapabilityInstall> = {}): CapabilityInstall => ({
  id: "src_1",
  kind: "api",
  name: "Contacts API",
  source: "https://api.example.test/v1",
  version: "1.0.0",
  digest: null,
  secretConfigured: false,
  config: {
    operations: [
      { id: "list_contacts", method: "GET", path: "/contacts", readOnly: true },
      { id: "add_contact", method: "POST", path: "/contacts" },
    ],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  agentBotId: agent.id,
  allAgents: false,
  agentShared: false,
  writesEnabled: false,
  usableBotIds: [agent.id],
  writeBotIds: [],
  ...patch,
});

const meta = {
  title: "Integrations/SourceDetail",
  component: SourceDetail,
  parameters: { layout: "fullscreen", entry: "/app/integrations/source/src_1" },
  beforeEach: () => mockRpc({ "capabilities.setAgentAccess": null }),
  // SourceDetail reads :sourceId from the route, so mount it at its real path.
  render: (args, { parameters }) => (
    <Routes>
      <Route path="/app/integrations/source/:sourceId" element={<SourceDetail {...args} />} />
      <Route path="*" element={<Navigate to={parameters.entry ?? "/"} replace />} />
    </Routes>
  ),
} satisfies Meta<typeof SourceDetail>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A new source: private to its own agent, changes off. */
export const Private: Story = {
  args: { data: mockIntegrations({ sources: [source()], bots: [agent] }) },
};

/** Shared with chosen agents; one of them may also make changes. */
export const SharedWithSome: Story = {
  args: {
    data: mockIntegrations({
      sources: [
        source({
          agentShared: true,
          writesEnabled: true,
          usableBotIds: [agent.id, "bot_ada"],
          writeBotIds: ["bot_ada"],
        }),
      ],
      bots: [agent, makeBot({ id: "bot_ada", name: "Ada" }), makeBot({ id: "bot_bo", name: "Bo" })],
    }),
  },
};

/** The agent could not be made at install: Create agent repairs it. */
export const NoAgent: Story = {
  args: {
    data: mockIntegrations({
      sources: [source({ agentBotId: null, usableBotIds: [] })],
      bots: [],
    }),
  },
};
