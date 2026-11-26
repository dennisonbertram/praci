import { t } from "@lingui/core/macro";
import type { EquityRelationship } from "@rakazo/contracts";
import { EQUITY_RELATIONSHIP_LABELS } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@rakazo/ui-web";
import { useState } from "react";
import type { StakeholderFilterValue, StakeholderHoldingFilter } from "./stakeholder-filter-params";
import { activeFilterCount } from "./stakeholder-filter-params";

const GROUPS = [
  "relationship",
  "costCenter",
  "holdings",
  "vesting",
  "address",
  "country",
  "created",
] as const;
type Group = (typeof GROUPS)[number];

/** Which value key each checkbox group writes. */
const FIELD_NAMES = {
  relationship: "relationship",
  costCenter: "costCenter",
  holdings: "holdings",
  vesting: "vesting",
  address: "addressCompleteness",
  country: "country",
} as const;

type Option = { value: string; label: string };

export type StakeholderFiltersProps = {
  value: StakeholderFilterValue;
  onChange: (value: StakeholderFilterValue) => void;
  /** Relationships seen in the list, so the panel offers only values that match rows. */
  relationshipsInUse: string[];
  costCentersInUse: string[];
  countriesInUse: string[];
};

/**
 * The stakeholder list's filters: a button with the number of active groups that opens a two-pane
 * panel, filter groups on the left and the selected group's checkboxes on the right. Each group is
 * an OR over its values and the groups combine with AND. A group with nothing selected is dropped
 * from the value, so the caller can read an absent array as "not filtering".
 */
export function StakeholderFilters({
  value,
  onChange,
  relationshipsInUse,
  costCentersInUse,
  countriesInUse,
}: StakeholderFiltersProps) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<Group>("relationship");
  const count = activeFilterCount(value);

  const setField = <K extends keyof StakeholderFilterValue>(
    field: K,
    next: StakeholderFilterValue[K],
  ) => {
    const empty = Array.isArray(next) ? next.length === 0 : !next;
    onChange({ ...value, [field]: empty ? undefined : next });
  };

  const groupLabels: Record<Group, string> = {
    relationship: t`Relationship`,
    costCenter: t`Cost center`,
    holdings: t`Holdings`,
    vesting: t`Vesting`,
    address: t`Address`,
    country: t`Country`,
    created: t`Date created`,
  };

  const relationshipOptions: Option[] = [
    ...relationshipsInUse.map((relationship) => ({
      value: relationship,
      label: EQUITY_RELATIONSHIP_LABELS[relationship as EquityRelationship] ?? relationship,
    })),
    { value: "none", label: t`None entered` },
  ];
  const costCenterOptions: Option[] = costCentersInUse.map((costCenter) => ({
    value: costCenter,
    label: costCenter,
  }));
  const holdingOptions: Option[] = [
    { value: "has" satisfies StakeholderHoldingFilter, label: t`Has holdings` },
    { value: "none" satisfies StakeholderHoldingFilter, label: t`No holdings` },
  ];
  const addressOptions: Option[] = [
    { value: "complete", label: t`Complete` },
    { value: "incomplete", label: t`Incomplete` },
    { value: "none", label: t`None entered` },
  ];
  const countryOptions: Option[] = [
    ...countriesInUse.map((country) => ({ value: country, label: country })),
    { value: "none", label: t`None entered` },
  ];

  const options: Record<Exclude<Group, "created">, Option[]> = {
    relationship: relationshipOptions,
    costCenter: costCenterOptions,
    holdings: holdingOptions,
    vesting: [
      { value: "active", label: t`Actively vesting` },
      { value: "ending", label: t`Vesting ends within 12 months` },
      { value: "ended", label: t`Vesting ended` },
      { value: "none", label: t`No vesting` },
    ],
    address: addressOptions,
    country: countryOptions,
  };

  const selectedIn = (field: Exclude<Group, "created">): string[] =>
    (value[FIELD_NAMES[field]] as string[] | undefined) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        {count > 0 ? t`Filters · ${count}` : t`Filters`}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-120 max-w-[calc(100vw-2rem)] gap-0 p-0">
        <div className="flex max-h-96">
          <nav
            aria-label={t`Filter groups`}
            className="flex w-40 shrink-0 flex-col gap-0.5 overflow-y-auto p-1.5"
          >
            {GROUPS.map((id) => (
              <Button
                key={id}
                variant={id === group ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                aria-current={id === group ? "true" : undefined}
                onClick={() => setGroup(id)}
              >
                {groupLabels[id]}
              </Button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto border-s p-2.5">
            {group === "created" ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="stakeholder-filter-from">{t`From`}</Label>
                  <Input
                    id="stakeholder-filter-from"
                    type="date"
                    value={value.createdFrom ?? ""}
                    onChange={(event) => setField("createdFrom", event.target.value || undefined)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="stakeholder-filter-to">{t`To`}</Label>
                  <Input
                    id="stakeholder-filter-to"
                    type="date"
                    value={value.createdTo ?? ""}
                    onChange={(event) => setField("createdTo", event.target.value || undefined)}
                  />
                </div>
              </div>
            ) : (
              <CheckList
                options={options[group]}
                selected={selectedIn(group)}
                onChange={(next) => setField(FIELD_NAMES[group], next)}
              />
            )}
          </div>
        </div>
        {count > 0 && (
          <div className="border-t p-1.5">
            <Button variant="ghost" size="sm" onClick={() => onChange({})}>{t`Clear all`}</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function CheckList({
  options,
  selected,
  onChange,
}: {
  options: Option[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const all = options.length > 0 && options.every((option) => selected.includes(option.value));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="link"
          size="xs"
          disabled={all}
          onClick={() => onChange(options.map((option) => option.value))}
        >{t`Select all`}</Button>
        <Button
          variant="link"
          size="xs"
          disabled={selected.length === 0}
          onClick={() => onChange([])}
        >{t`Deselect all`}</Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map((option) => (
          <Label key={option.value} className="font-normal">
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option.value]
                    : selected.filter((item) => item !== option.value),
                )
              }
            />
            {option.label}
          </Label>
        ))}
      </div>
    </div>
  );
}
