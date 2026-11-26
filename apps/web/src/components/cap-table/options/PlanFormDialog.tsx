import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type { EquityPlan } from "@rakazo/contracts";
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
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

const figure = (value: string) => new Intl.NumberFormat(i18n.locale || "en").format(BigInt(value));

/** Add or edit an equity plan, with a review step before it saves. */
export function PlanFormDialog({
  plan,
  onClose,
  onSaved,
}: {
  /** The plan to edit; absent to add one. */
  plan?: EquityPlan;
  onClose: () => void;
  onSaved: (plan: EquityPlan) => void;
}) {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState(plan?.name ?? "");
  const [shareClassId, setShareClassId] = useState(plan?.shareClassId ?? "");
  const [reserved, setReserved] = useState(plan?.reservedShares ?? "");
  const [approvedOn, setApprovedOn] = useState(plan?.boardApprovedOn ?? "");
  const [status, setStatus] = useState(plan?.status ?? "active");
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    rpc.equity.shareClasses
      .list({ pageSize: 100 })
      .then((page) => {
        if (!live) return;
        setClasses(page.items.map((item) => ({ id: item.id, name: item.name })));
        setShareClassId((current) => current || page.items[0]?.id || "");
      })
      .catch((caught: unknown) => live && setError(errorText(caught)));
    return () => {
      live = false;
    };
  }, []);

  const reservedValid = /^\d+$/.test(reserved);
  const valid = name.trim() !== "" && shareClassId !== "" && reservedValid;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const fields = {
        name: name.trim(),
        shareClassId,
        reservedShares: reserved,
        boardApprovedOn: approvedOn || null,
      };
      const saved = plan
        ? await rpc.equity.plans.update({ id: plan.id, ...fields, status })
        : await rpc.equity.plans.create(fields);
      onSaved(saved);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const className = classes.find((item) => item.id === shareClassId)?.name ?? "";
  const review: [string, string][] = [
    [t`Plan name`, name.trim()],
    [t`Share class`, className],
    [t`Reserved shares`, reservedValid ? figure(reserved) : reserved],
    ...(approvedOn ? ([[t`Board approval`, approvedOn]] as [string, string][]) : []),
    ...(plan
      ? ([[t`Status`, status === "active" ? t`Active` : t`Inactive`]] as [string, string][])
      : []),
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? t`Edit plan` : t`Add plan`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {reviewing ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {review.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="plan-name">{t`Plan name`}</FieldLabel>
                <Input
                  id="plan-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="plan-class">{t`Share class`}</FieldLabel>
                <NativeSelect
                  id="plan-class"
                  value={shareClassId}
                  onChange={(event) => setShareClassId(event.target.value)}
                >
                  {classes.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={(reserved !== "" && !reservedValid) || undefined}>
                <FieldLabel htmlFor="plan-reserved">{t`Reserved shares`}</FieldLabel>
                <Input
                  id="plan-reserved"
                  inputMode="numeric"
                  value={reserved}
                  onChange={(event) => setReserved(event.target.value.trim())}
                />
                {reserved !== "" && !reservedValid && (
                  <FieldError>{t`Enter a whole number of shares`}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="plan-approved">{t`Board approval`}</FieldLabel>
                <Input
                  id="plan-approved"
                  type="date"
                  value={approvedOn}
                  onChange={(event) => setApprovedOn(event.target.value)}
                />
              </Field>
              {plan && (
                <Field>
                  <FieldLabel htmlFor="plan-status">{t`Status`}</FieldLabel>
                  <NativeSelect
                    id="plan-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as EquityPlan["status"])}
                  >
                    <NativeSelectOption value="active">{t`Active`}</NativeSelectOption>
                    <NativeSelectOption value="inactive">{t`Inactive`}</NativeSelectOption>
                  </NativeSelect>
                </Field>
              )}
            </div>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={reviewing ? () => setReviewing(false) : onClose}
            disabled={busy}
          >
            {reviewing ? t`Back` : t`Cancel`}
          </Button>
          {reviewing ? (
            <Button onClick={() => void save()} disabled={busy}>
              {t`Save`}
            </Button>
          ) : (
            <Button onClick={() => setReviewing(true)} disabled={!valid}>
              {t`Review`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
