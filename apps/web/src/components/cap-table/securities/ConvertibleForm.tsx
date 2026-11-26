import { t } from "@lingui/core/macro";
import type {
  EquityConvertible,
  EquityConvertibleBlock,
  EquityConvertibleCreateInput,
  EquityConvertibleUpdateInput,
  EquityStakeholder,
} from "@rakazo/contracts";
import { EQUITY_MODIFICATION_REASONS, EQUITY_REASON_LABELS } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { ConcealedAmountInput } from "../ConcealedAmountInput";
import { centsToDollars, dollarsToCents } from "../views/money";
import { formatCents, formatDay } from "./format";

const NEW_TERMS = "__new";
const PERCENT = /^\d{1,4}(\.\d{1,4})?$/;

export type ConvertibleFormValues = {
  stakeholderId: string;
  kind: "safe" | "note";
  blockId: string;
  newBlockName: string;
  amount: string;
  issueDate: string;
  valuationCap: string;
  valuationCapType: "pre_money" | "post_money";
  discount: string;
  mfn: boolean;
  proRata: boolean;
  interestRate: string;
  interestStartDate: string;
  interestType: "simple" | "compound";
  maturityDate: string;
  reason: (typeof EQUITY_MODIFICATION_REASONS)[number];
};

function initialForm(convertible: EquityConvertible | null): ConvertibleFormValues {
  return {
    stakeholderId: convertible?.stakeholderId ?? "",
    kind: convertible?.kind ?? "safe",
    blockId: convertible?.blockId ?? "",
    newBlockName: "",
    amount: convertible ? centsToDollars(convertible.principalCents) : "",
    issueDate: convertible?.issueDate ?? today(),
    valuationCap: convertible ? centsToDollars(convertible.valuationCapCents) : "",
    valuationCapType: convertible?.valuationCapType ?? "post_money",
    discount: convertible?.discountPercent ?? "",
    mfn: convertible?.mfn ?? false,
    proRata: convertible?.proRata ?? false,
    interestRate: convertible?.interestRate ?? "",
    interestStartDate: convertible?.interestStartDate ?? "",
    interestType: convertible?.interestType ?? "simple",
    maturityDate: convertible?.maturityDate ?? "",
    reason: "clerical_error",
  };
}

/**
 * The create input for a form, or the message to show. Terms chosen as "New terms…" are validated
 * here but resolved by the caller, which creates the block first and adds its id.
 */
export function convertibleInput(
  form: ConvertibleFormValues,
): EquityConvertibleCreateInput | string {
  if (!form.stakeholderId) return t`Choose a stakeholder`;
  if (form.blockId === NEW_TERMS && !form.newBlockName.trim())
    return t`Enter a name for the new terms`;
  const principalCents = dollarsToCents(form.amount);
  if (!principalCents || BigInt(principalCents) === 0n) return t`Enter the amount in dollars`;
  if (!form.issueDate) return t`Choose an issue date`;
  const input: EquityConvertibleCreateInput = {
    stakeholderId: form.stakeholderId,
    kind: form.kind,
    principalCents,
    issueDate: form.issueDate,
    mfn: form.mfn,
    proRata: form.proRata,
  };
  if (form.blockId && form.blockId !== NEW_TERMS) input.blockId = form.blockId;
  if (form.valuationCap) {
    const valuationCapCents = dollarsToCents(form.valuationCap);
    if (!valuationCapCents) return t`Enter the valuation cap in dollars`;
    input.valuationCapCents = valuationCapCents;
    input.valuationCapType = form.valuationCapType;
  }
  if (form.discount) {
    if (!PERCENT.test(form.discount)) return t`Enter the discount as a percent`;
    input.discountPercent = form.discount;
  }
  if (form.kind === "note") {
    if (form.interestRate) {
      if (!PERCENT.test(form.interestRate)) return t`Enter the interest rate as a percent`;
      input.interestRate = form.interestRate;
    }
    if (form.interestStartDate) input.interestStartDate = form.interestStartDate;
    input.interestType = form.interestType;
    if (form.maturityDate) input.maturityDate = form.maturityDate;
  }
  return input;
}

/** The fields the form actually changed, for a modify transaction on the record. */
function changedFields(
  original: EquityConvertible,
  input: EquityConvertibleCreateInput,
): EquityConvertibleUpdateInput {
  const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => !same(original[key as keyof EquityConvertible], value),
    ),
  ) as EquityConvertibleUpdateInput;
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </>
  );
}

/** Create one SAFE or note, or edit its terms: the form, then a review, then the save. */
export function ConvertibleForm({
  convertible = null,
  onOpenChange,
  onSaved,
}: {
  convertible: EquityConvertible | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const hidden = useHideAmounts();
  const editing = convertible !== null;
  const [form, setForm] = useState<ConvertibleFormValues>(() => initialForm(convertible));
  // One key per dialog open for each create, so a retry after a failure or a lost response
  // reuses the new terms and the convertible instead of making a second of either.
  const keys = useRef({ terms: crypto.randomUUID(), convertible: crypto.randomUUID() });
  const [step, setStep] = useState<"form" | "review">("form");
  const [stakeholders, setStakeholders] = useState<EquityStakeholder[]>([]);
  const [blocks, setBlocks] = useState<EquityConvertibleBlock[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ConvertibleFormValues>) =>
    setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    rpc.equity.stakeholders
      .list({ pageSize: 500 })
      .then((page) => setStakeholders(page.items))
      .catch((cause: unknown) => setError(errorText(cause)));
    rpc.equity.convertibleBlocks
      .list()
      .then((items) => setBlocks(items))
      .catch((cause: unknown) => setError(errorText(cause)));
  }, []);

  const title = editing ? t`Edit ${convertible.label}` : t`New convertible`;

  const review = () => {
    const problem = convertibleInput(form);
    if (typeof problem === "string") return setError(problem);
    setError("");
    setStep("review");
  };

  const save = async () => {
    const input = convertibleInput(form);
    if (typeof input === "string") return setError(input);
    setSaving(true);
    setError("");
    try {
      if (form.blockId === NEW_TERMS) {
        const block = await rpc.equity.convertibleBlocks.create({
          name: form.newBlockName.trim(),
          kind: form.kind,
          requestKey: keys.current.terms,
        });
        input.blockId = block.id;
      }
      if (editing) {
        await rpc.equity.convertibles.update({
          ...changedFields(convertible, input),
          id: convertible.id,
          reason: form.reason,
        });
      } else {
        await rpc.equity.convertibles.create({ ...input, requestKey: keys.current.convertible });
      }
      onSaved();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const termsName = (id: string) => blocks.find((block) => block.id === id)?.name ?? "";
  const input = convertibleInput(form);
  const stakeholder = stakeholders.find((item) => item.id === form.stakeholderId)?.name ?? "";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === "review" ? t`Review` : title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {step === "review" && typeof input !== "string" ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <ReviewRow label={t`Stakeholder`} value={stakeholder} />
              <ReviewRow label={t`Kind`} value={form.kind === "note" ? t`Note` : t`SAFE`} />
              <ReviewRow
                label={t`Terms`}
                value={
                  form.blockId === NEW_TERMS
                    ? form.newBlockName.trim()
                    : form.blockId
                      ? termsName(form.blockId)
                      : t`None`
                }
              />
              <ReviewRow label={t`Amount`} value={formatCents(input.principalCents, hidden)} />
              <ReviewRow label={t`Issue date`} value={formatDay(form.issueDate)} />
              {input.valuationCapCents ? (
                <ReviewRow
                  label={t`Valuation cap`}
                  value={`${formatCents(input.valuationCapCents, hidden)} (${
                    form.valuationCapType === "pre_money" ? t`pre-money` : t`post-money`
                  })`}
                />
              ) : null}
              {input.discountPercent ? (
                <ReviewRow label={t`Discount`} value={`${input.discountPercent}%`} />
              ) : null}
              {form.mfn ? <ReviewRow label={t`MFN`} value={t`Yes`} /> : null}
              {form.proRata ? <ReviewRow label={t`Pro rata`} value={t`Yes`} /> : null}
              {form.kind === "note" ? (
                <>
                  {form.interestRate ? (
                    <ReviewRow label={t`Interest rate`} value={`${form.interestRate}%`} />
                  ) : null}
                  {form.interestStartDate ? (
                    <ReviewRow
                      label={t`Interest start`}
                      value={formatDay(form.interestStartDate)}
                    />
                  ) : null}
                  <ReviewRow
                    label={t`Interest type`}
                    value={form.interestType === "compound" ? t`Compound` : t`Simple`}
                  />
                  {form.maturityDate ? (
                    <ReviewRow label={t`Maturity date`} value={formatDay(form.maturityDate)} />
                  ) : null}
                </>
              ) : null}
              {editing ? (
                <ReviewRow
                  label={t`Reason`}
                  value={EQUITY_REASON_LABELS[form.reason] ?? form.reason}
                />
              ) : null}
            </dl>
          ) : (
            <div className="flex flex-col gap-3">
              <Field label={t`Stakeholder`} id="convertible-stakeholder">
                <NativeSelect
                  id="convertible-stakeholder"
                  value={form.stakeholderId}
                  onChange={(event) => set({ stakeholderId: event.target.value })}
                >
                  <NativeSelectOption value="">{t`Choose a stakeholder`}</NativeSelectOption>
                  {stakeholders.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t`Kind`} id="convertible-kind">
                <NativeSelect
                  id="convertible-kind"
                  value={form.kind}
                  onChange={(event) => set({ kind: event.target.value as "safe" | "note" })}
                >
                  <NativeSelectOption value="safe">{t`SAFE`}</NativeSelectOption>
                  <NativeSelectOption value="note">{t`Note`}</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field label={t`Terms`} id="convertible-block">
                <NativeSelect
                  id="convertible-block"
                  value={form.blockId}
                  onChange={(event) => set({ blockId: event.target.value })}
                >
                  <NativeSelectOption value="">{t`None`}</NativeSelectOption>
                  {blocks.map((block) => (
                    <NativeSelectOption key={block.id} value={block.id}>
                      {block.name}
                    </NativeSelectOption>
                  ))}
                  <NativeSelectOption value={NEW_TERMS}>{t`New terms…`}</NativeSelectOption>
                </NativeSelect>
              </Field>
              {form.blockId === NEW_TERMS ? (
                <Field label={t`Terms name`} id="convertible-block-name">
                  <Input
                    id="convertible-block-name"
                    value={form.newBlockName}
                    onChange={(event) => set({ newBlockName: event.target.value })}
                  />
                </Field>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t`Amount ($)`} id="convertible-amount">
                  <ConcealedAmountInput
                    id="convertible-amount"
                    scopeKey={`${convertible?.id ?? "new"}:principal`}
                    stored={convertible != null}
                    fieldLabel={t`Amount ($)`}
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(amount) => set({ amount })}
                  />
                </Field>
                <Field label={t`Issue date`} id="convertible-issue-date">
                  <Input
                    id="convertible-issue-date"
                    type="date"
                    value={form.issueDate}
                    onChange={(event) => set({ issueDate: event.target.value })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t`Valuation cap ($) — optional`} id="convertible-cap">
                  <ConcealedAmountInput
                    id="convertible-cap"
                    scopeKey={`${convertible?.id ?? "new"}:valuation-cap`}
                    stored={Boolean(convertible?.valuationCapCents)}
                    fieldLabel={t`Valuation cap ($) — optional`}
                    inputMode="decimal"
                    value={form.valuationCap}
                    onChange={(valuationCap) => set({ valuationCap })}
                  />
                </Field>
                <Field label={t`Cap type`} id="convertible-cap-type">
                  <NativeSelect
                    id="convertible-cap-type"
                    value={form.valuationCapType}
                    onChange={(event) =>
                      set({ valuationCapType: event.target.value as "pre_money" | "post_money" })
                    }
                  >
                    <NativeSelectOption value="post_money">{t`Post-money`}</NativeSelectOption>
                    <NativeSelectOption value="pre_money">{t`Pre-money`}</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>
              <Field label={t`Discount (%) — optional`} id="convertible-discount">
                <Input
                  id="convertible-discount"
                  inputMode="decimal"
                  value={form.discount}
                  onChange={(event) => set({ discount: event.target.value })}
                />
              </Field>
              <div className="flex gap-6">
                <Checkbox
                  id="convertible-mfn"
                  checked={form.mfn}
                  onCheckedChange={(on) => set({ mfn: on === true })}
                />
                <Label htmlFor="convertible-mfn">{t`MFN`}</Label>
                <Checkbox
                  id="convertible-pro-rata"
                  checked={form.proRata}
                  onCheckedChange={(on) => set({ proRata: on === true })}
                />
                <Label htmlFor="convertible-pro-rata">{t`Pro rata`}</Label>
              </div>
              {form.kind === "note" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t`Interest rate (%)`} id="convertible-interest-rate">
                      <Input
                        id="convertible-interest-rate"
                        inputMode="decimal"
                        value={form.interestRate}
                        onChange={(event) => set({ interestRate: event.target.value })}
                      />
                    </Field>
                    <Field label={t`Interest start date`} id="convertible-interest-start">
                      <Input
                        id="convertible-interest-start"
                        type="date"
                        value={form.interestStartDate}
                        onChange={(event) => set({ interestStartDate: event.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t`Interest type`} id="convertible-interest-type">
                      <NativeSelect
                        id="convertible-interest-type"
                        value={form.interestType}
                        onChange={(event) =>
                          set({ interestType: event.target.value as "simple" | "compound" })
                        }
                      >
                        <NativeSelectOption value="simple">{t`Simple`}</NativeSelectOption>
                        <NativeSelectOption value="compound">{t`Compound`}</NativeSelectOption>
                      </NativeSelect>
                    </Field>
                    <Field label={t`Maturity date`} id="convertible-maturity">
                      <Input
                        id="convertible-maturity"
                        type="date"
                        value={form.maturityDate}
                        onChange={(event) => set({ maturityDate: event.target.value })}
                      />
                    </Field>
                  </div>
                </>
              ) : null}
              {editing ? (
                <Field label={t`Reason`} id="convertible-reason">
                  <NativeSelect
                    id="convertible-reason"
                    value={form.reason}
                    onChange={(event) =>
                      set({ reason: event.target.value as ConvertibleFormValues["reason"] })
                    }
                  >
                    {EQUITY_MODIFICATION_REASONS.map((reason) => (
                      <NativeSelectOption key={reason} value={reason}>
                        {EQUITY_REASON_LABELS[reason]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => (step === "review" ? setStep("form") : onOpenChange(false))}
          >
            {step === "review" ? t`Back` : t`Close`}
          </Button>
          <Button disabled={saving} onClick={step === "review" ? save : review}>
            {step === "review" ? t`Save` : t`Review`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
