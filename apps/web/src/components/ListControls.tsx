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
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { ArrowDown, ArrowUp, ChevronDown, Search, X } from "lucide-react";
import type { ReactElement } from "react";

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
    <InputGroup className={className}>
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

/** The "Sort: <field>" dropdown and, once a field is chosen, the direction arrow. */
export function SortControl<F extends string>({
  fields,
  field,
  fieldLabel,
  direction,
  onField,
  onDirection,
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
}) {
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
