import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, ContactKind } from "@rakazo/contracts";
import { ContactKindSchema } from "@rakazo/contracts";
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
import { useSearchParams } from "react-router-dom";
import { ContactDialog, contactKindNames } from "../components/ContactDialog";
import { ContactNotice, useContactNotices } from "../components/ContactNotice";
import { PickFilter, SearchField } from "../components/ListControls";
import { PageHeader } from "../components/PageHeader";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const matches = (contact: Contact, needle: string, kindName: string) =>
  [contact.name, contact.email, contact.organization, contact.notes, kindName].some((field) =>
    field?.toLowerCase().includes(needle),
  );

/** The people and companies the business works with, saved by the user or by their agents. */
export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const setParam = (key: string, value: string | undefined) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (value) updated.set(key, value);
        else updated.delete(key);
        return updated;
      },
      { replace: true },
    );
  const query = params.get("q") ?? "";
  const parsedKind = ContactKindSchema.safeParse(params.get("kind"));
  const kind = parsedKind.success ? parsedKind.data : undefined;
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
  const { notice, setNotice, savedId, setSavedId, deleted } = useContactNotices(
    load,
    container,
    contacts,
  );

  const needle = query.trim().toLowerCase();
  const shown = (contacts ?? []).filter(
    (contact) =>
      (!kind || contact.kind === kind) &&
      (!needle || matches(contact, needle, names[contact.kind])),
  );

  return (
    <div
      ref={container}
      className="@container/bd rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5"
    >
      <PageHeader
        title={<Trans>Contacts</Trans>}
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            <Trans>Add contact</Trans>
          </Button>
        }
      />
      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={load}>
            <Trans>Try again</Trans>
          </Button>
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
              onChange={(next) => setParam("q", next)}
              placeholder={t`Search`}
              label={t`Search`}
              name="contacts-search"
            />
            <PickFilter
              label={t`Kind`}
              value={kind}
              options={(Object.keys(names) as ContactKind[]).map((value) => [value, names[value]])}
              onChange={(next) => setParam("kind", next)}
            />
          </div>
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                <Trans>No matches</Trans>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setParams(
                    (current) => {
                      const updated = new URLSearchParams(current);
                      updated.delete("q");
                      updated.delete("kind");
                      return updated;
                    },
                    { replace: true },
                  )
                }
              >
                <Trans>Clear filters</Trans>
              </Button>
            </div>
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
                    className={contact.id === savedId ? "bg-muted" : ""}
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
      {editing ? (
        <ContactDialog
          key={editing === "new" ? "new" : editing.id}
          contact={editing === "new" ? null : editing}
          prefill={
            editing === "new"
              ? { name: "", email: null, organization: null, kind: kind ?? "other" }
              : undefined
          }
          contacts={contacts ?? []}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            load();
            setSavedId(saved.id);
          }}
          onDeleted={deleted}
          onOpenContact={setEditing}
        />
      ) : null}
      <ContactNotice notice={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}
