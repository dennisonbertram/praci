import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Button,
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
} from "@rakazo/ui-web";
import { ListFilter } from "lucide-react";
import { useState } from "react";
import type { useListParams } from "../../lib/list-params";
import type { PipelineRow, SortField } from "../../lib/pipeline-rows";
import { usePhone } from "../ListControls";
import { interestNames, statusNames } from "./PipelineControls";

type Filter = { param: string; label: string; options: [string, string][] };

/** One filter per column, each with its URL param, plus Wave when the list has waves. */
export function pipelineFilters(rows: readonly PipelineRow[]): Filter[] {
  const interests = interestNames();
  const referrers = new Map(
    rows.flatMap((r) => (r.referredBy ? [[r.referredBy.id, r.referredBy.name] as const] : [])),
  );
  const waves = [...new Set(rows.flatMap((r) => (r.group ? [r.group] : [])))].sort();
  const statuses = statusNames();
  return [
    {
      param: "status",
      label: t`Status`,
      options: Object.entries(statuses) as [string, string][],
    },
    {
      param: "interest",
      label: t`Interest`,
      options: [...(Object.entries(interests) as [string, string][]), ["none", t`Unknown`]],
    },
    {
      param: "last",
      label: t`Last call`,
      options: [
        ["never", t`Never`],
        ["week", t`Past 7 days`],
        ["older", t`Older`],
      ],
    },
    {
      param: "step",
      label: t`Next step`,
      options: [
        ["yes", t`Has a next step`],
        ["no", t`None`],
      ],
    },
    {
      param: "next",
      label: t`Next call`,
      options: [
        ["overdue", t`Overdue`],
        ["today", t`Today`],
        ["week", t`Next 7 days`],
        ["later", t`Later`],
        ["none", t`Not set`],
      ],
    },
    {
      param: "by",
      label: t`Referred by`,
      options: [...referrers.entries(), ["none", t`Nobody`]],
    },
    {
      param: "amount",
      label: t`Possible amount`,
      options: [
        ["none", t`Not set`],
        ["low", t`Under $100K`],
        ["mid", t`$100K–$500K`],
        ["high", t`Over $500K`],
      ],
    },
    {
      param: "details",
      label: t`Fund details`,
      options: [
        ["list", t`From your list`],
        ["researched", t`Researched`],
        ["none", t`Empty`],
      ],
    },
    ...(waves.length
      ? [{ param: "wave", label: t`Wave`, options: waves.map((w): [string, string] => [w, w]) }]
      : []),
  ];
}

type List = ReturnType<typeof useListParams<SortField>>;

function FilterFields({
  filters,
  list,
  sortFields,
}: {
  filters: Filter[];
  list: List;
  sortFields: [SortField, string][];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid min-w-0 gap-1 sm:col-span-2">
        <Label htmlFor="sort-field">
          <Trans>Sort by</Trans>
        </Label>
        <NativeSelect
          id="sort-field"
          className="w-full pointer-coarse:h-11"
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
      {filters.map((filter) => (
        <div key={filter.param} className="grid min-w-0 gap-1">
          <Label htmlFor={`filter-${filter.param}`}>{filter.label}</Label>
          <NativeSelect
            id={`filter-${filter.param}`}
            className="w-full pointer-coarse:h-11"
            value={list.param(filter.param) ?? ""}
            onChange={(event) => list.setParam(filter.param, event.target.value || undefined)}
          >
            <NativeSelectOption value="">
              <Trans>Any</Trans>
            </NativeSelectOption>
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

/** The one Filter control: every column's filter and Sort by, in a popover, or a sheet on a phone. */
export function PipelineFilter({
  filters,
  list,
  sortFields,
}: {
  filters: Filter[];
  list: List;
  sortFields: [SortField, string][];
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const names = filters.map((filter) => filter.param);
  const active = names.filter((name) => list.param(name)).length;
  const label = active ? t`Filter · ${active}` : t`Filter`;
  const clear = active ? (
    <Button variant="ghost" size="sm" onClick={() => list.clear(...names)}>
      <Trans>Clear filters</Trans>
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
            <SheetTitle>
              <Trans>Filter</Trans>
            </SheetTitle>
            <SheetBody>
              <FilterFields filters={filters} list={list} sortFields={sortFields} />
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
        <FilterFields filters={filters} list={list} sortFields={sortFields} />
        {clear ? <div className="mt-1 flex justify-end">{clear}</div> : null}
      </PopoverContent>
    </Popover>
  );
}
