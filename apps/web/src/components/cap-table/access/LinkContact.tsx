import { t } from "@lingui/core/macro";
import type { Contact, EquityAccessHolder } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  enqueueNotificationToast,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

/**
 * Picks the investor contact a holder is reached through: their portal link, delivered
 * documents and last seen all go through it. Contacts already linked to another holder are left
 * out; the server refuses them too.
 */
export function LinkContact({
  holder,
  linkedContactIds,
  open,
  onOpenChange,
  onLinked,
}: {
  holder: EquityAccessHolder;
  /** Contacts already linked to other holders. */
  linkedContactIds: ReadonlySet<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: (row: EquityAccessHolder) => void;
}) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [choice, setChoice] = useState(holder.contactId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setChoice(holder.contactId ?? "");
    rpc.contacts
      .list({ kind: "investor" })
      .then((rows) => {
        if (live) setContacts(rows);
      })
      .catch(() => {
        if (live) setContacts([]);
      });
    return () => {
      live = false;
    };
  }, [open, holder.contactId]);

  const save = async () => {
    setSaving(true);
    try {
      const row = await rpc.equity.accessHolders.linkContact({
        stakeholderId: holder.stakeholderId,
        contactId: choice || null,
      });
      onLinked(row);
      onOpenChange(false);
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-link-contact-failed",
        title: t`Could not link the contact`,
        body: errorText(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  const options = (contacts ?? []).filter(
    (contact) => contact.id === holder.contactId || !linkedContactIds.has(contact.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{holder.name}</DialogTitle>
        </DialogHeader>
        {contacts == null ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <NativeSelect
            aria-label={t`Investor contact`}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
          >
            <NativeSelectOption value="">{t`No contact`}</NativeSelectOption>
            {options.map((contact) => (
              <NativeSelectOption key={contact.id} value={contact.id}>
                {contact.email ? `${contact.name} (${contact.email})` : contact.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t`Cancel`}
          </Button>
          <Button
            disabled={saving || choice === (holder.contactId ?? "")}
            onClick={() => void save()}
          >
            {t`Save`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
