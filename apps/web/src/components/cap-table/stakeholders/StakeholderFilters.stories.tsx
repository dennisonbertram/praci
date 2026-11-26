import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { StakeholderFilters } from "./StakeholderFilters";
import type { StakeholderFilterValue } from "./stakeholder-filter-params";

const inUse = {
  relationshipsInUse: ["investor", "founder", "ex_employee", "employee"],
  costCentersInUse: ["Engineering", "Design"],
  countriesInUse: ["USA", "Portugal"],
};

const meta = {
  title: "Cap table/Stakeholders/Filters",
  component: StakeholderFilters,
  args: { value: {}, onChange: () => undefined, ...inUse },
} satisfies Meta<typeof StakeholderFilters>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Holds the filters and opens the panel (and one group) once, so the story shows what filters look like. */
function Opened({ initial, group }: { initial: StakeholderFilterValue; group?: string }) {
  const [value, setValue] = useState(initial);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    host.current?.querySelector("button")?.click();
    const timer = setTimeout(() => {
      const tab = [...document.querySelectorAll("nav button")].find(
        (button) => button.textContent === group,
      );
      (tab as HTMLElement | undefined)?.click();
    }, 30);
    return () => clearTimeout(timer);
  }, [group]);
  return (
    <div ref={host}>
      <StakeholderFilters value={value} onChange={setValue} {...inUse} />
    </div>
  );
}

export const NoneActive: Story = {
  render: () => <Opened initial={{}} />,
};

export const TwoGroupsActive: Story = {
  render: () => <Opened initial={{ relationship: ["investor", "none"], country: ["USA"] }} />,
};

export const DateCreated: Story = {
  render: () => (
    <Opened initial={{ createdFrom: "2025-01-01", createdTo: "2025-12-31" }} group="Date created" />
  ),
};
