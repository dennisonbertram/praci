import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorContent } from "@tiptap/react";
import { Bold } from "lucide-react";
import { useState } from "react";
import { FormatBar, LinkButton, ToolButton, useComposeEditor } from "./RichTextEditor";

const meta = { title: "Compose/RichTextEditor" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Editor({
  disabled = false,
  initialLinkOpen = false,
}: {
  disabled?: boolean;
  initialLinkOpen?: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(initialLinkOpen);
  const editor = useComposeEditor({
    disabled,
    onChange: () => undefined,
    onLinkShortcut: () => setLinkOpen(true),
  });
  return (
    <div className="w-[520px] max-w-full rounded-xl border border-border">
      <div className="min-h-24">
        <EditorContent editor={editor} />
      </div>
      <FormatBar
        editor={editor}
        disabled={disabled}
        linkOpen={linkOpen}
        onLinkOpenChange={setLinkOpen}
      />
    </div>
  );
}

export const WithFormatBar: Story = { render: () => <Editor /> };
export const Disabled: Story = { render: () => <Editor disabled /> };
export const LinkPopover: Story = { render: () => <Editor initialLinkOpen /> };

export const ToolButtons: Story = {
  render: () => (
    <div className="flex gap-1">
      <ToolButton label="Bold" shortcut="B" onClick={() => undefined}>
        <Bold aria-hidden="true" />
      </ToolButton>
      <ToolButton label="Bold" shortcut="B" active onClick={() => undefined}>
        <Bold aria-hidden="true" />
      </ToolButton>
      <ToolButton label="Bold" disabled onClick={() => undefined}>
        <Bold aria-hidden="true" />
      </ToolButton>
    </div>
  ),
};

export const LinkButtonWithoutEditor: Story = {
  render: () => (
    <LinkButton editor={null} open={false} disabled={false} onOpenChange={() => undefined} />
  ),
};
