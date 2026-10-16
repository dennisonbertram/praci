import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "./field";
import { Input } from "./input";

const meta = { title: "UI/Field", component: Field } satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <FieldSet>
        <FieldLegend>Profile</FieldLegend>
        <FieldDescription>Shown to other people in your space.</FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="f-name">Name</FieldLabel>
            <Input id="f-name" defaultValue="Sam Example" />
          </Field>
          <FieldSeparator>or</FieldSeparator>
          <Field>
            <FieldLabel htmlFor="f-email">Email</FieldLabel>
            <Input id="f-email" defaultValue="sam@example.com" />
            <FieldDescription>We never share this.</FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="w-80">
      <Field data-invalid>
        <FieldLabel htmlFor="f-err">Email</FieldLabel>
        <Input id="f-err" defaultValue="not-an-email" aria-invalid />
        <FieldError errors={[{ message: "Enter a valid email." }]} />
      </Field>
    </div>
  ),
};

export const WithSeveralErrors: Story = {
  render: () => (
    <div className="w-80">
      <FieldError errors={[{ message: "Too short." }, { message: "Needs a number." }]} />
    </div>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <div className="w-96">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>Notifications</FieldTitle>
          <FieldDescription>Email me when a bot finishes a run.</FieldDescription>
        </FieldContent>
        <Input className="w-24" defaultValue="Daily" />
      </Field>
    </div>
  ),
};
