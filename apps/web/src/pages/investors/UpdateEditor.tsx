import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  Contact,
  InvestorDeliveryState,
  InvestorUpdate,
  MailAccountSummary,
} from "@rakazo/contracts";
import { THREAD_MESSAGE_MAX_LENGTH } from "@rakazo/contracts";
import { newClientId } from "@rakazo/core";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  enqueueNotificationToast,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Textarea,
} from "@rakazo/ui-web";
import { EditorContent } from "@tiptap/react";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useComposeEditor } from "../../components/compose/RichTextEditor";
import { PAGE_GUTTER_X, PageHeader } from "../../components/PageHeader";
import { updateStatusNames } from "../../lib/investor-updates-list";
import { UNDO_SEND_MS } from "../../lib/outbox";
import { usePollWhile, useReloadWhenAgentIdle } from "../../lib/page-data";
import { rpc, selectedSpaceId } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { countTbd, TbdHighlight } from "./tbd-highlight";

/** How often a running send is read again, and how long a draft without pending consent is waited for. */
const SENDING_POLL_MS = 1500;
const DRAFT_WAIT_MS = 3 * 60_000;
const CONSENT_POLL_MS = 1500;
const SAVE_DELAY_MS = 600;

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

type DraftContext = { highlights: string; lowlights: string; asks: string };
const EMPTY_DRAFT_CONTEXT: DraftContext = { highlights: "", lowlights: "", asks: "" };

function investorDraftPrompt(update: InvestorUpdate, context: DraftContext): string {
  return `Use the investor-update skill to write the ${update.audience} update for ${update.period} into the existing draft ${update.id}: read it with investor_update_draft get, then save the body with investor_update_draft save. The founder supplied this period context; treat it as a source for their stated highlights, lowlights, and asks. Do not ask for it again. Source other factual claims from available tools and use TBD for facts you cannot verify.\n\nHighlights:\n${context.highlights.trim() || "Skipped: TBD"}\n\nLowlights:\n${context.lowlights.trim() || "Skipped: TBD"}\n\nAsks:\n${context.asks.trim() || "Skipped: TBD"}\n\nSave as a draft only; never send or post it.`;
}

const isConflict = (cause: unknown) => (cause as { code?: string } | null)?.code === "CONFLICT";

/** Stops Send/Post when a queued save found the draft changed elsewhere. */
const conflictError = () =>
  Object.assign(new Error("This update changed elsewhere."), { code: "CONFLICT" });

/** The update editor page: `/app/investors/updates/:id`. */
export function UpdateEditor({
  updateId,
  agentBusy,
  spaceId,
}: {
  updateId: string;
  agentBusy?: boolean;
  /** The active Space at editor entry; a draft run must stay in this scope. */
  spaceId?: string | null;
}) {
  const navigate = useNavigate();
  const activeSpaceId = useRef(spaceId === undefined ? selectedSpaceId() : spaceId).current;
  const spaceContext = useMemo(() => ({ context: { spaceId: activeSpaceId } }), [activeSpaceId]);
  const [update, setUpdate] = useState<InvestorUpdate | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [accounts, setAccounts] = useState<MailAccountSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ticked, setTicked] = useState<string[]>([]);
  const [from, setFrom] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed" | "conflict">("saved");
  const latestLoad = useRef(0);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [draftHighlights, setDraftHighlights] = useState("");
  const [draftLowlights, setDraftLowlights] = useState("");
  const [draftAsks, setDraftAsks] = useState("");
  const [draftContextError, setDraftContextError] = useState("");
  const submittedDraftContext = useRef<DraftContext | null>(null);
  const [draftState, setDraftState] = useState<
    | { kind: "idle" }
    | { kind: "running" }
    | { kind: "consent"; botId: string; messageId: string; confirmedPending: boolean }
    | { kind: "denied"; botId: string; messageId: string }
    | { kind: "closed"; botId: string; messageId: string }
  >({ kind: "idle" });
  const [draftContextAsked, setDraftContextAsked] = useState(false);
  const draftRequestId = useRef(0);
  const updateIdRef = useRef(updateId);
  updateIdRef.current = updateId;
  const [asking, setAsking] = useState<"tbd" | null>(null);
  const [resend, setResend] = useState<string[] | null>(null);
  const [partError, setPartError] = useState("");
  const [contactsFailed, setContactsFailed] = useState(false);
  const [reloads, setReloads] = useState(0);
  const contactRequest = useRef(0);
  const contactLookup = useRef<{ key: string } | null>(null);
  // Send is held for UNDO_SEND_MS so the founder can take it back.
  const [holding, setHolding] = useState(false);
  const held = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const live = useRef(true);
  const loadedId = useRef<string | null>(null);
  // Set in the same batch as the fields, so autosave never sees them half taken.
  const [fieldsFor, setFieldsFor] = useState<string | null>(null);
  // The fields as the server last held them, so opening an update does not save it again.
  const saved = useRef("");
  // The server version the fields were read from; sent on every save so a stale write is refused.
  const version = useRef<string | null>(null);
  // A save actually on the wire, and a count of refused saves (see flushSave).
  const inflight = useRef(0);
  const conflicts = useRef(0);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef<{
    subject: string;
    body: string;
    ticked: string[];
    from: string | null;
    key: string;
  } | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = useCallback(
    (fields: {
      subject: string;
      body: string;
      recipientContactIds: string[];
      fromConnectionId: string | null;
    }) => {
      inflight.current += 1;
      // The version is read when the request starts, not when it was scheduled.
      return rpc.investors.updates
        .save({ id: updateId, ...fields, updatedAt: version.current ?? undefined }, spaceContext)
        .finally(() => {
          inflight.current -= 1;
        });
    },
    [spaceContext, updateId],
  );

  // Leaving within the autosave delay still saves the last edit. A refused save is dropped: the
  // newer version stays.
  useEffect(
    () => () => {
      const last = pending.current;
      if (last)
        void saveNow({
          subject: last.subject,
          body: last.body,
          recipientContactIds: last.ticked,
          fromConnectionId: last.from,
        }).catch(() => undefined);
    },
    [updateId, saveNow, spaceContext],
  );
  const wasSending = useRef(false);
  // Leaving during the hold sends now: the founder believes the update went out.
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (!held.current) return;
      clearTimeout(held.current.timer);
      void rpc.investors.updates.send({ id: held.current.id }, spaceContext).catch(() => undefined);
      held.current = null;
    };
  }, []);

  // A revoked contact is never emailed: it is left out of the recipients whatever was saved.
  const recipients = useMemo(() => {
    // The portal block means nothing for the board.
    const revoked = new Set(
      contacts
        .filter((c) => c.portalBlockedAt && update?.audience === "investors")
        .map((c) => c.id),
    );
    return ticked.filter((id) => !revoked.has(id));
  }, [contacts, ticked, update?.audience]);
  const emailRecipients = useMemo(() => {
    const emailable = new Set(
      contacts.filter((contact) => Boolean(contact.email)).map((contact) => contact.id),
    );
    return recipients.filter((id) => emailable.has(id));
  }, [contacts, recipients]);

  const draft = update?.status === "draft";
  // Until the lookup answers (or if it fails) assume Gmail, so Post to portal is never offered by mistake.
  const gmail = accounts === null || accounts.length > 0;

  const editor = useComposeEditor({
    disabled: !draft,
    markdown: true,
    extensions: [TbdHighlight],
    onLinkShortcut: () => {},
    onChange: (value) => {
      setBody(value.markdown ?? "");
    },
  });

  const loadContacts = useCallback(
    (next: InvestorUpdate, retry = false) => {
      const kind = next.audience === "board" ? "board" : "investor";
      const key = `${next.id}:${kind}`;
      if (!retry && contactLookup.current?.key === key) return;

      const request = ++contactRequest.current;
      contactLookup.current = { key };
      setContacts([]);
      setContactsLoaded(false);
      setContactsFailed(false);
      void rpc.contacts
        .list({ kind }, spaceContext)
        .then((list) => {
          if (contactRequest.current !== request || contactLookup.current?.key !== key) return;
          setContacts(list);
          setContactsLoaded(true);
        })
        .catch((cause) => {
          if (contactRequest.current !== request || contactLookup.current?.key !== key) return;
          setContactsFailed(true);
          setContactsLoaded(true);
          setPartError(errorText(cause, t`Could not load recipients`));
        });
    },
    [spaceContext],
  );

  const load = useCallback(
    async (retryContacts = false) => {
      const request = ++latestLoad.current;
      try {
        const next = await rpc.investors.updates.get({ id: updateId }, spaceContext);
        if (request !== latestLoad.current) return null;
        setUpdate(next);
        setLoadError("");
        loadContacts(next, retryContacts);
        return next;
      } catch (cause) {
        if (request !== latestLoad.current) return null;
        if ((cause as { code?: string } | null)?.code === "NOT_FOUND") setUpdate(null);
        setLoadError(errorText(cause, t`Could not load this update`));
        return null;
      }
    },
    [loadContacts, spaceContext, updateId],
  );

  // First load: the update, the audience's contacts and the Gmail accounts.
  useEffect(() => {
    let current = true;
    const failed = (cause: unknown) =>
      current && setPartError(errorText(cause, t`Could not load recipients`));
    setPartError("");
    setContactsFailed(false);
    setContacts([]);
    setContactsLoaded(false);
    setAccounts(null);
    contactRequest.current += 1;
    contactLookup.current = null;
    void load(true);
    void rpc.investors.updates
      .accounts(undefined, spaceContext)
      .then((list) => current && setAccounts(list))
      .catch(failed);
    return () => {
      current = false;
      latestLoad.current += 1;
      contactRequest.current += 1;
    };
  }, [load, reloads, spaceContext]);

  // Fields take the server's values: first load, a refused save, or the agent's finished turn.
  const seedFields = useCallback(
    (next: InvestorUpdate) => {
      setSubject(next.subject);
      setBody(next.body);
      setTicked(next.recipientContactIds);
      setFrom(next.fromConnectionId);
      saved.current = fieldsKey(
        next.subject,
        next.body,
        next.recipientContactIds,
        next.fromConnectionId,
      );
      version.current = next.updatedAt;
      editor?.commands.setContent(next.body, { contentType: "markdown", emitUpdate: false });
    },
    [editor],
  );

  // Fields take the stored values once per update, then belong to the founder.
  useEffect(() => {
    if (!update || !editor || loadedId.current === update.id) return;
    loadedId.current = update.id;
    setFieldsFor(update.id);
    seedFields(update);
    setSaveState("saved");
  }, [update, editor, seedFields]);

  // A save came back CONFLICT: the draft changed on the server (the agent, another tab). Take
  // theirs and say so; a sent update just goes read-only through `update`.
  const applyConflict = useCallback(
    async (cause: unknown): Promise<boolean> => {
      if (!isConflict(cause)) return false;
      conflicts.current += 1;
      const next = await load();
      if (next?.status !== "draft" || !live.current) return true;
      pending.current = null;
      seedFields(next);
      setSaveState("conflict");
      return true;
    },
    [load, seedFields],
  );

  // A sent update is read-only; the editor follows the status.
  useEffect(() => {
    editor?.setEditable(draft === true && !drafting && !holding, false);
  }, [editor, draft, drafting, holding]);

  // Autosave when a field differs from what the server holds.
  useEffect(() => {
    const key = fieldsKey(subject, body, recipients, from);
    if (!draft || fieldsFor !== updateId || key === saved.current) return;
    setSaveState("saving");
    pending.current = { subject, body, ticked: recipients, from, key };
    const timer = setTimeout(() => {
      if (autosaveTimer.current === timer) autosaveTimer.current = null;
      // One save at a time, in order, so an older request cannot land after a newer one.
      saving.current = saving.current
        .then(() =>
          saveNow({ subject, body, recipientContactIds: recipients, fromConnectionId: from }),
        )
        .then((next) => {
          if (next) version.current = next.updatedAt;
          saved.current = key;
          if (pending.current?.key === key) pending.current = null;
          setSaveState("saved");
        })
        .catch(async (cause) => {
          if (await applyConflict(cause)) return;
          setSaveState("failed");
        });
    }, SAVE_DELAY_MS);
    autosaveTimer.current = timer;
    return () => {
      clearTimeout(timer);
      if (autosaveTimer.current === timer) autosaveTimer.current = null;
    };
  }, [subject, body, recipients, from, draft, updateId, fieldsFor, saveNow, applyConflict]);

  // When a docked agent turn ends, take what it wrote — unless the founder is mid-edit, in which
  // case the version check catches the next save instead.
  const refreshAfterAgent = useCallback(async () => {
    const next = await load();
    if (
      !live.current ||
      next?.status !== "draft" ||
      held.current ||
      drafting ||
      pending.current !== null ||
      inflight.current > 0 ||
      fieldsKey(subject, body, recipients, from) !== saved.current
    )
      return;
    seedFields(next);
  }, [load, drafting, subject, body, recipients, from, seedFields]);
  useReloadWhenAgentIdle(agentBusy, () => void refreshAfterAgent());

  // While a send runs, read it again until it ends.
  const sending = update?.status === "sending";
  usePollWhile(sending, SENDING_POLL_MS, () => void load());

  // A send that ended with every recipient delivered returns to Investors.
  useEffect(() => {
    if (sending) wasSending.current = true;
    if (update?.status !== "sent" || !wasSending.current) return;
    wasSending.current = false;
    const count = update.deliveries.filter((d) => d.state === "sent").length;
    toast(t`Sent to ${count}`);
    navigate("/app/investors?tab=updates");
  }, [update, sending, navigate]);

  const tbd = useMemo(() => countTbd(body), [body]);

  const run = async (action: () => Promise<InvestorUpdate | undefined | undefined>) => {
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
    const before = conflicts.current;
    await saving.current;
    // A queued save was refused while waiting: theirs is already on screen, so stop.
    if (conflicts.current !== before) throw conflictError();
    pending.current = null;
    try {
      const next = await saveNow({
        subject,
        body,
        recipientContactIds: recipients,
        fromConnectionId: from,
      });
      version.current = next.updatedAt;
      saved.current = fieldsKey(subject, body, recipients, from);
      setSaveState("saved");
      return next;
    } catch (cause) {
      await applyConflict(cause);
      throw cause;
    }
  };

  /** Finish a debounce (or save its newest pending value) before reading the draft for agent work. */
  const flushPendingDraftSave = async () => {
    const before = conflicts.current;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = null;
    await saving.current;
    if (conflicts.current !== before) throw conflictError();

    const key = fieldsKey(subject, body, recipients, from);
    if (key === saved.current) {
      pending.current = null;
      return;
    }
    const queued = pending.current?.key === key ? pending.current : null;
    try {
      const next = await saveNow({
        subject: queued?.subject ?? subject,
        body: queued?.body ?? body,
        recipientContactIds: queued?.ticked ?? recipients,
        fromConnectionId: queued?.from ?? from,
      });
      version.current = next.updatedAt;
      saved.current = key;
      if (pending.current?.key === key) pending.current = null;
      setSaveState("saved");
    } catch (cause) {
      await applyConflict(cause);
      throw cause;
    }
  };

  const send = () => {
    setAsking(null);
    setBusy(true);
    setActionError("");
    flushSave()
      .then(() => {
        if (!live.current) return;
        const id = updateId;
        const timer = setTimeout(() => {
          held.current = null;
          setHolding(false);
          void run(() => {
            wasSending.current = true;
            return rpc.investors.updates.send({ id }, spaceContext);
          });
        }, UNDO_SEND_MS);
        held.current = { id, timer };
        setHolding(true);
      })
      .catch((cause) => {
        // A conflict put the server's version on screen; the founder presses Send again.
        if (live.current && !isConflict(cause)) setActionError(errorText(cause));
      })
      .finally(() => live.current && setBusy(false));
  };
  const undo = () => {
    if (held.current) clearTimeout(held.current.timer);
    held.current = null;
    setHolding(false);
  };
  const trySend = () => (tbd > 0 ? setAsking("tbd") : send());

  /** Post to portal, for a founder with no Gmail: no email goes out from here, only portal notices. */
  const post = () => {
    setAsking(null);
    void run(async () => {
      try {
        await flushSave();
      } catch (cause) {
        if (isConflict(cause)) return undefined;
        throw cause;
      }
      const result = await rpc.investors.updates.post({ id: updateId }, spaceContext);
      toast(t`Posted · ${result.notified} notified`);
      navigate("/app/investors?tab=updates");
      return result.update;
    });
  };
  const tryPost = () => (tbd > 0 ? setAsking("tbd") : post());

  const retry = (contactIds: string[], resendUnknown = false) => {
    setResend(null);
    wasSending.current = true;
    void run(() =>
      rpc.investors.updates.retry({ id: updateId, contactIds, resendUnknown }, spaceContext),
    );
  };
  const markDelivered = (contactIds?: string[]) => {
    setResend(null);
    void run(() => rpc.investors.updates.markDelivered({ id: updateId, contactIds }, spaceContext));
  };

  /** Asks the Investors agent to write the body into this draft, then waits for it to appear. */
  const draftWithAgent = async (context?: {
    highlights: string;
    lowlights: string;
    asks: string;
  }) => {
    if (!update) return;
    const submittedContext = context ?? submittedDraftContext.current ?? EMPTY_DRAFT_CONTEXT;
    const draftText = investorDraftPrompt(update, submittedContext);
    if (draftText.length > THREAD_MESSAGE_MAX_LENGTH) {
      setDraftContextError(t`This context is too long. Shorten it and try again.`);
      setDraftPromptOpen(true);
      return;
    }
    submittedDraftContext.current = submittedContext;
    setDraftContextError("");
    setDraftContextAsked(true);
    setDraftPromptOpen(false);
    const requestId = ++draftRequestId.current;
    const isCurrentRequest = () =>
      live.current && draftRequestId.current === requestId && updateIdRef.current === updateId;
    setDrafting(true);
    setDraftState({ kind: "running" });
    setActionError("");
    try {
      await flushPendingDraftSave();
      if (!isCurrentRequest()) return;
      const baseline = await rpc.investors.updates.get({ id: updateId }, spaceContext);
      if (!isCurrentRequest()) return;
      if (baseline.body.trim()) {
        setUpdate(baseline);
        seedFields(baseline);
        setDrafting(false);
        setDraftState({ kind: "idle" });
        return;
      }
      const bot = await rpc.investors.agent(undefined, spaceContext);
      if (!isCurrentRequest()) return;
      const { runId, seq } = await rpc.threads.send(
        {
          botId: bot.id,
          clientNonce: newClientId(),
          text: draftText,
        },
        spaceContext,
      );
      let until = Date.now() + DRAFT_WAIT_MS;
      let approved = false;
      let waitingForConsent = false;
      const handledClosedCards = new Set<string>();
      while (live.current && (waitingForConsent || Date.now() < until)) {
        await new Promise((resolve) => setTimeout(resolve, CONSENT_POLL_MS));
        if (!isCurrentRequest()) return;
        let thread: Awaited<ReturnType<typeof rpc.threads.get>>;
        try {
          thread = await rpc.threads.get({ botId: bot.id }, spaceContext);
        } catch {
          // A read failure says nothing about the consent decision. Keep this run and its
          // review link, then retry the same snapshot instead of submitting a second request.
          continue;
        }
        if (!isCurrentRequest()) return;
        const consentRequests = thread.messages
          .filter((message) => message.runId === runId && message.seq > seq)
          .flatMap((message) =>
            message.blocks
              .filter((block) => block.kind === "ask" && block.consent)
              .map((block) => ({ message, block })),
          )
          .sort((left, right) => left.message.seq - right.message.seq);
        const consentRequest = consentRequests.at(-1);
        if (consentRequest?.block.kind === "ask" && consentRequest.block.consent) {
          if (consentRequest.block.status === "pending" || !consentRequest.block.status) {
            setDraftState({
              kind: "consent",
              botId: bot.id,
              messageId: consentRequest.message.id,
              confirmedPending: consentRequest.block.status === "pending",
            });
            waitingForConsent = consentRequest.block.status === "pending";
            approved = false;
            continue;
          }
          const answer = consentRequest.block.answer;
          const runIsActive =
            thread.activeRuns?.some((run) => run.id === runId) ||
            (thread.run?.id === runId &&
              ["queued", "leased", "running", "waiting_input", "waiting_takeover"].includes(
                thread.run.status,
              ));
          if (answer === "deny" && runIsActive) {
            // An Allow on an old disclosure version is recorded as deny, then requeues
            // the same run to ask again with the current disclosure.
            waitingForConsent = false;
            if (!handledClosedCards.has(consentRequest.message.id)) {
              handledClosedCards.add(consentRequest.message.id);
              until = Date.now() + DRAFT_WAIT_MS;
            }
            setDraftState({ kind: "running" });
            continue;
          }
          if (answer === "superseded" && runIsActive) {
            // The replacement card may not be in this snapshot yet.
            waitingForConsent = false;
            if (!handledClosedCards.has(consentRequest.message.id)) {
              handledClosedCards.add(consentRequest.message.id);
              until = Date.now() + DRAFT_WAIT_MS;
            }
            setDraftState({ kind: "running" });
            continue;
          }
          if (
            answer === "expired" ||
            answer === "stopped" ||
            answer === "superseded" ||
            answer === "skipped"
          ) {
            setDraftState({
              kind: "closed",
              botId: bot.id,
              messageId: consentRequest.message.id,
            });
            setDrafting(false);
            return;
          }
          if (answer !== "allow") {
            setDraftState({
              kind: "denied",
              botId: bot.id,
              messageId: consentRequest.message.id,
            });
            setDrafting(false);
            return;
          }
          if (!approved) until = Date.now() + DRAFT_WAIT_MS;
          waitingForConsent = false;
          approved = true;
          setDraftState({ kind: "running" });
        }
        let next: Awaited<ReturnType<typeof rpc.investors.updates.get>>;
        try {
          next = await rpc.investors.updates.get({ id: updateId }, spaceContext);
        } catch {
          // A failed draft read is transient too; keep polling this same send.
          continue;
        }
        if (!isCurrentRequest()) return;
        if (next.body.trim() && next.body !== baseline.body) {
          setUpdate(next);
          setBody(next.body);
          editor?.commands.setContent(next.body, { contentType: "markdown", emitUpdate: false });
          version.current = next.updatedAt;
          saved.current = fieldsKey(
            next.subject,
            next.body,
            next.recipientContactIds,
            next.fromConnectionId,
          );
          setDrafting(false);
          setDraftState({ kind: "idle" });
          return;
        }
      }
      toast(t`The agent did not finish a draft`);
    } catch (cause) {
      if (!isCurrentRequest()) return;
      toast(errorText(cause, t`Could not draft with the agent`));
    }
    if (isCurrentRequest()) setDrafting(false);
    if (isCurrentRequest()) setDraftState({ kind: "idle" });
  };

  useEffect(() => {
    draftRequestId.current += 1;
    setDrafting(false);
    setDraftState({ kind: "idle" });
    setDraftContextAsked(false);
    setDraftHighlights("");
    setDraftLowlights("");
    setDraftAsks("");
    submittedDraftContext.current = null;
    setDraftContextError("");
  }, [updateId]);

  if (loadError && !update) {
    return (
      <div className={`${PAGE_GUTTER_X} pt-5`}>
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => setReloads((n) => n + 1)}>
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

  const names = updateStatusNames();
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
      <div className={`${PAGE_GUTTER_X} pt-2`}>
        <Link
          to="/app/investors?tab=updates"
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
                  ) : saveState === "conflict" ? (
                    <span className="text-destructive">
                      <Trans>Changed elsewhere</Trans>
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
              disabled={!draft || holding}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          {partError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-destructive">{partError}</span>
              <Button variant="outline" size="sm" onClick={() => setReloads((n) => n + 1)}>
                <Trans>Try again</Trans>
              </Button>
            </div>
          ) : null}

          {draft && gmail && !contactsFailed ? (
            <fieldset aria-busy={!contactsLoaded} className="flex min-w-0 flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">
                <Trans>To</Trans>
              </legend>
              {!contactsLoaded ? (
                <>
                  <p className="sr-only" role="status">
                    {update.audience === "board" ? (
                      <Trans>Loading board members…</Trans>
                    ) : (
                      <Trans>Loading investors…</Trans>
                    )}
                  </p>
                  {[0, 1].map((row) => (
                    <div key={row} aria-hidden="true" className="flex min-h-9 items-center gap-2">
                      <Skeleton className="size-4 rounded-sm" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  ))}
                </>
              ) : contacts.length === 0 ? (
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
                const revoked = Boolean(contact.portalBlockedAt) && update.audience === "investors";
                const checked = !noEmail && !revoked && ticked.includes(contact.id);
                return (
                  <div
                    key={contact.id}
                    className={`flex min-h-9 items-center gap-2 text-sm pointer-coarse:min-h-11 ${noEmail || revoked ? "text-muted-foreground" : ""}`}
                  >
                    <Checkbox
                      id={`to-${contact.id}`}
                      checked={checked}
                      disabled={noEmail || revoked || holding}
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
                  disabled={drafting || holding}
                  onClick={() =>
                    draftContextAsked ? void draftWithAgent() : setDraftPromptOpen(true)
                  }
                >
                  {drafting ? (
                    draftState.kind === "consent" ? (
                      <Trans>Waiting for consent</Trans>
                    ) : (
                      <Trans>Drafting…</Trans>
                    )
                  ) : (
                    <Trans>Draft with agent</Trans>
                  )}
                </Button>
              ) : null}
            </div>
            {draftState.kind === "consent" ? (
              <p role="status" className="text-sm text-muted-foreground">
                {draftState.confirmedPending ? (
                  <Trans>Approval requested</Trans>
                ) : (
                  <Trans>Checking approval status</Trans>
                )}{" "}
                <Link
                  to={`/app/${draftState.botId}?m=${draftState.messageId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Trans>Review request</Trans>
                </Link>
              </p>
            ) : draftState.kind === "denied" ? (
              <p role="status" className="text-sm text-muted-foreground">
                <Trans>Consent was declined</Trans>{" "}
                <Link
                  to={`/app/${draftState.botId}?m=${draftState.messageId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Trans>Review request</Trans>
                </Link>
              </p>
            ) : draftState.kind === "closed" ? (
              <p role="status" className="text-sm text-muted-foreground">
                <Trans>Consent request closed</Trans>{" "}
                <Link
                  to={`/app/${draftState.botId}?m=${draftState.messageId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Trans>Review request</Trans>
                </Link>
              </p>
            ) : null}
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
                disabled={holding}
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

      <Dialog open={draftPromptOpen} onOpenChange={setDraftPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t`Add this period’s highlights`}</DialogTitle>
            <DialogDescription>
              {t`Optional. Anything you leave blank will be checked against available sources or marked TBD.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Textarea
              aria-label={t`Highlights`}
              placeholder={t`Highlights`}
              rows={3}
              value={draftHighlights}
              onChange={(event) => {
                setDraftHighlights(event.target.value);
                setDraftContextError("");
              }}
            />
            <Textarea
              aria-label={t`Lowlights`}
              placeholder={t`Lowlights`}
              rows={3}
              value={draftLowlights}
              onChange={(event) => {
                setDraftLowlights(event.target.value);
                setDraftContextError("");
              }}
            />
            <Textarea
              aria-label={t`Asks`}
              placeholder={t`Asks`}
              rows={3}
              value={draftAsks}
              onChange={(event) => {
                setDraftAsks(event.target.value);
                setDraftContextError("");
              }}
            />
            {draftContextError ? (
              <p role="alert" className="text-sm text-destructive">
                {draftContextError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDraftHighlights("");
                setDraftLowlights("");
                setDraftAsks("");
                void draftWithAgent(EMPTY_DRAFT_CONTEXT);
              }}
            >
              <Trans>Skip</Trans>
            </Button>
            <Button
              onClick={() => {
                void draftWithAgent({
                  highlights: draftHighlights,
                  lowlights: draftLowlights,
                  asks: draftAsks,
                });
              }}
            >
              <Trans>Continue</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Button onClick={() => navigate("/app/investors?tab=updates")}>
                <Trans>Done</Trans>
              </Button>
            </>
          ) : sending ? (
            <Button disabled>
              <Trans>Sending</Trans>
            </Button>
          ) : holding ? (
            <>
              <span className="me-auto text-sm text-muted-foreground" role="status">
                <Trans>Sending…</Trans>
              </span>
              <Button variant="outline" className="pointer-coarse:min-h-11" onClick={undo}>
                <Trans>Undo</Trans>
              </Button>
            </>
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
              disabled={
                busy ||
                drafting ||
                accounts === null ||
                !contactsLoaded ||
                Boolean(partError) ||
                emailRecipients.length === 0 ||
                bodyEmpty
              }
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
