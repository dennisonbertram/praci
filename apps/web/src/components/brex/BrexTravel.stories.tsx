import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexTravel } from "./BrexTravel";
import { emptyTripsFixture, tripsFixture } from "./fixtures";

const meta = {
  title: "Brex/Travel",
  component: BrexTravel,
  parameters: { initialEntries: ["/app/brex/travel"] },
  decorators: [
    (Story) => (
      <div className="w-[880px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrexTravel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  beforeEach: () => mockRpc({ "brexCards.trips": tripsFixture }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "brexCards.trips": emptyTripsFixture }),
};
