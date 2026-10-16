import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, ContactKind } from "@rakazo/contracts";
import { isCartaEndpoint } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@rakazo/ui-web";
import { PanelRightOpen, Plus } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { mcpStatus } from "../lib/integrations";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

type Filter = "all" | ContactKind;

const kindNames = (): Record<ContactKind, string> => ({
  investor: t`Investor`,
  auditor: t`Auditor`,
  other: t`Other`,
});

/** Name, email, organization and notes of one contact; `contact` null adds a new one. */
function ContactDialog({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(contact?.name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [organization, setOrganization] = useState(contact?.organization ?? "");
  const [kind, setKind] = useState<ContactKind>(contact?.kind ?? "investor");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const names = kindNames();

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      onSaved();
      onClose();
    } catch (cause) {
      setError(errorText(cause));
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() =>
      rpc.contacts.save({
        ...(contact ? { id: contact.id } : {}),
        name,
        email: email.trim() || null,
        organization: organization.trim() || null,
        kind,
        notes: notes.trim() || null,
      }),
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {contact ? <Trans>Edit contact</Trans> : <Trans>Add contact</Trans>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-name">
              <Trans>Name</Trans>
            </Label>
            <Input
              id="contact-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-email">
              <Trans>Email</Trans>
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-organization">
              <Trans>Organization</Trans>
            </Label>
            <Input
              id="contact-organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-kind">
              <Trans>Kind</Trans>
            </Label>
            <NativeSelect
              id="contact-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ContactKind)}
            >
              {(Object.keys(names) as ContactKind[]).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {names[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-notes">
              <Trans>Notes</Trans>
            </Label>
            <Textarea id="contact-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            {contact ? (
              <Button
                type="button"
                variant="destructive"
                className="me-auto"
                disabled={busy}
                onClick={() => void run(() => rpc.contacts.delete({ id: contact.id }))}
              >
                <Trans>Delete</Trans>
              </Button>
            ) : null}
            <Button type="submit" disabled={busy || !name.trim()}>
              <Trans>Save</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The Cap Table page: the user's investor contacts. The Carta agent beside it does the cap table work. */
export function CapTablePage({
  onShowAgent,
  onConnectCarta,
}: {
  onShowAgent?: () => void;
  onConnectCarta: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState("");
  const [cartaConnected, setCartaConnected] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const names = kindNames();

  const latestLoad = useRef(0);
  const load = useCallback(() => {
    const request = ++latestLoad.current;
    setError("");
    rpc.contacts
      .list({})
      .then((list) => request === latestLoad.current && setContacts(list))
      .catch(
        (cause) =>
          request === latestLoad.current && setError(errorText(cause, t`Could not load contacts`)),
      );
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    rpc.mcp.servers
      .list()
      .then((servers) =>
        setCartaConnected(
          servers.some(
            (server) =>
              server.enabled &&
              "endpoint" in server &&
              isCartaEndpoint(server.endpoint) &&
              mcpStatus(server) === "connected",
          ),
        ),
      )
      .catch(() => undefined);
  }, []);

  const shown = contacts?.filter((c) => filter === "all" || c.kind === filter) ?? [];
  const filterNames: Record<Filter, string> = {
    all: t`All`,
    investor: t`Investors`,
    auditor: t`Auditors`,
    other: t`Other`,
  };

  return (
    <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="me-auto text-lg font-medium">
          <Trans>Cap Table</Trans>
        </h1>
        {cartaConnected ? null : (
          <Button variant="outline" onClick={onConnectCarta}>
            <Trans>Connect Carta</Trans>
          </Button>
        )}
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          <Trans>Add contact</Trans>
        </Button>
        {onShowAgent ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-10"
            aria-label={t`Show Carta agent`}
            onClick={onShowAgent}
          >
            <PanelRightOpen aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <Tabs value={filter} onValueChange={(next) => setFilter(next as Filter)} className="mb-4">
        <TabsList className="rounded-full" aria-label={t`Kind`}>
          {(Object.keys(filterNames) as Filter[]).map((value) => (
            <TabsTrigger key={value} value={value} className="rounded-full px-3">
              {filterNames[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={load}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : contacts === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-9 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          <Trans>No contacts yet</Trans>
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-start text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pe-3 text-start font-medium">
                <Trans>Name</Trans>
              </th>
              <th className="py-2 pe-3 text-start font-medium">
                <Trans>Email</Trans>
              </th>
              <th className="hidden py-2 pe-3 text-start font-medium @md:table-cell">
                <Trans>Organization</Trans>
              </th>
              <th className="py-2 text-start font-medium">
                <Trans>Kind</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((contact) => (
              <tr key={contact.id} className="border-t border-border hover:bg-muted/50">
                <td className="py-2 pe-3">
                  <button
                    type="button"
                    className="text-start font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                    onClick={() => setEditing(contact)}
                  >
                    {contact.name}
                  </button>
                </td>
                <td className="py-2 pe-3 text-muted-foreground">{contact.email}</td>
                <td className="hidden py-2 pe-3 text-muted-foreground @md:table-cell">
                  {contact.organization}
                </td>
                <td className="py-2 text-muted-foreground">{names[contact.kind]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing ? (
        <ContactDialog
          contact={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      ) : null}
    </div>
  );
}
