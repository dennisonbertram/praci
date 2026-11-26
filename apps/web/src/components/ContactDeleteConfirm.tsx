import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, ContactLinked } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rakazo/ui-web";
import { useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/** True when deleting the contact would remove more than its own fields, which Undo cannot bring back. */
export const hasLinks = (linked: ContactLinked) =>
  linked.portal || linked.documents.length > 0 || linked.safes > 0;

/** What the delete removes, in words: "their portal access and access to 2 shared documents". */
function removes(linked: ContactLinked): string {
  const parts: string[] = [];
  if (linked.portal) parts.push(t`their portal access`);
  const count = linked.documents.length;
  if (count > 0)
    parts.push(
      plural(count, { one: "access to # shared document", other: "access to # shared documents" }),
    );
  if (linked.safes > 0)
    parts.push(plural(linked.safes, { one: "the link to # SAFE", other: "the links to # SAFEs" }));
  return parts.join(` ${t`and`} `);
}

/** Asks before deleting a contact that has linked data; the delete then has no Undo. */
export function ContactDeleteConfirm({
  contact,
  linked,
  busy = false,
  onCancel,
  onConfirm,
}: {
  contact: Contact;
  linked: ContactLinked;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">
            <Trans>Delete {contact.name}?</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>This also removes {removes(linked)}.</Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={onConfirm}>
            <Trans>Delete</Trans>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The page-level delete flow Contacts and Investors share: a contact with linked data asks first
 * and that delete has no Undo; any other is held for the Undo window. Render `confirm` on the page.
 */
export function useContactDelete(
  deleted: (contact: Contact, undoable?: boolean) => void,
  notify: (text: string) => void,
) {
  const [confirming, setConfirming] = useState<{
    contact: Contact;
    linked: ContactLinked;
  } | null>(null);

  /** The menu's Delete: check what the contact is linked to before holding or asking. */
  const remove = async (contact: Contact) => {
    try {
      const linked = await rpc.contacts.linked({ id: contact.id });
      if (hasLinks(linked)) return setConfirming({ contact, linked });
      deleted(contact);
    } catch (cause) {
      notify(errorText(cause, t`Could not delete ${contact.name}`));
    }
  };

  const confirm = confirming ? (
    <ContactDeleteConfirm
      contact={confirming.contact}
      linked={confirming.linked}
      onCancel={() => setConfirming(null)}
      onConfirm={() => {
        const { contact } = confirming;
        setConfirming(null);
        rpc.contacts
          .delete({ id: contact.id })
          .then(() => deleted(contact, false))
          .catch((cause) => notify(errorText(cause, t`Could not delete ${contact.name}`)));
      }}
    />
  ) : null;

  return { remove, confirm };
}
