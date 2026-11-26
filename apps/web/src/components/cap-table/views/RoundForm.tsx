import { t } from "@lingui/core/macro";
import type { EquityFundingRound } from "@rakazo/contracts";
import { Button, Field, FieldLabel, Input } from "@rakazo/ui-web";
import { useState } from "react";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { todayIso } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { ConcealedAmountInput } from "../ConcealedAmountInput";
import { formatPrice as formatSecurityPrice } from "../securities/format";
import { formatDollars } from "./format";
import { centsToDollars, dollarsToCents } from "./money";

type Draft = {
  name: string;
  startDate: string;
  closingDate: string;
  originalIssuePrice: string;
  preMoney: string;
  cashRaised: string;
  postMoney: string;
};

/** Create or edit a funding round, with optional typed-in totals, and a review before saving. */
export function RoundForm({
  round,
  today = todayIso(),
  onSaved,
  onCancel,
}: {
  round?: EquityFundingRound;
  today?: string;
  onSaved: (saved: EquityFundingRound) => void;
  onCancel: () => void;
}) {
  const hidden = useHideAmounts();
  const [draft, setDraft] = useState<Draft>({
    name: round?.name ?? "",
    startDate: round?.startDate ?? today,
    closingDate: round?.closingDate ?? "",
    originalIssuePrice: round?.originalIssuePrice ?? "",
    preMoney: centsToDollars(round?.preMoneyValuationCents),
    cashRaised: centsToDollars(round?.overrides.cashRaisedCents),
    postMoney: centsToDollars(round?.overrides.postMoneyValuationCents),
  });
  const [adjusting, setAdjusting] = useState(Boolean(draft.cashRaised || draft.postMoney));
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof Draft) => (event: { target: { value: string } }) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const cents = (value: string) => (value.trim() ? dollarsToCents(value) : null);
  const payload = () => ({
    name: draft.name,
    startDate: draft.startDate,
    closingDate: draft.closingDate || null,
    originalIssuePrice: draft.originalIssuePrice.trim() || null,
    preMoneyValuationCents: cents(draft.preMoney),
    overrides: {
      ...(cents(draft.cashRaised) ? { cashRaisedCents: cents(draft.cashRaised)! } : {}),
      ...(cents(draft.postMoney) ? { postMoneyValuationCents: cents(draft.postMoney)! } : {}),
    },
  });

  const review = () => {
    for (const value of [draft.preMoney, draft.cashRaised, draft.postMoney]) {
      if (value.trim() && dollarsToCents(value) == null) {
        setError(t`Enter amounts in dollars, up to two decimals`);
        return;
      }
    }
    setError("");
    setReviewing(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const saved = round
        ? await rpc.equity.fundingRounds.update({ id: round.id, ...payload() })
        : await rpc.equity.fundingRounds.create(payload());
      onSaved(saved);
    } catch (cause) {
      setError(errorText(cause));
      setReviewing(false);
    } finally {
      setSaving(false);
    }
  };

  if (reviewing) {
    const values = payload();
    const rows: [string, string][] = [
      [t`Round`, values.name],
      [t`Start date`, values.startDate],
      [t`Closing date`, values.closingDate ?? "—"],
      [
        t`Original issue price`,
        values.originalIssuePrice
          ? formatSecurityPrice(values.originalIssuePrice, undefined, hidden)
          : "—",
      ],
      [
        t`Pre-money`,
        values.preMoneyValuationCents ? formatDollars(values.preMoneyValuationCents, hidden) : "—",
      ],
      ...(values.overrides.cashRaisedCents
        ? [
            [t`Cash raised`, formatDollars(values.overrides.cashRaisedCents, hidden)] as [
              string,
              string,
            ],
          ]
        : []),
      ...(values.overrides.postMoneyValuationCents
        ? [
            [t`Post-money`, formatDollars(values.overrides.postMoneyValuationCents, hidden)] as [
              string,
              string,
            ],
          ]
        : []),
    ];
    return (
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setReviewing(false)} disabled={saving}>
            {t`Back`}
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {round ? t`Save round` : t`Create round`}
          </Button>
        </div>
      </div>
    );
  }

  const input = (key: keyof Draft, label: string, type = "text", required = false) => {
    const id = `round-${key}`;
    const stored =
      key === "originalIssuePrice"
        ? round?.originalIssuePrice != null
        : key === "preMoney"
          ? round?.preMoneyValuationCents != null
          : key === "cashRaised"
            ? round?.overrides.cashRaisedCents != null
            : key === "postMoney"
              ? round?.overrides.postMoneyValuationCents != null
              : false;
    return (
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {key === "originalIssuePrice" ||
        key === "preMoney" ||
        key === "cashRaised" ||
        key === "postMoney" ? (
          <ConcealedAmountInput
            id={id}
            scopeKey={`${round?.id ?? "new"}:${key}`}
            stored={stored}
            fieldLabel={label}
            inputMode="decimal"
            value={draft[key]}
            onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
          />
        ) : (
          <Input
            id={id}
            type={type}
            required={required}
            inputMode={type === "text" && key !== "name" ? "decimal" : undefined}
            value={draft[key]}
            onChange={set(key)}
          />
        )}
      </Field>
    );
  };
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        review();
      }}
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {input("name", t`Round`, "text", true)}
        {input("startDate", t`Start date`, "date", true)}
        {input("closingDate", t`Closing date`, "date")}
        {input("originalIssuePrice", t`Original issue price`)}
        {input("preMoney", t`Pre-money valuation`)}
        {adjusting ? (
          <>
            {input("cashRaised", t`Cash raised`)}
            {input("postMoney", t`Post-money valuation`)}
          </>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        {adjusting ? null : (
          <Button
            type="button"
            variant="ghost"
            className="me-auto"
            onClick={() => setAdjusting(true)}
          >
            {t`Adjust totals`}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          {t`Cancel`}
        </Button>
        <Button type="submit">{t`Review`}</Button>
      </div>
    </form>
  );
}
