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
import { AskBotButton } from "../components/AskBotButton";
import { ContactDialog, contactKindNames } from "../components/ContactDialog";
import { PickFilter, SearchField } from "../components/ListControls";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { RowsSkeleton } from "../components/RowsSkeleton";
import { rpc } from "../lib/rpc";
import { SAVED_ROW_CLASS, useContactNotices } from "../lib/use-contact-notices";
import { errorText } from "../lib/user-error";

const matches = (contact: Contact, needle: string, kindName: string) =>
  [contact.name, contact.email, contact.organization, contact.notes, kindName].some((field) =>
    field?.toLowerCase().includes(needle),
  );

/** The people and companies the business works with, saved by the user or by their agents. */
export function ContactsPage({
  spaceName,
  onAskAgent,
}: {
  spaceName?: string;
  onAskAgent?: () => void;
}) {
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
  const { savedId, setSavedId, deleted } = useContactNotices(load, container, contacts);

  const needle = query.trim().toLowerCase();
  const shown = (contacts ?? []).filter(
    (contact) =>
      (!kind || contact.kind === kind) &&
      (!needle || matches(contact, needle, names[contact.kind])),
  );

  return (
    <div className="@container/bd flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2 md:pt-5`}>
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
            <>
              <Button onClick={() => setEditing("new")}>
                <Plus aria-hidden="true" />
                <Trans>Add contact</Trans>
              </Button>
              {onAskAgent ? <AskBotButton botName="Chief" onClick={onAskAgent} /> : null}
            </>
          }
        />
      </div>
      <div ref={container} className={`rk-scroll flex-1 overflow-y-auto ${PAGE_GUTTER_X} pb-6`}>
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center text-sm">
            <span className="text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={load}>
              <Trans>Try again</Trans>
            </Button>
          </div>
        ) : contacts === null ? (
          <RowsSkeleton className="pt-2" />
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
                options={(Object.keys(names) as ContactKind[]).map((value) => [
                  value,
                  names[value],
                ])}
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
                  onClick={() => {
                    setParams(
                      (current) => {
                        const updated = new URLSearchParams(current);
                        updated.delete("q");
                        updated.delete("kind");
                        return updated;
                      },
                      { replace: true },
                    );
                    container.current
                      ?.querySelector<HTMLInputElement>("input[name=contacts-search]")
                      ?.focus();
                  }}
                >
                  <Trans>Clear filters</Trans>
                </Button>
              </div>
            ) : (
              <div>
                <Table compact className="table-fixed">
                  <TableHeader>
                    <TableHeadRow>
                      <TableHead className="ps-2">
                        <Trans>Name</Trans>
                      </TableHead>
                      <TableHead className="hidden w-[34%] @md:table-cell">
                        <Trans>Email</Trans>
                      </TableHead>
                      <TableHead className="hidden w-[26%] @lg:table-cell">
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
                        className={contact.id === savedId ? SAVED_ROW_CLASS : ""}
                        onOpen={() => setEditing(contact)}
                      >
                        <TableCell>
                          <button
                            type="button"
                            title={contact.name}
                            data-row-open
                            className="block max-w-full truncate rounded-sm text-start font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {contact.name}
                          </button>
                          {/* Without room for the Email column, the email (else the organization) shows here. */}
                          <div className="truncate text-xs text-muted-foreground @md:hidden">
                            {contact.email ?? contact.organization}
                          </div>
                        </TableCell>
                        <TableCell
                          className="hidden truncate @md:table-cell"
                          title={contact.email ?? undefined}
                        >
                          {contact.email}
                        </TableCell>
                        <TableCell
                          className="hidden truncate @lg:table-cell"
                          title={contact.organization ?? undefined}
                        >
                          {contact.organization}
                        </TableCell>
                        <TableCell>{names[contact.kind]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
      </div>
    </div>
  );
}
