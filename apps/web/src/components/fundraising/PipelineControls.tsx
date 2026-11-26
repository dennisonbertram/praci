import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, PipelineInterest, PipelineStatus } from "@rakazo/contracts";
import {
  Badge,
  Button,
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  ContactAvatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Toggle,
} from "@rakazo/ui-web";
import { Check, ChevronDown, CircleQuestionMark, Minus, Plus, X } from "lucide-react";
import type { FocusEvent, FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { todayDay } from "../../lib/day-input";
import { shortDay } from "../../lib/finance-format";
import type { NextCallValue, PipelineRow } from "../../lib/pipeline-rows";
import { callDay, daysFrom } from "../../lib/pipeline-rows";

export const statusNames = (): Record<PipelineStatus, string> => ({
  not_reached: t`Not reached`,
  reached_out: t`Reached out`,
  intro_requested: t`Intro requested`,
  intro_made: t`Intro made`,
  meeting_booked: t`Meeting booked`,
  met: t`Met`,
  diligence: t`Diligence`,
  committed: t`Committed`,
  passed: t`Passed`,
});

export const interestNames = (): Record<PipelineInterest, string> => ({
  in: t`In`,
  maybe: t`Maybe`,
  out: t`Out`,
});

const locale = () => i18n.locale || "en";

/** A short day such as "Nov 4", from a YYYY-MM-DD day. */
export const dayLabel = (day: string) => shortDay(day, new Date(), locale());

/** "Today, 3:30 PM", "Nov 6", from a row's next call. */
export function callLabel(row: PipelineRow): string | null {
  const day = callDay(row);
  if (!day || !row.nextCallAt) return null;
  const date = daysFrom(day, todayDay()) === 0 ? t`Today` : dayLabel(day);
  if (!row.nextCallHasTime) return date;
  const time = new Date(row.nextCallAt).toLocaleTimeString(locale(), {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

export const isOverdue = (row: PipelineRow) => {
  const day = callDay(row);
  return Boolean(day && daysFrom(day, todayDay()) < 0);
};

/** One blank-cell rule: an unset value is a muted dash. */
export const Dash = () => <span className="text-muted-foreground">—</span>;

/** The dash that turns into its action word on row hover, focus and touch. */
export const BlankAction = ({ children }: { children: ReactNode }) => (
  <>
    <span className="group-focus-within/row:hidden group-hover/row:hidden pointer-coarse:hidden">
      <Dash />
    </span>
    <span className="hidden text-muted-foreground group-focus-within/row:inline group-hover/row:inline pointer-coarse:inline">
      {children}
    </span>
  </>
);

export function StatusPick({
  row,
  onChange,
}: {
  row: PipelineRow;
  onChange: (status: PipelineStatus) => void;
}) {
  const names = statusNames();
  const name = names[row.status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t`Status of ${row.name}: ${name}`}
            className="inline-flex max-w-full rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:items-center"
          />
        }
      >
        <Badge variant={row.status === "not_reached" ? "outline" : "secondary"}>
          {name}
          <ChevronDown aria-hidden="true" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-max min-w-40">
        <DropdownMenuRadioGroup
          value={row.status}
          onValueChange={(next) => onChange(String(next) as PipelineStatus)}
        >
          {(Object.keys(names) as PipelineStatus[]).map((id) => (
            <DropdownMenuRadioItem key={id} value={id} closeOnClick>
              {names[id]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const INTEREST_ICON = { in: Check, maybe: Minus, out: X } as const;
/** "unknown" is not a PipelineInterest: it is the name the picker gives a null interest. */
type InterestId = PipelineInterest | "unknown";
const INTEREST_IDS: InterestId[] = ["unknown", "in", "maybe", "out"];
const interestChoiceNames = (): Record<InterestId, string> => ({
  unknown: t`Unknown`,
  ...interestNames(),
});
/** No solid fill: a mark and a border. In and Out differ by colour and glyph, not only the word. */
const INTEREST_ON: Record<InterestId, string> = {
  unknown: "z-10 border-muted-foreground font-medium text-muted-foreground",
  in: "z-10 border-success font-semibold text-success",
  maybe: "z-10 border-foreground font-semibold",
  out: "z-10 border-muted-foreground bg-muted font-medium text-muted-foreground",
};

/**
 * Unknown, In, Maybe and Out as four toggles, each a tab stop. Unknown means no stance and saves
 * null; pressing the one that is on clears to null, which reads as Unknown. A row nobody has
 * contacted yet (not_reached) shows no interest control at all.
 */
export function InterestChoice({
  row,
  onChange,
  wide = false,
}: {
  row: PipelineRow;
  onChange: (value: PipelineInterest | null) => void;
  wide?: boolean;
}) {
  const names = interestChoiceNames();
  if (row.status === "not_reached") return null;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would add a legend and a border for four toggles.
    <div
      role="group"
      aria-label={t`Interest: ${row.name}`}
      className={wide ? "flex" : "inline-flex"}
    >
      {INTEREST_IDS.map((id) => {
        const on = id === "unknown" ? row.interest === null : row.interest === id;
        const Icon = id === "unknown" ? CircleQuestionMark : INTEREST_ICON[id];
        return (
          <Toggle
            key={id}
            size="sm"
            variant="outline"
            pressed={on}
            onPressedChange={(pressed) => onChange(pressed && id !== "unknown" ? id : null)}
            style={wide ? undefined : { minWidth: 30 + names[id].length * 7 }}
            className={`relative gap-0.5 rounded-none text-xs not-first:-ms-px first:rounded-s-md last:rounded-e-md focus-visible:z-20 aria-pressed:bg-transparent ${wide ? "h-11 flex-1" : "h-6 px-1"} ${on ? INTEREST_ON[id] : ""}`}
          >
            {on ? <Icon aria-hidden="true" className="size-3" /> : null}
            {names[id]}
          </Toggle>
        );
      })}
    </div>
  );
}

/** The same choice as a pill where a phone row has no room for four toggles. */
export function InterestPick({
  row,
  onChange,
}: {
  row: PipelineRow;
  onChange: (value: PipelineInterest | null) => void;
}) {
  const names = interestChoiceNames();
  const name = names[row.interest ?? "unknown"];
  const Icon = row.interest ? INTEREST_ICON[row.interest] : null;
  if (row.status === "not_reached") return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t`Interest of ${row.name}: ${name}`}
            className="inline-flex shrink-0 items-center rounded-full pointer-coarse:min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Badge variant={row.interest ? "secondary" : "outline"}>
          {Icon ? <Icon aria-hidden="true" /> : null}
          {name}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max min-w-32">
        <DropdownMenuRadioGroup
          value={row.interest ?? "unknown"}
          onValueChange={(next) => onChange(next === "unknown" ? null : (next as PipelineInterest))}
        >
          {INTEREST_IDS.map((id) => (
            <DropdownMenuRadioItem key={id} value={id} closeOnClick>
              {names[id]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Matches first; Create only when no contact matches, so Enter cannot make a duplicate. */
export function ReferredByPicker({
  row,
  contacts,
  trigger,
  onPick,
  onCreate,
}: {
  row: PipelineRow;
  contacts: readonly Contact[];
  trigger: ReactNode;
  onPick: (contactId: string | null) => void;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const typed = query.trim().toLowerCase();
  const matches = contacts
    .filter((contact) => contact.name.toLowerCase().includes(typed))
    .slice(0, 8);
  const done = (act: () => void) => {
    act();
    setOpen(false);
    setQuery("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        render={
          <button
            type="button"
            aria-label={t`Add who referred ${row.name}`}
            className="block max-w-full truncate rounded-sm text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t`Search contacts`}
            value={query}
            onValueChange={setQuery}
            aria-label={t`Search contacts`}
          />
          <CommandList>
            <CommandGroup>
              {row.referredBy && !typed ? (
                <CommandItem value="nobody" onSelect={() => done(() => onPick(null))}>
                  <Trans>Nobody</Trans>
                </CommandItem>
              ) : null}
              {matches.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={contact.id}
                  onSelect={() => done(() => onPick(contact.id))}
                >
                  <ContactAvatar name={contact.name} size="sm" />
                  {contact.name}
                </CommandItem>
              ))}
              {typed && matches.length === 0 ? (
                <CommandItem value={query} onSelect={() => done(() => onCreate(query.trim()))}>
                  <Plus aria-hidden="true" />
                  {t`Create “${query.trim()}”`}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type NextCallDraft = { day: string; time: string };
const EMPTY_DRAFT: NextCallDraft = { day: "", time: "" };
const nextCallDraft = (row: PipelineRow): NextCallDraft => ({
  day: callDay(row) ?? "",
  time:
    row.nextCallHasTime && row.nextCallAt
      ? new Date(row.nextCallAt).toTimeString().slice(0, 5)
      : "",
});
export const nextCallValue = (draft: NextCallDraft): NextCallValue =>
  draft.day ? { day: draft.day, time: draft.time || null } : null;
/** What a draft saves as, for telling a save from a no-op. */
const nextCallKey = (next: NextCallValue) => (next ? `${next.day}|${next.time ?? ""}` : "");
/** Changes whenever the row's next call does, so a reload re-seeds the draft. */
export const nextCallRowKey = (row: PipelineRow) => `${nextCallKey(nextCallDraft(row))}`;

/**
 * The draft an editor holds and the value it last saved. Leaving and closing can both save, so the
 * second is a no-op; a failed save stays unsaved, so leaving again tries that value again.
 */
export function useNextCallSave(row: PipelineRow, onSave: (next: NextCallValue) => unknown) {
  const draft = useRef<NextCallDraft>(nextCallDraft(row));
  const sent = useRef(nextCallKey(nextCallValue(nextCallDraft(row))));
  const save = async (next: NextCallValue) => {
    const key = nextCallKey(next);
    if (key === sent.current) return;
    try {
      await onSave(next);
      sent.current = key;
    } catch {
      // The page already said it could not save; the draft keeps the value for another try.
    }
  };
  return { draft, save };
}

/**
 * The next call's date and optional time as one draft: a change saves when the pair is left, so a
 * date and a time are one write. The time waits for a day. Mount a new one (a key on the row's
 * value) when the row's next call changes, so the fields never show a value the row no longer has.
 */
export function NextCallFields({
  row,
  idPrefix,
  onSave,
  inputClassName,
  draftRef,
  seed,
}: {
  row: PipelineRow;
  idPrefix: string;
  onSave: (next: NextCallValue) => void;
  inputClassName?: string;
  /** Lets a wrapper read the draft when it closes, so closing saves what typing left unsaved. */
  draftRef?: { current: NextCallDraft };
  /** What this mount starts from instead of the row, for a Clear that is still being saved. */
  seed?: NextCallDraft;
}) {
  const [draft, setDraft] = useState<NextCallDraft>(() => {
    const first = seed ?? nextCallDraft(row);
    if (draftRef) draftRef.current = first;
    return first;
  });
  const date = useRef<HTMLInputElement>(null);
  const time = useRef<HTMLInputElement>(null);
  const update = (next: NextCallDraft) => {
    setDraft(next);
    if (draftRef) draftRef.current = next;
  };
  // Moving between the two inputs stays inside the pair; leaving either saves both once.
  const leave = (event: FocusEvent<HTMLInputElement>) => {
    if (event.relatedTarget === date.current || event.relatedTarget === time.current) return;
    onSave(nextCallValue(draft));
  };

  return (
    <div className="grid grid-cols-[1fr_8rem] gap-2">
      <div className="grid min-w-0 gap-1.5">
        <Label htmlFor={`${idPrefix}-date`}>
          <Trans>Next call</Trans>
        </Label>
        <Input
          ref={date}
          id={`${idPrefix}-date`}
          type="date"
          className={inputClassName}
          value={draft.day}
          onChange={(event) => update({ ...draft, day: event.target.value })}
          onBlur={leave}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-time`}>
          <Trans>Time</Trans>
        </Label>
        <Input
          ref={time}
          id={`${idPrefix}-time`}
          type="time"
          className={inputClassName}
          value={draft.time}
          disabled={!draft.day}
          onChange={(event) => update({ ...draft, time: event.target.value })}
          onBlur={leave}
        />
      </div>
    </div>
  );
}

/** Date and optional time of the next call. A change saves when the editor is left; Clear removes it. */
export function NextCallEditor({
  row,
  onSave,
  children,
}: {
  row: PipelineRow;
  onSave: (next: NextCallValue) => unknown;
  children: ReactNode;
}) {
  const { draft, save } = useNextCallSave(row, onSave);
  const [cleared, setCleared] = useState(0);
  // Only the mount Clear creates starts empty; a later reload of the row seeds from the row again.
  const seed = useRef<NextCallDraft | undefined>(undefined);
  useEffect(() => {
    seed.current = undefined;
  }, [cleared]);
  const day = callDay(row);
  return (
    <Popover onOpenChange={(open) => open || void save(nextCallValue(draft.current))}>
      <PopoverTrigger
        nativeButton
        render={
          <button
            type="button"
            aria-label={t`Next call with ${row.name}`}
            className={`block max-w-full truncate rounded-sm text-start outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring ${isOverdue(row) ? "text-destructive" : ""}`}
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <NextCallFields
          key={`${nextCallRowKey(row)}|${cleared}`}
          row={row}
          idPrefix={row.id}
          seed={seed.current}
          onSave={(next) => void save(next)}
          draftRef={draft}
        />
        <div className="mt-1 flex items-center justify-start">
          <Button
            variant="ghost"
            size="sm"
            disabled={!day}
            onClick={() => {
              // Clear empties the fields themselves, not just the draft the editor reads.
              seed.current = EMPTY_DRAFT;
              setCleared((count) => count + 1);
              void save(null);
            }}
          >
            <Trans>Clear</Trans>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A one-line value edited in a small popover: Enter or Save writes it, an empty value clears it. */
export function ValueEditor({
  label,
  value,
  inputMode,
  onSave,
  children,
}: {
  label: string;
  value: string;
  inputMode?: "text" | "decimal";
  onSave: (text: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(text);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setText(value);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        nativeButton
        render={
          <button
            type="button"
            aria-label={label}
            className="block max-w-full truncate rounded-sm text-start outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form className="flex gap-2" onSubmit={submit}>
          <Input
            aria-label={label}
            inputMode={inputMode}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button type="submit" size="sm">
            <Trans>Save</Trans>
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
