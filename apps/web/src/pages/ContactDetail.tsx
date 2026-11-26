import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, ContactDetail, PipelineStatus } from "@rakazo/contracts";
import { CONTACT_DETAIL_LIMIT } from "@rakazo/contracts";
import { Button, ContactAvatar } from "@rakazo/ui-web";
import { Pencil } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ComposeRestore } from "../components/ComposeEmail";
import { ContactDialog, contactKindNames } from "../components/ContactDialog";
import { NEW_MESSAGE } from "../components/compose-email-constants";
import { ErrorNotice } from "../components/ErrorNotice";
import { InboxMessageDialog } from "../components/inbox/InboxMessageDialog";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { RowsSkeleton } from "../components/RowsSkeleton";
import { usdFigure } from "../lib/finance-format";
import { formatMailTime } from "../lib/mail-time";
import { usePageQuery } from "../lib/page-data";
import { rpc } from "../lib/rpc";
import { CONTACT_RESTORED_EVENT, useContactNotices } from "../lib/use-contact-notices";
import { useRefetchWhileOpen } from "../lib/use-refetch-while-open";
import { errorText } from "../lib/user-error";

const ComposeEmail = lazy(() =>
  import("../components/ComposeEmail").then((module) => ({ default: module.ComposeEmail })),
);

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(i18n.locale || "en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const safeStatusNames = (): Record<string, string> => ({
  draft: t`Draft`,
  sent: t`Sent`,
  signed: t`Signed`,
  funded: t`Funded`,
  expired: t`Expired`,
  canceled: t`Canceled`,
});

const pipelineStatusNames = (): Record<PipelineStatus, string> => ({
  not_reached: t`Not reached`,
  reached_out: t`Reached out`,
  intro_requested: t`Intro requested`,
  intro_made: t`Intro made`,
  meeting_booked: t`Meeting booked`,
  met: t`Met`,
  diligence: t`Diligence`,
  committed: t`Committed`,
  passed: t`Passed`,
});

const allMailText = (name: string) => t`All mail with ${name}`;
const allMeetingsText = (name: string) => t`All meetings with ${name}`;

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

const rowClass = "flex items-baseline justify-between gap-3 py-2 text-sm";

/** One contact: its details and whatever is stored against it. A list with nothing in it is hidden. */
export function ContactDetailPage({ id, spaceName }: { id: string; spaceName?: string }) {
  const [editing, setEditing] = useState(false);
  const [openMail, setOpenMail] = useState<ContactDetail["mail"][number] | null>(null);
  const navigate = useNavigate();
  // The list's search and filter ride in this URL's query, so Back restores them.
  const { search } = useLocation();
  const back = () => navigate(`/app/contacts${search}`);
  const container = useRef<HTMLDivElement>(null);

  const query = usePageQuery(() => rpc.contacts.detail({ id }), [id], {
    fallback: t`Could not load contact`,
  });
  // A contact deleted elsewhere drops the page; any other failed refresh keeps it on screen.
  const detail = query.notFound ? null : query.data;
  const error = detail ? "" : query.error;
  const load = query.reload;
  useEffect(() => {
    if (query.notFound) setEditing(false);
  }, [query.notFound]);
  useRefetchWhileOpen(detail !== null, load);
  // The list reloads when it opens; an Undo clicked after returning to it tells it to reload.
  const { deleted, notify } = useContactNotices(
    (restoredId) =>
      restoredId &&
      window.dispatchEvent(new CustomEvent(CONTACT_RESTORED_EVENT, { detail: restoredId })),
    container,
    null,
  );
  const [compose, setCompose] = useState<ComposeRestore | null>(null);
  const writing = useRef(false);
  // The user's other contacts, so the dialog can offer the one that already has an email.
  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    if (editing) rpc.contacts.list({}).then(setContacts, () => {});
  }, [editing]);

  const kinds = contactKindNames();
  const contact = detail?.contact;
  const record = contact?.pipelineRecord;

  /**
   * A plain click on the address writes to the contact in the app itself, the way Data room
   * composes; modified clicks and the context menu keep the mailto. Desktop cannot open mailto.
   */
  const write = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    const email = contact?.email;
    if (!email || writing.current) return;
    writing.current = true;
    try {
      const { accounts } = await rpc.inbox.list({});
      if (!accounts.length) {
        notify(t`Connect Gmail to send`);
        return;
      }
      setCompose({
        seed: NEW_MESSAGE,
        clientId: crypto.randomUUID().replaceAll("-", ""),
        fields: {
          connectionId: accounts[0]?.connectionId ?? "",
          to: [email],
          cc: [],
          bcc: [],
          subject: "",
          html: "",
          text: "",
        },
        forwarded: [],
        files: [],
        saved: false,
        accounts,
      });
    } catch (cause) {
      notify(errorText(cause));
    } finally {
      writing.current = false;
    }
  };

  const facts: [string, ReactNode][] = contact
    ? [
        [
          t`Email`,
          contact.email ? (
            <a
              key="email"
              href={`mailto:${contact.email}`}
              onClick={write}
              className="break-words underline underline-offset-2"
            >
              {contact.email}
            </a>
          ) : null,
        ],
        [t`Organization`, contact.organization],
        [t`Kind`, kinds[contact.kind]],
        [t`Added by`, contact.addedBy?.name],
        [t`Notes`, contact.notes],
      ]
    : [];
  const openIndex = detail?.mail.findIndex((mail) => mail.id === openMail?.id) ?? -1;

  return (
    <div className="@container/bd flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2`}>
        <PageHeader
          className="max-sm:[&_[data-page-header-meta]]:hidden"
          title={
            <span className="flex min-w-0 items-center gap-3">
              {contact ? (
                <ContactAvatar name={contact.name} src={contact.photoUrl} size="lg" />
              ) : null}
              <span className="truncate">{contact?.name ?? ""}</span>
            </span>
          }
          spaceName={spaceName}
          onBack={back}
          actions={
            contact ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                <Trans>Edit</Trans>
              </Button>
            ) : null
          }
        />
      </div>
      <div ref={container} className={`rk-scroll flex-1 overflow-y-auto ${PAGE_GUTTER_X} pb-6`}>
        {error ? (
          <ErrorNotice message={error} onRetry={query.retry} className="justify-center py-8" />
        ) : detail === null ? (
          <RowsSkeleton className="pt-2" />
        ) : (
          <>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">
              {facts.map(([label, value]) =>
                value ? (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 whitespace-pre-wrap break-words">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            {record && contact ? (
              <Link
                to={`/app/fundraising?record=${encodeURIComponent(contact.id)}`}
                className="mt-3 block text-sm underline underline-offset-2"
              >
                {t`Fundraising: ${record.name} · ${pipelineStatusNames()[record.status]}`}
              </Link>
            ) : null}
            {detail.mail.length > 0 ? (
              <Section title={<Trans>Emails</Trans>}>
                {detail.mail.map((mail) => (
                  <li key={mail.id}>
                    <button
                      type="button"
                      onClick={() => setOpenMail(mail)}
                      className={`${rowClass} w-full text-start hover:bg-accent`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{mail.subject}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {mail.from} · {mail.snippet}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatMailTime(mail.receivedAt)}
                      </span>
                    </button>
                  </li>
                ))}
                {contact?.email && detail.mail.length >= CONTACT_DETAIL_LIMIT ? (
                  <li>
                    <Link
                      to={`/app/inbox?q=${encodeURIComponent(contact.email)}`}
                      className={`${rowClass} text-muted-foreground hover:bg-accent pointer-coarse:min-h-11`}
                    >
                      <span className="truncate">{allMailText(contact.name)}</span>
                    </Link>
                  </li>
                ) : null}
              </Section>
            ) : null}
            {detail.meetings.length > 0 ? (
              <Section title={<Trans>Meetings</Trans>}>
                {detail.meetings.map((meeting) => (
                  <li key={meeting.id}>
                    <Link
                      to={`/app/meetings/${encodeURIComponent(meeting.id)}`}
                      className={`${rowClass} hover:bg-accent pointer-coarse:min-h-11`}
                    >
                      <span className="truncate">{meeting.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {date(meeting.startedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
                {contact?.email && detail.meetings.length >= CONTACT_DETAIL_LIMIT ? (
                  <li>
                    <Link
                      to={`/app/meetings?attendee=${encodeURIComponent(contact.email)}`}
                      className={`${rowClass} text-muted-foreground hover:bg-accent pointer-coarse:min-h-11`}
                    >
                      <span className="truncate">{allMeetingsText(contact.name)}</span>
                    </Link>
                  </li>
                ) : null}
              </Section>
            ) : null}
            {detail.documents.length > 0 ? (
              <Section title={<Trans>Documents</Trans>}>
                {detail.documents.map((document) => (
                  <li key={document.id}>
                    <Link
                      to={`/app/data-room?item=${encodeURIComponent(document.id)}`}
                      className={`${rowClass} hover:bg-accent pointer-coarse:min-h-11`}
                    >
                      <span className="truncate">{document.name}</span>
                    </Link>
                  </li>
                ))}
              </Section>
            ) : null}
            {detail.safes.length > 0 ? (
              <Section title={<Trans>SAFEs</Trans>}>
                {detail.safes.map((safe) => (
                  <li key={safe.id} className={rowClass}>
                    <span>{usdFigure(safe.amountCents / 100, 0, i18n.locale || "en")}</span>
                    <span className="text-xs text-muted-foreground">
                      {safeStatusNames()[safe.status] ?? safe.status}
                    </span>
                  </li>
                ))}
              </Section>
            ) : null}
          </>
        )}
        <InboxMessageDialog
          messageId={openMail?.id ?? null}
          subject={openMail?.subject}
          preview={
            openMail
              ? { from: openMail.from, receivedAt: openMail.receivedAt, snippet: openMail.snippet }
              : undefined
          }
          previousId={openIndex > 0 ? detail?.mail[openIndex - 1]?.id : undefined}
          nextId={openIndex >= 0 ? detail?.mail[openIndex + 1]?.id : undefined}
          onNavigate={(id) => setOpenMail(detail?.mail.find((mail) => mail.id === id) ?? null)}
          onClose={() => setOpenMail(null)}
        />
        {compose ? (
          <Suspense fallback={null}>
            <ComposeEmail
              seed={NEW_MESSAGE}
              accounts={compose.accounts}
              restore={compose}
              onClose={() => setCompose(null)}
            />
          </Suspense>
        ) : null}
        {editing && contact ? (
          <ContactDialog
            contact={contact}
            contacts={contacts}
            onOpenContact={(other) => {
              setEditing(false);
              navigate(`/app/contacts/${other.id}${search}`);
            }}
            onClose={() => setEditing(false)}
            onSaved={(saved) => {
              query.mutate((current) => ({
                ...current,
                contact: {
                  ...saved,
                  photoUrl:
                    current.contact.email?.toLowerCase() === saved.email?.toLowerCase()
                      ? current.contact.photoUrl
                      : null,
                },
              }));
              load();
            }}
            onDeleted={(gone, undoable) => {
              deleted(gone, undoable);
              back();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
