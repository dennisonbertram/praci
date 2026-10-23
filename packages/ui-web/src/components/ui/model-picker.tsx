import { matchesSearchQuery } from "@rakazo/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command.js";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";

export type ModelPickerOption = {
  value: string;
  label: string;
  id?: string;
  provider?: string;
  providerName?: string;
  badgeLabel?: string;
};

export function ModelPicker({
  options,
  value,
  onChange,
  label,
  searchLabel,
  emptyLabel,
  loadingLabel,
  id,
  className,
  loading = false,
  disabled = false,
  allowCustom = false,
}: {
  options: readonly ModelPickerOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  searchLabel: string;
  emptyLabel: string;
  loadingLabel: string;
  id?: string;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected =
    options.find((option) => option.value === value) ??
    (value ? { value, label: value, id: value } : undefined);
  const candidates = selected && !options.includes(selected) ? [selected, ...options] : options;
  const filtered = candidates.filter(
    (option) =>
      !query.trim() ||
      matchesSearchQuery(
        query,
        option.label,
        option.id ?? option.value,
        option.provider ?? "",
        option.providerName ?? "",
      ),
  );
  const current = filtered.find((option) => option.value === value);
  const groups = new Map<string, { label: string; options: ModelPickerOption[] }>();
  for (const option of filtered) {
    if (option === current) continue;
    const key = option.provider ?? "";
    const group = groups.get(key) ?? { label: option.providerName ?? key, options: [] };
    group.options.push(option);
    groups.set(key, group);
  }
  const customValue = query.trim();

  function renderOption(option: ModelPickerOption) {
    return (
      <CommandItem
        key={option.value}
        value={`model:${option.value}`}
        data-checked={option.value === value}
        onSelect={() => {
          onChange(option.value);
          setOpen(false);
        }}
      >
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="min-w-0 truncate" title={option.label}>
            {option.label}
          </span>
          {option.badgeLabel ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">{option.badgeLabel}</span>
          ) : null}
        </span>
      </CommandItem>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
      }}
    >
      <PopoverTrigger
        render={<Button variant="outline" />}
        id={id}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className={cn("w-full justify-between font-normal", className)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setQuery("");
            setOpen(true);
          }
        }}
      >
        <span className="min-w-0 truncate">
          {selected?.label ?? (loading ? loadingLabel : label)}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-64 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <Command shouldFilter={false} defaultValue={`model:${value}`} loop>
          <CommandInput
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList aria-label={label}>
            {loading ? (
              <p role="status" className="p-3 text-sm text-muted-foreground">
                {loadingLabel}
              </p>
            ) : (
              <>
                <CommandEmpty>{emptyLabel}</CommandEmpty>
                {current ? <CommandGroup>{renderOption(current)}</CommandGroup> : null}
                {[...groups].map(([key, group]) => (
                  <CommandGroup key={key} heading={group.label || undefined}>
                    {group.options.map(renderOption)}
                  </CommandGroup>
                ))}
                {allowCustom &&
                customValue &&
                !candidates.some((option) => option.value === customValue) ? (
                  <CommandGroup>
                    {renderOption({ value: customValue, label: customValue })}
                  </CommandGroup>
                ) : null}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
