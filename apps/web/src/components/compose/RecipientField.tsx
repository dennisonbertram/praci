import { t } from "@lingui/core/macro";
import { cn } from "@rakazo/ui-web";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { parseRecipient, takeEntries } from "../../lib/recipients";

/**
 * Addresses as chips. A comma, semicolon or Enter, Tab or leaving the field finishes the address
 * being typed; pasting a list finishes every address in it. Backspace in the empty input removes
 * the last chip. An address that is not valid stays as a red chip so it can be fixed or removed.
 */
export function RecipientField({
  label,
  entries,
  disabled,
  inputRef,
  onChange,
}: {
  label: string;
  entries: string[];
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (entries: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const local = useRef<HTMLInputElement>(null);

  const commit = (text: string, final: boolean) => {
    const { added, rest } = takeEntries(text, entries, final);
    if (added.length) onChange([...entries, ...added]);
    setDraft(rest);
    return added.length > 0 || rest !== text;
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click only moves focus to the real input
    // biome-ignore lint/a11y/noStaticElementInteractions: the click only moves focus to the real input
    <div
      className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
      onClick={() => local.current?.focus()}
    >
      {entries.map((entry) => {
        const recipient = parseRecipient(entry);
        return (
          <span
            key={entry}
            title={recipient.address}
            className={cn(
              "inline-flex h-6 max-w-full items-center gap-0.5 rounded-full bg-muted ps-2.5 pe-0.5 text-xs",
              !recipient.valid && "bg-destructive/10 text-destructive",
            )}
          >
            <span className="truncate" dir="auto">
              {recipient.name || recipient.address}
            </span>
            <button
              type="button"
              disabled={disabled}
              aria-label={t`Remove ${recipient.address}`}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={(event) => {
                event.stopPropagation();
                onChange(entries.filter((other) => other !== entry));
                local.current?.focus();
              }}
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </span>
        );
      })}
      <input
        ref={(node) => {
          local.current = node;
          if (typeof inputRef === "function") inputRef(node);
          else if (inputRef) inputRef.current = node;
        }}
        aria-label={label}
        value={draft}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="email"
        maxLength={1_000}
        className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
        onChange={(event) => {
          const value = event.target.value;
          // A space after a complete address also finishes it, as in Gmail.
          if (/\s$/.test(value) && parseRecipient(value).valid) commit(value, true);
          else commit(value, false);
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          if (!/[,;\n\r]/.test(text)) return;
          event.preventDefault();
          commit(draft + text, true);
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft, true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // With Cmd or Ctrl this is Send: finish the address, then let the dialog see the key.
            if (!event.metaKey && !event.ctrlKey) event.preventDefault();
            commit(draft, true);
          } else if (event.key === "Tab" && draft.trim()) {
            commit(draft, true);
          } else if (event.key === "Backspace" && !draft && entries.length) {
            onChange(entries.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
