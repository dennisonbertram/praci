import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, ContactKind } from "@rakazo/contracts";
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ContactDialog, contactKindNames } from "../components/ContactDialog";
import { ContactNotice } from "../components/ContactNotice";
import { PickFilter, SearchField } from "../components/ListControls";
import { PageHeader } from "../components/PageHeader";
import { rpc } from "../lib/rpc";
import { useContactNotice } from "../lib/use-contact-notice";
import { errorText } from "../lib/user-error";

const matches = (contact: Contact, needle: string) =>
  [contact.name, contact.email, contact.organization].some((field) =>
    field?.toLowerCase().includes(needle),
  );

/** The people and companies the business works with, saved by the user or by their agents. */
export function ContactsPage({ spaceName }: { spaceName?: string }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ContactKind | undefined>();
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const names = contactKindNames();

  const latestLoad = useRef(0);
  const load = useCallback(() => {
    const request = ++latestLoad.current;
    rpc.contacts
      .list({})
      .then((list) => {
        if (request !== latestLoad.current) return;
        setContacts(list);
        setError("");
      })
      .catch((cause) => {
        if (request === latestLoad.current) setError(errorText(cause, t`Could not load contacts`));
      });
  }, []);
  useEffect(load, [load]);
  const container = useRef<HTMLDivElement>(null);
  const { notice, setNotice, savedId, saved, deleted } = useContactNotice(load, container);

  const needle = query.trim().toLowerCase();
  const shown = (contacts ?? []).filter(
    (contact) => (!kind || contact.kind === kind) && (!needle || matches(contact, needle)),
  );

  return (
    <div
      ref={container}
      className="@container/bd rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5"
    >
      <PageHeader
        title={<Trans>Contacts</Trans>}
        meta={
          spaceName ? (
            <span className="truncate" title={spaceName}>
              {spaceName}
            </span>
          ) : null
        }
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            <Trans>Add contact</Trans>
          </Button>
        }
      />
      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : contacts === null ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : contacts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          <Trans>No contacts yet</Trans>
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <SearchField
              className="w-full @md:w-72"
              value={query}
              onChange={setQuery}
              placeholder={t`Search`}
              label={t`Search`}
              name="contacts-search"
            />
            <PickFilter
              label={t`Kind`}
              value={kind}
              options={(Object.keys(names) as ContactKind[]).map((value) => [value, names[value]])}
              onChange={(next) => setKind(next as ContactKind | undefined)}
            />
          </div>
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              <Trans>No matches</Trans>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableHeadRow>
                  <TableHead>
                    <Trans>Name</Trans>
                  </TableHead>
                  <TableHead className="hidden @md:table-cell">
                    <Trans>Email</Trans>
                  </TableHead>
                  <TableHead className="hidden @lg:table-cell">
                    <Trans>Organization</Trans>
                  </TableHead>
                  <TableHead className="w-28">
                    <Trans>Kind</Trans>
                  </TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {shown.map((contact) => (
                  <TableRow
                    key={contact.id}
                    data-contact-id={contact.id}
                    className={contact.id === savedId ? "h-10 bg-muted" : "h-10"}
                  >
                    <TableCell>
                      <button
                        type="button"
                        title={contact.name}
                        className="block max-w-full truncate text-start font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                        onClick={() => setEditing(contact)}
                      >
                        {contact.name}
                      </button>
                      {/* Without room for the Organization column, it shows under the name. */}
                      {contact.organization ? (
                        <div
                          className="truncate text-xs text-muted-foreground @lg:hidden"
                          title={contact.organization}
                        >
                          {contact.organization}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden truncate @md:table-cell">
                      {contact.email}
                    </TableCell>
                    <TableCell className="hidden truncate @lg:table-cell">
                      {contact.organization}
                    </TableCell>
                    <TableCell>{names[contact.kind]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
      <ContactNotice notice={notice} onDismiss={() => setNotice(null)} />
      {editing ? (
        <ContactDialog
          key={editing === "new" ? "new" : editing.id}
          contact={editing === "new" ? null : editing}
          contacts={contacts ?? []}
          onClose={() => setEditing(null)}
          onSaved={saved}
          onDeleted={deleted}
          onOpenContact={setEditing}
        />
      ) : null}
    </div>
  );
}
