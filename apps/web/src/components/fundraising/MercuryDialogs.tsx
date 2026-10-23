import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact } from "@rakazo/contracts";
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
} from "@rakazo/ui-web";
import type { FormEvent } from "react";
import { useState } from "react";
import { errorText } from "../../lib/user-error";

/** A small form dialog: one field, a primary button named for the action, and its own error line. */
function OneFieldDialog({
  title,
  action,
  disabled,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  action: string;
  disabled: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit();
    } catch (cause) {
      setError(errorText(cause, t`Could not save`));
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogBody className="flex flex-col gap-3">
            {children}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy || disabled} className="pointer-coarse:h-11">
              {action}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Send SAFE through Mercury needs the investor's email: the next sync attaches the SAFE by it. */
export function InvestorEmailDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const value = email.trim();
  return (
    <OneFieldDialog
      title={t`Send SAFE`}
      action={t`Send SAFE`}
      disabled={!value.includes("@")}
      onClose={onClose}
      onSubmit={() => onSave(value)}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="investor-email">
          <Trans>Investor email</Trans>
        </Label>
        <Input
          id="investor-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
    </OneFieldDialog>
  );
}

/** Assign to contact: a picker of the prospects and investors that can own a Mercury SAFE. */
export function AssignSafeDialog({
  contacts,
  onClose,
  onAssign,
}: {
  contacts: readonly Contact[];
  onClose: () => void;
  onAssign: (contactId: string) => Promise<void>;
}) {
  const choices = contacts.filter((c) => c.kind === "prospect" || c.kind === "investor");
  const [contactId, setContactId] = useState("");
  return (
    <OneFieldDialog
      title={t`Assign to contact`}
      action={t`Assign`}
      disabled={!contactId}
      onClose={onClose}
      onSubmit={() => onAssign(contactId)}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assign-contact">
          <Trans>Contact</Trans>
        </Label>
        <NativeSelect
          id="assign-contact"
          className="w-full"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
        >
          <NativeSelectOption value="" disabled>
            {t`Choose a contact`}
          </NativeSelectOption>
          {choices.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </OneFieldDialog>
  );
}
