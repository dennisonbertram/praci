import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { PortalDocument, PortalUpdate } from "@rakazo/contracts";
import { Button, Skeleton } from "@rakazo/ui-web";
import { useCallback, useEffect, useState } from "react";
import { shortDay } from "../../lib/finance-format";
import type { PortalContent } from "../../lib/portal";
import { loadPortal, PortalDeadError, portalDocumentUrl, signOutPortal } from "../../lib/portal";
import { PortalDead } from "./PortalDead";

const day = (iso: string | null) =>
  iso ? shortDay(iso.slice(0, 10), new Date(), document.documentElement.lang || undefined) : "";

function UpdateBody({ update }: { update: PortalUpdate }) {
  return (
    <>
      <h2 className="text-lg font-semibold break-words">{update.subject}</h2>
      {update.sentAt ? (
        <p className="mb-3 text-xs text-muted-foreground">{day(update.sentAt)}</p>
      ) : null}
      <ChatMarkdown>{update.body}</ChatMarkdown>
    </>
  );
}

function EarlierUpdate({ update }: { update: PortalUpdate }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-border first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-3 py-2 text-start"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{update.subject}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{day(update.sentAt)}</span>
      </button>
      {open ? (
        <div className="pb-4">
          <ChatMarkdown>{update.body}</ChatMarkdown>
        </div>
      ) : null}
    </li>
  );
}

function DocumentRow({ document: item }: { document: PortalDocument }) {
  return (
    <li className="flex min-h-11 items-center gap-3 border-t border-border first:border-t-0">
      <span className="min-w-0 flex-1 truncate text-sm" title={item.name}>
        {item.name}
      </span>
      <Button
        variant="outline"
        className="min-h-11 md:min-h-8"
        render={<a href={portalDocumentUrl(item.id)} download={item.name} />}
      >
        <Trans>Download</Trans>
      </Button>
    </li>
  );
}

/** What the investor sees: the newest update in full, earlier ones as rows, and shared documents. */
export function PortalHome({
  onSignedOut,
  initial,
}: {
  onSignedOut?: () => void;
  /** Content already loaded (stories and tests). */
  initial?: PortalContent;
}) {
  const [content, setContent] = useState<PortalContent | null>(initial ?? null);
  const [dead, setDead] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    loadPortal()
      .then(setContent)
      .catch((cause: unknown) => {
        if (cause instanceof PortalDeadError) setDead(true);
        else setFailed(true);
      });
  }, []);
  useEffect(() => {
    if (!initial) load();
  }, [initial, load]);

  if (dead) return <PortalDead />;
  if (failed)
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-4 text-foreground">
        <p role="alert" className="text-sm text-destructive">
          {t`Could not load this page`}
        </p>
        <Button variant="outline" className="min-h-11" onClick={load}>
          <Trans>Try again</Trans>
        </Button>
      </main>
    );
  if (!content)
    return (
      <main className="mx-auto max-w-2xl bg-background px-4 py-8" aria-busy="true">
        <Skeleton className="h-8 w-48" />
      </main>
    );

  const [newest, ...earlier] = content.updates;
  const nothing = !newest && content.documents.length === 0;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
        <h1 className="text-2xl font-semibold break-words">{content.me.company}</h1>
        {nothing ? (
          <p className="text-sm text-muted-foreground">
            <Trans>Nothing shared yet.</Trans>
          </p>
        ) : null}
        {newest ? (
          <section aria-label={t`Latest update`}>
            <UpdateBody update={newest} />
          </section>
        ) : null}
        {earlier.length > 0 ? (
          <section aria-label={t`Earlier updates`}>
            <h2 className="mb-1 text-sm font-semibold">
              <Trans>Earlier updates</Trans>
            </h2>
            <ul>
              {earlier.map((update) => (
                <EarlierUpdate key={update.id} update={update} />
              ))}
            </ul>
          </section>
        ) : null}
        {content.documents.length > 0 ? (
          <section aria-label={t`Documents`}>
            <h2 className="mb-1 text-sm font-semibold">
              <Trans>Documents</Trans>
            </h2>
            <ul>
              {content.documents.map((item) => (
                <DocumentRow key={item.id} document={item} />
              ))}
            </ul>
          </section>
        ) : null}
        <footer className="border-t border-border pt-4">
          <Button
            variant="ghost"
            className="min-h-11 md:min-h-8"
            onClick={() => void signOutPortal().then(() => onSignedOut?.())}
          >
            <Trans>Sign out</Trans>
          </Button>
        </footer>
      </main>
    </div>
  );
}
