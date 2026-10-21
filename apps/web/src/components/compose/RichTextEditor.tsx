import { t } from "@lingui/core/macro";
import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { Markdown } from "@tiptap/markdown";
import type { Editor, Extensions } from "@tiptap/react";
import { useEditor, useEditorState } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface EditorContentValue {
  /** Empty when the message has no text. */
  html: string;
  text: string;
  /** Only when the editor was made with `markdown`; empty when the message has no text. */
  markdown?: string;
}

export const MOD_KEY = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? "") ? "⌘" : "Ctrl+";

/** The editor holds basic formatting only; the server keeps just these tags again. */
export function useComposeEditor({
  disabled,
  onChange,
  onLinkShortcut,
  markdown = false,
  extensions = [],
}: {
  disabled: boolean;
  /** Stores and loads markdown (and keeps headings), for text that is kept as markdown. */
  markdown?: boolean;
  /** More tiptap extensions, for example a decoration. */
  extensions?: Extensions;
  onChange: (value: EditorContentValue) => void;
  onLinkShortcut: () => void;
}) {
  // Handlers change every render; the editor is created once.
  const latest = useRef({ onChange, onLinkShortcut });
  latest.current = { onChange, onLinkShortcut };
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: markdown ? undefined : false,
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
        link: { openOnClick: false, defaultProtocol: "https" },
      }),
      ...(markdown ? [Markdown] : []),
      ...extensions,
    ],
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": t`Message`,
        dir: "auto",
        class:
          "min-h-full px-4 py-3 text-sm outline-none [&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-1 [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          // The app's own Cmd/Ctrl+K (command palette) listens higher up.
          event.stopPropagation();
          latest.current.onLinkShortcut();
          return true;
        }
        // Cmd/Ctrl+Enter sends; the editor would otherwise insert a line break.
        return (event.metaKey || event.ctrlKey) && event.key === "Enter";
      },
    },
    onUpdate: ({ editor: current }) =>
      latest.current.onChange({
        html: current.isEmpty ? "" : current.getHTML(),
        text: current.getText({ blockSeparator: "\n" }),
        ...(markdown ? { markdown: current.isEmpty ? "" : current.getMarkdown() } : {}),
      }),
  });
  useEffect(() => {
    // No update event: locking or unlocking the editor is not an edit.
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  return editor;
}

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("pointer-coarse:size-10", active && PRESSED)}
            disabled={disabled}
            aria-label={label}
            aria-pressed={active}
            // Keep the editor's selection: a button press must not take focus from it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{shortcut ? `${label} (${MOD_KEY}${shortcut})` : label}</TooltipContent>
    </Tooltip>
  );
}

export { ToolButton };

/** Pressed state that stays visible in dark mode, where the secondary fill nearly matches the page. */
const PRESSED = "bg-foreground/10 dark:bg-foreground/20";

/** Bold, italic, underline, link, lists and clear formatting. */
export function FormatBar({
  editor,
  disabled,
  linkOpen,
  onLinkOpenChange,
}: {
  editor: Editor | null;
  disabled: boolean;
  linkOpen: boolean;
  onLinkOpenChange: (open: boolean) => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      bullets: current?.isActive("bulletList") ?? false,
      numbers: current?.isActive("orderedList") ?? false,
    }),
  });
  if (!editor) return null;
  const run = () => editor.chain().focus();
  return (
    <div
      role="toolbar"
      aria-label={t`Formatting`}
      className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-t border-border px-2 py-1"
    >
      <ToolButton
        label={t`Bold`}
        shortcut="B"
        active={state?.bold}
        disabled={disabled}
        onClick={() => run().toggleBold().run()}
      >
        <Bold aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label={t`Italic`}
        shortcut="I"
        active={state?.italic}
        disabled={disabled}
        onClick={() => run().toggleItalic().run()}
      >
        <Italic aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label={t`Underline`}
        shortcut="U"
        active={state?.underline}
        disabled={disabled}
        onClick={() => run().toggleUnderline().run()}
      >
        <Underline aria-hidden="true" />
      </ToolButton>
      <LinkButton
        editor={editor}
        open={linkOpen}
        disabled={disabled}
        onOpenChange={onLinkOpenChange}
      />
      <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
      <ToolButton
        label={t`Bulleted list`}
        active={state?.bullets}
        disabled={disabled}
        onClick={() => run().toggleBulletList().run()}
      >
        <List aria-hidden="true" />
      </ToolButton>
      <ToolButton
        label={t`Numbered list`}
        active={state?.numbers}
        disabled={disabled}
        onClick={() => run().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden="true" />
      </ToolButton>
      <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
      <ToolButton
        label={t`Clear formatting`}
        disabled={disabled}
        onClick={() => run().unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormatting aria-hidden="true" />
      </ToolButton>
    </div>
  );
}

/** `name@host` becomes a mailto link, a bare domain gets https. */
export function normalizeHref(input: string): string {
  const value = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)) return `mailto:${value}`;
  return `https://${value}`;
}

/** Adds, edits or removes the link at the selection. Opens from the button or Cmd/Ctrl+K. */
export function LinkButton({
  editor,
  open,
  disabled,
  onOpenChange,
}: {
  editor: Editor | null;
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => current?.isActive("link") ?? false,
  });
  useEffect(() => {
    if (open && editor) setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
  }, [open, editor]);

  const apply = () => {
    if (!editor) return;
    const href = normalizeHref(url);
    if (!url.trim()) return;
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain
        .insertContent({
          type: "text",
          text: url.trim(),
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    } else {
      chain.extendMarkRange("link").setLink({ href }).run();
    }
    onOpenChange(false);
  };
  const remove = () => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={cn("pointer-coarse:size-10", active && PRESSED)}
                  disabled={disabled}
                  aria-label={t`Insert link`}
                  onMouseDown={(event) => event.preventDefault()}
                />
              }
            />
          }
        >
          <LinkIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{`${t`Insert link`} (${MOD_KEY}K)`}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="start" className="w-72 gap-2">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: the popover opens to type a URL
            autoFocus
            type="text"
            inputMode="url"
            aria-label={t`Link address`}
            value={url}
            placeholder="https://"
            autoComplete="off"
            spellCheck={false}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              // Submitting moves focus into the editor mid-keypress, which would add a line break.
              if (event.key === "Enter") {
                event.preventDefault();
                apply();
              }
            }}
          />
          <div className="flex justify-end gap-1.5">
            {active ? (
              <Button type="button" variant="ghost" size="sm" onClick={remove}>
                {t`Remove link`}
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={!url.trim()}>
              {t`Apply`}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
