import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { PortalLink } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rakazo/ui-web";
import { useState } from "react";

function LinkRow({ link, named }: { link: PortalLink; named: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard
      ?.writeText(link.link)
      .then(() => setCopied(true))
      .catch(() => undefined);
  return (
    <div className="flex flex-col gap-1.5">
      {named ? <span className="text-sm font-medium">{link.name}</span> : null}
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={link.link}
          aria-label={t`Link for ${link.name}`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" variant="outline" className="min-h-11 md:min-h-8" onClick={copy}>
          {copied ? <Trans>Copied</Trans> : <Trans>Copy</Trans>}
        </Button>
      </div>
    </div>
  );
}

/** A portal link shown once, because only its hash is stored: the founder pastes it to the investor. */
export function CopyLinkDialog({ links, onClose }: { links: PortalLink[]; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Portal link</Trans>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {links.map((link) => (
            <LinkRow key={link.contactId} link={link} named={links.length > 1} />
          ))}
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            <Trans>Done</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
