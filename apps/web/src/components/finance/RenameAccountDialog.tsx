import { Trans, useLingui } from "@lingui/react/macro";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
} from "@rakazo/ui-web";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** Renames an account made from uploaded statements (its first name comes from the file). */
export function RenameAccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: { id: string; name: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  const id = useId();
  const [name, setName] = useState(account.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await rpc.finance.statementAccountRename({ id: account.id, name: name.trim() });
      onSaved();
      onClose();
    } catch (cause) {
      setError(errorText(cause, t`Could not rename the account`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>
              <Trans>Rename account</Trans>
            </DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>
              <Trans>Account name</Trans>
            </FieldLabel>
            <Input
              id={`${id}-name`}
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              aria-describedby={`${id}-hint`}
            />
            <FieldDescription id={`${id}-hint`}>
              <Trans>Later statements for this account keep this name.</Trans>
            </FieldDescription>
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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
