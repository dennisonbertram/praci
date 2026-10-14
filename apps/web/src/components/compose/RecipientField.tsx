import { t } from "@lingui/core/macro";
import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@rakazo/ui-web";
import { X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { parseRecipient, takeEntries } from "../../lib/recipients";

/** Names the address that was refused, in full, for a tooltip or the blocked-send message. */
export const invalidAddressText = (address: string) => t`${address} isn't a valid email address`;

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
  trailing,
  onChange,
}: {
  label: string;
  entries: string[];
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  /**
   * Shown after the last chip and the input. It comes before the input in the tab order, so Tab
   * from the input moves on to the next field; Shift+Tab reaches these.
   */
  trailing?: React.ReactNode;
  onChange: (entries: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const local = useRef<HTMLInputElement>(null);
  const base = useId();

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
      {entries.map((entry, index) => {
        const recipient = parseRecipient(entry);
        const reason = `${base}-${index}`;
        const chip = (
          <span
            key={entry}
            title={recipient.valid ? recipient.address : undefined}
            className={cn(
              "inline-flex h-6 max-w-full items-center gap-0.5 rounded-full bg-muted ps-2.5 pe-0.5 text-xs pointer-coarse:h-8 dark:bg-foreground/15",
              !recipient.valid && "bg-destructive/10 text-destructive dark:bg-destructive/20",
            )}
          >
            <span className="truncate" dir="auto">
              {recipient.name || recipient.address}
            </span>
            {recipient.valid ? null : (
              <span id={reason} className="sr-only">
                {t`Not a valid email address`}
              </span>
            )}
            <button
              type="button"
              disabled={disabled}
              aria-label={t`Remove ${recipient.address}`}
              aria-describedby={recipient.valid ? undefined : reason}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:size-8"
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
        return recipient.valid ? (
          <span key={entry} className="contents">
            {chip}
          </span>
        ) : (
          <Tooltip key={entry}>
            <TooltipTrigger render={chip} />
            <TooltipContent className="max-w-xs break-all">
              {invalidAddressText(recipient.address)}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {trailing ? <span className="order-last flex shrink-0 items-center">{trailing}</span> : null}
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
        className="h-7 min-w-12 flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
        onChange={(event) => {
          const value = event.target.value;
          // A space after a complete address also finishes it, as in Gmail.
          if (/\s$/.test(value) && parseRecipient(value).valid) commit(value, true);
          else commit(value, false);
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          // One address with no separator is finished too; other text pastes as typed.
          if (!/[,;\n\r]/.test(text) && !parseRecipient(draft + text).valid) return;
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
          } else if ((event.key === "Tab" || event.key === "Escape") && draft.trim()) {
            // Escape closes the composer, which would drop an address still being typed.
            commit(draft, true);
          } else if (event.key === "Backspace" && !draft && entries.length) {
            onChange(entries.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
