import { t } from "@lingui/core/macro";
import type { EquityWarrant } from "@rakazo/contracts";
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
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay, formatPrice, formatShares } from "./format";

type Option = { id: string; name: string };

const day = (value: string) => (value ? formatDay(value) : "");
const price = (value: string, hidden: boolean) => (value ? formatPrice(value, hidden) : "");

/**
 * "Issue warrant" for a new warrant, or "Cancel warrant" for one already outstanding. Both show a
 * review step before anything is sent, and the server's refusal is shown in the dialog.
 */
export function WarrantDialog({
  mode,
  warrant,
  onClose,
  onSaved,
}: {
  mode: "issue" | "cancel";
  /** The warrant to cancel; required in cancel mode. */
  warrant?: EquityWarrant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const hidden = useHideAmounts();
  const [holders, setHolders] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [stakeholderId, setStakeholderId] = useState("");
  const [shareClassId, setShareClassId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [exercisePrice, setExercisePrice] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [expirationDate, setExpirationDate] = useState("");
  const [canceledOn, setCanceledOn] = useState(today());
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  // One key per dialog open, so a retry after a lost response issues the warrant once.
  const requestKey = useRef(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "issue") return;
    let live = true;
    Promise.all([
      rpc.equity.stakeholders.list({ pageSize: 500 }),
      rpc.equity.shareClasses.list({ pageSize: 100 }),
    ])
      .then(([holderPage, classPage]) => {
        if (!live) return;
        setHolders(holderPage.items.map((item) => ({ id: item.id, name: item.name })));
        setClasses(classPage.items.map((item) => ({ id: item.id, name: item.name })));
        setStakeholderId((current) => current || holderPage.items[0]?.id || "");
        setShareClassId((current) => current || classPage.items[0]?.id || "");
      })
      .catch((caught: unknown) => live && setError(errorText(caught)));
    return () => {
      live = false;
    };
  }, [mode]);

  const quantityValid = /^[1-9]\d*$/.test(quantity);
  const priceValid = /^\d+(\.\d{1,10})?$/.test(exercisePrice);
  const valid =
    mode === "cancel"
      ? canceledOn !== ""
      : stakeholderId !== "" && shareClassId !== "" && quantityValid && priceValid;

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "cancel") {
        await rpc.equity.warrants.cancel({ id: warrant?.id ?? "", canceledOn });
      } else {
        await rpc.equity.warrants.create({
          requestKey: requestKey.current,
          stakeholderId,
          shareClassId,
          quantity,
          exercisePrice,
          issueDate,
          expirationDate: expirationDate || null,
        });
      }
      onSaved();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (list: Option[], id: string) => list.find((item) => item.id === id)?.name ?? "";
  const review: [string, string][] =
    mode === "cancel"
      ? [
          [t`Security`, warrant?.label ?? ""],
          [t`Holder`, warrant?.stakeholderName ?? ""],
          [t`Quantity`, warrant ? formatShares(warrant.quantity) : ""],
          [t`Cancellation date`, day(canceledOn)],
        ]
      : [
          [t`Holder`, nameOf(holders, stakeholderId)],
          [t`Class`, nameOf(classes, shareClassId)],
          [t`Quantity`, quantityValid ? formatShares(quantity) : quantity],
          [t`Exercise price`, priceValid ? price(exercisePrice, hidden) : exercisePrice],
          [t`Issue date`, day(issueDate)],
          [t`Expiration`, expirationDate ? day(expirationDate) : t`None`],
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
          <DialogTitle>{mode === "cancel" ? t`Cancel warrant` : t`Issue warrant`}</DialogTitle>
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
          ) : mode === "cancel" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t`Canceling ${warrant?.label ?? ""} (${formatShares(warrant?.quantity ?? "0")}) leaves the warrant in the ledger, marked canceled.`}
              </p>
              <Field>
                <FieldLabel htmlFor="warrant-canceled-on">{t`Cancellation date`}</FieldLabel>
                <Input
                  id="warrant-canceled-on"
                  type="date"
                  value={canceledOn}
                  onChange={(event) => setCanceledOn(event.target.value)}
                />
              </Field>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {select("warrant-holder", t`Holder`, stakeholderId, setStakeholderId, holders)}
              {select("warrant-class", t`Class`, shareClassId, setShareClassId, classes)}
              <Field data-invalid={(quantity !== "" && !quantityValid) || undefined}>
                <FieldLabel htmlFor="warrant-quantity">{t`Quantity`}</FieldLabel>
                <Input
                  id="warrant-quantity"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value.trim())}
                />
                {quantity !== "" && !quantityValid && (
                  <FieldError>{t`Enter a whole number of shares`}</FieldError>
                )}
              </Field>
              <Field data-invalid={(exercisePrice !== "" && !priceValid) || undefined}>
                <FieldLabel htmlFor="warrant-price">{t`Exercise price`}</FieldLabel>
                <Input
                  id="warrant-price"
                  inputMode="decimal"
                  value={exercisePrice}
                  onChange={(event) => setExercisePrice(event.target.value.trim())}
                />
                {exercisePrice !== "" && !priceValid && (
                  <FieldError>{t`Enter a decimal price`}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="warrant-issue-date">{t`Issue date`}</FieldLabel>
                <Input
                  id="warrant-issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="warrant-expiration">{t`Expiration`}</FieldLabel>
                <Input
                  id="warrant-expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(event) => setExpirationDate(event.target.value)}
                />
              </Field>
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
