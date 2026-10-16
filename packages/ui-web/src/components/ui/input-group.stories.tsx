import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "./input-group";

const meta = { title: "UI/Input group", component: InputGroup } satisfies Meta<typeof InputGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton>Go</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

export const WithText: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon>
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput defaultValue="example.com" />
    </InputGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <InputGroup className="w-80" data-disabled="true">
      <InputGroupInput disabled placeholder="Disabled" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton disabled>Go</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

export const Textarea: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupTextarea placeholder="Write a note" />
      <InputGroupAddon align="block-end">
        <InputGroupText>0 / 280</InputGroupText>
        <InputGroupButton className="ml-auto" variant="default">
          Save
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};
