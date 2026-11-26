import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { ArrowDown, ArrowUp, ChevronDown, ListFilter, Search, X } from "lucide-react";
import type { ReactElement, RefObject } from "react";
import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

type PickSpec = {
  kind: "pick";
  label: string;
  value: string | undefined;
  anyLabel: string | undefined;
  options: [string, string][];
  empty: string | undefined;
  onChange: (value: string | undefined) => void;
};
type SortSpec = {
  kind: "sort";
  fields: [string, string][];
  field: string;
  fieldLabel: string;
  direction: "asc" | "desc" | undefined;
  onField: (field: string) => void;
  onDirection: (direction: "asc" | "desc") => void;
};
type RangeSpec = {
  kind: "range";
  label: string;
  /** Days as YYYY-MM-DD. */
  from: string | undefined;
  to: string | undefined;
  onChange: (from: string | undefined, to: string | undefined) => void;
};
type Spec = PickSpec | SortSpec | RangeSpec;
type Entry = { marker: HTMLElement; root: Element; spec: Spec };

// On a phone the PickFilters and the SortControl of one toolbar do not each take room: they
// register here, and the first of them draws one "Filters" button and sheet for all.
// ponytail: module-level registry keyed by toolbar element; a provider if pages ever wrap toolbars.
const entries = new Map<string, Entry>();
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const signature = (spec: Spec) =>
  JSON.stringify(spec, (_key, value) => (typeof value === "function" ? undefined : value));

const PHONE = "(max-width: 639px)";
/** True below the `sm` breakpoint, where a toolbar cannot hold its controls in one row. */
export function usePhone() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia?.(PHONE);
      query?.addEventListener("change", notify);
      return () => query?.removeEventListener("change", notify);
    },
    () => window.matchMedia?.(PHONE).matches ?? false,
    () => false,
  );
}

/** The toolbar a control sits in: the nearest ancestor that holds the search box or is marked `data-list-toolbar`. */
function toolbarOf(marker: HTMLElement) {
  for (let el = marker.parentElement; el; el = el.parentElement)
    if (el.hasAttribute("data-list-toolbar") || el.querySelector("[data-list-search]")) return el;
  return marker.parentElement ?? marker;
}

/** Registers a control for the phone sheet. Null on wider screens or with `inline`. */
function usePhoneGroup(spec: Spec, inline: boolean | undefined) {
  const id = useId();
  const marker = useRef<HTMLSpanElement>(null);
  const phone = usePhone() && !inline;
  useSyncExternalStore(subscribe, () => version);
  useLayoutEffect(() => {
    if (!phone || !marker.current) return;
    const previous = entries.get(id);
    entries.set(id, { marker: marker.current, root: toolbarOf(marker.current), spec });
    if (!previous || signature(previous.spec) !== signature(spec)) bump();
  });
  useLayoutEffect(() => {
    if (!phone) return;
    return () => {
      entries.delete(id);
      bump();
    };
  }, [phone, id]);
  if (!phone) return null;
  const root = entries.get(id)?.root;
  const group = [...entries.entries()]
    .filter(([, entry]) => entry.root === root)
    .sort(([, a], [, b]) =>
      a.marker.compareDocumentPosition(b.marker) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  return { marker, group, leader: group[0]?.[0] === id };
}

/** What a phone control renders: a hidden marker, and, for the first control, the shared button. */
function PhoneSlot({
  slot,
}: {
  slot: { marker: RefObject<HTMLSpanElement | null>; group: [string, Entry][]; leader: boolean };
}) {
  return (
    <>
      <span hidden ref={slot.marker} />
      {slot.leader ? <FilterSheet group={slot.group} /> : null}
    </>
  );
}

const latest = (id: string) => entries.get(id)?.spec;

/** The one phone control: a Filters button (with the count), the chips of what is applied, and a bottom sheet with every filter and the sort. */
function FilterSheet({ group }: { group: [string, Entry][] }) {
  const [open, setOpen] = useState(false);
  const picks = group.filter(([, e]) => e.spec.kind === "pick") as [
    string,
    Entry & { spec: PickSpec },
  ][];
  const ranges = group.filter(([, e]) => e.spec.kind === "range") as [
    string,
    Entry & { spec: RangeSpec },
  ][];
  const sort = group.find(([, e]) => e.spec.kind === "sort") as
    | [string, Entry & { spec: SortSpec }]
    | undefined;
  const fieldLabel = sort?.[1].spec.fieldLabel ?? "";
  const active = [
    ...picks.filter(([, e]) => e.spec.value),
    ...ranges.filter(([, e]) => e.spec.from || e.spec.to),
  ];
  const shown = (spec: PickSpec | RangeSpec) =>
    spec.kind === "range"
      ? `${spec.from ?? "…"} – ${spec.to ?? "…"}`
      : (spec.options.find(([option]) => option === spec.value)?.[1] ?? spec.value);
  const set = (id: string, value: string | undefined) => {
    const spec = latest(id);
    if (spec?.kind === "pick") spec.onChange(value);
    if (spec?.kind === "range" && !value) spec.onChange(undefined, undefined);
  };
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        data-testid="filters-button"
        onClick={() => setOpen(true)}
      >
        <ListFilter aria-hidden="true" />
        <Trans>Filters</Trans>
        {active.length > 0 ? (
          <span className="min-w-5 rounded-full bg-primary px-1 text-xs text-primary-foreground tabular-nums">
            {active.length}
          </span>
        ) : null}
      </Button>
      {active.length > 0 ? (
        <div className="flex basis-full flex-wrap gap-1.5">
          {active.map(([id, { spec }]) => {
            const { label } = spec;
            return (
              <Button
                key={id}
                variant="secondary"
                size="sm"
                className="rounded-full"
                aria-label={t`Remove filter ${label}`}
                onClick={() => set(id, undefined)}
              >
                {label}: {shown(spec)}
                <X aria-hidden="true" />
              </Button>
            );
          })}
        </div>
      ) : null}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle>
            <Trans>Filters</Trans>
          </SheetTitle>
          <SheetBody className="flex flex-col gap-4">
            {picks.map(([id, { spec }]) => (
              <fieldset key={id} className="m-0 flex flex-col gap-1.5 border-0 p-0">
                <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {spec.label}
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ...(spec.anyLabel ? ([["", spec.anyLabel]] as [string, string][]) : []),
                    ...spec.options,
                  ].map(([option, name]) => {
                    const on = (spec.value ?? "") === option;
                    return (
                      <Button
                        key={option}
                        variant={on ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        aria-pressed={on}
                        // Tapping the chosen value again clears it.
                        onClick={() => set(id, on ? undefined : option || undefined)}
                      >
                        {name}
                      </Button>
                    );
                  })}
                </div>
                {spec.options.length === 0 && spec.empty ? (
                  <p className="text-sm text-muted-foreground">{spec.empty}</p>
                ) : null}
              </fieldset>
            ))}
            {ranges.map(([id, { spec }]) => (
              <fieldset key={id} className="m-0 flex flex-col gap-1.5 border-0 p-0">
                <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {spec.label}
                </legend>
                {(["from", "to"] as const).map((edge) => (
                  <div key={edge} className="flex items-center justify-between gap-2 text-sm">
                    {edge === "from" ? <Trans>From</Trans> : <Trans>To</Trans>}
                    <Input
                      type="date"
                      name={`${id}-${edge}`}
                      aria-label={edge === "from" ? t`From` : t`To`}
                      value={spec[edge] ?? ""}
                      onChange={(event) => {
                        const now = latest(id);
                        if (now?.kind !== "range") return;
                        const value = event.target.value || undefined;
                        if (edge === "from") now.onChange(value, now.to);
                        else now.onChange(now.from, value);
                      }}
                      className="w-44"
                    />
                  </div>
                ))}
              </fieldset>
            ))}
            {sort ? (
              <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
                  <Trans>Sort: {fieldLabel}</Trans>
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {sort[1].spec.fields.map(([field, name]) => (
                    <Button
                      key={field}
                      variant={field === sort[1].spec.field ? "default" : "outline"}
                      size="sm"
                      className="rounded-full"
                      aria-pressed={field === sort[1].spec.field}
                      onClick={() => {
                        const spec = latest(sort[0]);
                        if (spec?.kind === "sort") spec.onField(field);
                      }}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
                {sort[1].spec.direction ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(["asc", "desc"] as const).map((direction) => (
                      <Button
                        key={direction}
                        variant={direction === sort[1].spec.direction ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        aria-pressed={direction === sort[1].spec.direction}
                        onClick={() => {
                          const spec = latest(sort[0]);
                          if (spec?.kind === "sort") spec.onDirection(direction);
                        }}
                      >
                        {direction === "asc" ? (
                          <ArrowUp aria-hidden="true" />
                        ) : (
                          <ArrowDown aria-hidden="true" />
                        )}
                        {direction === "asc" ? t`Sort ascending` : t`Sort descending`}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </fieldset>
            ) : null}
          </SheetBody>
          <SheetFooter>
            <Button
              variant="ghost"
              disabled={active.length === 0}
              onClick={() => {
                for (const [id] of active) set(id, undefined);
              }}
            >
              <Trans>Clear all</Trans>
            </Button>
            <Button onClick={() => setOpen(false)}>
              <Trans>Done</Trans>
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** A hover and focus label for an icon-only control. */
export function Tip({
  label,
  side,
  disabled,
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  /** Keeps the label hidden, for example while the control's own menu is open. */
  disabled?: boolean;
  children: ReactElement;
}) {
  return (
    <Tooltip disabled={disabled}>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

/** A search box with a clear button; Escape clears it. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  name,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  name: string;
  className?: string;
}) {
  return (
    // On a phone the search shares its row with the Filters button, whatever width the page gave it.
    <InputGroup data-list-search className={`max-sm:min-w-0 max-sm:flex-1 ${className ?? ""}`}>
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        name={name}
        onKeyDown={(event) => event.key === "Escape" && value && onChange("")}
        className="[&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={t`Clear search`}
            onClick={(event) => {
              onChange("");
              event.currentTarget
                .closest("[data-slot=input-group]")
                ?.querySelector("input")
                ?.focus();
            }}
          >
            <X aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

/** A pill that picks one of the values the items have; with a value it shows it and a remove button. */
export function PickFilter({
  label,
  value,
  options,
  empty,
  anyLabel,
  inline,
  onChange,
}: {
  label: string;
  value: string | undefined;
  /** When set, the menu starts with this choice (for example "Any time"), the pill shows it while no value is picked, and picking it clears the filter. */
  anyLabel?: string;
  /** [value, display name] pairs. */
  options: [string, string][];
  /** Shown in the menu when there is nothing to pick, so the pill never vanishes unexplained. */
  empty?: string;
  onChange: (value: string | undefined) => void;
  /** Keeps the pill in place on a phone, for a toolbar that has its own phone layout. */
  inline?: boolean;
}) {
  const slot = usePhoneGroup(
    { kind: "pick", label, value, anyLabel, options, empty, onChange },
    inline,
  );
  if (slot) return <PhoneSlot slot={slot} />;
  const shown = options.find(([option]) => option === value)?.[1] ?? value;
  return (
    <span className="inline-flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={value ? "secondary" : "outline"}
              size="sm"
              className={value ? "rounded-s-full rounded-e-none" : "rounded-full"}
            />
          }
          aria-label={value ? `${label}: ${shown}` : t`Filter by ${label}`}
        >
          {value ? `${label}: ${shown}` : anyLabel ? `${label}: ${anyLabel}` : label}
          {value ? null : <ChevronDown aria-hidden="true" />}
        </DropdownMenuTrigger>
        {/* As wide as its longest value (within the screen), so names do not wrap. */}
        <DropdownMenuContent
          align="start"
          className="max-h-72 w-max min-w-40 max-w-[min(24rem,calc(100vw-2rem))]"
        >
          <DropdownMenuRadioGroup
            value={value ?? ""}
            onValueChange={(next) => onChange(String(next) || undefined)}
          >
            {anyLabel ? (
              <DropdownMenuRadioItem value="" closeOnClick>
                {anyLabel}
              </DropdownMenuRadioItem>
            ) : null}
            {options.map(([option, name]) => (
              <DropdownMenuRadioItem key={option} value={option} closeOnClick>
                {name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {options.length === 0 && empty ? (
            <DropdownMenuItem disabled>{empty}</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {value ? (
        <Button
          variant="secondary"
          size="icon-sm"
          className="rounded-s-none rounded-e-full"
          aria-label={t`Remove filter ${label}`}
          onClick={() => onChange(undefined)}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </span>
  );
}

/** A date range (YYYY-MM-DD) that lives in the phone sheet; it renders nothing on a wider screen, where the page has its own control. */
export function PhoneDateRange(props: Omit<RangeSpec, "kind">) {
  const slot = usePhoneGroup({ kind: "range", ...props }, undefined);
  return slot ? <PhoneSlot slot={slot} /> : null;
}

/** The "Sort: <field>" dropdown and, once a field is chosen, the direction arrow. */
export function SortControl<F extends string>({
  fields,
  field,
  fieldLabel,
  direction,
  onField,
  onDirection,
  inline,
}: {
  /** [field, display name] pairs. */
  fields: [F, string][];
  field: F;
  /** The chosen field's name, shown on the button. */
  fieldLabel: string;
  /** Undefined hides the arrow (a field with no direction, such as relevance). */
  direction: "asc" | "desc" | undefined;
  onField: (field: F) => void;
  onDirection: (direction: "asc" | "desc") => void;
  /** Keeps the control in place on a phone, for a toolbar that has its own phone layout. */
  inline?: boolean;
}) {
  const slot = usePhoneGroup(
    {
      kind: "sort",
      fields,
      field,
      fieldLabel,
      direction,
      onField: (next) => onField(next as F),
      onDirection,
    },
    inline,
  );
  if (slot) return <PhoneSlot slot={slot} />;
  const label = direction === "asc" ? t`Sort descending` : t`Sort ascending`;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" className="rounded-full" />}
        >
          <Trans>Sort: {fieldLabel}</Trans>
          <ChevronDown aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuRadioGroup value={field} onValueChange={(next) => onField(next as F)}>
            {fields.map(([value, text]) => (
              <DropdownMenuRadioItem key={value} value={value} closeOnClick>
                {text}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {direction ? (
        <Tip label={label}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={() => onDirection(direction === "asc" ? "desc" : "asc")}
          >
            {direction === "asc" ? (
              <ArrowUp aria-hidden="true" />
            ) : (
              <ArrowDown aria-hidden="true" />
            )}
          </Button>
        </Tip>
      ) : null}
    </>
  );
}
