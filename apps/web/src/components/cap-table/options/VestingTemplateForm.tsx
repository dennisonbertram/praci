import { t } from "@lingui/core/macro";
import type { EquityVestingTemplate } from "@rakazo/contracts";
import { describeVesting, parseFixed } from "@rakazo/core/equity";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

/** One custom tranche as typed: strings until the form checks them. */
export type VestingTrancheValue = { monthOffset: string; percent: string };

/** The rule being edited: an even schedule or custom tranches. */
export type VestingRuleValue = {
  mode: "even" | "custom";
  totalMonths: string;
  cliffMonths: string;
  frequencyMonths: string;
  tranches: VestingTrancheValue[];
};

/** A checked rule, ready for the wire and for `describeVesting`. */
export type ParsedVestingRule = {
  totalMonths: number;
  cliffMonths: number;
  frequencyMonths: number;
  tranches: { monthOffset: number; percent: string }[] | null;
};

/** A new template's starting point: 48 months monthly with a one-year cliff. */
export const DEFAULT_VESTING_RULE: VestingRuleValue = {
  mode: "even",
  totalMonths: "48",
  cliffMonths: "12",
  frequencyMonths: "1",
  tranches: [
    { monthOffset: "12", percent: "25" },
    { monthOffset: "24", percent: "25" },
    { monthOffset: "36", percent: "25" },
    { monthOffset: "48", percent: "25" },
  ],
};

/** The rule a template already holds, for the edit form. */
export function vestingRuleOf(template: EquityVestingTemplate | null): VestingRuleValue {
  if (template == null) return DEFAULT_VESTING_RULE;
  const tranches = template.tranches ?? [];
  if (tranches.length > 0)
    return {
      mode: "custom",
      totalMonths: String(template.totalMonths),
      cliffMonths: String(template.cliffMonths),
      frequencyMonths: String(template.frequencyMonths),
      tranches: tranches.map((tranche) => ({
        monthOffset: String(tranche.monthOffset),
        percent: displayPercent(tranche.percent),
      })),
    };
  return {
    mode: "even",
    totalMonths: String(template.totalMonths),
    cliffMonths: String(template.cliffMonths),
    frequencyMonths: String(template.frequencyMonths),
    tranches: DEFAULT_VESTING_RULE.tranches,
  };
}

/** A stored percent without its trailing zeros: "25.0000000000" reads as "25". */
export function displayPercent(percent: string): string {
  return percent.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

const WHOLE = /^\d+$/;
const PERCENT = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

function wholeMonths(value: string, min: number): number | null {
  const trimmed = value.trim();
  if (!WHOLE.test(trimmed)) return null;
  const months = Number(trimmed);
  return months >= min ? months : null;
}

/** A typed percent in integer hundredths of a percent, so "12.5" is 1250 and 100% is 10000. */
export function percentHundredths(percent: string): number | null {
  const match = PERCENT.exec(percent.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const hundredths = whole * 100 + fraction;
  return hundredths > 0 && hundredths <= 10000 ? hundredths : null;
}

/** Hundredths back to the wire form: "2500" is "25", "1250" is "12.5". */
function percentWire(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const fraction = hundredths % 100;
  if (fraction === 0) return String(whole);
  if (fraction % 10 === 0) return `${whole}.${fraction / 10}`;
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}

/** Custom tranches total exactly 100 percent, counted in integer hundredths. */
export function trancheHundredths(tranches: VestingTrancheValue[]): number | null {
  let total = 0;
  for (const tranche of tranches) {
    const hundredths = percentHundredths(tranche.percent);
    if (hundredths === null) return null;
    total += hundredths;
  }
  return total;
}

/** The rule when every field is valid, or null with the first problem the form shows. */
export function parseVestingRule(value: VestingRuleValue): ParsedVestingRule | null {
  if (value.mode === "custom") {
    if (value.tranches.length === 0) return null;
    const tranches: { monthOffset: number; percent: string }[] = [];
    for (const tranche of value.tranches) {
      const monthOffset = wholeMonths(tranche.monthOffset, 0);
      const hundredths = percentHundredths(tranche.percent);
      if (monthOffset === null || hundredths === null) return null;
      tranches.push({ monthOffset, percent: percentWire(hundredths) });
    }
    const total = trancheHundredths(value.tranches);
    if (total !== 10000) return null;
    const last = Math.max(...tranches.map((tranche) => tranche.monthOffset));
    // A template still stores the even rule's fields; custom tranches carry the schedule.
    return { totalMonths: last, cliffMonths: 0, frequencyMonths: 1, tranches };
  }
  const totalMonths = wholeMonths(value.totalMonths, 0);
  const cliffMonths = wholeMonths(value.cliffMonths || "0", 0);
  const frequencyMonths = wholeMonths(value.frequencyMonths, 1);
  if (totalMonths === null || cliffMonths === null || frequencyMonths === null) return null;
  return { totalMonths, cliffMonths, frequencyMonths, tranches: null };
}

/** The one-line schedule for a checked rule, e.g. "1/48 monthly, 1 year cliff". */
export function describeRule(rule: ParsedVestingRule): string {
  return describeVesting({
    startDate: "2025-01-01",
    totalMonths: rule.totalMonths,
    cliffMonths: rule.cliffMonths,
    frequencyMonths: rule.frequencyMonths,
    tranches:
      rule.tranches?.map((tranche) => ({
        monthOffset: tranche.monthOffset,
        percent: parseFixed(tranche.percent),
      })) ?? null,
  });
}

/** The schedule a stored template describes. */
export function describeTemplate(template: EquityVestingTemplate): string {
  return describeVesting({
    startDate: "2025-01-01",
    totalMonths: template.totalMonths,
    cliffMonths: template.cliffMonths,
    frequencyMonths: template.frequencyMonths,
    tranches:
      template.tranches?.map((tranche) => ({
        monthOffset: tranche.monthOffset,
        percent: parseFixed(tranche.percent),
      })) ?? null,
  });
}

/** Even (total, cliff, frequency) or custom tranches, with a live preview of the schedule. */
export function VestingRuleFields({
  value,
  onChange,
}: {
  value: VestingRuleValue;
  onChange: (value: VestingRuleValue) => void;
}) {
  const parsed = parseVestingRule(value);
  const custom = value.mode === "custom";
  const total = custom ? trancheHundredths(value.tranches) : null;
  const badPercent = custom && value.tranches.some((tr) => percentHundredths(tr.percent) === null);
  const setTranche = (index: number, next: Partial<VestingTrancheValue>) =>
    onChange({
      ...value,
      tranches: value.tranches.map((tranche, at) =>
        at === index ? { ...tranche, ...next } : tranche,
      ),
    });

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={value.mode}
        onValueChange={(next) =>
          onChange({ ...value, mode: next === "custom" ? "custom" : "even" })
        }
      >
        <TabsList aria-label={t`Vesting type`}>
          <TabsTrigger value="even">{t`Even`}</TabsTrigger>
          <TabsTrigger value="custom">{t`Custom`}</TabsTrigger>
        </TabsList>
      </Tabs>

      {custom ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
            <span>{t`Month`}</span>
            <span>{t`Percent`}</span>
            <span className="sr-only">{t`Remove`}</span>
          </div>
          {value.tranches.map((tranche, index) => (
            <div
              key={`tranche-${index}`}
              className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
            >
              <Input
                aria-label={t`Tranche ${index + 1} month`}
                inputMode="numeric"
                value={tranche.monthOffset}
                onChange={(event) => setTranche(index, { monthOffset: event.target.value.trim() })}
              />
              <Input
                aria-label={t`Tranche ${index + 1} percent`}
                inputMode="decimal"
                value={tranche.percent}
                onChange={(event) => setTranche(index, { percent: event.target.value.trim() })}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t`Remove tranche ${index + 1}`}
                disabled={value.tranches.length <= 1}
                onClick={() =>
                  onChange({
                    ...value,
                    tranches: value.tranches.filter((_tranche, at) => at !== index),
                  })
                }
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...value,
                  tranches: [...value.tranches, { monthOffset: "", percent: "" }],
                })
              }
            >
              <Plus aria-hidden="true" />
              {t`Add tranche`}
            </Button>
            {badPercent ? (
              <span className="text-sm text-destructive">
                {t`Enter percentages like 25 or 12.5`}
              </span>
            ) : total !== null && total !== 10000 ? (
              <span className="text-sm text-destructive">{t`Percentages must total 100%`}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Field>
            <FieldLabel htmlFor="vesting-total-months">{t`Total months`}</FieldLabel>
            <Input
              id="vesting-total-months"
              inputMode="numeric"
              value={value.totalMonths}
              onChange={(event) => onChange({ ...value, totalMonths: event.target.value.trim() })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="vesting-cliff-months">{t`Cliff months`}</FieldLabel>
            <Input
              id="vesting-cliff-months"
              inputMode="numeric"
              value={value.cliffMonths}
              onChange={(event) => onChange({ ...value, cliffMonths: event.target.value.trim() })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="vesting-frequency-months">{t`Every (months)`}</FieldLabel>
            <Input
              id="vesting-frequency-months"
              inputMode="numeric"
              value={value.frequencyMonths}
              onChange={(event) =>
                onChange({ ...value, frequencyMonths: event.target.value.trim() })
              }
            />
          </Field>
        </div>
      )}

      {parsed ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {describeRule(parsed)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A vesting template's name and schedule, created or saved. A custom rule must total exactly
 * 100 percent; the preview and the server share the same description.
 */
export function VestingTemplateForm({
  template,
  onClose,
  onSaved,
}: {
  template: EquityVestingTemplate | null;
  onClose: () => void;
  onSaved: (template: EquityVestingTemplate) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [rule, setRule] = useState<VestingRuleValue>(() => vestingRuleOf(template));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseVestingRule(rule);
  const [nameTouched, setNameTouched] = useState(false);
  const nameValid = name.trim().length > 0 && name.trim().length <= 200;
  const valid = nameValid && parsed !== null;

  async function save() {
    if (!nameValid || !parsed) return;
    setBusy(true);
    setError(null);
    const input = {
      name: name.trim(),
      totalMonths: parsed.totalMonths,
      cliffMonths: parsed.cliffMonths,
      frequencyMonths: parsed.frequencyMonths,
      tranches: parsed.tranches,
    };
    try {
      const saved = template
        ? await rpc.equity.vestingTemplates.update({ id: template.id, ...input })
        : await rpc.equity.vestingTemplates.create(input);
      onSaved(saved);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template ? t`Edit vesting template` : t`New vesting template`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <Field data-invalid={(nameTouched && !nameValid) || undefined}>
              <FieldLabel htmlFor="vesting-template-name">{t`Name`}</FieldLabel>
              <Input
                id="vesting-template-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setNameTouched(true)}
                placeholder={t`Standard 4 year`}
              />
              {nameTouched && !nameValid && <FieldError>{t`Enter a name`}</FieldError>}
            </Field>
            <VestingRuleFields value={rule} onChange={setRule} />
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t`Cancel`}
          </Button>
          <Button onClick={() => void save()} disabled={busy || !valid}>
            {template ? t`Save` : t`Create template`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
