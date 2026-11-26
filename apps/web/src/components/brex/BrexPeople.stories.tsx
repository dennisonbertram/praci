import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexPeople } from "./BrexPeople";
import { peopleFixture } from "./fixtures";

const meta = {
  title: "Brex/People",
  component: BrexPeople,
  parameters: { initialEntries: ["/app/brex/people"] },
} satisfies Meta<typeof BrexPeople>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () => mockRpc({ "brexCards.people": peopleFixture }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "brexCards.people": { ...peopleFixture, people: [] } }),
};

export const Partial: Story = {
  beforeEach: () => mockRpc({ "brexCards.people": { ...peopleFixture, partial: true } }),
};

export const ChangesOff: Story = {
  beforeEach: () => mockRpc({ "brexCards.people": { ...peopleFixture, writesEnabled: false } }),
};
