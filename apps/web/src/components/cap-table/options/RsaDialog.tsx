import { t } from "@lingui/core/macro";
import type { EquityCertificate } from "@rakazo/contracts";
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
import { useEffect, useRef, useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay, formatPrice, formatShares } from "./format";

type Option = { id: string; name: string };
type DialogState = { mode: "issue" } | { mode: "cancel"; certificate: EquityCertificate };

const day = (value: string) => (value ? formatDay(value) : "");

/** Issue a restricted stock award under a plan, or cancel an outstanding one. Both review first. */
export function RsaDialog({
  mode,
  certificate,
  plans,
  onClose,
  onDone,
}: {
  mode: DialogState["mode"];
  certificate?: EquityCertificate;
  plans: Option[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [holders, setHolders] = useState<Option[]>([]);
  const [stakeholderId, setStakeholderId] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today());
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  // One key per dialog open, so a retry after a lost response issues the RSA once.
  const requestKey = useRef(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const issuing = mode === "issue";

  useEffect(() => {
    if (!issuing) return;
    let live = true;
    rpc.equity.stakeholders
      .list({ pageSize: 500 })
      .then((page) => {
        if (!live) return;
        const options = page.items.map((item) => ({ id: item.id, name: item.name }));
        setHolders(options);
        setStakeholderId((current) => current || options[0]?.id || "");
      })
      .catch((caught: unknown) => live && setError(errorText(caught)));
    return () => {
      live = false;
    };
  }, [issuing]);

  const quantityValid = /^[1-9]\d*$/.test(quantity);
  const priceValid = /^\d+(\.\d{1,10})?$/.test(price);
  const valid = issuing
    ? stakeholderId !== "" && planId !== "" && quantityValid && priceValid
    : date !== "";

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      if (issuing) {
        const plan = await rpc.equity.plans.get({ id: planId });
        await rpc.equity.certificates.create({
          requestKey: requestKey.current,
          stakeholderId,
          planId,
          shareClassId: plan.shareClassId,
          quantity,
          pricePerShare: price,
          issueDate: date,
        });
      } else if (certificate) {
        await rpc.equity.certificates.update({
          id: certificate.id,
          status: "canceled",
          canceledOn: date,
          reason: "amendment",
        });
      }
      onDone();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (list: Option[], id: string) => list.find((item) => item.id === id)?.name ?? "";
  const review: [string, string][] = issuing
    ? [
        [t`Holder`, nameOf(holders, stakeholderId)],
        [t`Plan`, nameOf(plans, planId)],
        [t`Quantity`, quantityValid ? formatShares(quantity) : quantity],
        [t`Price per share`, priceValid ? formatPrice(price) : price],
        [t`Issue date`, day(date)],
      ]
    : [
        [t`Security`, certificate?.label ?? ""],
        [t`Holder`, certificate?.stakeholderName ?? ""],
        [t`Canceled on`, day(date)],
      ];

  const select = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: Option[],
  ) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>
            {item.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{issuing ? t`Issue RSA` : t`Cancel RSA`}</DialogTitle>
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
              {issuing ? (
                <>
                  {select("rsa-holder", t`Holder`, stakeholderId, setStakeholderId, holders)}
                  {select("rsa-plan", t`Plan`, planId, setPlanId, plans)}
                  <Field data-invalid={(quantity !== "" && !quantityValid) || undefined}>
                    <FieldLabel htmlFor="rsa-quantity">{t`Quantity`}</FieldLabel>
                    <Input
                      id="rsa-quantity"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value.trim())}
                    />
                    {quantity !== "" && !quantityValid && (
                      <FieldError>{t`Enter a whole number of shares`}</FieldError>
                    )}
                  </Field>
                  <Field data-invalid={(price !== "" && !priceValid) || undefined}>
                    <FieldLabel htmlFor="rsa-price">{t`Price per share`}</FieldLabel>
                    <Input
                      id="rsa-price"
                      inputMode="decimal"
                      value={price}
                      onChange={(event) => setPrice(event.target.value.trim())}
                    />
                    {price !== "" && !priceValid && (
                      <FieldError>{t`Enter an amount, e.g. 0.001`}</FieldError>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rsa-date">{t`Issue date`}</FieldLabel>
                    <Input
                      id="rsa-date"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </Field>
                </>
              ) : (
                <Field>
                  <FieldLabel htmlFor="rsa-canceled-on">{t`Canceled on`}</FieldLabel>
                  <Input
                    id="rsa-canceled-on"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>
              )}
            </div>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t`Cancel`}
          </Button>
          {reviewing ? (
            <Button onClick={() => void commit()} disabled={busy}>
              {t`Confirm`}
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
