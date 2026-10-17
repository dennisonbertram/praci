import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
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
} from "@rakazo/ui-web";
import { ArrowDown, ArrowUp, ChevronDown, Folder, Search, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { FolderNode } from "./folders";
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
  date: t`Date`,
  name: t`Name`,
  type: t`Type`,
  createdAt: t`Recently added`,
});

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
  onChange,
}: {
  filters: Filters;
  onChange: (from: string | undefined, to: string | undefined) => void;
}) {
  const from = filters.docDateFrom?.slice(0, 10);
  const to = filters.docDateTo?.slice(0, 10);
  const value =
    from || to ? `${from ? dayLabel(from) : "…"} – ${to ? dayLabel(to) : "…"}` : undefined;
  return (
    <Chip label={t`Document date`} value={value} onClear={() => onChange(undefined, undefined)}>
      {(close) => (
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
      )}
    </Chip>
  );
}

/** A pill that picks one of the values the items have; with a value it shows it and a remove button. */
function PickFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  /** [value, display name] pairs. */
  options: [string, string][];
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
        <DropdownMenuContent align="start" className="max-h-72 min-w-40">
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
}: {
  /** Where the folder tree is hidden (a narrow page), this picker chooses the folder. */
  folders: FolderNode[];
  folderId: string | undefined;
  onFolder: (id: string | undefined) => void;
  query: string;
  onQuery: (query: string) => void;
  searching: boolean;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  /** Null is relevance (search only). */
  sort: Sort | null;
  onSort: (sort: Sort | null) => void;
  /**
   * The values the items on screen have. A filter shows only when it has a value to pick (two
   * sources, since one source filters nothing), or is already set.
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
    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5 md:px-5">
      <InputGroup className="me-1.5 w-full min-w-40 @min-[560px]/bd:max-w-80 @min-[560px]/bd:flex-1">
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
      <div className="@min-[800px]/bd:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="data-room-folder-picker"
            render={<Button variant="outline" size="sm" className="max-w-36 rounded-full" />}
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
      </div>
      {types.length || filters.docType ? (
        <PickFilter
          label={t`Type`}
          value={filters.docType}
          options={withValue(types, filters.docType).map((type) => [type, type])}
          onChange={(docType) => onFilters({ ...filters, docType })}
        />
      ) : null}
      {parties.length || filters.party ? (
        <PickFilter
          label={t`Party`}
          value={filters.party}
          options={withValue(parties, filters.party).map((party) => [party, party])}
          onChange={(party) => onFilters({ ...filters, party })}
        />
      ) : null}
      {hasDates || filters.docDateFrom || filters.docDateTo ? (
        <DateFilter
          filters={filters}
          onChange={(from, to) =>
            onFilters({
              ...filters,
              docDateFrom: from && `${from}T00:00:00.000Z`,
              docDateTo: to && `${to}T23:59:59.999Z`,
            })
          }
        />
      ) : null}
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
      <div className="ms-auto flex items-center gap-0.5">
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
        ) : null}
      </div>
    </div>
  );
}
