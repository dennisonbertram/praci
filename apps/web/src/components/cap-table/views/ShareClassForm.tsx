import { t } from "@lingui/core/macro";
import type {
  EquityShareClass,
  EquityShareClassCreateInput,
  EquityShareClassUpdateInput,
} from "@rakazo/contracts";
import {
  Button,
  Field,
  FieldLabel,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Switch,
} from "@rakazo/ui-web";
import { useState } from "react";
import { todayIso } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

type Text =
  | "authorizedShares"
  | "votesPerShare"
  | "parValue"
  | "seniority"
  | "originalIssuePrice"
  | "conversionPrice"
  | "conversionRatio"
  | "multiplier"
  | "participationCap"
  | "dividendYield";
type Flag = "certificated" | "pariPassu" | "participating" | "dividend" | "cumulative";

const TEXT_FIELDS: { key: Text; label: () => string; preferred?: boolean }[] = [
  { key: "authorizedShares", label: () => t`Authorized shares` },
  { key: "votesPerShare", label: () => t`Votes per share` },
  { key: "parValue", label: () => t`Par value` },
  { key: "seniority", label: () => t`Seniority` },
  { key: "originalIssuePrice", label: () => t`Original issue price`, preferred: true },
  { key: "conversionPrice", label: () => t`Conversion price`, preferred: true },
  { key: "conversionRatio", label: () => t`Conversion ratio`, preferred: true },
  { key: "multiplier", label: () => t`Liquidation multiple`, preferred: true },
  { key: "participationCap", label: () => t`Participation cap`, preferred: true },
  { key: "dividendYield", label: () => t`Dividend yield %`, preferred: true },
];
const FLAGS: { key: Flag; label: () => string; preferred?: boolean }[] = [
  { key: "certificated", label: () => t`Certificated` },
  { key: "pariPassu", label: () => t`Pari passu` },
  { key: "participating", label: () => t`Participating`, preferred: true },
  { key: "dividend", label: () => t`Dividends`, preferred: true },
  { key: "cumulative", label: () => t`Cumulative`, preferred: true },
];

const ACCRUALS = (): Record<string, string> => ({
  daily: t`Daily`,
  monthly: t`Monthly`,
  quarterly: t`Quarterly`,
  semi_annually: t`Semi-annually`,
  annually: t`Annually`,
});
const DAY_COUNTS: Record<string, string> = {
  actual_365: "Actual/365",
  actual_360: "Actual/360",
  "30_360": "30/360",
};
const DIVIDEND_FIELDS = [
  { key: "dividendAccrual", label: () => t`Dividend accrual` },
  { key: "dayCountConvention", label: () => t`Day count` },
] as const;

type Draft = {
  name: string;
  prefix: string;
  classType: "common" | "preferred";
  documentDate: string;
  text: Record<Text, string>;
  flags: Record<Flag, boolean>;
  dividendAccrual: string;
  dayCountConvention: string;
};

function draftOf(shareClass: EquityShareClass | undefined, today: string): Draft {
  const current = shareClass?.current;
  const text = Object.fromEntries(
    TEXT_FIELDS.map(({ key }) => [key, current?.[key] == null ? "" : String(current[key])]),
  ) as Record<Text, string>;
  const flags = Object.fromEntries(
    FLAGS.map(({ key }) => [
      key,
      current
        ? Boolean(current[key])
        : key !== "participating" && key !== "dividend" && key !== "cumulative",
    ]),
  ) as Record<Flag, boolean>;
  return {
    name: shareClass?.name ?? "",
    prefix: shareClass?.prefix ?? "",
    classType: shareClass?.classType ?? "common",
    documentDate: current?.documentDate ?? today,
    text,
    flags,
    dividendAccrual: current?.dividendAccrual ?? "",
    dayCountConvention: current?.dayCountConvention ?? "",
  };
}

/** The terms the draft sets, as the contract expects them (empty boxes are left out). */
function termsOf(draft: Draft) {
  const preferred = draft.classType === "preferred";
  const terms: Record<string, string | number | boolean> = { documentDate: draft.documentDate };
  for (const field of TEXT_FIELDS) {
    if (field.preferred && !preferred) continue;
    const value = draft.text[field.key].replaceAll(",", "").trim();
    if (value === "") continue;
    terms[field.key] = field.key === "seniority" ? Number(value) : value;
  }
  for (const field of FLAGS) {
    if (field.preferred && !preferred) continue;
    terms[field.key] = draft.flags[field.key];
  }
  if (preferred && draft.flags.dividend) {
    if (draft.dividendAccrual) terms.dividendAccrual = draft.dividendAccrual;
    if (draft.dayCountConvention) terms.dayCountConvention = draft.dayCountConvention;
  }
  return terms;
}

/** Create a share class or write its terms for one incorporation document date, with a review. */
export function ShareClassForm({
  shareClass,
  today = todayIso(),
  onSaved,
  onCancel,
}: {
  shareClass?: EquityShareClass;
  today?: string;
  onSaved: (saved: EquityShareClass) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => draftOf(shareClass, today));
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const preferred = draft.classType === "preferred";
  const newVersion =
    shareClass &&
    !shareClass.versions.some((version) => version.documentDate === draft.documentDate);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const terms = termsOf(draft);
      const saved = shareClass
        ? await rpc.equity.shareClasses.update({
            id: shareClass.id,
            name: draft.name,
            prefix: draft.prefix,
            terms: terms as EquityShareClassUpdateInput["terms"],
          })
        : await rpc.equity.shareClasses.create({
            name: draft.name,
            prefix: draft.prefix,
            classType: draft.classType,
            terms: terms as EquityShareClassCreateInput["terms"],
          });
      onSaved(saved);
    } catch (cause) {
      setError(errorText(cause));
      setReviewing(false);
    } finally {
      setSaving(false);
    }
  };

  if (reviewing) {
    const terms = termsOf(draft);
    return (
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t`Name`}</dt>
          <dd>{draft.name}</dd>
          <dt className="text-muted-foreground">{t`Prefix`}</dt>
          <dd>{draft.prefix}</dd>
          <dt className="text-muted-foreground">{t`Class type`}</dt>
          <dd>{preferred ? t`Preferred` : t`Common`}</dd>
          <dt className="text-muted-foreground">{t`Document date`}</dt>
          <dd>
            {draft.documentDate}
            {newVersion ? ` · ${t`new version`}` : ""}
          </dd>
          {[...TEXT_FIELDS, ...FLAGS, ...DIVIDEND_FIELDS]
            .filter((field) => field.key in terms)
            .map((field) => (
              <div key={field.key} className="contents">
                <dt className="text-muted-foreground">{field.label()}</dt>
                <dd>
                  {typeof terms[field.key] === "boolean"
                    ? terms[field.key]
                      ? t`Yes`
                      : t`No`
                    : field.key === "dividendAccrual"
                      ? ACCRUALS()[String(terms[field.key])]
                      : field.key === "dayCountConvention"
                        ? DAY_COUNTS[String(terms[field.key])]
                        : String(terms[field.key])}
                </dd>
              </div>
            ))}
        </dl>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setReviewing(false)} disabled={saving}>
            {t`Back`}
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {shareClass ? t`Save terms` : t`Create share class`}
          </Button>
        </div>
      </div>
    );
  }

  const setText = (key: Text, value: string) =>
    setDraft((current) => ({ ...current, text: { ...current.text, [key]: value } }));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setReviewing(true);
      }}
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="share-class-name">{t`Name`}</FieldLabel>
          <Input
            id="share-class-name"
            required
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="share-class-prefix">{t`Prefix`}</FieldLabel>
          <Input
            id="share-class-prefix"
            required
            value={draft.prefix}
            onChange={(event) => setDraft({ ...draft, prefix: event.target.value.toUpperCase() })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="share-class-type">{t`Class type`}</FieldLabel>
          <NativeSelect
            id="share-class-type"
            disabled={Boolean(shareClass)}
            value={draft.classType}
            onChange={(event) =>
              setDraft({ ...draft, classType: event.target.value as Draft["classType"] })
            }
          >
            <NativeSelectOption value="common">{t`Common`}</NativeSelectOption>
            <NativeSelectOption value="preferred">{t`Preferred`}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="share-class-date">{t`Document date`}</FieldLabel>
          <Input
            id="share-class-date"
            type="date"
            required
            value={draft.documentDate}
            onChange={(event) => setDraft({ ...draft, documentDate: event.target.value })}
          />
        </Field>
        {TEXT_FIELDS.filter((field) => preferred || !field.preferred).map((field) => (
          <Field key={field.key}>
            <FieldLabel htmlFor={`share-class-${field.key}`}>{field.label()}</FieldLabel>
            <Input
              id={`share-class-${field.key}`}
              inputMode="decimal"
              required={field.key === "authorizedShares"}
              value={draft.text[field.key]}
              onChange={(event) => setText(field.key, event.target.value)}
            />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {FLAGS.filter((field) => preferred || !field.preferred).map((field) => (
          <Label key={field.key} className="gap-2 font-normal">
            <Switch
              checked={draft.flags[field.key]}
              onCheckedChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  flags: { ...current.flags, [field.key]: checked },
                }))
              }
            />
            {field.label()}
          </Label>
        ))}
      </div>
      {preferred && draft.flags.dividend ? (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="share-class-accrual">{t`Dividend accrual`}</FieldLabel>
            <NativeSelect
              id="share-class-accrual"
              value={draft.dividendAccrual}
              onChange={(event) => setDraft({ ...draft, dividendAccrual: event.target.value })}
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {Object.entries(ACCRUALS()).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="share-class-day-count">{t`Day count`}</FieldLabel>
            <NativeSelect
              id="share-class-day-count"
              value={draft.dayCountConvention}
              onChange={(event) => setDraft({ ...draft, dayCountConvention: event.target.value })}
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {Object.entries(DAY_COUNTS).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t`Cancel`}
        </Button>
        <Button type="submit">{t`Review`}</Button>
      </div>
    </form>
  );
}
