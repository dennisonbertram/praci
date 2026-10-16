import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta = {
  title: "UI/Select",
  component: Select,
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton",
      },
    },
  },
} satisfies Meta<typeof Select>;
export default meta;

type Story = StoryObj<typeof meta>;

const fruit = { apple: "Apple", banana: "Banana", cherry: "Cherry" };

export const Default: Story = {
  render: () => (
    <Select defaultValue="apple" items={fruit}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Open: Story = {
  render: () => (
    <div className="h-64">
      <Select defaultOpen defaultValue="banana" items={fruit}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectLabel>Fruit</SelectLabel>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>More</SelectLabel>
            <SelectItem value="cherry">Cherry</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <Select defaultValue="apple" items={fruit}>
      <SelectTrigger size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Placeholder: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Pick a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled defaultValue="apple" items={fruit}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-48" aria-invalid>
        <SelectValue placeholder="Required" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
      </SelectContent>
    </Select>
  ),
};

const many = Array.from({ length: 40 }, (_, i) => `Option ${i + 1}`);

export const LongList: Story = {
  render: () => (
    <div className="h-80">
      <Select defaultOpen defaultValue="Option 1">
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="max-h-48">
          {many.map((label) => (
            <SelectItem key={label} value={label}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};
