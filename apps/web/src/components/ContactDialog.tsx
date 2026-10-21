import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, ContactKind } from "@rakazo/contracts";
import {
  Button,
  Dialog,
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
import type { FormEvent } from "react";
import { useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

export type ContactPrefill = {
  name: string;
  email: string | null;
  organization: string | null;
  kind?: ContactKind;
};

export const contactKindNames = (): Record<ContactKind, string> => ({
  investor: t`Investor`,
  auditor: t`Auditor`,
  customer: t`Customer`,
  vendor: t`Vendor`,
  partner: t`Partner`,
  advisor: t`Advisor`,
  legal: t`Legal`,
  other: t`Other`,
});
export const contactAddLabels = (): Record<ContactKind, string> => ({
  investor: t`Add investor`,
  auditor: t`Add auditor`,
  customer: t`Add contact`,
  vendor: t`Add contact`,
  partner: t`Add contact`,
  advisor: t`Add contact`,
  legal: t`Add contact`,
  other: t`Add contact`,
});

/** Name, email, organization and notes of one contact; `contact` null adds a new one. */
export function ContactDialog({
  contact,
  prefill,
  contacts = [],
  onClose,
  onSaved,
  onDeleted,
  onOpenContact,
  onCapTable = false,
}: {
  contact: Contact | null;
  prefill?: ContactPrefill;
  /** The user's other contacts, to offer the one that already has the email typed. */
  contacts?: readonly Contact[];
  onClose: () => void;
  onSaved: (saved: Contact) => void;
  onDeleted?: (contact: Contact) => void;
  onOpenContact?: (contact: Contact) => void;
  /** The contact is also a holder on the cap table, so say that editing it does not change Carta. */
  onCapTable?: boolean;
}) {
  const [name, setName] = useState(contact?.name ?? prefill?.name ?? "");
  const [email, setEmail] = useState(contact?.email ?? prefill?.email ?? "");
  const [organization, setOrganization] = useState(
    contact?.organization ?? prefill?.organization ?? "",
  );
  const [kind, setKind] = useState<ContactKind>(contact?.kind ?? prefill?.kind ?? "investor");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const names = contactKindNames();

  const typedEmail = email.trim().toLowerCase();
  const sameEmail = typedEmail
    ? contacts.find(
        (other) => other.id !== contact?.id && other.email?.toLowerCase() === typedEmail,
      )
    : undefined;

  async function run<T>(action: () => Promise<T>, done: (result: T) => void) {
    setBusy(true);
    setError("");
    try {
      done(await action());
      onClose();
    } catch (cause) {
      setError(errorText(cause));
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(
      () =>
        rpc.contacts.save({
          ...(contact ? { id: contact.id } : {}),
          name,
          email: email.trim() || null,
          organization: organization.trim() || null,
          kind,
          notes: notes.trim() || null,
        }),
      onSaved,
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {contact ? (
              <Trans>Edit contact</Trans>
            ) : prefill?.name && prefill.email ? (
              <Trans>Save {prefill.name} as a contact</Trans>
            ) : prefill?.name ? (
              <Trans>Add email for {prefill.name}</Trans>
            ) : prefill?.kind ? (
              contactAddLabels()[prefill.kind]
            ) : (
              <Trans>Add contact</Trans>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-name">
              <Trans>Name</Trans>
            </Label>
            <Input
              id="contact-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-email">
              <Trans>Email</Trans>
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-organization">
              <Trans>Organization</Trans>
            </Label>
            <Input
              id="contact-organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-kind">
              <Trans>Kind</Trans>
            </Label>
            <NativeSelect
              id="contact-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ContactKind)}
            >
              {(Object.keys(names) as ContactKind[]).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {names[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-notes">
              <Trans>Notes</Trans>
            </Label>
            <Textarea
              id="contact-notes"
              aria-describedby={onCapTable ? "contact-notes-hint" : undefined}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {onCapTable ? (
              <p id="contact-notes-hint" className="text-xs text-muted-foreground">
                <Trans>Contacts are your address book. They do not change Carta.</Trans>
              </p>
            ) : null}
          </div>
          {error ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-destructive">{error}</span>
              {sameEmail && onOpenContact ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenContact(sameEmail)}
                >
                  <Trans>Open {sameEmail.name}</Trans>
                </Button>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            {contact ? (
              <Button
                type="button"
                variant="destructive"
                className="me-auto"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => rpc.contacts.delete({ id: contact.id }),
                    () => onDeleted?.(contact),
                  )
                }
              >
                <Trans>Delete</Trans>
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              <Trans>Save</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
