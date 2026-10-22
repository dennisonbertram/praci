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

/** True when deleting the contact would remove more than its own fields, which Undo cannot bring back. */
export const hasLinks = (linked: ContactLinked) => linked.portal || linked.documents.length > 0;

/** What the delete removes, in words: "their portal access and access to 2 shared documents". */
function removes(linked: ContactLinked): string {
  const parts: string[] = [];
  if (linked.portal) parts.push(t`their portal access`);
  const count = linked.documents.length;
  if (count > 0)
    parts.push(
      plural(count, { one: "access to # shared document", other: "access to # shared documents" }),
    );
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
