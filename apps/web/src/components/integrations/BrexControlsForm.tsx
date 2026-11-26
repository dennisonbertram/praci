import { Trans, useLingui } from "@lingui/react/macro";
import type { BrexCardDuration, BrexCardsControls } from "@rakazo/contracts";
import { BrexCardDurationSchema, BrexCardsControlsSchema } from "@rakazo/contracts";
import { Button, Checkbox, Input, Label, Skeleton } from "@rakazo/ui-web";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Heading } from "./AppDetail";

// The largest amount `BrexCardsControlsSchema` and the write-tool schemas accept (`MAX_CENTS` in
// packages/contracts/src/brex-cards.ts, not exported): $10,000,000.
const MAX_CENTS = 1_000_000_000;

/** Whole dollars or dollars and cents ("250", "250.5"), above zero, as cents. Anything else is null. */
export function dollarsToCents(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return cents > 0 && cents <= MAX_CENTS ? cents : null;
}

/** Cents as the dollar text a person types: "250", "250.50". */
export function centsToDollars(cents: number): string {
  const rest = cents % 100;
  return `${Math.floor(cents / 100)}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}

const wholeNumber = (text: string) => (/^\d{1,5}$/.test(text.trim()) ? Number(text.trim()) : null);

type Draft = {
  newCard: string;
  raise: string;
  spendBase: string;
  perDay: string;
  oneTimeDays: string;
  durations: BrexCardDuration[];
};

const toDraft = (controls: BrexCardsControls): Draft => ({
  newCard: centsToDollars(controls.maxNewCardLimitCents),
  raise: centsToDollars(controls.maxCardLimitCents),
  spendBase: centsToDollars(controls.maxSpendLimitBaseCents),
  perDay: String(controls.maxCardsPerDay),
  oneTimeDays: controls.oneTimeMaxDays === null ? "" : String(controls.oneTimeMaxDays),
  durations: controls.allowedDurations,
});

type Field = keyof Draft;

/** The controls the draft describes, or the fields that are not valid. */
function parse(draft: Draft): { value: BrexCardsControls } | { invalid: Field[] } {
  const parts = {
    newCard: dollarsToCents(draft.newCard),
    raise: dollarsToCents(draft.raise),
    spendBase: dollarsToCents(draft.spendBase),
    perDay: wholeNumber(draft.perDay),
    // An empty field means no lock-date rule; text that is not a number is left undefined so it fails.
    oneTimeDays:
      draft.oneTimeDays.trim() === "" ? null : (wholeNumber(draft.oneTimeDays) ?? undefined),
  };
  const candidate = {
    maxNewCardLimitCents: parts.newCard,
    maxCardLimitCents: parts.raise,
    maxSpendLimitBaseCents: parts.spendBase,
    maxCardsPerDay: parts.perDay,
    allowedDurations: draft.durations,
    oneTimeMaxDays: parts.oneTimeDays,
  };
  const result = BrexCardsControlsSchema.safeParse(candidate);
  if (result.success) return { value: result.data };
  const names: Record<string, Field> = {
    maxNewCardLimitCents: "newCard",
    maxCardLimitCents: "raise",
    maxSpendLimitBaseCents: "spendBase",
    maxCardsPerDay: "perDay",
    allowedDurations: "durations",
    oneTimeMaxDays: "oneTimeDays",
  };
  const invalid = new Set<Field>();
  for (const issue of result.error.issues) {
    const name = names[String(issue.path[0])];
    if (name) invalid.add(name);
  }
  return { invalid: [...invalid] };
}

/** The owner's hard limits for the Brex agent. Amounts are shown in dollars and saved as cents. */
export function BrexControlsForm() {
  const { t } = useLingui();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Field[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    rpc.brexCards
      .getControls()
      .then((controls) => setDraft(toDraft(controls)))
      .catch((cause) => setLoadError(errorText(cause)));
  }, []);
  useEffect(load, [load]);

  const durationLabels: Record<BrexCardDuration, string> = {
    ONE_TIME: t`One time`,
    MONTHLY: t`Monthly`,
    QUARTERLY: t`Quarterly`,
    YEARLY: t`Yearly`,
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaved(false);
    const parsed = parse(draft);
    if ("invalid" in parsed) {
      setInvalid(parsed.invalid);
      setError(t`Check the highlighted fields`);
      return;
    }
    setInvalid([]);
    setError("");
    setBusy(true);
    try {
      setDraft(toDraft(await rpc.brexCards.setControls(parsed.value)));
      setSaved(true);
    } catch (cause) {
      setError(errorText(cause));
    }
    setBusy(false);
  }

  const edit = (patch: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setSaved(false);
  };

  const heading = (
    <Heading>
      <Trans>Controls</Trans>
    </Heading>
  );
  if (!draft) {
    return (
      <section aria-label={t`Controls`}>
        {heading}
        {loadError ? (
          <div className="flex items-center gap-3">
            <p role="alert" className="text-sm text-destructive">
              {loadError}
            </p>
            <Button variant="outline" size="sm" onClick={load}>
              <Trans>Retry</Trans>
            </Button>
          </div>
        ) : (
          <div role="status" aria-label={t`Loading`}>
            <Skeleton className="h-40 w-full max-w-xl rounded-xl" />
          </div>
        )}
      </section>
    );
  }

  const text = (field: Field, label: string, value: string, inputMode: "decimal" | "numeric") => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`brex-controls-${field}`}>{label}</Label>
      <Input
        id={`brex-controls-${field}`}
        aria-label={label}
        aria-invalid={invalid.includes(field) || undefined}
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        onChange={(event) => edit({ [field]: event.target.value })}
      />
    </div>
  );

  return (
    <section aria-label={t`Controls`}>
      {heading}
      <form
        onSubmit={submit}
        className="flex max-w-xl flex-col gap-3 rounded-xl border border-border bg-card px-3.5 py-3"
      >
        {text("newCard", t`Max limit for a new card`, draft.newCard, "decimal")}
        {text("raise", t`Max limit a card can be raised to`, draft.raise, "decimal")}
        {text("spendBase", t`Max spend limit base amount`, draft.spendBase, "decimal")}
        {text("perDay", t`Cards per day`, draft.perDay, "numeric")}
        <fieldset
          className="flex flex-col gap-1.5"
          aria-invalid={invalid.includes("durations") || undefined}
        >
          <legend className="mb-1 text-sm font-medium">
            <Trans>Allowed durations</Trans>
          </legend>
          {BrexCardDurationSchema.options.map((duration) => (
            <div key={duration} className="flex items-center gap-2">
              <Checkbox
                id={`brex-controls-${duration}`}
                aria-label={durationLabels[duration]}
                checked={draft.durations.includes(duration)}
                onCheckedChange={(on) =>
                  edit({
                    durations: on
                      ? [...draft.durations, duration]
                      : draft.durations.filter((entry) => entry !== duration),
                  })
                }
              />
              <Label htmlFor={`brex-controls-${duration}`}>{durationLabels[duration]}</Label>
            </div>
          ))}
        </fieldset>
        {text("oneTimeDays", t`One-time cards lock within (days)`, draft.oneTimeDays, "numeric")}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            <Trans>Save</Trans>
          </Button>
          {saved ? (
            <span role="status" className="text-sm text-muted-foreground">
              <Trans>Saved</Trans>
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
