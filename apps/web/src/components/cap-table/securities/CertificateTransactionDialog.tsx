import { t } from "@lingui/core/macro";
import type { EquityCertificate, EquityShareClass, EquityStakeholder } from "@rakazo/contracts";
import {
  EQUITY_CANCELLATION_REASONS,
  EQUITY_MODIFICATION_REASONS,
  EQUITY_REASON_LABELS,
  EQUITY_REPURCHASE_REASONS,
  EQUITY_TRANSFER_REASONS,
} from "@rakazo/contracts";
import {
  Button,
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
  Textarea,
} from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay, formatPrice, formatShares } from "./format";

export type CertificateTransaction = "transfer" | "modify" | "repurchase" | "cancel" | "convert";

const NEW_STAKEHOLDER = "__new";
const SHARES = /^\d+$/;
const DECIMAL = /^\d{1,14}(\.\d{1,10})?$/;

type Form = {
  toStakeholderId: string;
  newStakeholderName: string;
  toShareClassId: string;
  quantity: string;
  effectiveDate: string;
  reason: string;
  pricePerShare: string;
  ratio: string;
  note: string;
};

function reasons(action: CertificateTransaction): readonly string[] {
  if (action === "transfer") return EQUITY_TRANSFER_REASONS;
  if (action === "repurchase") return EQUITY_REPURCHASE_REASONS;
  if (action === "cancel") return EQUITY_CANCELLATION_REASONS;
  if (action === "modify") return EQUITY_MODIFICATION_REASONS;
  return [];
}

export function transactionForm(
  action: CertificateTransaction,
  certificate: EquityCertificate,
): Form {
  return {
    toStakeholderId: "",
    newStakeholderName: "",
    toShareClassId: "",
    quantity: certificate.quantity,
    effectiveDate: action === "modify" ? certificate.issueDate : today(),
    reason: "",
    pricePerShare: action === "modify" ? (certificate.pricePerShare ?? "") : "",
    ratio: "1",
    note: "",
  };
}

/** What is wrong with the form, or null when it can go to review. */
export function transactionProblem(
  action: CertificateTransaction,
  certificate: EquityCertificate,
  form: Form,
): string | null {
  if (!SHARES.test(form.quantity) || BigInt(form.quantity) === 0n)
    return t`Enter a whole number of shares`;
  if (action !== "modify" && BigInt(form.quantity) > BigInt(certificate.quantity))
    return t`The certificate holds ${formatShares(certificate.quantity)} shares`;
  if (!form.effectiveDate) return t`Choose a date`;
  if (form.pricePerShare && !DECIMAL.test(form.pricePerShare)) return t`Enter a price like 1.25`;
  if (action === "transfer") {
    if (!form.toStakeholderId) return t`Choose who receives the shares`;
    if (form.toStakeholderId === NEW_STAKEHOLDER && !form.newStakeholderName.trim())
      return t`Enter a name`;
  }
  if (action === "convert") {
    if (!form.toShareClassId) return t`Choose a share class`;
    if (!DECIMAL.test(form.ratio) || !/[1-9]/.test(form.ratio))
      return t`Enter a ratio like 1 or 0.5`;
  }
  if (reasons(action).length && !form.reason) return t`Choose a reason`;
  return null;
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** One share transaction on a certificate: the form, then a review, then the commit. */
export function CertificateTransactionDialog({
  action,
  certificate,
  onOpenChange,
  onDone,
}: {
  action: CertificateTransaction;
  certificate: EquityCertificate;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<Form>(() => transactionForm(action, certificate));
  const [step, setStep] = useState<"form" | "review">("form");
  const [stakeholders, setStakeholders] = useState<EquityStakeholder[]>([]);
  const [classes, setClasses] = useState<EquityShareClass[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // One key per dialog open for the new stakeholder and the transfer, so a retry after a
  // failure or a lost response adds that stakeholder once and moves the shares once.
  const keys = useRef({ stakeholder: crypto.randomUUID(), transfer: crypto.randomUUID() });
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (action === "transfer")
      rpc.equity.stakeholders
        .list({ pageSize: 500 })
        .then((page) =>
          setStakeholders(page.items.filter((item) => item.id !== certificate.stakeholderId)),
        )
        .catch((cause: unknown) => setError(errorText(cause)));
    if (action === "convert")
      rpc.equity.shareClasses
        .list({ pageSize: 500 })
        .then((page) =>
          setClasses(page.items.filter((item) => item.id !== certificate.shareClassId)),
        )
        .catch((cause: unknown) => setError(errorText(cause)));
  }, [action, certificate.stakeholderId, certificate.shareClassId]);

  const title = {
    transfer: t`Transfer ${certificate.label}`,
    modify: t`Modify ${certificate.label}`,
    repurchase: t`Repurchase ${certificate.label}`,
    cancel: t`Cancel ${certificate.label}`,
    convert: t`Convert ${certificate.label}`,
  }[action];
  const problem = transactionProblem(action, certificate, form);
  const price = form.pricePerShare || undefined;
  const note = form.note.trim() || undefined;

  const commit = async () => {
    setSaving(true);
    setError("");
    try {
      const base = {
        certificateId: certificate.id,
        quantity: form.quantity,
        effectiveDate: form.effectiveDate,
        note,
      };
      if (action === "transfer") {
        const toStakeholderId =
          form.toStakeholderId === NEW_STAKEHOLDER
            ? (
                await rpc.equity.stakeholders.create({
                  type: "individual",
                  name: form.newStakeholderName.trim(),
                  requestKey: keys.current.stakeholder,
                })
              ).id
            : form.toStakeholderId;
        await rpc.equity.shareTransactions.transfer({
          ...base,
          requestKey: keys.current.transfer,
          toStakeholderId,
          reason: form.reason as (typeof EQUITY_TRANSFER_REASONS)[number],
          pricePerShare: price,
        });
      } else if (action === "repurchase") {
        await rpc.equity.shareTransactions.repurchase({
          ...base,
          reason: form.reason as (typeof EQUITY_REPURCHASE_REASONS)[number],
          pricePerShare: price,
        });
      } else if (action === "cancel") {
        await rpc.equity.shareTransactions.cancel({
          ...base,
          reason: form.reason as (typeof EQUITY_CANCELLATION_REASONS)[number],
        });
      } else if (action === "convert") {
        await rpc.equity.shareTransactions.convert({
          certificateId: certificate.id,
          toShareClassId: form.toShareClassId,
          ratio: form.ratio,
          effectiveDate: form.effectiveDate,
          note,
        });
      } else {
        await rpc.equity.certificates.update({
          id: certificate.id,
          quantity: form.quantity,
          issueDate: form.effectiveDate,
          pricePerShare: price ?? null,
          reason: form.reason as (typeof EQUITY_MODIFICATION_REASONS)[number],
          note,
        });
      }
      onDone();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const recipient =
    form.toStakeholderId === NEW_STAKEHOLDER
      ? form.newStakeholderName.trim()
      : stakeholders.find((item) => item.id === form.toStakeholderId)?.name;
  const remainder =
    BigInt(certificate.quantity) - (SHARES.test(form.quantity) ? BigInt(form.quantity) : 0n);
  const review: [string, string][] = [
    [t`Certificate`, `${certificate.label} · ${certificate.stakeholderName}`],
    ...(action === "transfer" ? ([[t`To`, recipient ?? ""]] as [string, string][]) : []),
    ...(action === "convert"
      ? ([
          [t`To class`, classes.find((item) => item.id === form.toShareClassId)?.name ?? ""],
          [t`Ratio`, form.ratio],
        ] as [string, string][])
      : ([[t`Shares`, SHARES.test(form.quantity) ? formatShares(form.quantity) : ""]] as [
          string,
          string,
        ][])),
    ...(action !== "modify" && action !== "convert" && remainder > 0n
      ? ([[t`Remaining with holder`, formatShares(remainder.toString())]] as [string, string][])
      : []),
    [action === "modify" ? t`Issue date` : t`Effective date`, formatDay(form.effectiveDate)],
    ...(form.reason
      ? ([[t`Reason`, EQUITY_REASON_LABELS[form.reason] ?? form.reason]] as [string, string][])
      : []),
    ...(price ? ([[t`Price per share`, formatPrice(price)]] as [string, string][]) : []),
  ];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === "review" ? t`Review` : title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {step === "review" ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {review.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="flex flex-col gap-3">
              {action === "transfer" ? (
                <Field label={t`To`} id="tx-to">
                  <NativeSelect
                    id="tx-to"
                    value={form.toStakeholderId}
                    onChange={(event) => set({ toStakeholderId: event.target.value })}
                  >
                    <NativeSelectOption value="">{t`Choose a stakeholder`}</NativeSelectOption>
                    {stakeholders.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.name}
                      </NativeSelectOption>
                    ))}
                    <NativeSelectOption
                      value={NEW_STAKEHOLDER}
                    >{t`New stakeholder…`}</NativeSelectOption>
                  </NativeSelect>
                </Field>
              ) : null}
              {form.toStakeholderId === NEW_STAKEHOLDER ? (
                <Field label={t`Name`} id="tx-new-name">
                  <Input
                    id="tx-new-name"
                    value={form.newStakeholderName}
                    onChange={(event) => set({ newStakeholderName: event.target.value })}
                  />
                </Field>
              ) : null}
              {action === "convert" ? (
                <>
                  <Field label={t`To class`} id="tx-class">
                    <NativeSelect
                      id="tx-class"
                      value={form.toShareClassId}
                      onChange={(event) => set({ toShareClassId: event.target.value })}
                    >
                      <NativeSelectOption value="">{t`Choose a share class`}</NativeSelectOption>
                      {classes.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label={t`New shares per share`} id="tx-ratio">
                    <Input
                      id="tx-ratio"
                      inputMode="decimal"
                      value={form.ratio}
                      onChange={(event) => set({ ratio: event.target.value })}
                    />
                  </Field>
                </>
              ) : (
                <Field label={t`Shares`} id="tx-quantity">
                  <Input
                    id="tx-quantity"
                    inputMode="numeric"
                    value={form.quantity}
                    onChange={(event) =>
                      set({ quantity: event.target.value.replace(/[,\s]/g, "") })
                    }
                  />
                </Field>
              )}
              <Field label={action === "modify" ? t`Issue date` : t`Effective date`} id="tx-date">
                <Input
                  id="tx-date"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(event) => set({ effectiveDate: event.target.value })}
                />
              </Field>
              {reasons(action).length ? (
                <Field label={t`Reason`} id="tx-reason">
                  <NativeSelect
                    id="tx-reason"
                    value={form.reason}
                    onChange={(event) => set({ reason: event.target.value })}
                  >
                    <NativeSelectOption value="">{t`Choose a reason`}</NativeSelectOption>
                    {reasons(action).map((reason) => (
                      <NativeSelectOption key={reason} value={reason}>
                        {EQUITY_REASON_LABELS[reason] ?? reason}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
              {action === "transfer" || action === "repurchase" || action === "modify" ? (
                <Field label={t`Price per share`} id="tx-price">
                  <Input
                    id="tx-price"
                    inputMode="decimal"
                    value={form.pricePerShare}
                    onChange={(event) =>
                      set({ pricePerShare: event.target.value.replace(/^\$/, "") })
                    }
                  />
                </Field>
              ) : null}
              <Field label={t`Note`} id="tx-note">
                <Textarea
                  id="tx-note"
                  rows={2}
                  value={form.note}
                  onChange={(event) => set({ note: event.target.value })}
                />
              </Field>
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {step === "review" ? (
            <>
              <Button variant="outline" onClick={() => setStep("form")} disabled={saving}>
                {t`Back`}
              </Button>
              <Button
                variant={action === "cancel" ? "destructive" : "default"}
                onClick={() => void commit()}
                disabled={saving}
              >
                {t`Confirm`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t`Close`}
              </Button>
              <Button
                onClick={() => {
                  if (problem) setError(problem);
                  else {
                    setError("");
                    setStep("review");
                  }
                }}
              >
                {t`Review`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
