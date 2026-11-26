import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@rakazo/ui-web";
import { useState } from "react";
import { CopyLinkDialog } from "./CopyLinkDialog";

/**
 * The share link of an artifact version. `url` is set only right after the link was made, since
 * only its hash is stored; reopening an existing share offers Replace link, which stops the old
 * link and makes a new one, and Stop sharing.
 */
export function ArtifactShareDialog({
  name,
  url,
  expiresAt,
  busy,
  error,
  onReplace,
  onStop,
  onClose,
}: {
  name: string;
  url: string | null;
  /** Absent for a page share, which has no expiry to show. */
  expiresAt?: string;
  busy: boolean;
  error: string | null;
  onReplace?: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <CopyLinkDialog
        title={t`Share link`}
        links={url ? [{ contactId: "artifact", name, link: url }] : []}
        note={
          <div className="flex flex-col gap-1.5">
            <p>
              {expiresAt
                ? t`Anyone with this link can view this version until ${i18n.date(new Date(expiresAt), { dateStyle: "medium" })}.`
                : t`Anyone with this link can view this version until you stop sharing or for 30 days.`}
            </p>
            {url === null ? (
              <p>
                <Trans>Links are shown once. Replacing this one stops the old link.</Trans>
              </p>
            ) : null}
            {error && !confirming ? (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        }
        onClose={onClose}
        actions={
          <>
            {url === null && onReplace ? (
              <Button type="button" variant="outline" disabled={busy} onClick={onReplace}>
                <Trans>Replace link</Trans>
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
              <Trans>Stop sharing</Trans>
            </Button>
          </>
        }
      />
      <AlertDialog
        open={confirming}
        onOpenChange={(open) => !open && !busy && setConfirming(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Stop sharing this link?</Trans>
            </AlertDialogTitle>
          </AlertDialogHeader>
          {error ? <p className="text-[13.5px] text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={onStop}>
              <Trans>Stop sharing</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
