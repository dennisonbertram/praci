import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  Contact,
  PipelineStatus,
  ProspectSaveInput,
  Safe,
  SafeMarkInput,
} from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  enqueueNotificationToast,
} from "@rakazo/ui-web";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AskBotButton } from "../components/AskBotButton";
import type { ContactPrefill as Prefill } from "../components/ContactDialog";
import { ContactDialog } from "../components/ContactDialog";
import { ErrorNotice } from "../components/ErrorNotice";
import { usd } from "../components/fundraising/format";
import { AssignSafeDialog, InvestorEmailDialog } from "../components/fundraising/MercuryDialogs";
import { MercuryLine } from "../components/fundraising/MercuryLine";
import { statusNames } from "../components/fundraising/PipelineControls";
import { PipelineTable } from "../components/fundraising/PipelineTable";
import { RoundCard, RoundDialog } from "../components/fundraising/RoundCard";
import { SafeCoverSummary, SafeDialog } from "../components/fundraising/SafeDialog";
import type { SafeStep } from "../components/fundraising/SafeList";
import { AttentionStrip, MarkDateDialog, SafeList } from "../components/fundraising/SafeList";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { RowsSkeleton } from "../components/RowsSkeleton";
import { SectionCard } from "../components/SectionCard";
import { isoFromDay, todayDay } from "../lib/day-input";
import { centsFromText } from "../lib/dollars-input";
import { connectFinanceProvider } from "../lib/finance-connect";
import { usePageQuery, useReloadWhenAgentIdle } from "../lib/page-data";
import type { PipelineRow, RowEdits } from "../lib/pipeline-rows";
import { callIso, toPipelineRow } from "../lib/pipeline-rows";
import { rpc } from "../lib/rpc";
import { useContactNotices, useWithoutDeleted } from "../lib/use-contact-notices";
import { useRefetchWhileOpen } from "../lib/use-refetch-while-open";
import { errorText } from "../lib/user-error";

/** Mercury's dashboard, where the founder creates the SAFE (Capital, then SAFEs); its API cannot. */
const MERCURY_URL = "https://app.mercury.com";
const openMercury = () => window.open(MERCURY_URL, "_blank", "noopener");

/** Mercury's own document link opens only when it is https. */
const openDocument = (url: string) => {
  if (/^https:\/\//i.test(url)) window.open(url, "_blank", "noopener");
};

const NEW_PROSPECT: Prefill = { name: "", email: null, organization: null, kind: "prospect" };

/** A row with no person yet carries its record's id, so its actions add the first person. */
const hasNoPerson = (prospect: Contact) => prospect.pipelineRecord?.id === prospect.id;
const firstPerson = ({ name, id }: Contact): Prefill => ({
  ...NEW_PROSPECT,
  name,
  pipelineRecordId: id,
});

/** The Fundraising page: the round and the prospect pipeline. */
export function FundraisingPage({
  onShowAgent,
  onAskAbout,
  agentBusy = false,
  spaceName,
}: {
  /** Shown beside the title when the person has more than one space. */
  spaceName?: string;
  onShowAgent?: () => void;
  /** Sends a question to the docked Investors agent; absent when the page has none. */
  onAskAbout?: (question: string) => void;
  /** Whether the Investors agent is answering in the panel; its contact changes load when it ends. */
  agentBusy?: boolean;
}) {
  // A failed background reload keeps the page on screen; the next focus or tick tries again.
  const overviewQuery = usePageQuery(() => rpc.fundraising.overview(), [], {
    fallback: t`Could not load fundraising`,
  });
  const contactsQuery = usePageQuery(() => rpc.contacts.list({}), []);
  // A hint only, so a failed count leaves the last number rather than failing the page.
  const safeCount = usePageQuery(() => rpc.legal.safeCount(), []);
  const overview = overviewQuery.data;
  const contacts = useWithoutDeleted(contactsQuery.data);
  const error = overview ? "" : overviewQuery.error;
  const contactsError = contactsQuery.data
    ? ""
    : contactsQuery.error
      ? t`Could not load contacts`
      : "";
  // SAFEs the Legal agent found in the Data room: a hint only, never counted as raised.
  const legalSafes = safeCount.data?.count ?? 0;
  const [reloadOverview, reloadContacts, reloadSafes] = [
    overviewQuery.reload,
    contactsQuery.reload,
    safeCount.reload,
  ];
  const load = useCallback(() => {
    reloadOverview();
    reloadContacts();
    reloadSafes();
  }, [reloadOverview, reloadContacts, reloadSafes]);
  const [editing, setEditing] = useState<Contact | Prefill | null>(null);
  const [roundDialog, setRoundDialog] = useState<"start" | "edit" | null>(null);
  // Send SAFE for this prospect; then the saved SAFE's cover summary.
  const [sending, setSending] = useState<Contact | null>(null);
  const [cover, setCover] = useState<Safe | null>(null);
  // Send SAFE with Mercury for a prospect that has no email yet, and Assign to contact.
  const [needsEmail, setNeedsEmail] = useState<Contact | null>(null);
  const [assigning, setAssigning] = useState<Safe | null>(null);
  // `previous` set means Change date: the stored ISO the dialog seeds and Undo restores.
  const [marking, setMarking] = useState<{ safe: Safe; step: SafeStep; previous?: string } | null>(
    null,
  );
  const [confirm, setConfirm] = useState<
    { kind: "close"; unpaid: Safe[] } | { kind: "delete"; safe: Safe } | null
  >(null);

  // An agent's or another tab's change appears while the page is open.
  useRefetchWhileOpen(overview !== null, load);
  const container = useRef<HTMLDivElement>(null);
  const { notify, savedId, setSavedId, deleted } = useContactNotices(load, container, contacts);

  // A chat turn can add or change contacts, so reload when the agent finishes answering.
  useReloadWhenAgentIdle(agentBusy, load);

  // Coming back from Mercury after sending a SAFE: pick up the new SAFE, at most once a minute.
  const lastRefresh = useRef(0);
  const waitingOnMercury =
    overview?.mercury.status === "ok" && overview.prospects.some((p) => p.mercurySentAt);
  useEffect(() => {
    if (!waitingOnMercury) return;
    const refresh = () => {
      if (Date.now() - lastRefresh.current < 60_000) return;
      lastRefresh.current = Date.now();
      rpc.fundraising.refresh().then(load, load);
    };
    const onVisible = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [waitingOnMercury, load]);

  const round = overview?.round ?? null;
  const bannerError = error || (overview !== null ? contactsError : "");
  const open = round && !round.closedAt ? round : null;

  const run = (call: () => Promise<unknown>, failure: string) =>
    call()
      .then(load)
      .catch((cause) => notify(errorText(cause, failure)));
  // A row edit only changes the pipeline: re-reading contacts and the Legal count buys nothing.
  const runRows = (call: () => Promise<unknown>, failure: string) =>
    call()
      .then(reloadOverview)
      .catch((cause) => notify(errorText(cause, failure)));
  /** One row change, then a reload; `undo` (when given) puts the row back from the toast. */
  const change = (
    row: PipelineRow,
    changes: Omit<ProspectSaveInput, "id">,
    failure: string,
    toast?: {
      title: string;
      /** What to put back, or a function of what the save left (the server may set more than asked). */
      undo?: Omit<ProspectSaveInput, "id"> | ((saved: Contact) => Omit<ProspectSaveInput, "id">);
    },
  ) =>
    rpc.fundraising.prospects
      .save({ id: row.id, ...changes })
      .then((saved) => {
        reloadOverview();
        if (!toast) return;
        const undo = typeof toast.undo === "function" ? toast.undo(saved) : toast.undo;
        enqueueNotificationToast({
          id: `prospect-${row.id}-${Date.now()}`,
          title: toast.title,
          action: undo
            ? {
                label: t`Undo`,
                onClick: () =>
                  void runRows(
                    () => rpc.fundraising.prospects.save({ id: row.id, ...undo }),
                    t`Could not undo`,
                  ),
              }
            : undefined,
          timeout: 8000,
        });
      })
      .catch((cause) => notify(errorText(cause, failure)));
  // Restoring a commitment from an earlier round would attach it to the open round instead.
  const canRestore = (row: PipelineRow) =>
    !(row.status === "committed" && row.contact.roundId !== (open?.id ?? null));
  // Each Undo puts back only what its change set, and only while the row still has what the save left.
  const restoreStatus = (
    row: PipelineRow,
    saved: Contact,
    to: PipelineStatus,
  ): Omit<ProspectSaveInput, "id"> => {
    // Committing also sets interest to In, so an Undo guarded on status alone would put back the status
    // and leave the interest the save set.
    const interest = toPipelineRow(saved).interest;
    return { status: row.status, interest: row.interest, expect: { status: to, interest } };
  };
  const restoreOut = (row: PipelineRow): Omit<ProspectSaveInput, "id"> => ({
    status: row.status,
    interest: row.interest,
    nextCallAt: row.nextCallAt,
    nextCallHasTime: row.nextCallHasTime,
    expect: { status: "passed", interest: "out", nextCallAt: null },
  });
  const edits: RowEdits = {
    status: (row, status: PipelineStatus) =>
      void change(row, { status }, t`Could not move ${row.name}`, {
        title: t`Moved ${row.name} to ${statusNames()[status]}`,
        undo: canRestore(row) ? (saved: Contact) => restoreStatus(row, saved, status) : undefined,
      }),
    interest: (row, interest) =>
      void change(
        row,
        { interest },
        t`Could not change interest`,
        interest === "out" && row.status !== "passed"
          ? {
              title: t`${row.name}: Interest set to Out, status moved to Passed`,
              undo: canRestore(row) ? restoreOut(row) : undefined,
            }
          : undefined,
      ),
    nextStep: (row, text) =>
      void change(row, { nextStep: text.trim() || null }, t`Could not save the next step`),
    // Rejects on failure so the editor keeps the value and a second attempt saves it.
    nextCall: (row, next) =>
      rpc.fundraising.prospects
        .save({
          id: row.id,
          nextCallAt: next ? callIso(next.day, next.time) : null,
          nextCallHasTime: Boolean(next?.time),
        })
        .then(reloadOverview)
        .catch((cause) => {
          notify(errorText(cause, t`Could not save the next call`));
          throw cause;
        }),
    amount: (row, text) => {
      const checkSizeCents = centsFromText(text);
      if (checkSizeCents === undefined) return notify(t`Enter an amount`);
      void change(row, { checkSizeCents }, t`Could not save the amount`);
    },
    referrer: (row, contactId) =>
      void change(row, { referredByContactId: contactId }, t`Could not save who referred`),
    createReferrer: (row, name) =>
      void rpc.contacts
        .save({ name, kind: "other" })
        .then(({ id }) => {
          // The new "other" contact must be in the Referred by picker next time.
          reloadContacts();
          return change(row, { referredByContactId: id }, t`Could not save who referred`);
        })
        .catch((cause) => notify(errorText(cause, t`Could not add ${name}`))),
    log: (row, { outcome, note, next }) =>
      void rpc.fundraising.calls
        .log({
          id: row.id,
          outcome,
          note: note.trim() || null,
          nextCall:
            next === "keep"
              ? "keep"
              : { at: next.day ? isoFromDay(next.day) : null, hasTime: false },
        })
        .then(({ eventId, movedToMet }) => {
          reloadOverview();
          enqueueNotificationToast({
            id: `call-${eventId}`,
            title: movedToMet ? t`Call logged. ${row.name} moved to Met` : t`Call logged`,
            action: {
              label: t`Undo`,
              onClick: () =>
                void runRows(() => rpc.fundraising.calls.undo({ eventId }), t`Could not undo`),
            },
            timeout: 8000,
          });
        })
        .catch((cause) => notify(errorText(cause, t`Could not log the call`))),
    undoAuto: (row) => {
      const eventId = row.lastAuto?.eventId;
      if (!eventId) return;
      void runRows(() => rpc.fundraising.auto.undo({ eventId }), t`Could not undo`);
    },
  };

  const mercuryConnected = overview ? overview.mercury.status !== "not_connected" : false;
  // With Mercury the SAFE is made there: open it, then mark the prospect Waiting for Mercury.
  function sendSafe(prospect: Contact) {
    if (hasNoPerson(prospect)) return setEditing(firstPerson(prospect));
    if (!mercuryConnected) return setSending(prospect);
    if (!prospect.email?.trim()) return setNeedsEmail(prospect);
    openMercury();
    void run(
      () => rpc.fundraising.prospects.markWaiting({ id: prospect.id }),
      t`Could not mark ${prospect.name} waiting`,
    );
  }
  const connectMercury = (reconnect: boolean) =>
    connectFinanceProvider("mercury", reconnect)
      .then(() => rpc.fundraising.refresh())
      .then(load)
      .catch((cause) => notify(errorText(cause, t`Could not connect Mercury`)));
  const openSafe = (safe: Safe) =>
    safe.source === "mercury" && safe.documentUrl ? openDocument(safe.documentUrl) : setCover(safe);

  const markDone = (): Record<SafeMarkInput["action"], string> => ({
    sent: t`Marked sent`,
    signed: t`Marked signed`,
    funded: t`Marked funded`,
    cancel: t`Canceled`,
  });
  // Records a step with its date, then offers Undo, which clears the date again — or, after a
  // Change date, puts the previous date back.
  async function mark(
    safe: Safe,
    action: SafeMarkInput["action"],
    at: string,
    changed?: { title: string; undoAt: string },
  ) {
    await rpc.fundraising.safes.mark({ id: safe.id, action, at });
    load();
    // Undo clears the date again. It fades after the usual few seconds so it cannot cover the header.
    enqueueNotificationToast({
      id: `safe-${safe.id}-${action}-${Date.now()}`,
      title: changed?.title ?? markDone()[action],
      action: {
        label: t`Undo`,
        onClick: () =>
          void run(
            () => rpc.fundraising.safes.mark({ id: safe.id, action, at: changed?.undoAt ?? null }),
            t`Could not undo`,
          ),
      },
    });
  }
  const closeRound = () => {
    if (!round) return;
    const unpaid = overview?.safes.filter((s) => s.status === "signed" && s.roundId === round.id);
    if (unpaid?.length) return setConfirm({ kind: "close", unpaid });
    void run(() => rpc.fundraising.round.close({ id: round.id }), t`Could not close the round`);
  };

  // "Harbor Angels' $50,000 SAFE", "Ada Fund's $50,000 SAFE".
  const owner = (name: string) => (name.endsWith("s") ? `${name}'` : `${name}'s`);
  const confirmText = (() => {
    if (confirm?.kind === "delete") {
      const { investorName, amountCents } = confirm.safe;
      return t`${owner(investorName)} ${usd(amountCents)} SAFE will be removed.`;
    }
    const first = confirm?.unpaid[0];
    if (confirm?.unpaid.length === 1 && first) {
      const { investorName, amountCents } = first;
      return t`${owner(investorName)} ${usd(amountCents)} SAFE is signed and unpaid.`;
    }
    const count = confirm?.unpaid.length ?? 0;
    return t`${count} SAFEs are signed and unpaid.`;
  })();

  return (
    <div className="@container/bd flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2`}>
        <PageHeader
          title={<Trans>Fundraising</Trans>}
          spaceName={spaceName}
          meta={
            overview ? (
              <MercuryLine
                state={overview.mercury}
                onConnect={() => void connectMercury(false)}
                onRefresh={() => void run(() => rpc.fundraising.refresh(), t`Could not refresh`)}
                onReconnect={() => void connectMercury(true)}
              />
            ) : null
          }
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(NEW_PROSPECT)}>
                <Plus aria-hidden="true" />
                <Trans>Add prospect</Trans>
              </Button>
              {onShowAgent ? (
                <AskBotButton botName="Investors agent" onClick={onShowAgent} />
              ) : null}
            </>
          }
        />
      </div>

      <div ref={container} className={`rk-scroll flex-1 overflow-y-auto ${PAGE_GUTTER_X} pb-6`}>
        {bannerError ? <ErrorNotice message={bannerError} onRetry={load} className="mb-4" /> : null}

        {overview === null ? (
          error ? null : (
            <RowsSkeleton variant="bars" rows={3} />
          )
        ) : (
          <div className="flex flex-col gap-4">
            <AttentionStrip
              safes={overview.safes}
              onOpen={openSafe}
              onMark={(safe, step) => setMarking({ safe, step })}
            />

            <RoundCard
              round={round}
              pendingCents={overview.pendingCents}
              signedCents={overview.signedCents}
              fundedCents={overview.fundedCents}
              onStart={() => setRoundDialog("start")}
              onEdit={() => setRoundDialog("edit")}
              onClose={closeRound}
              onReopen={() =>
                round &&
                void run(
                  () => rpc.fundraising.round.reopen({ id: round.id }),
                  t`Could not reopen the round`,
                )
              }
            />

            <PipelineTable
              prospects={overview.prospects}
              contacts={contactsQuery.data === null ? null : (contacts ?? [])}
              edits={edits}
              savedId={savedId}
              filledSend={Boolean(open)}
              onSendSafe={sendSafe}
              onOpenMercury={openMercury}
              onNotSent={(prospect) =>
                void run(
                  () => rpc.fundraising.prospects.notSent({ id: prospect.id }),
                  t`Could not undo Send SAFE`,
                )
              }
              onEdit={(prospect) =>
                setEditing(hasNoPerson(prospect) ? firstPerson(prospect) : prospect)
              }
              onAskAbout={onAskAbout}
            />

            <SectionCard title={t`SAFEs`}>
              {overview.safes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Trans>No SAFEs yet</Trans>
                  {legalSafes > 0 ? (
                    <>
                      {" · "}
                      <Link to="/app/legal" className="underline underline-offset-2">
                        {legalSafes === 1
                          ? t`1 SAFE found in Legal`
                          : t`${legalSafes} SAFEs found in Legal`}
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : (
                <SafeList
                  keepId={cover?.id}
                  safes={overview.safes}
                  round={round}
                  contacts={contacts ?? []}
                  onOpen={openSafe}
                  onAssign={contactsQuery.data === null ? undefined : setAssigning}
                  onUnassign={(safe) =>
                    void run(
                      () => rpc.fundraising.safes.unassign({ id: safe.id }),
                      t`Could not unassign`,
                    )
                  }
                  onMark={(safe, step) => setMarking({ safe, step })}
                  onChangeDate={(safe, step, at) => setMarking({ safe, step, previous: at })}
                  onCancel={(safe) =>
                    void run(
                      () => mark(safe, "cancel", isoFromDay(todayDay())),
                      t`Could not cancel`,
                    )
                  }
                  onDelete={(safe) => setConfirm({ kind: "delete", safe })}
                />
              )}
            </SectionCard>
          </div>
        )}

        {roundDialog ? (
          <RoundDialog
            round={roundDialog === "edit" ? open : null}
            onClose={() => setRoundDialog(null)}
            onSave={async (input) => {
              await rpc.fundraising.round.save({
                ...input,
                ...(roundDialog === "edit" && open ? { id: open.id } : {}),
              });
              load();
            }}
          />
        ) : null}
        {sending ? (
          <SafeDialog
            prospect={sending}
            round={open}
            onClose={() => setSending(null)}
            onSave={async (input) => {
              const saved = await rpc.fundraising.safes.save(input);
              setSending(null);
              setCover(saved);
              load();
            }}
          />
        ) : null}
        {needsEmail ? (
          <InvestorEmailDialog
            onClose={() => setNeedsEmail(null)}
            onSave={async (email) => {
              // Opened first, while the click still counts, so the browser does not block it.
              openMercury();
              await rpc.contacts.save({ id: needsEmail.id, name: needsEmail.name, email });
              await rpc.fundraising.prospects.markWaiting({ id: needsEmail.id });
              setNeedsEmail(null);
              load();
            }}
          />
        ) : null}
        {assigning ? (
          <AssignSafeDialog
            contacts={contacts ?? []}
            onClose={() => setAssigning(null)}
            onAssign={async (contactId) => {
              await rpc.fundraising.safes.assign({ id: assigning.id, contactId });
              setAssigning(null);
              load();
            }}
          />
        ) : null}
        {cover ? (
          <SafeCoverSummary
            safe={overview?.safes.find((s) => s.id === cover.id) ?? cover}
            onClose={() => setCover(null)}
            onMarkSent={async () => {
              await mark(cover, "sent", isoFromDay(todayDay()));
              setCover(null);
            }}
          />
        ) : null}
        {marking ? (
          <MarkDateDialog
            step={marking.step}
            changeDay={marking.previous?.slice(0, 10)}
            onClose={() => setMarking(null)}
            onSave={async (day) => {
              const { safe, step, previous } = marking;
              // The day it already has is a no-op: close with no RPC and no toast.
              if (previous !== undefined && day === previous.slice(0, 10)) {
                setMarking(null);
                return;
              }
              await mark(
                safe,
                step,
                isoFromDay(day),
                previous === undefined ? undefined : { title: t`Date changed`, undoAt: previous },
              );
              setMarking(null);
            }}
          />
        ) : null}
        <AlertDialog open={confirm !== null} onOpenChange={(next) => !next && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirm?.kind === "delete" ? (
                  <Trans>Delete SAFE?</Trans>
                ) : (
                  <Trans>Close round?</Trans>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>{confirmText}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Cancel</Trans>
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const target = confirm;
                  setConfirm(null);
                  if (target?.kind === "delete")
                    void run(
                      () => rpc.fundraising.safes.delete({ id: target.safe.id }),
                      t`Could not delete the SAFE`,
                    );
                  else if (round)
                    void run(
                      () => rpc.fundraising.round.close({ id: round.id }),
                      t`Could not close the round`,
                    );
                }}
              >
                {confirm?.kind === "delete" ? <Trans>Delete</Trans> : <Trans>Close round</Trans>}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {editing ? (
          <ContactDialog
            key={"id" in editing ? editing.id : "new"}
            contact={"id" in editing ? editing : null}
            prefill={"id" in editing ? undefined : editing}
            contacts={contacts ?? []}
            onClose={() => setEditing(null)}
            onSaved={(saved) => {
              load();
              setSavedId(saved.id);
              notify(t`Saved ${saved.name}`);
            }}
            onDeleted={deleted}
            onOpenContact={setEditing}
          />
        ) : null}
      </div>
    </div>
  );
}
