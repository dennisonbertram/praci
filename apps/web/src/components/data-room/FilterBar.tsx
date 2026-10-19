import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { ArrowDown, ArrowUp, ChevronDown, Folder, FolderPlus, Search, X } from "lucide-react";
import { type FormEvent, type ReactElement, useState } from "react";
import { PAGE_GUTTER_X } from "../PageHeader";
import type { FolderNode } from "./folders";
import { typeLabel } from "./format";
import type { Filters, Sort, SortField } from "./use-data-room-list";
import { naturalSort } from "./use-data-room-list";

export const sourceLabels = () => ({
  upload: t`Upload`,
  drive: t`Google Drive`,
  gmail: t`Gmail`,
  chat: t`Chat`,
  finance: t`Finance`,
});
export const sourceLabel = (source: string) =>
  (sourceLabels() as Record<string, string>)[source] ?? source;

const sortLabels = (): Record<SortField | "relevance", string> => ({
  relevance: t`Relevance`,
  date: t`Document date`,
  name: t`Name`,
  type: t`Type`,
  createdAt: t`Added`,
});

/** A hover and focus label for an icon-only control. */
export function Tip({
  label,
  side,
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

/** In the page header the labelled buttons shrink to icons where the line is too short for text. */
export const TOOLBAR_BUTTON = "@max-[639px]/bd:w-8 @max-[639px]/bd:px-0";
export const TOOLBAR_LABEL = "@max-[639px]/bd:sr-only";

/** A tooltip around a header button (the text is also visible on a wide line). */
export function ToolbarTip({
  label,
  compact,
  children,
}: {
  label: string;
  compact: boolean;
  children: ReactElement;
}) {
  return compact ? <Tip label={label}>{children}</Tip> : children;
}

/** A pill that opens a popover; with a value it shows "Label: value" and a remove button. */
function Chip({
  label,
  value,
  onClear,
  children,
}: {
  label: string;
  value?: string;
  onClear: () => void;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant={value ? "secondary" : "outline"}
              size="sm"
              className={value ? "rounded-s-full rounded-e-none" : "rounded-full"}
            />
          }
          aria-label={value ? `${label}: ${value}` : t`Filter by ${label}`}
        >
          {value ? `${label}: ${value}` : label}
          {value ? null : <ChevronDown aria-hidden="true" />}
        </PopoverTrigger>
        <PopoverContent align="start">{children(() => setOpen(false))}</PopoverContent>
      </Popover>
      {value ? (
        <Button
          variant="secondary"
          size="icon-sm"
          className="rounded-s-none rounded-e-full"
          aria-label={t`Remove filter ${label}`}
          onClick={onClear}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </span>
  );
}

const dayLabel = (day: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

function DateFilter({
  filters,
  hasDates,
  onChange,
}: {
  filters: Filters;
  /** False: nothing here has a document date, so the pill says so instead of offering a range. */
  hasDates: boolean;
  onChange: (from: string | undefined, to: string | undefined) => void;
}) {
  const from = filters.docDateFrom?.slice(0, 10);
  const to = filters.docDateTo?.slice(0, 10);
  const value =
    from || to ? `${from ? dayLabel(from) : "…"} – ${to ? dayLabel(to) : "…"}` : undefined;
  return (
    <Chip label={t`Document date`} value={value} onClear={() => onChange(undefined, undefined)}>
      {(close) =>
        !hasDates && !value ? (
          <p className="text-sm text-muted-foreground">
            <Trans>No documents here have a date yet.</Trans>
          </p>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              onChange(
                String(data.get("from") ?? "") || undefined,
                String(data.get("to") ?? "") || undefined,
              );
              close();
            }}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <Trans>From</Trans>
              <Input
                type="date"
                name="from"
                aria-label={t`From`}
                defaultValue={from ?? ""}
                className="w-40"
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <Trans>To</Trans>
              <Input
                type="date"
                name="to"
                aria-label={t`To`}
                defaultValue={to ?? ""}
                className="w-40"
              />
            </div>
            <Button type="submit">
              <Trans>Apply</Trans>
            </Button>
          </form>
        )
      }
    </Chip>
  );
}

/** A pill that picks one of the values the items have; with a value it shows it and a remove button. */
function PickFilter({
  label,
  value,
  options,
  empty,
  onChange,
}: {
  label: string;
  value: string | undefined;
  /** [value, display name] pairs. */
  options: [string, string][];
  /** Shown in the menu when there is nothing to pick, so the pill never vanishes unexplained. */
  empty?: string;
  onChange: (value: string | undefined) => void;
}) {
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
          {value ? `${label}: ${shown}` : label}
          {value ? null : <ChevronDown aria-hidden="true" />}
        </DropdownMenuTrigger>
        {/* As wide as its longest value (within the screen), so names do not wrap. */}
        <DropdownMenuContent
          align="start"
          className="max-h-72 w-max min-w-40 max-w-[min(24rem,calc(100vw-2rem))]"
        >
          <DropdownMenuRadioGroup
            value={value ?? ""}
            onValueChange={(next) => onChange(String(next))}
          >
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

export type FacetOptions = {
  types: string[];
  parties: string[];
  sources: string[];
  hasDates: boolean;
};

/**
 * The values the filters offer: those the listed items have. Sources come only from the items
 * (the server has no list of them), so a source with no files is never offered; they are in label
 * order.
 */
export function facetOptions(items: DataRoomApiItem[]): FacetOptions {
  const uniq = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  return {
    types: uniq(items.flatMap((item) => item.facets.docType ?? [])),
    parties: uniq(items.flatMap((item) => item.facets.parties)),
    sources: [...new Set(items.map((item) => item.source))].sort((a, b) =>
      sourceLabel(a).localeCompare(sourceLabel(b)),
    ),
    hasDates: items.some((item) => item.facets.docDate),
  };
}

const withValue = (values: string[], value: string | undefined) =>
  value && !values.includes(value) ? [...values, value] : values;

/** One bar: search, the facet filters and the sort control. Every change goes to the server. */
export function FilterBar({
  query,
  onQuery,
  searching,
  filters,
  onFilters,
  sort,
  onSort,
  types,
  parties,
  sources,
  hasDates,
  folders,
  folderId,
  onFolder,
  onNewFolder,
}: {
  /** Where the folder tree is hidden (a narrow page), this picker chooses the folder. */
  folders: FolderNode[];
  folderId: string | undefined;
  onFolder: (id: string | undefined) => void;
  /** Opens the New folder dialog; the folder tree's own button is hidden on this narrow page. */
  onNewFolder: () => void;
  query: string;
  onQuery: (query: string) => void;
  searching: boolean;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  /** Null is relevance (search only). */
  sort: Sort | null;
  onSort: (sort: Sort | null) => void;
  /**
   * The values the items here have, given the other filters. Type, Party and Document date always
   * show, and say so when there is nothing to pick; Source shows only with two sources to choose
   * between (one filters nothing), or when set.
   */
  types: string[];
  parties: string[];
  sources: string[];
  hasDates: boolean;
}) {
  const labels = sortLabels();
  const field = sort?.field ?? "relevance";
  // Date and Type order nothing until some item has one (or that sort is already chosen).
  const fields = (
    (searching ? ["relevance", "date"] : ["date", "name", "type", "createdAt"]) as (
      | SortField
      | "relevance"
    )[]
  ).filter(
    (name) =>
      name === field || (name === "date" ? hasDates : name === "type" ? types.length > 0 : true),
  );
  const direction = sort?.direction ?? "desc";
  const openFolder = folders.find(({ folder }) => folder.id === folderId);
  return (
    // Search and Sort share the first row; the filter pills wrap on a row of their own below, or,
    // given room, between the two. Sort never moves down among the pills.
    <div className={`flex flex-wrap items-start gap-1.5 pb-2.5 ${PAGE_GUTTER_X}`}>
      <InputGroup className="order-1 w-full @min-[640px]/bd:me-1.5 @min-[640px]/bd:w-80">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t`Search names and text`}
          aria-label={t`Search documents`}
          autoComplete="off"
          name="data-room-search"
          onKeyDown={(event) => event.key === "Escape" && query && onQuery("")}
          className="[&::-webkit-search-cancel-button]:appearance-none"
        />
        {query ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t`Clear search`}
              onClick={(event) => {
                onQuery("");
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
      {/* Where the folder tree is hidden, this picks the folder; it sits with Sort, not the pills. */}
      <div className="order-2 flex h-8 items-center gap-1 @min-[800px]/bd:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="data-room-folder-picker"
            render={<Button variant="outline" size="sm" className="max-w-44 rounded-full" />}
            title={openFolder?.path}
          >
            <Folder aria-hidden="true" />
            {/* The folder's own name, so the toolbar stays one row; the menu shows the full path. */}
            <span className="truncate">{openFolder?.folder.name ?? t`All items`}</span>
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          {/* As wide as its longest path (not the button), so no path wraps. */}
          <DropdownMenuContent
            align="start"
            className="w-max min-w-40 max-w-[calc(100vw-2rem)] whitespace-nowrap"
          >
            <DropdownMenuRadioGroup
              value={folderId ?? ""}
              onValueChange={(next) => onFolder(String(next) || undefined)}
            >
              <DropdownMenuRadioItem value="" closeOnClick>
                <Trans>All items</Trans>
              </DropdownMenuRadioItem>
              {folders.map(({ folder, path }) => (
                <DropdownMenuRadioItem key={folder.id} value={folder.id} closeOnClick>
                  {path}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tip label={t`New folder`}>
          <Button variant="outline" size="icon" aria-label={t`New folder`} onClick={onNewFolder}>
            <FolderPlus aria-hidden="true" />
          </Button>
        </Tip>
      </div>
      <div
        data-testid="data-room-filters"
        className="order-4 flex basis-full flex-wrap items-center gap-1.5 *:h-8 *:shrink-0 empty:hidden @min-[960px]/bd:order-3 @min-[960px]/bd:min-w-0 @min-[960px]/bd:basis-0 @min-[960px]/bd:flex-1"
      >
        <PickFilter
          label={t`Type`}
          value={filters.docType}
          options={withValue(types, filters.docType).map((type) => [type, typeLabel(type)])}
          empty={t`No tagged documents here`}
          onChange={(docType) => onFilters({ ...filters, docType })}
        />
        <PickFilter
          label={t`Party`}
          value={filters.party}
          options={withValue(parties, filters.party).map((party) => [party, party])}
          empty={t`No documents here name a party`}
          onChange={(party) => onFilters({ ...filters, party })}
        />
        <DateFilter
          filters={filters}
          hasDates={hasDates}
          onChange={(from, to) =>
            onFilters({
              ...filters,
              docDateFrom: from && `${from}T00:00:00.000Z`,
              docDateTo: to && `${to}T23:59:59.999Z`,
            })
          }
        />
        {sources.length > 1 || filters.source ? (
          <PickFilter
            label={t`Source`}
            value={filters.source}
            options={withValue(sources, filters.source).map((source) => [
              source,
              sourceLabel(source),
            ])}
            onChange={(source) => onFilters({ ...filters, source })}
          />
        ) : null}
      </div>
      <div className="order-3 ms-auto flex h-8 shrink-0 items-center gap-0.5 @min-[960px]/bd:order-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="rounded-full" />}
          >
            <Trans>Sort: {labels[field]}</Trans>
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuRadioGroup
              value={field}
              onValueChange={(next) =>
                onSort(next === "relevance" ? null : naturalSort(next as SortField))
              }
            >
              {fields.map((name) => (
                <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                  {labels[name]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Relevance has no direction, so the arrow only shows for a field sort. */}
        {sort ? (
          <Tip label={direction === "asc" ? t`Ascending` : t`Descending`}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={direction === "asc" ? t`Ascending` : t`Descending`}
              onClick={() => onSort({ ...sort, direction: direction === "asc" ? "desc" : "asc" })}
            >
              {direction === "asc" ? (
                <ArrowUp aria-hidden="true" />
              ) : (
                <ArrowDown aria-hidden="true" />
              )}
            </Button>
          </Tip>
        ) : null}
      </div>
    </div>
  );
}
