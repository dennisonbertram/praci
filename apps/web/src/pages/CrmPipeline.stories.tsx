// Mockup for docs/crm-pipeline/PLAN.md. Nothing in the app uses this yet. Every firm, person, address,
// date and amount is invented. `TableCopy` is story-only: it lets the GTM example reuse the table.
// The plan builds Fundraising with plain strings and adds a config only when GTM is real.
import type { Safe } from "@rakazo/contracts";
import {
  Badge,
  Button,
  Checkbox,
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  ContactAvatar,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  enqueueNotificationToast,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetTitle,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  Toggle,
} from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Columns3,
  ExternalLink,
  FileText,
  ListChecks,
  ListFilter,
  Mail,
  Minus,
  MoreHorizontal,
  Phone,
  Plus,
  Send,
  Tag,
  Users,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { AppToaster } from "../components/AppToaster";
import { AskBotButton } from "../components/AskBotButton";
import { SeeAll, useCappedRows } from "../components/CappedList";
import { RoundCard } from "../components/fundraising/RoundCard";
import { AttentionStrip, SafeList } from "../components/fundraising/SafeList";
import { SearchField, usePhone } from "../components/ListControls";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { usdFigure } from "../lib/finance-format";
import { sortBy, useListParams } from "../lib/list-params";
import { meetingSourceName } from "../lib/meeting-source";
import type { Interest, Outcome, PipelineRow } from "./crm-pipeline-fixtures";
import {
  fundraisingRows,
  GTM_STATUSES,
  gtmRows,
  REFERRERS,
  STATUSES,
  TODAY,
} from "./crm-pipeline-fixtures";

const noop = () => {};
const usd = (cents: number | null) => (cents == null ? null : usdFigure(cents / 100, 0, "en"));
const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const weekday = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
const daysFromToday = (iso: string) =>
  Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`)) / 86_400_000);
const plusDays = (days: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** One blank-cell rule: an unset value is a muted dash. */
const Dash = () => <span className="text-muted-foreground">—</span>;

type TableCopy = {
  noun: string;
  search: string;
  add: string;
  interest: string;
  setInterest: string;
  interestOptions: [Interest, string][];
  interestWidth: string;
  amount: string;
  details: string;
  groupLabel: string;
  groupParam: string;
  groupOptions: [string, string][];
  statuses: readonly (readonly [string, string])[];
  /** Fundraising only: Out moves to Passed. GTM's Fit is the founder's view and moves nothing. */
  interestMovesStatus: boolean;
  passedStatus: string;
  rows: PipelineRow[];
};

const FUNDRAISING: TableCopy = {
  noun: "Prospect",
  search: "Search prospects",
  add: "Add prospect",
  interest: "Interest",
  setInterest: "Set interest",
  interestOptions: [
    ["in", "In"],
    ["maybe", "Maybe"],
    ["out", "Out"],
  ],
  interestWidth: "w-44",
  amount: "Possible amount",
  details: "Fund details",
  groupLabel: "Wave",
  groupParam: "wave",
  groupOptions: [
    ["1", "Wave 1"],
    ["2", "Wave 2"],
    ["3", "Wave 3"],
  ],
  statuses: STATUSES,
  interestMovesStatus: true,
  passedStatus: "passed",
  rows: fundraisingRows,
};

const GTM: TableCopy = {
  noun: "Lead",
  search: "Search leads",
  add: "Add lead",
  interest: "Fit",
  setInterest: "Set fit",
  interestOptions: [
    ["in", "Good fit"],
    ["maybe", "Maybe"],
    ["out", "No fit"],
  ],
  interestWidth: "w-60",
  amount: "Deal value",
  details: "Company details",
  groupLabel: "Source",
  groupParam: "source",
  groupOptions: [
    ["inbound", "Inbound"],
    ["outbound", "Outbound"],
    ["referral", "Referral"],
  ],
  statuses: GTM_STATUSES,
  interestMovesStatus: false,
  passedStatus: "lost",
  rows: gtmRows,
};

const statusName = (copy: TableCopy, status: string) =>
  copy.statuses.find(([id]) => id === status)?.[1] ?? status;

const SORTS = [
  "name",
  "status",
  "interest",
  "lastCall",
  "nextStep",
  "nextCall",
  "referredBy",
  "amount",
  "details",
] as const;
type SortField = (typeof SORTS)[number];
type OptionalColumn = "referredBy" | "amount" | "details";
const COLUMNS_KEY = "rakazo:crm-pipeline-columns";

function readColumns(): OptionalColumn[] {
  try {
    return JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeColumns(columns: OptionalColumn[]) {
  try {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
  } catch {
    // Private mode: the choice lasts for this page only.
  }
}

function StatusPick({
  copy,
  row,
  value,
  onChange,
}: {
  copy: TableCopy;
  row: PipelineRow;
  value: string;
  onChange: (status: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Status of ${row.name}: ${statusName(copy, value)}`}
            className="inline-flex max-w-full rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:items-center"
          />
        }
      >
        <Badge variant={value === copy.statuses[0]?.[0] ? "outline" : "secondary"}>
          {statusName(copy, value)}
          <ChevronDown aria-hidden="true" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-max min-w-40">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(String(next))}>
          {copy.statuses.map(([id, name]) => (
            <DropdownMenuRadioItem key={id} value={id} closeOnClick>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const INTEREST_ICON = { in: Check, maybe: Minus, out: X } as const;
/** No solid fill: a mark and a border. In and Out differ by colour and glyph, not only the word. */
const INTEREST_ON: Record<Interest, string> = {
  in: "z-10 border-success font-semibold text-success",
  maybe: "z-10 border-foreground font-semibold",
  out: "z-10 border-muted-foreground bg-muted font-medium text-muted-foreground",
};

function InterestChoice({
  copy,
  row,
  value,
  onChange,
  wide = false,
}: {
  copy: TableCopy;
  row: PipelineRow;
  value: Interest | null;
  onChange: (value: Interest | null) => void;
  wide?: boolean;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would add a legend and a border for three toggles.
    <div
      role="group"
      aria-label={`${copy.interest}: ${row.name}`}
      className={wide ? "flex" : "inline-flex"}
    >
      {copy.interestOptions.map(([id, name]) => {
        const on = value === id;
        const Icon = INTEREST_ICON[id];
        return (
          <Toggle
            key={id}
            size="sm"
            variant="outline"
            pressed={on}
            onPressedChange={(pressed) => onChange(pressed ? id : null)}
            style={wide ? undefined : { minWidth: 30 + name.length * 7 }}
            className={`relative gap-0.5 rounded-none text-xs not-first:-ms-px first:rounded-s-md last:rounded-e-md focus-visible:z-20 aria-pressed:bg-transparent ${wide ? "h-11 flex-1" : "h-6 px-1"} ${on ? INTEREST_ON[id] : ""}`}
          >
            {on ? <Icon aria-hidden="true" className="size-3" /> : null}
            {name}
          </Toggle>
        );
      })}
    </div>
  );
}

/** The same choice where a phone row has no room for three toggles. */
function InterestPick({
  copy,
  row,
  value,
  onChange,
}: {
  copy: TableCopy;
  row: PipelineRow;
  value: Interest | null;
  onChange: (value: Interest | null) => void;
}) {
  const name = copy.interestOptions.find(([id]) => id === value)?.[1];
  const Icon = value ? INTEREST_ICON[value] : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`${copy.interest} of ${row.name}: ${name ?? "Not set"}`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Badge variant={value ? "secondary" : "outline"}>
          {Icon ? <Icon aria-hidden="true" /> : null}
          {name ?? copy.setInterest}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max min-w-32">
        <DropdownMenuRadioGroup
          value={value ?? ""}
          onValueChange={(next) => onChange((String(next) || null) as Interest | null)}
        >
          {copy.interestOptions.map(([id, option]) => (
            <DropdownMenuRadioItem key={id} value={id} closeOnClick>
              {option}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Matches first; Create only when no contact matches. The same picker everywhere. */
function ReferredByPicker({ name, trigger }: { name: string; trigger: ReactNode }) {
  const [query, setQuery] = useState("");
  const typed = query.trim().toLowerCase();
  const matches = REFERRERS.filter((contact) => contact.name.toLowerCase().includes(typed));
  return (
    <Popover>
      <PopoverTrigger
        nativeButton
        render={
          <button
            type="button"
            aria-label={`Add who referred ${name}`}
            className="rounded-sm text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search contacts"
            value={query}
            onValueChange={setQuery}
            aria-label="Search contacts"
          />
          <CommandList>
            <CommandGroup>
              {matches.map((contact) => (
                <CommandItem key={contact.id} value={contact.name}>
                  <ContactAvatar name={contact.name} size="sm" />
                  {contact.name}
                </CommandItem>
              ))}
              {typed && matches.length === 0 ? (
                <CommandItem value={query}>
                  <Plus aria-hidden="true" />
                  Create “{query.trim()}”
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function callLabel(row: PipelineRow) {
  if (!row.nextCall) return null;
  const today = daysFromToday(row.nextCall) === 0;
  const date = today ? "Today" : day(row.nextCall);
  return `${date}${row.nextCallTime ? `, ${row.nextCallTime}` : ""}`;
}
const isOverdue = (row: PipelineRow) => Boolean(row.nextCall && daysFromToday(row.nextCall) < 0);

function NextCallEditor({
  row,
  onInvite,
  children,
}: {
  row: PipelineRow;
  onInvite: () => void;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        nativeButton
        render={
          <button
            type="button"
            aria-label={`Next call with ${row.name}`}
            className={`block max-w-full truncate rounded-sm text-start outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring ${isOverdue(row) ? "text-destructive" : ""}`}
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="grid grid-cols-[1fr_8rem] gap-2">
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor={`date-${row.id}`}>Next call</Label>
            <Input id={`date-${row.id}`} type="date" defaultValue={row.nextCall ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`time-${row.id}`}>Time</Label>
            <Input id={`time-${row.id}`} type="time" defaultValue={row.nextCallTime ?? ""} />
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <Button variant="ghost" size="sm">
            Clear
          </Button>
          <Button variant="outline" size="sm" disabled={!row.nextCall} onClick={onInvite}>
            <CalendarPlus aria-hidden="true" />
            Send invite
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type LogResult = { outcome: Outcome; note: string; next: string | null | "keep" };

/** The one entry point after a call. Scenario "left a message, try again Thursday": Log, Left message, Thu, Save. */
function LogCallBody({
  row,
  onSave,
  onCancel,
}: {
  row: PipelineRow;
  onSave: (result: LogResult) => void;
  onCancel?: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [next, setNext] = useState<string | null | "keep">(row.nextCall ? "keep" : null);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");
  const CHOICES: [string, string][] = [
    [plusDays(1), weekday(plusDays(1))],
    [plusDays(2), weekday(plusDays(2))],
    [plusDays(5), weekday(plusDays(5))],
    [plusDays(7), "Next week"],
  ];
  const chip = (selected: boolean) =>
    selected ? "border-foreground font-semibold" : "text-muted-foreground";
  return (
    <div className="grid gap-3">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Outcome</legend>
        <div className="flex gap-1.5">
          {(["Spoke", "Left message", "No answer"] as const).map((option) => (
            <Toggle
              key={option}
              variant="outline"
              pressed={outcome === option}
              onPressedChange={() => setOutcome(option)}
              className={`h-9 flex-1 px-1.5 text-xs pointer-coarse:h-11 ${outcome === option ? "border-foreground font-semibold aria-pressed:bg-muted" : ""}`}
            >
              {option}
            </Toggle>
          ))}
        </div>
      </fieldset>
      <Textarea
        aria-label="Note"
        placeholder="Note"
        rows={2}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Next call</legend>
        <div className="flex flex-wrap gap-1.5">
          {row.nextCall ? (
            <Button
              variant="outline"
              size="xs"
              className={chip(next === "keep")}
              aria-pressed={next === "keep"}
              onClick={() => setNext("keep")}
            >
              Keep {day(row.nextCall)}
            </Button>
          ) : null}
          {CHOICES.map(([iso, label]) => (
            <Button
              key={iso}
              variant="outline"
              size="xs"
              className={chip(next === iso)}
              aria-pressed={next === iso}
              onClick={() => {
                setPicking(false);
                setNext(iso);
              }}
            >
              {label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="xs"
            className={chip(picking)}
            aria-pressed={picking}
            onClick={() => setPicking(true)}
          >
            Pick date
          </Button>
          <Button
            variant="outline"
            size="xs"
            className={chip(next === null && !picking)}
            aria-pressed={next === null && !picking}
            onClick={() => {
              setPicking(false);
              setNext(null);
            }}
          >
            None
          </Button>
        </div>
        {picking ? (
          <Input
            aria-label="Next call date"
            type="date"
            className="mt-1.5"
            onChange={(event) => setNext(event.target.value || null)}
          />
        ) : null}
      </fieldset>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="outline" size="sm" className="pointer-coarse:h-11" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          size="sm"
          className="pointer-coarse:h-11"
          disabled={!outcome}
          onClick={() => outcome && onSave({ outcome, note, next })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function InviteDialog({
  row,
  calendar,
  onClose,
}: {
  row: PipelineRow;
  calendar: "one" | "two" | "none";
  onClose: () => void;
}) {
  // A researched address is shown but starts unticked: the owner decides to use it.
  const [ticked, setTicked] = useState(
    () => new Set(row.people.filter((p) => p.email && !p.researched).map((p) => p.id)),
  );
  const [typed, setTyped] = useState<Record<string, string>>({});
  const tick = (id: string, value: boolean) =>
    setTicked((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  const count = ticked.size;
  // An overdue date is not offered: an invite for the past would be wrong.
  const [date, setDate] = useState(
    row.nextCall && daysFromToday(row.nextCall) >= 0 ? row.nextCall : "",
  );
  const dateOk = Boolean(date) && daysFromToday(date) >= 0;
  return (
    <Dialog defaultOpen onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send invite</DialogTitle>
        </DialogHeader>
        {calendar === "none" ? (
          <>
            <DialogBody>
              <p className="text-sm text-muted-foreground">
                Connect Google Calendar to send an invite. The next call stays on this row.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button>Connect Google Calendar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="invite-title">Title</Label>
                <Input id="invite-title" defaultValue={`Call: ${row.name}`} />
              </div>
              <div className="grid grid-cols-[1fr_8rem_6.5rem] gap-2 max-sm:grid-cols-2">
                <div className="grid min-w-0 gap-1.5 max-sm:col-span-2">
                  <Label htmlFor="invite-date">Date</Label>
                  <Input
                    id="invite-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-time">Time</Label>
                  <Input id="invite-time" type="time" defaultValue={row.nextCallTime ?? "10:00"} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-length">Length</Label>
                  <NativeSelect id="invite-length" defaultValue="30">
                    <NativeSelectOption value="30">30 min</NativeSelectOption>
                    <NativeSelectOption value="60">1 hour</NativeSelectOption>
                  </NativeSelect>
                </div>
              </div>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Attendees</legend>
                {row.people.length === 0 ? (
                  <Input
                    aria-label="Attendee email"
                    type="email"
                    placeholder="Add a person's email"
                  />
                ) : null}
                {row.people.map((person) => {
                  const email = person.email ?? typed[person.id]?.trim() ?? "";
                  const usable = /^\S+@\S+\.\S+$/.test(email);
                  return (
                    <div key={person.id} className="flex min-w-0 items-center gap-2 text-sm">
                      <Checkbox
                        disabled={!usable}
                        checked={ticked.has(person.id)}
                        aria-label={
                          usable ? `Invite ${person.name}` : `${person.name} has no email`
                        }
                        onCheckedChange={(value) => tick(person.id, Boolean(value))}
                      />
                      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
                        <span>{person.name}</span>
                        {person.researched ? (
                          <span className="text-xs text-muted-foreground">Researched</span>
                        ) : null}
                        {person.email ? (
                          <span className="min-w-0 break-all text-muted-foreground sm:ms-auto">
                            {email}
                          </span>
                        ) : null}
                      </span>
                      {person.email ? null : (
                        <Input
                          aria-label={`Email for ${person.name}`}
                          placeholder="No email: add one"
                          type="email"
                          value={typed[person.id] ?? ""}
                          onChange={(event) => {
                            setTyped((current) => ({
                              ...current,
                              [person.id]: event.target.value,
                            }));
                            if (!/^\S+@\S+\.\S+$/.test(event.target.value.trim()))
                              tick(person.id, false);
                          }}
                          className="h-8 min-w-0 flex-1 pointer-coarse:h-11"
                        />
                      )}
                    </div>
                  );
                })}
              </fieldset>
              {calendar === "two" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-from">From</Label>
                  <NativeSelect id="invite-from" defaultValue="you">
                    <NativeSelectOption value="you">you@example.test</NativeSelectOption>
                    <NativeSelectOption value="work">
                      founder@company.example.test
                    </NativeSelectOption>
                  </NativeSelect>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <Label htmlFor="invite-meet">Google Meet link</Label>
                <Switch id="invite-meet" defaultChecked />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={count === 0 || !dateOk} onClick={onClose}>
                <Send aria-hidden="true" />
                {count === 0
                  ? "Send invite"
                  : `Send invite to ${count} ${count === 1 ? "person" : "people"}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** What a touch screen uses in place of hover. Log call is the primary action. */
function RowSheet({
  copy,
  row,
  logging: startLogging = false,
  onClose,
  onInvite,
  onLog,
  onInterest,
}: {
  copy: TableCopy;
  row: PipelineRow;
  logging?: boolean;
  onClose: () => void;
  onInvite: () => void;
  onLog: (result: LogResult) => void;
  onInterest: (value: Interest | null) => void;
}) {
  const [logging, setLogging] = useState(startLogging);
  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        <SheetTitle>{logging ? `Log call: ${row.name}` : row.name}</SheetTitle>
        {logging ? (
          <SheetBody>
            <LogCallBody row={row} onSave={onLog} onCancel={() => setLogging(false)} />
          </SheetBody>
        ) : (
          <>
            <SheetBody className="grid gap-3">
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">{copy.interest}</span>
                <InterestChoice
                  copy={copy}
                  row={row}
                  value={row.interest}
                  onChange={onInterest}
                  wide
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sheet-status">Status</Label>
                <NativeSelect id="sheet-status" defaultValue={row.status} className="w-full">
                  {copy.statuses.map(([id, name]) => (
                    <NativeSelectOption key={id} value={id}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sheet-step">Next step</Label>
                <Input id="sheet-step" defaultValue={row.nextStep ?? ""} />
              </div>
              <div className="grid grid-cols-[1fr_8.5rem] gap-2">
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="sheet-date">Next call</Label>
                  <Input id="sheet-date" type="date" defaultValue={row.nextCall ?? ""} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sheet-time">Time</Label>
                  <Input id="sheet-time" type="time" defaultValue={row.nextCallTime ?? ""} />
                </div>
              </div>
              <div className="flex min-h-11 items-center justify-between gap-2 text-sm">
                <span className="font-medium">Referred by</span>
                <ReferredByPicker
                  name={row.name}
                  trigger={row.referredBy?.name ?? <span className="underline">Add</span>}
                />
              </div>
            </SheetBody>
            <SheetFooter className="flex-row gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={onInvite}>
                <CalendarPlus aria-hidden="true" />
                Send invite
              </Button>
              <Button size="lg" className="flex-1" onClick={() => setLogging(true)}>
                <Phone aria-hidden="true" />
                Log call
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const FILTERS = (
  copy: TableCopy,
): { param: string; label: string; options: [string, string][] }[] => [
  { param: "status", label: "Status", options: copy.statuses.map(([a, b]) => [a, b]) },
  {
    param: "interest",
    label: copy.interest,
    options: [...copy.interestOptions, ["none", "Not set"]],
  },
  {
    param: "last",
    label: "Last call",
    options: [
      ["never", "Never"],
      ["week", "Past 7 days"],
      ["older", "Older"],
    ],
  },
  {
    param: "step",
    label: "Next step",
    options: [
      ["yes", "Has a next step"],
      ["no", "None"],
    ],
  },
  {
    param: "next",
    label: "Next call",
    options: [
      ["overdue", "Overdue"],
      ["today", "Today"],
      ["week", "Next 7 days"],
      ["later", "Later"],
      ["none", "Not set"],
    ],
  },
  {
    param: "by",
    label: "Referred by",
    options: [...REFERRERS.map((r): [string, string] => [r.id, r.name]), ["none", "Nobody"]],
  },
  {
    param: "amount",
    label: copy.amount,
    options: [
      ["none", "Not set"],
      ["low", "Under $100K"],
      ["mid", "$100K–$500K"],
      ["high", "Over $500K"],
    ],
  },
  {
    param: "details",
    label: copy.details,
    options: [
      ["list", "From your list"],
      ["researched", "Researched"],
      ["none", "Empty"],
    ],
  },
  { param: copy.groupParam, label: copy.groupLabel, options: copy.groupOptions },
];

function FilterFields({
  copy,
  list,
  sortFields,
}: {
  copy: TableCopy;
  list: ReturnType<typeof useListParams<SortField>>;
  sortFields: [SortField, string][];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid min-w-0 gap-1 sm:col-span-2">
        <Label htmlFor="sort-field">Sort by</Label>
        <NativeSelect
          id="sort-field"
          className="w-full"
          value={list.sort.field}
          onChange={(event) =>
            list.setSort({ field: event.target.value as SortField, dir: list.sort.dir })
          }
        >
          {sortFields.map(([field, label]) => (
            <NativeSelectOption key={field} value={field}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {FILTERS(copy).map((filter) => (
        <div key={filter.param} className="grid min-w-0 gap-1">
          <Label htmlFor={`filter-${filter.param}`}>{filter.label}</Label>
          <NativeSelect
            id={`filter-${filter.param}`}
            className="w-full"
            value={list.param(filter.param) ?? ""}
            onChange={(event) => list.setParam(filter.param, event.target.value || undefined)}
          >
            <NativeSelectOption value="">Any</NativeSelectOption>
            {filter.options.map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ))}
    </div>
  );
}

function FilterControl({
  copy,
  list,
  sortFields,
}: {
  copy: TableCopy;
  list: ReturnType<typeof useListParams<SortField>>;
  sortFields: [SortField, string][];
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const names = FILTERS(copy).map((filter) => filter.param);
  const active = names.filter((name) => list.param(name)).length;
  const label = active ? `Filter · ${active}` : "Filter";
  const clear = active ? (
    <Button variant="ghost" size="sm" onClick={() => list.clear(...names)}>
      Clear filters
    </Button>
  ) : null;
  if (phone)
    return (
      <>
        <Button variant={active ? "secondary" : "outline"} size="lg" onClick={() => setOpen(true)}>
          <ListFilter aria-hidden="true" />
          {label}
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent>
            <SheetTitle>Filter</SheetTitle>
            <SheetBody>
              <FilterFields copy={copy} list={list} sortFields={sortFields} />
            </SheetBody>
            {clear ? <SheetFooter>{clear}</SheetFooter> : null}
          </SheetContent>
        </Sheet>
      </>
    );
  return (
    <Popover>
      <PopoverTrigger
        nativeButton
        render={<Button variant={active ? "secondary" : "outline"} size="sm" />}
      >
        <ListFilter aria-hidden="true" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-120 max-w-[calc(100vw-2rem)]">
        <FilterFields copy={copy} list={list} sortFields={sortFields} />
        {clear ? <div className="mt-1 flex justify-end">{clear}</div> : null}
      </PopoverContent>
    </Popover>
  );
}

function PipelineTable({
  copy,
  onOpen,
  initialInvite,
  initialSheet,
  initialSheetLog = false,
  initialLog,
  initialColumns,
  initialEdits = {},
  calendar = "two",
  safeRows = false,
}: {
  copy: TableCopy;
  onOpen?: (row: PipelineRow) => void;
  initialInvite?: string;
  initialSheet?: string;
  initialSheetLog?: boolean;
  initialLog?: string;
  initialColumns?: OptionalColumn[];
  initialEdits?: Record<string, Partial<PipelineRow>>;
  calendar?: "one" | "two" | "none";
  /** Puts the two SAFE rows first, for the story about them. */
  safeRows?: boolean;
}) {
  const list = useListParams(SORTS, { field: "nextCall", dir: "asc" });
  const [search, setSearch] = useState("");
  const [columns, setColumns] = useState<OptionalColumn[]>(() => initialColumns ?? readColumns());
  const [edits, setEdits] = useState<Record<string, Partial<PipelineRow>>>(initialEdits);
  const rowsAll = copy.rows.map((row) => ({ ...row, ...edits[row.id] }));
  const [inviteId, setInviteId] = useState(initialInvite);
  const [sheetId, setSheetId] = useState(initialSheet);
  const [logId, setLogId] = useState(initialLog);
  const invite = rowsAll.find((row) => row.id === inviteId);
  const sheet = rowsAll.find((row) => row.id === sheetId);
  const edit = (id: string, change: Partial<PipelineRow>) =>
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...change } }));
  const original = (row: PipelineRow) => ({ ...row });

  const chooseInterest = (row: PipelineRow, value: Interest | null) => {
    if (copy.interestMovesStatus && value === "out") {
      const before = original(row);
      edit(row.id, {
        interest: "out",
        status: copy.passedStatus,
        nextCall: null,
        nextCallTime: null,
      });
      enqueueNotificationToast({
        id: `out-${row.id}`,
        title: `${row.name}: Interest set to Out, status moved to Passed`,
        action: { label: "Undo", onClick: () => edit(row.id, before) },
        timeout: 8000,
      });
      return;
    }
    edit(row.id, { interest: value });
  };
  const chooseStatus = (row: PipelineRow, status: string) => {
    edit(row.id, { status });
    if (copy.interestMovesStatus && status === copy.passedStatus) edit(row.id, { interest: "out" });
    if (copy.interestMovesStatus && status === "committed") edit(row.id, { interest: "in" });
  };
  const saveLog = (row: PipelineRow, result: LogResult) => {
    const before = original(row);
    const order = copy.statuses.findIndex(([id]) => id === row.status);
    const metAt = copy.statuses.findIndex(([id]) => id === "met");
    const moved = result.outcome === "Spoke" && metAt >= 0 && order < metAt;
    edit(row.id, {
      lastCall: { outcome: result.outcome, date: TODAY },
      ...(moved ? { status: "met" } : {}),
      ...(result.next === "keep"
        ? {}
        : { nextCall: result.next, nextCallTime: null, invited: false }),
    });
    setLogId(undefined);
    setSheetId(undefined);
    enqueueNotificationToast({
      id: `log-${row.id}`,
      title: moved ? `Call logged. ${row.name} moved to Met` : "Call logged",
      action: { label: "Undo", onClick: () => edit(row.id, before) },
      timeout: 8000,
    });
  };

  const amountBand = (cents: number | null) =>
    cents == null ? "none" : cents < 10_000_000 ? "low" : cents <= 50_000_000 ? "mid" : "high";
  const lastBand = (row: PipelineRow) =>
    !row.lastCall ? "never" : daysFromToday(row.lastCall.date) >= -7 ? "week" : "older";
  const nextBand = (iso: string | null) => {
    if (!iso) return "none";
    const away = daysFromToday(iso);
    return away < 0 ? "overdue" : away === 0 ? "today" : away <= 7 ? "week" : "later";
  };
  const status = list.param("status");
  const hidePassed = (row: PipelineRow) => row.status === copy.passedStatus && !status;
  const live = rowsAll.filter((row) => !hidePassed(row));
  const isDue = (row: PipelineRow) => ["overdue", "today"].includes(nextBand(row.nextCall));
  const due = live.filter(isDue).length;
  const dueOn = list.param("due") === "1";
  const interest = list.param("interest");
  const by = list.param("by");
  const found = live
    .filter((row) => !dueOn || isDue(row))
    .filter((row) => !status || row.status === status)
    .filter((row) => !interest || (interest === "none" ? !row.interest : row.interest === interest))
    .filter((row) => !by || (by === "none" ? !row.referredBy : row.referredBy?.id === by))
    .filter((row) => !list.param("amount") || amountBand(row.amountCents) === list.param("amount"))
    .filter(
      (row) => !list.param("details") || (row.detailsSource ?? "none") === list.param("details"),
    )
    .filter((row) => !list.param("last") || lastBand(row) === list.param("last"))
    .filter(
      (row) => !list.param("step") || (list.param("step") === "yes") === Boolean(row.nextStep),
    )
    .filter((row) => !list.param("next") || nextBand(row.nextCall) === list.param("next"))
    .filter((row) => !list.param(copy.groupParam) || row.group === list.param(copy.groupParam))
    .filter((row) =>
      `${row.name} ${row.people.map((p) => p.name).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const pick: Record<SortField, (row: PipelineRow) => string | number | null> = {
    name: (row) => row.name,
    status: (row) => copy.statuses.findIndex(([id]) => id === row.status),
    interest: (row) => {
      const at = copy.interestOptions.findIndex(([id]) => id === row.interest);
      return at < 0 ? null : at;
    },
    referredBy: (row) => row.referredBy?.name ?? null,
    amount: (row) => row.amountCents,
    details: (row) => row.details,
    lastCall: (row) => row.lastCall?.date ?? null,
    nextStep: (row) => row.nextStep,
    nextCall: (row) => row.nextCall,
  };
  const sorted = sortBy(found, pick[list.sort.field], list.sort.dir);
  const rows = safeRows
    ? [
        ...sorted.filter((row) => row.status === "committed"),
        ...sorted.filter((row) => row.status !== "committed"),
      ]
    : sorted;
  const capped = useCappedRows(rows, { desktop: 10, phone: 6 });
  const head = (field: SortField) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const passed = rowsAll.filter((row) => row.status === copy.passedStatus).length;
  const sortFields: [SortField, string][] = [
    ["name", copy.noun],
    ["status", "Status"],
    ["interest", copy.interest],
    ["lastCall", "Last call"],
    ["nextStep", "Next step"],
    ["nextCall", "Next call"],
    ["referredBy", "Referred by"],
    ["amount", copy.amount],
    ["details", copy.details],
  ];
  const optional: [OptionalColumn, string][] = [
    ["referredBy", "Referred by"],
    ["amount", copy.amount],
    ["details", copy.details],
  ];
  const clearAll = () => {
    setSearch("");
    list.clear("due", ...FILTERS(copy).map((filter) => filter.param));
  };
  const show = (column: OptionalColumn) => columns.includes(column);
  // Container queries, never the viewport: the shell's sidebar decides how wide this page really is.
  const headClass = "sticky top-0 z-20 bg-card";
  return (
    // The card clips by default, which would stop the header from sticking.
    <SectionCard title="Pipeline" className="overflow-visible">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="min-w-0 basis-full sm:max-w-56 sm:flex-1 sm:basis-40">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={copy.search}
            label={copy.search}
            name="pipeline-search"
          />
        </div>
        {due ? (
          <Button
            variant={dueOn ? "secondary" : "outline"}
            size="sm"
            aria-pressed={dueOn}
            className="pointer-coarse:h-11"
            onClick={() => list.setParam("due", dueOn ? undefined : "1")}
          >
            Due now · {due}
          </Button>
        ) : null}
        <FilterControl copy={copy} list={list} sortFields={sortFields} />
        <span className="@max-[759px]/bd:hidden sm:ms-auto">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <Columns3 aria-hidden="true" />
              Columns
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-max min-w-44">
              {optional.map(([column, label]) => (
                <DropdownMenuCheckboxItem
                  key={column}
                  checked={show(column)}
                  closeOnClick={false}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...columns, column]
                      : columns.filter((c) => c !== column);
                    setColumns(next);
                    writeColumns(next);
                  }}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">No matches</p>
          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="@max-[759px]/bd:hidden">
            <Table compact className="table-fixed" data-testid="pipeline-table">
              <TableHeader>
                <TableHeadRow>
                  <TableHead className={`${headClass} ps-2 @[1040px]/bd:w-52`} {...head("name")}>
                    {copy.noun}
                  </TableHead>
                  <TableHead className={`${headClass} w-34`} {...head("status")}>
                    Status
                  </TableHead>
                  <TableHead className={`${headClass} ${copy.interestWidth}`} {...head("interest")}>
                    {copy.interest}
                  </TableHead>
                  <TableHead
                    className={`${headClass} hidden w-38 @[900px]/bd:table-cell`}
                    {...head("lastCall")}
                  >
                    Last call
                  </TableHead>
                  <TableHead
                    className={`${headClass} hidden @[1040px]/bd:table-cell`}
                    {...head("nextStep")}
                  >
                    Next step
                  </TableHead>
                  <TableHead className={`${headClass} w-28`} {...head("nextCall")}>
                    Next call
                  </TableHead>
                  {show("referredBy") ? (
                    <TableHead
                      className={`${headClass} hidden w-28 @[1240px]/bd:table-cell`}
                      {...head("referredBy")}
                    >
                      Referred by
                    </TableHead>
                  ) : null}
                  {show("amount") ? (
                    <TableHead
                      className={`${headClass} hidden w-28 whitespace-nowrap text-end @[1240px]/bd:table-cell`}
                      {...head("amount")}
                    >
                      {copy.amount}
                    </TableHead>
                  ) : null}
                  {show("details") ? (
                    <TableHead
                      className={`${headClass} hidden w-40 @[1240px]/bd:table-cell`}
                      {...head("details")}
                    >
                      {copy.details}
                    </TableHead>
                  ) : null}
                  <TableHead className={`${headClass} w-20`}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {capped.rows.map((row) => {
                  const [first, ...others] = row.people;
                  const sub = row.waitingSince
                    ? `Waiting for Mercury · ${day(row.waitingSince)}`
                    : first
                      ? `${first.name}${others.length ? ` +${others.length}` : ""}`
                      : null;
                  const dueWord = isOverdue(row) ? "Overdue" : null;
                  return (
                    <TableRow
                      key={row.id}
                      className="group/row [&>td]:py-1.5"
                      data-testid={`row-${row.id}`}
                      onOpen={() => onOpen?.(row)}
                    >
                      <TableCell>
                        <button
                          type="button"
                          data-row-open
                          title={row.name}
                          className="block max-w-full truncate rounded-sm text-start font-medium outline-none hover:underline"
                        >
                          {row.name}
                        </button>
                        {sub ? (
                          <div className="truncate text-xs text-muted-foreground" title={sub}>
                            {sub}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <StatusPick
                          copy={copy}
                          row={row}
                          value={row.status}
                          onChange={(next) => chooseStatus(row, next)}
                        />
                      </TableCell>
                      <TableCell>
                        <InterestChoice
                          copy={copy}
                          row={row}
                          value={row.interest}
                          onChange={(value) => chooseInterest(row, value)}
                        />
                      </TableCell>
                      <TableCell className="hidden @[900px]/bd:table-cell">
                        {row.lastCall ? (
                          <div
                            className="truncate text-muted-foreground"
                            title={`${row.lastCall.outcome} ${day(row.lastCall.date)}`}
                          >
                            {row.lastCall.outcome} {day(row.lastCall.date)}
                          </div>
                        ) : (
                          <Dash />
                        )}
                      </TableCell>
                      <TableCell className="hidden @[1040px]/bd:table-cell">
                        {row.nextStep ? (
                          <div className="truncate" title={row.nextStep}>
                            {row.nextStep}
                          </div>
                        ) : (
                          <Dash />
                        )}
                      </TableCell>
                      <TableCell>
                        <NextCallEditor row={row} onInvite={() => setInviteId(row.id)}>
                          {callLabel(row) ?? (
                            <>
                              <span className="group-focus-within/row:hidden group-hover/row:hidden pointer-coarse:hidden">
                                <Dash />
                              </span>
                              <span className="hidden text-muted-foreground group-focus-within/row:inline group-hover/row:inline pointer-coarse:inline">
                                Set date
                              </span>
                            </>
                          )}
                        </NextCallEditor>
                        {dueWord || row.invited ? (
                          <div
                            className={`text-xs ${dueWord ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {dueWord ?? "Invited"}
                          </div>
                        ) : null}
                      </TableCell>
                      {show("referredBy") ? (
                        <TableCell className="hidden @[1240px]/bd:table-cell">
                          {row.referredBy ? (
                            <a
                              href={`#contact-${row.referredBy.id}`}
                              title={row.referredBy.name}
                              className="block truncate underline decoration-border underline-offset-2 hover:decoration-foreground"
                            >
                              {row.referredBy.name}
                            </a>
                          ) : (
                            <ReferredByPicker
                              name={row.name}
                              trigger={
                                <>
                                  <span className="group-focus-within/row:hidden group-hover/row:hidden pointer-coarse:hidden">
                                    <Dash />
                                  </span>
                                  <span className="hidden text-muted-foreground group-focus-within/row:inline group-hover/row:inline pointer-coarse:inline">
                                    Add
                                  </span>
                                </>
                              }
                            />
                          )}
                        </TableCell>
                      ) : null}
                      {show("amount") ? (
                        <TableCell className="hidden text-end tabular-nums @[1240px]/bd:table-cell">
                          {usd(row.amountCents) ?? <Dash />}
                        </TableCell>
                      ) : null}
                      {show("details") ? (
                        <TableCell className="hidden @[1240px]/bd:table-cell">
                          {row.details ? (
                            <div className="truncate text-muted-foreground" title={row.details}>
                              {row.details}
                            </div>
                          ) : (
                            <Dash />
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell className="pe-0 text-end">
                        {row.status === "committed" && !row.waitingSince ? (
                          <Button size="xs">Send SAFE</Button>
                        ) : row.waitingSince ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${row.name}`}
                                />
                              }
                            >
                              <MoreHorizontal aria-hidden="true" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-max">
                              <DropdownMenuItem>Open Mercury</DropdownMenuItem>
                              <DropdownMenuItem>Not sent</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Popover
                            open={logId === row.id}
                            onOpenChange={(open) => setLogId(open ? row.id : undefined)}
                          >
                            <PopoverTrigger
                              nativeButton
                              render={
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  aria-label={`Log a call with ${row.name}`}
                                  className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 pointer-coarse:opacity-100"
                                />
                              }
                            >
                              <Phone aria-hidden="true" />
                              Log
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              className="w-96 max-w-[calc(100vw-2rem)] text-start"
                            >
                              <LogCallBody row={row} onSave={(result) => saveLog(row, result)} />
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ul className="@[760px]/bd:hidden" data-testid="pipeline-list">
            {capped.rows.map((row) => (
              <li
                key={row.id}
                data-testid={`item-${row.id}`}
                className="flex min-h-13 items-center gap-1 border-t border-border"
              >
                <button
                  type="button"
                  onClick={() => onOpen?.(row)}
                  className="min-w-0 flex-1 py-1.5 text-start outline-none"
                >
                  <span className="block truncate text-sm font-medium" title={row.name}>
                    {row.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.waitingSince
                      ? `Waiting for Mercury · ${day(row.waitingSince)}`
                      : `${statusName(copy, row.status)}${row.lastCall ? ` · ${row.lastCall.outcome} ${day(row.lastCall.date)}` : ""}`}
                  </span>
                  {row.nextCall ? (
                    <span
                      className={`block truncate text-xs ${isOverdue(row) ? "text-destructive" : ""}`}
                    >
                      {isOverdue(row) ? "Overdue: " : "Next call "}
                      {callLabel(row)}
                    </span>
                  ) : null}
                </button>
                <InterestPick
                  copy={copy}
                  row={row}
                  value={row.interest}
                  onChange={(value) => chooseInterest(row, value)}
                />
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="size-11"
                  aria-label={`Actions for ${row.name}`}
                  onClick={() => setSheetId(row.id)}
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex items-center justify-end gap-3 pt-1">
        {!status && passed ? (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => list.setParam("status", copy.passedStatus)}
          >
            {statusName(copy, copy.passedStatus)} · {passed}
          </Button>
        ) : null}
        <SeeAll list={capped} />
      </div>
      {sheet ? (
        <RowSheet
          key={sheet.id}
          copy={copy}
          row={sheet}
          logging={initialSheetLog}
          onClose={() => setSheetId(undefined)}
          onInterest={(value) => chooseInterest(sheet, value)}
          onLog={(result) => saveLog(sheet, result)}
          onInvite={() => {
            setSheetId(undefined);
            setInviteId(sheet.id);
          }}
        />
      ) : null}
      {invite ? (
        <InviteDialog
          key={invite.id}
          row={invite}
          calendar={calendar}
          onClose={() => setInviteId(undefined)}
        />
      ) : null}
    </SectionCard>
  );
}

const round = {
  id: "r1",
  name: "Seed",
  targetCents: 300_000_000,
  capCents: 1_500_000_000,
  closedAt: null,
};

type ScreenProps = {
  initialInvite?: string;
  initialSheet?: string;
  initialSheetLog?: boolean;
  initialLog?: string;
  initialColumns?: OptionalColumn[];
  initialEdits?: Record<string, Partial<PipelineRow>>;
  calendar?: "one" | "two" | "none";
  safes?: boolean;
};

const SAFE_BASE: Safe = {
  id: "s1",
  source: "native",
  contactId: "c-signed",
  roundId: "r1",
  investorName: "Quinn Sample",
  investorEmail: "quinn@example.test",
  amountCents: 10_000_000,
  valuationType: "post_money_cap",
  capCents: 1_500_000_000,
  discountPercent: null,
  mfn: false,
  proRata: false,
  governingState: null,
  investmentDate: null,
  expiresAt: null,
  canceledAt: null,
  sentAt: "2026-10-20T00:00:00.000Z",
  signedByOwnerAt: "2026-10-22T00:00:00.000Z",
  signedByInvestorAt: "2026-10-22T00:00:00.000Z",
  paidAt: null,
  documentUrl: null,
  status: "signed",
  createdAt: "2026-10-20T00:00:00.000Z",
};
const SAFES: Safe[] = [
  SAFE_BASE,
  {
    ...SAFE_BASE,
    id: "s2",
    investorName: "Avery Example",
    investorEmail: "avery@example.test",
    amountCents: 5_000_000,
    signedByOwnerAt: null,
    signedByInvestorAt: null,
    status: "sent",
  },
];

function FundraisingScreen({ safes = false, ...props }: ScreenProps) {
  const [open, setOpen] = useState<PipelineRow | null>(null);
  if (open) return <ProspectPage row={open} />;
  return (
    <div className="@container/bd flex h-svh min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2`}>
        <PageHeader
          title="Fundraising"
          actions={
            <>
              <Button variant="outline" size="sm" className="pointer-coarse:h-11">
                <Plus aria-hidden="true" />
                Add prospect
              </Button>
              <AskBotButton botName="Investors agent" onClick={noop} compact />
            </>
          }
        />
      </div>
      <div className={`rk-scroll flex flex-1 flex-col gap-4 overflow-y-auto ${PAGE_GUTTER_X} pb-6`}>
        {safes ? (
          <AttentionStrip
            safes={SAFES}
            now={new Date(`${TODAY}T12:00:00Z`)}
            onOpen={noop}
            onMark={noop}
          />
        ) : null}
        <RoundCard
          round={round}
          pendingCents={safes ? 90_000_000 : 85_000_000}
          signedCents={safes ? 10_000_000 : 0}
          onStart={noop}
          onEdit={noop}
          onClose={noop}
          onReopen={noop}
        />
        <PipelineTable copy={FUNDRAISING} onOpen={setOpen} safeRows={safes} {...props} />
        {safes ? (
          <SectionCard title="SAFEs">
            <SafeList
              safes={SAFES}
              round={round}
              onOpen={noop}
              onMark={noop}
              onCancel={noop}
              onDelete={noop}
              onAssign={noop}
              onUnassign={noop}
            />
          </SectionCard>
        ) : null}
      </div>
      <AppToaster />
    </div>
  );
}

/** The real shell reserves this width (BOTS_SIDEBAR_WIDTH in ResizableSidePanel.tsx). */
function InShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh min-w-0">
      <aside
        style={{ width: 316 }}
        data-testid="shell-sidebar"
        className="shrink-0 border-e border-border bg-muted p-4 text-sm text-muted-foreground"
      >
        Sidebar
      </aside>
      <div className="flex min-w-0 flex-1">{children}</div>
    </div>
  );
}

type TimelineKind = "invite" | "change" | "call" | "email" | "note" | "meeting" | "import";
const TIMELINE_ICON: Record<TimelineKind, typeof Mail> = {
  invite: CalendarPlus,
  change: Tag,
  call: Phone,
  email: Mail,
  note: FileText,
  meeting: Users,
  import: ListChecks,
};
const TIMELINE: {
  id: string;
  kind: TimelineKind;
  title: string;
  meta: string;
  body?: string;
  recording?: string;
  at: string;
}[] = [
  {
    id: "t1",
    kind: "invite",
    title: "Invite sent: Call: Sample Street Capital",
    meta: "Nov 6, 10:00 · alex@samplestreet.example.test · from you@example.test",
    at: "Nov 4",
  },
  {
    id: "t3",
    kind: "call",
    title: "Spoke with Alex Sample",
    meta: `28 min · ${meetingSourceName("granola")}`,
    body: "Likes the market; wants the deck and the cap table before a partner meeting.",
    recording: "Open recording",
    at: "Oct 28",
  },
  {
    id: "t4",
    kind: "change",
    title: "Status: Intro made → Met",
    meta: "From this call",
    at: "Oct 28",
  },
  {
    id: "t5",
    kind: "email",
    title: "Intro to Sample Street Capital",
    meta: "Sam Example · Connecting you both, thread below.",
    at: "Oct 27",
  },
  {
    id: "t6",
    kind: "note",
    title: "Note",
    meta: "You",
    body: "Asked about the lead. Prefers a short update every two weeks.",
    at: "Oct 25",
  },
  { id: "t7", kind: "call", title: "Left message", meta: "Logged by you", at: "Oct 22" },
  {
    id: "t8",
    kind: "import",
    title: "Added from your list",
    meta: "Alex Sample matched a saved contact by email",
    at: "Oct 15",
  },
];

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function ProspectPage({ row }: { row: PipelineRow }) {
  const [invite, setInvite] = useState(false);
  const [logging, setLogging] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [interest, setInterest] = useState(row.interest);
  const timeline = useCappedRows(
    row.people.length
      ? TIMELINE
      : [
          {
            id: "t0",
            kind: "import" as const,
            title: "Added from your list",
            meta: "No person named",
            at: "Oct 15",
          },
        ],
    { desktop: 8 },
  );
  return (
    <div className="@container/bd flex h-svh min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2`}>
        <PageHeader
          title={
            <span className="flex min-w-0 items-center gap-3">
              <ContactAvatar name={row.name} size="lg" />
              <span className="truncate" title={row.name}>
                {row.name}
              </span>
            </span>
          }
          onBack={noop}
          actions={
            <>
              <Popover open={logging} onOpenChange={setLogging}>
                <PopoverTrigger
                  nativeButton
                  render={<Button size="sm" className="pointer-coarse:h-11" />}
                >
                  <Phone aria-hidden="true" />
                  Log call
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
                  <LogCallBody row={row} onSave={() => setLogging(false)} />
                </PopoverContent>
              </Popover>
              <AskBotButton botName="Investors agent" onClick={noop} compact />
            </>
          }
        />
      </div>
      <div
        className={`rk-scroll grid flex-1 content-start gap-6 overflow-y-auto ${PAGE_GUTTER_X} pb-6 @[760px]/bd:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]`}
      >
        <div className="min-w-0 space-y-6">
          {row.lastCall || row.nextStep ? (
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 rounded-lg bg-muted p-3 text-sm">
              {row.lastCall ? (
                <Fact label="Last call">
                  <span className="font-medium">
                    {row.lastCall.outcome} {day(row.lastCall.date)}
                  </span>
                  <span className="block text-muted-foreground">
                    Likes the market; wants the deck and the cap table.
                  </span>
                </Fact>
              ) : null}
              <Fact label="Next">
                <span className="font-medium">{row.nextStep ?? <Dash />}</span>
                {callLabel(row) ? (
                  <span className="block text-muted-foreground">{callLabel(row)}</span>
                ) : null}
              </Fact>
            </dl>
          ) : null}
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-6 gap-y-2 text-sm">
            <Fact label="Status">
              <StatusPick copy={FUNDRAISING} row={row} value={status} onChange={setStatus} />
            </Fact>
            <Fact label="Interest">
              <InterestChoice
                copy={FUNDRAISING}
                row={row}
                value={interest}
                onChange={setInterest}
              />
            </Fact>
            <Fact label="Possible amount">
              <Input
                aria-label="Possible amount"
                defaultValue={usd(row.amountCents) ?? ""}
                placeholder="—"
                className="h-7 w-32"
              />
            </Fact>
            <Fact label="Referred by">
              {row.referredBy ? (
                <a
                  href="#contact"
                  className="underline decoration-border underline-offset-2 hover:decoration-foreground"
                >
                  {row.referredBy.name}
                </a>
              ) : (
                <ReferredByPicker
                  name={row.name}
                  trigger={<span className="underline">Add</span>}
                />
              )}
            </Fact>
            <Fact label="Next step">
              <Input
                aria-label="Next step"
                defaultValue={row.nextStep ?? ""}
                placeholder="—"
                className="h-7"
              />
            </Fact>
            <Fact label="Next call">
              <span className="flex flex-wrap items-center gap-2">
                <NextCallEditor row={row} onInvite={() => setInvite(true)}>
                  {callLabel(row) ?? "Set date"}
                </NextCallEditor>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={!row.nextCall}
                  onClick={() => setInvite(true)}
                >
                  <CalendarPlus aria-hidden="true" />
                  {row.invited ? "Send a new invite" : "Send invite"}
                </Button>
              </span>
            </Fact>
          </dl>

          <section>
            <h2 className="mb-1 text-sm font-semibold">People</h2>
            {row.people.length === 0 ? (
              <p className="py-1 text-sm text-muted-foreground">No people yet</p>
            ) : (
              <ul className="divide-y divide-border">
                {row.people.map((person) => (
                  <li key={person.id} className="flex items-center gap-2 py-2 text-sm">
                    <ContactAvatar name={person.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <a
                        href={`#contact-${person.id}`}
                        className="block truncate font-medium underline decoration-border underline-offset-2 hover:decoration-foreground"
                      >
                        {person.name}
                      </a>
                      <span className="block truncate text-xs text-muted-foreground">
                        {person.email
                          ? `${person.email}${person.researched ? " · Researched" : ""}`
                          : "No email"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" className="mt-1 pointer-coarse:h-11">
              <Plus aria-hidden="true" />
              Add person
            </Button>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold">Fund details</h2>
            {row.details ? (
              <>
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
                  <Fact label="Stage and check">{row.details}</Fact>
                </dl>
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {row.detailsSource === "researched"
                    ? "Researched Nov 2 · example-ventures.test"
                    : "From your list"}
                  {row.detailsSource === "researched" ? (
                    <ExternalLink aria-hidden="true" className="size-3" />
                  ) : null}
                </p>
              </>
            ) : (
              <Dash />
            )}
          </section>
        </div>

        <section className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="me-auto text-sm font-semibold">Timeline</h2>
            <Button variant="outline" size="sm" className="pointer-coarse:h-11">
              <FileText aria-hidden="true" />
              Add note
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {timeline.rows.map((item) => {
              const Icon = TIMELINE_ICON[item.kind];
              return (
                <li key={item.id} className="flex gap-3 py-2.5 text-sm">
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.title}</span>
                    <span className="block break-words text-xs text-muted-foreground">
                      {item.meta}
                    </span>
                    {item.body ? <span className="mt-0.5 block">{item.body}</span> : null}
                    {item.recording ? (
                      <a
                        href="#meeting"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs underline underline-offset-2"
                      >
                        {item.recording}
                        <ExternalLink aria-hidden="true" className="size-3" />
                      </a>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.at}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end">
            <SeeAll list={timeline} />
          </div>
        </section>
      </div>
      {invite ? <InviteDialog row={row} calendar="two" onClose={() => setInvite(false)} /> : null}
    </div>
  );
}

const QUESTIONS: {
  id: string;
  heading: string;
  sub: string;
  options: { id: string; label: string; detail: string }[];
}[] = [
  {
    id: "q1",
    heading: "Alex Sample",
    sub: "Sample Street Capital",
    options: [
      { id: "1", label: "Alex Sample", detail: "alex@oldfirm.example.test · Old Firm Example" },
      { id: "2", label: "Alex Sample", detail: "No email · Sample Street Capital" },
    ],
  },
  {
    id: "q2",
    heading: "Drew Example",
    sub: "Example Peak Ventures",
    options: [
      { id: "1", label: "Drew Example", detail: "drew@elsewhere.example.test · Elsewhere Example" },
    ],
  },
];
const REFERRER_QUESTIONS = [
  {
    id: "r1",
    heading: "Sam Example",
    sub: "referred 12 prospects",
    options: [{ id: "1", label: "Sam Example", detail: "sam@example.test" }],
  },
  {
    id: "r2",
    heading: "J. Sample",
    sub: "referred 4 prospects",
    options: [
      { id: "1", label: "Jordan Sample", detail: "jordan@example.test" },
      { id: "2", label: "Jamie Sample", detail: "No email" },
    ],
  },
];
const SURE = {
  new: [
    "Taylor Sample · Placeholder Partners",
    "Finley Sample · Test Harbor Fund",
    "Harper Example · Mock Valley Seed",
  ],
  saved: [
    "Casey Placeholder · casey@examplepeak.example.test",
    "Kai Sample · kai@examplefield.example.test",
  ],
  noPerson: ["Riverside Example Fund", "Lantern Ventures 63"],
};

function Choice({
  question,
  value,
  onChange,
  skip,
}: {
  question: (typeof QUESTIONS)[number];
  value: string | undefined;
  onChange: (value: string) => void;
  skip: string;
}) {
  return (
    <fieldset className="border-t border-border px-5 py-3 text-sm">
      <legend className="sr-only">
        {question.heading}, {question.sub}
      </legend>
      <p className="font-medium text-foreground">
        {question.heading}
        <span className="font-normal text-muted-foreground"> · {question.sub}</span>
      </p>
      <div className="mt-1.5 grid gap-1">
        {[
          ...question.options,
          { id: "new", label: "New contact", detail: "" },
          { id: "skip", label: skip, detail: "" },
        ].map((option) => (
          <label
            key={option.id}
            className="flex min-h-7 cursor-pointer items-center gap-2 pointer-coarse:min-h-11"
          >
            <input
              type="radio"
              name={question.id}
              className="accent-primary"
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <span className="min-w-0">
              {option.label}
              {option.detail ? (
                <span className="block text-xs break-words text-muted-foreground">
                  {option.detail}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ListGroup({
  title,
  items,
  open: startOpen,
}: {
  title: string;
  items: string[];
  open?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(startOpen));
  return (
    <div className="border-t border-border px-5 py-2.5 text-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-6 w-full items-center gap-1 text-start pointer-coarse:min-h-11"
      >
        <ChevronDown
          aria-hidden="true"
          className={`size-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        {title}
      </button>
      {open ? (
        <ul className="mt-1 space-y-1 ps-5 text-[13px] text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="break-words">
              {item}
            </li>
          ))}
          <li>and more</li>
        </ul>
      ) : null}
    </div>
  );
}

const CARD =
  "@container w-160 max-w-full overflow-hidden rounded-3xl bg-muted ring-1 ring-inset ring-border";

function ReconcileCard() {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const total = QUESTIONS.length + REFERRER_QUESTIONS.length;
  const left = total - Object.keys(choices).length;
  if (done) return <ReconcileResult />;
  const choose = (id: string) => (value: string) =>
    setChoices((current) => ({ ...current, [id]: value }));
  return (
    <div data-testid="reconcile-card" className={CARD}>
      <div className="px-5 py-3.5 text-[15px]">
        <p className="font-medium text-foreground">Add 96 prospects to Fundraising</p>
        <p className="text-sm text-muted-foreground">Saved contacts are not overwritten.</p>
      </div>
      <p className="border-t border-border px-5 pt-3 text-sm font-medium">Which contact is this?</p>
      {QUESTIONS.map((question) => (
        <Choice
          key={question.id}
          question={question}
          value={choices[question.id]}
          onChange={choose(question.id)}
          skip="Skip this row"
        />
      ))}
      <p className="border-t border-border px-5 pt-3 text-sm font-medium">
        Who made these introductions?
      </p>
      {REFERRER_QUESTIONS.map((question) => (
        <Choice
          key={question.id}
          question={question}
          value={choices[question.id]}
          onChange={choose(question.id)}
          skip="Leave Referred by empty"
        />
      ))}
      <ListGroup title="84 new contacts" items={SURE.new} open />
      <ListGroup title="23 contacts already saved" items={SURE.saved} open />
      <ListGroup title="7 prospects with no person yet" items={SURE.noPerson} open />
      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        {left ? (
          <span className="me-auto text-sm text-muted-foreground">{left} left to choose</span>
        ) : null}
        <Button variant="outline" className="pointer-coarse:h-11">
          Cancel
        </Button>
        <Button disabled={left > 0} className="pointer-coarse:h-11" onClick={() => setDone(true)}>
          Add 96 prospects
        </Button>
      </div>
    </div>
  );
}

function ReconcileResult() {
  return (
    <div data-testid="reconcile-result" className={CARD}>
      <div className="px-5 py-3.5 text-[15px]">
        <p className="font-medium text-foreground">Added 95 prospects to Fundraising</p>
        <p className="text-sm text-muted-foreground">
          84 new contacts · 23 contacts already saved · 1 row failed
        </p>
      </div>
      <p className="border-t border-border px-5 py-3 text-sm">
        <span className="text-destructive">Could not save:</span> Maple Fund 21. Nothing else
        changed.
      </p>
      <div className="flex justify-end border-t border-border px-5 py-3">
        <Button className="pointer-coarse:h-11">View in Pipeline</Button>
      </div>
    </div>
  );
}

function GtmScreen() {
  return (
    <div className="@container/bd flex h-svh min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2`}>
        <PageHeader
          title="GTM"
          actions={
            <Button variant="outline" size="sm" className="pointer-coarse:h-11">
              <Plus aria-hidden="true" />
              Add lead
            </Button>
          }
        />
        <Tabs value="leads" className="mb-3">
          <TabsList>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className={`rk-scroll flex-1 overflow-y-auto ${PAGE_GUTTER_X} pb-6`}>
        <PipelineTable copy={GTM} />
      </div>
    </div>
  );
}

const meta = {
  title: "Fundraising/CRM pipeline mockup",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The default six columns. Due now sits outside Filter; Columns adds the other three. */
export const Pipeline: Story = { render: () => <FundraisingScreen /> };

/** The same page inside a shell with the real sidebar width. Resize the viewport to test. */
export const PipelineInShell: Story = {
  render: () => (
    <InShell>
      <FundraisingScreen />
    </InShell>
  ),
};

/** All nine columns, chosen in the Columns menu. */
export const PipelineAllColumns: Story = {
  render: () => <FundraisingScreen initialColumns={["referredBy", "amount", "details"]} />,
};

/** Filters that match nothing. */
export const NoMatches: Story = {
  parameters: { initialEntries: ["/?status=diligence&next=overdue"] },
  render: () => <FundraisingScreen />,
};

/** The one entry point after a call, opened from a row. */
export const LogCall: Story = { render: () => <FundraisingScreen initialLog="f2" /> };

/** Send SAFE and Waiting for Mercury on a row, with the Attention strip and the SAFEs section. */
export const SafeStates: Story = { render: () => <FundraisingScreen safes /> };

/** A known email, a researched one that starts unticked, and a person with none who cannot be ticked. */
export const InviteConfirm: Story = {
  render: () => (
    <FundraisingScreen
      initialInvite="f1"
      initialEdits={{ f1: { nextCall: "2026-11-06", nextCallTime: "10:00" } }}
    />
  ),
};

/** Send invite with no calendar connected: nothing can be sent, the date stays on the row. */
export const InviteNoCalendar: Story = {
  render: () => <FundraisingScreen initialInvite="f1" calendar="none" />,
};

/** A touch screen's row actions. Log call is the primary action. Shown at phone width. */
export const PhoneRowSheet: Story = { render: () => <FundraisingScreen initialSheet="f1" /> };

/** Log call in the row sheet. Shown at phone width. */
export const PhoneLogCall: Story = {
  render: () => <FundraisingScreen initialSheet="f2" initialSheetLog />,
};

/** The prospect page: last call and next on top, people link to contacts, one timeline. */
export const ProspectTimeline: Story = {
  render: () => (
    <ProspectPage
      row={{
        ...(fundraisingRows[0] as PipelineRow),
        nextCall: "2026-11-06",
        nextCallTime: "10:00",
        invited: true,
      }}
    />
  ),
};

/** A prospect with no named person yet: a record with no contact. */
export const ProspectNoPerson: Story = {
  render: () => (
    <ProspectPage row={fundraisingRows.find((row) => row.id === "f8") as PipelineRow} />
  ),
};

/** One import, one card: nothing pre-answered, people and referrers resolved once, lists expanded. */
export const Reconcile: Story = {
  render: () => (
    <div className="flex justify-center bg-background p-6 max-sm:p-2">
      <ReconcileCard />
    </div>
  ),
};

/** The card after Add, with a failed row and the way to the Pipeline. */
export const ReconcileDone: Story = {
  render: () => (
    <div className="flex justify-center bg-background p-6 max-sm:p-2">
      <ReconcileResult />
    </div>
  ),
};

/** The table with GTM's words. Fit is the founder's view and does not change status. */
export const GtmLeads: Story = { render: () => <GtmScreen /> };
