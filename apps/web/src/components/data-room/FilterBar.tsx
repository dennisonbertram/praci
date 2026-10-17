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
  InputGroupInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@rakazo/ui-web";
import { ArrowDown, ArrowUp, ChevronDown, Folder, Search, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import type { FolderNode } from "./folders";
import type { Filters, Sort, SortField } from "./use-data-room-list";

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

function TextFilter({
  label,
  value,
  suggestions,
  onChange,
}: {
  label: string;
  value: string | undefined;
  suggestions: string[];
  onChange: (value: string | undefined) => void;
}) {
  const list = useId();
  return (
    <Chip label={label} value={value} onClear={() => onChange(undefined)}>
      {(close) => (
        <form
          className="flex gap-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const typed = new FormData(event.currentTarget).get("value");
            onChange(String(typed ?? "").trim() || undefined);
            close();
          }}
        >
          <Input name="value" list={list} aria-label={label} defaultValue={value ?? ""} autoFocus />
          <datalist id={list}>
            {suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <Button type="submit" size="default">
            <Trans>Apply</Trans>
          </Button>
        </form>
      )}
    </Chip>
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
    <Chip label={t`Date`} value={value} onClear={() => onChange(undefined, undefined)}>
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

function SourceFilter({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const label = t`Source`;
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
          aria-label={value ? `${label}: ${sourceLabel(value)}` : t`Filter by ${label}`}
        >
          {value ? `${label}: ${sourceLabel(value)}` : label}
          {value ? null : <ChevronDown aria-hidden="true" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuRadioGroup
            value={value ?? ""}
            onValueChange={(next) => onChange(String(next))}
          >
            {Object.entries(sourceLabels()).map(([source, name]) => (
              <DropdownMenuRadioItem key={source} value={source} closeOnClick>
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

/** One bar: search, the facet filters and the sort control. Every change goes to the server. */
export function FilterBar({
  query,
  onQuery,
  searching,
  filters,
  onFilters,
  sort,
  onSort,
  typeSuggestions,
  partySuggestions,
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
  typeSuggestions: string[];
  partySuggestions: string[];
}) {
  const labels = sortLabels();
  const fields: (SortField | "relevance")[] = searching
    ? ["relevance", "date"]
    : ["date", "name", "type", "createdAt"];
  const field = sort?.field ?? "relevance";
  const direction = sort?.direction ?? "desc";
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5 md:px-5">
      <InputGroup className="me-1.5 w-full max-w-65 min-w-40 flex-1">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t`Search`}
          aria-label={t`Search documents`}
          autoComplete="off"
          name="data-room-search"
        />
      </InputGroup>
      <div className="@min-[800px]/bd:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="data-room-folder-picker"
            render={<Button variant="outline" size="sm" className="max-w-44 rounded-full" />}
          >
            <Folder aria-hidden="true" />
            <span className="truncate">
              {folders.find(({ folder }) => folder.id === folderId)?.path ?? t`All items`}
            </span>
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-40">
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
      <TextFilter
        label={t`Type`}
        value={filters.docType}
        suggestions={typeSuggestions}
        onChange={(docType) => onFilters({ ...filters, docType })}
      />
      <TextFilter
        label={t`Party`}
        value={filters.party}
        suggestions={partySuggestions}
        onChange={(party) => onFilters({ ...filters, party })}
      />
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
      <SourceFilter
        value={filters.source}
        onChange={(source) => onFilters({ ...filters, source })}
      />
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
                onSort(next === "relevance" ? null : { field: next as SortField, direction })
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
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!sort}
          aria-label={direction === "asc" ? t`Ascending` : t`Descending`}
          onClick={() =>
            sort && onSort({ ...sort, direction: direction === "asc" ? "desc" : "asc" })
          }
        >
          {direction === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
