import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  Contact,
  InvestorDeliveryState,
  InvestorUpdate,
  MailAccountSummary,
} from "@rakazo/contracts";
import { newClientId } from "@rakazo/core";
import {
  Badge,
  Button,
  Checkbox,
  enqueueNotificationToast,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
} from "@rakazo/ui-web";
import { EditorContent } from "@tiptap/react";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useComposeEditor } from "../../components/compose/RichTextEditor";
import { PAGE_GUTTER_X, PageHeader } from "../../components/PageHeader";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { countTbd, TbdHighlight } from "./tbd-highlight";

/** How often a running send is read again, and how long Draft with agent is waited for. */
const SENDING_POLL_MS = 1500;
const DRAFT_POLL_MS = 2000;
const DRAFT_WAIT_MS = 3 * 60_000;
const SAVE_DELAY_MS = 600;

const statusNames = () => ({
  draft: t`Draft`,
  sending: t`Sending`,
  sent: t`Sent`,
  partly_sent: t`Partly sent`,
  posted: t`Posted`,
});

const stateNames = (): Record<InvestorDeliveryState, string> => ({
  sent: t`Sent`,
  sending: t`Sending`,
  failed: t`Failed`,
  unknown: t`Unknown — check Sent mail`,
});

let toastCounter = 0;
const toast = (title: string) =>
  enqueueNotificationToast({ id: `investor-update-${++toastCounter}`, title });

const accountText = (account: MailAccountSummary) =>
  account.address && account.address !== account.label
    ? `${account.label} (${account.address})`
    : account.label;

const fieldsKey = (subject: string, body: string, ticked: readonly string[], from: string | null) =>
  JSON.stringify([subject, body, ticked, from]);

/** The update editor page: `/app/investors/updates/:id`. */
export function UpdateEditor({ updateId }: { updateId: string }) {
  const navigate = useNavigate();
  const [update, setUpdate] = useState<InvestorUpdate | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<MailAccountSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ticked, setTicked] = useState<string[]>([]);
  const [from, setFrom] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [asking, setAsking] = useState<"tbd" | null>(null);
  const [resend, setResend] = useState<string[] | null>(null);
  const loadedId = useRef<string | null>(null);
  // The fields as the server last held them, so opening an update does not save it again.
  const saved = useRef("");
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef<{
    subject: string;
    body: string;
    ticked: string[];
    from: string | null;
    key: string;
  } | null>(null);
  // Leaving within the autosave delay still saves the last edit.
  useEffect(
    () => () => {
      const last = pending.current;
      if (last)
        void rpc.investors.updates.save({
          id: updateId,
          subject: last.subject,
          body: last.body,
          recipientContactIds: last.ticked,
          fromConnectionId: last.from,
        });
    },
    [updateId],
  );
  const wasSending = useRef(false);

  // A revoked contact is never emailed: it is left out of the recipients whatever was saved.
  const recipients = useMemo(() => {
    const revoked = new Set(contacts.filter((c) => c.portalBlockedAt).map((c) => c.id));
    return ticked.filter((id) => !revoked.has(id));
  }, [contacts, ticked]);

  const draft = update?.status === "draft";
  const gmail = (accounts?.length ?? 0) > 0;

  const editor = useComposeEditor({
    disabled: !draft,
    markdown: true,
    extensions: [TbdHighlight],
    onLinkShortcut: () => {},
    onChange: (value) => {
      setBody(value.markdown ?? "");
    },
  });

  const load = useCallback(async () => {
    try {
      const next = await rpc.investors.updates.get({ id: updateId });
      setUpdate(next);
      setLoadError("");
      return next;
    } catch (cause) {
      setLoadError(errorText(cause, t`Could not load this update`));
      return null;
    }
  }, [updateId]);

  // First load: the update, the audience's contacts and the Gmail accounts.
  useEffect(() => {
    let live = true;
    void load().then((next) => {
      if (!live || !next) return;
      void rpc.contacts
        .list({ kind: next.audience === "board" ? "board" : "investor" })
        .then((list) => {
          if (live) setContacts(list);
        })
        .catch(() => undefined);
    });
    void rpc.investors.updates
      .accounts()
      .then((list) => live && setAccounts(list))
      .catch(() => live && setAccounts([]));
    return () => {
      live = false;
    };
  }, [load]);

  // Fields take the stored values once per update, then belong to the founder.
  useEffect(() => {
    if (!update || !editor || loadedId.current === update.id) return;
    loadedId.current = update.id;
    setSubject(update.subject);
    setBody(update.body);
    setTicked(update.recipientContactIds);
    setFrom(update.fromConnectionId);
    saved.current = fieldsKey(
      update.subject,
      update.body,
      update.recipientContactIds,
      update.fromConnectionId,
    );
    editor.commands.setContent(update.body, { contentType: "markdown", emitUpdate: false });
    setSaveState("saved");
  }, [update, editor]);

  // A sent update is read-only; the editor follows the status.
  useEffect(() => {
    editor?.setEditable(draft === true, false);
  }, [editor, draft]);

  // Autosave when a field differs from what the server holds.
  useEffect(() => {
    const key = fieldsKey(subject, body, recipients, from);
    if (!draft || loadedId.current !== updateId || key === saved.current) return;
    setSaveState("saving");
    pending.current = { subject, body, ticked: recipients, from, key };
    const timer = setTimeout(() => {
      // One save at a time, in order, so an older request cannot land after a newer one.
      saving.current = saving.current
        .then(() =>
          rpc.investors.updates.save({
            id: updateId,
            subject,
            body,
            recipientContactIds: recipients,
            fromConnectionId: from,
          }),
        )
        .then(() => {
          saved.current = key;
          if (pending.current?.key === key) pending.current = null;
          setSaveState("saved");
        })
        .catch(() => setSaveState("failed"));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [subject, body, recipients, from, draft, updateId]);

  // While a send runs, read it again until it ends.
  const sending = update?.status === "sending";
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(() => void load(), SENDING_POLL_MS);
    return () => clearInterval(timer);
  }, [sending, load]);

  // A send that ended with every recipient delivered returns to Investors.
  useEffect(() => {
    if (sending) wasSending.current = true;
    if (update?.status !== "sent" || !wasSending.current) return;
    wasSending.current = false;
    const count = update.deliveries.filter((d) => d.state === "sent").length;
    toast(t`Sent to ${count}`);
    navigate("/app/investors");
  }, [update, sending, navigate]);

  const tbd = useMemo(() => countTbd(body), [body]);

  const run = async (action: () => Promise<InvestorUpdate | undefined | void>) => {
    setBusy(true);
    setActionError("");
    try {
      const next = await action();
      if (next) setUpdate(next);
    } catch (cause) {
      setActionError(errorText(cause));
      void load();
    } finally {
      setBusy(false);
    }
  };

  const flushSave = async () => {
    await saving.current;
    pending.current = null;
    return rpc.investors.updates.save({
      id: updateId,
      subject,
      body,
      recipientContactIds: recipients,
      fromConnectionId: from,
    });
  };

  const send = () => {
    setAsking(null);
    void run(async () => {
      await flushSave();
      wasSending.current = true;
      return rpc.investors.updates.send({ id: updateId });
    });
  };
  const trySend = () => (tbd > 0 ? setAsking("tbd") : send());

  /** Post to portal, for a founder with no Gmail: no email goes out from here, only portal notices. */
  const post = () => {
    setAsking(null);
    void run(async () => {
      await flushSave();
      const result = await rpc.investors.updates.post({ id: updateId });
      toast(t`Posted · ${result.notified} notified`);
      navigate("/app/investors");
      return result.update;
    });
  };
  const tryPost = () => (tbd > 0 ? setAsking("tbd") : post());

  const retry = (contactIds: string[], resendUnknown = false) => {
    setResend(null);
    wasSending.current = true;
    void run(() => rpc.investors.updates.retry({ id: updateId, contactIds, resendUnknown }));
  };
  const markDelivered = (contactIds?: string[]) => {
    setResend(null);
    void run(() => rpc.investors.updates.markDelivered({ id: updateId, contactIds }));
  };

  /** Asks the Investors agent to write the body into this draft, then waits for it to appear. */
  const draftWithAgent = async () => {
    if (!update) return;
    setDrafting(true);
    setActionError("");
    try {
      const bot = await rpc.investors.agent();
      await rpc.threads.send({
        botId: bot.id,
        clientNonce: newClientId(),
        text: `Use the investor-update skill to write the ${update.audience} update for ${update.period} into the existing draft ${update.id}: read it with investor_update_draft get, then save the body with investor_update_draft save. Do not ask questions; write TBD for anything you cannot source.`,
      });
      const until = Date.now() + DRAFT_WAIT_MS;
      while (Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, DRAFT_POLL_MS));
        const next = await rpc.investors.updates.get({ id: updateId });
        if (next.body.trim()) {
          setUpdate(next);
          setBody(next.body);
          editor?.commands.setContent(next.body, { contentType: "markdown", emitUpdate: false });
          setDrafting(false);
          return;
        }
      }
      toast(t`The agent did not finish a draft`);
    } catch (cause) {
      toast(errorText(cause, t`Could not draft with the agent`));
    }
    setDrafting(false);
  };

  if (loadError && !update) {
    return (
      <div className={`${PAGE_GUTTER_X} pt-5`}>
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      </div>
    );
  }
  if (!update) {
    return (
      <div className={`${PAGE_GUTTER_X} pt-5`} aria-busy="true">
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  const names = statusNames();
  const states = stateNames();
  const total = update.deliveries.length;
  const delivered = update.deliveries.filter((d) => d.state === "sent").length;
  const hasUnknown = update.deliveries.some((d) => d.state === "unknown");
  const bodyEmpty = !body.trim();
  // An unticked investor with portal access still sees an update that goes out to others.
  const hasPortalAccess = (c: Contact) =>
    Boolean(c.portalLinkSentAt || c.portalLastSeenAt) && !c.portalBlockedAt;
  const untickedWithAccess =
    update.audience === "investors" &&
    contacts.some((c) => hasPortalAccess(c) && (!c.email || !ticked.includes(c.id)));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2 md:pt-5`}>
        <Link
          to="/app/investors"
          className="mb-1 inline-flex min-h-6 items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <Trans>Back to Investors</Trans>
        </Link>
        <PageHeader
          title={<Trans>Update</Trans>}
          meta={
            <>
              <Badge variant={update.status === "partly_sent" ? "destructive" : "secondary"}>
                {names[update.status]}
              </Badge>
              {draft ? (
                <span className="text-xs text-muted-foreground" role="status">
                  {saveState === "saving" ? (
                    <Trans>Saving…</Trans>
                  ) : saveState === "failed" ? (
                    <span className="text-destructive">
                      <Trans>Not saved</Trans>
                    </span>
                  ) : (
                    <Trans>Saved</Trans>
                  )}
                </span>
              ) : null}
            </>
          }
        />
      </div>

      <div className={`rk-scroll min-h-0 flex-1 overflow-y-auto ${PAGE_GUTTER_X} pb-4`}>
        <div className="flex max-w-3xl flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="update-subject">
              <Trans>Subject</Trans>
            </Label>
            <Input
              id="update-subject"
              value={subject}
              disabled={!draft}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          {draft && gmail ? (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">
                <Trans>To</Trans>
              </legend>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {update.audience === "board" ? (
                    <Trans>No board members yet</Trans>
                  ) : (
                    <Trans>No investors yet</Trans>
                  )}
                </p>
              ) : null}
              {contacts.map((contact) => {
                const noEmail = !contact.email;
                const revoked = Boolean(contact.portalBlockedAt);
                const checked = !noEmail && !revoked && ticked.includes(contact.id);
                return (
                  <div
                    key={contact.id}
                    className={`flex min-h-9 items-center gap-2 text-sm pointer-coarse:min-h-11 ${noEmail || revoked ? "text-muted-foreground" : ""}`}
                  >
                    <Checkbox
                      id={`to-${contact.id}`}
                      checked={checked}
                      disabled={noEmail || revoked}
                      onCheckedChange={(next) =>
                        setTicked((current) =>
                          next
                            ? [...current.filter((id) => id !== contact.id), contact.id]
                            : current.filter((id) => id !== contact.id),
                        )
                      }
                    />
                    <label
                      htmlFor={`to-${contact.id}`}
                      className="flex min-w-0 flex-1 items-center gap-2 py-1"
                    >
                      <span className="min-w-0 truncate">{contact.name}</span>
                      <span className="min-w-0 truncate text-xs text-muted-foreground">
                        {noEmail ? (
                          <Trans>no email</Trans>
                        ) : revoked ? (
                          <Trans>revoked</Trans>
                        ) : (
                          contact.email
                        )}
                      </span>
                    </label>
                  </div>
                );
              })}
              {untickedWithAccess ? (
                <p className="text-sm text-muted-foreground">
                  <Trans>Unticked investors still see this on the portal.</Trans>
                </p>
              ) : null}
            </fieldset>
          ) : null}

          {total > 0 ? (
            <ul className="flex flex-col" aria-label={t`Recipients`}>
              {update.deliveries.map((delivery) => (
                <li
                  key={delivery.contactId}
                  className="flex min-h-9 items-center gap-2 border-t border-border text-sm first:border-t-0"
                >
                  <span className="min-w-0 flex-1 truncate">{delivery.name}</span>
                  <span
                    className={
                      delivery.state === "failed" || delivery.state === "unknown"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {states[delivery.state]}
                  </span>
                  {/* The slot is reserved so rows do not shift when Retry appears. */}
                  <span className="inline-flex min-w-16 justify-end">
                    {delivery.state === "failed" || delivery.state === "unknown" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || sending}
                        onClick={() =>
                          delivery.state === "unknown"
                            ? setResend([delivery.contactId])
                            : retry([delivery.contactId])
                        }
                      >
                        <Trans>Retry</Trans>
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {resend ? (
            <div
              role="alertdialog"
              aria-label={t`May already be delivered. Send again?`}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <span className="min-w-0 flex-1">
                <Trans>May already be delivered. Send again?</Trans>
              </span>
              <Button size="sm" onClick={() => retry(resend, true)}>
                <Trans>Send again</Trans>
              </Button>
              <Button variant="outline" size="sm" onClick={() => markDelivered(resend)}>
                <Trans>Mark delivered</Trans>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t`Close`}
                onClick={() => setResend(null)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                <Trans>Body</Trans>
              </span>
              {draft && bodyEmpty ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={drafting}
                  onClick={() => void draftWithAgent()}
                >
                  {drafting ? <Trans>Drafting…</Trans> : <Trans>Draft with agent</Trans>}
                </Button>
              ) : null}
            </div>
            <div className="min-h-64 rounded-lg border border-input [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-0.5 [&_p]:my-2">
              <EditorContent editor={editor} />
            </div>
          </div>

          {draft && accounts && accounts.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="update-from">
                <Trans>From</Trans>
              </Label>
              <NativeSelect
                id="update-from"
                value={from ?? accounts[0]?.connectionId ?? ""}
                onChange={(event) => setFrom(event.target.value)}
              >
                {accounts.map((account) => (
                  <NativeSelectOption key={account.connectionId} value={account.connectionId}>
                    {accountText(account)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          {actionError ? (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          ) : null}
        </div>
      </div>

      {draft || sending || update.status === "partly_sent" ? (
        <div
          className={`flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border py-3 ${PAGE_GUTTER_X}`}
        >
          {update.status === "partly_sent" ? (
            <>
              <span className="me-auto text-sm text-muted-foreground">
                <Trans>
                  {delivered} of {total} sent
                </Trans>
              </span>
              {hasUnknown ? (
                <Button variant="outline" disabled={busy} onClick={() => markDelivered()}>
                  <Trans>Mark delivered</Trans>
                </Button>
              ) : null}
              <Button onClick={() => navigate("/app/investors")}>
                <Trans>Done</Trans>
              </Button>
            </>
          ) : sending ? (
            <Button disabled>
              <Trans>Sending</Trans>
            </Button>
          ) : !gmail && update.audience === "board" ? (
            <Button render={<Link to="/app/integrations" />}>
              <Trans>Connect Gmail to send</Trans>
            </Button>
          ) : asking === "tbd" ? (
            <>
              <span className="me-auto text-sm" role="alert">
                {t`${tbd} TBD left. Send anyway?`}
              </span>
              <Button variant="outline" onClick={() => setAsking(null)}>
                <Trans>Keep editing</Trans>
              </Button>
              <Button disabled={busy} onClick={gmail ? send : post}>
                <Trans>Send anyway</Trans>
              </Button>
            </>
          ) : !gmail ? (
            <>
              <Button variant="outline" render={<Link to="/app/integrations" />}>
                <Trans>Connect Gmail</Trans>
              </Button>
              <Button disabled={busy || drafting || bodyEmpty} onClick={tryPost}>
                <Trans>Post to portal</Trans>
              </Button>
            </>
          ) : (
            <Button
              disabled={busy || drafting || recipients.length === 0 || bodyEmpty}
              onClick={trySend}
            >
              <Trans>Send</Trans>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
