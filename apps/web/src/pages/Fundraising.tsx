import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  Contact,
  ContactStage,
  FundraisingOverview,
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
  Card,
  enqueueNotificationToast,
  Skeleton,
} from "@rakazo/ui-web";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AskBotButton } from "../components/AskBotButton";
import type { ContactPrefill as Prefill } from "../components/ContactDialog";
import { ContactDialog } from "../components/ContactDialog";
import { AssignSafeDialog, InvestorEmailDialog } from "../components/fundraising/MercuryDialogs";
import { MercuryLine } from "../components/fundraising/MercuryLine";
import { Pipeline } from "../components/fundraising/Pipeline";
import { RoundCard, RoundDialog } from "../components/fundraising/RoundCard";
import { SafeCoverSummary, SafeDialog } from "../components/fundraising/SafeDialog";
import type { SafeStep } from "../components/fundraising/SafeList";
import { AttentionStrip, MarkDateDialog, SafeList } from "../components/fundraising/SafeList";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { isoFromDay, todayDay } from "../lib/day-input";
import { connectFinanceProvider } from "../lib/finance-connect";
import { usdFigure } from "../lib/finance-format";
import { rpc } from "../lib/rpc";
import { useContactNotices } from "../lib/use-contact-notices";
import { errorText } from "../lib/user-error";

const usd = (cents: number) => usdFigure(cents / 100, 0, i18n.locale || "en");

/** Mercury's dashboard, where the founder creates the SAFE (Capital, then SAFEs); its API cannot. */
const MERCURY_URL = "https://app.mercury.com";
const openMercury = () => window.open(MERCURY_URL, "_blank", "noopener");

/** Mercury's own document link opens only when it is https. */
const openDocument = (url: string) => {
  if (/^https:\/\//i.test(url)) window.open(url, "_blank", "noopener");
};

const NEW_PROSPECT: Prefill = { name: "", email: null, organization: null, kind: "prospect" };

/** The Fundraising page: the round and the prospect pipeline. */
export function FundraisingPage({
  onShowAgent,
  agentBusy = false,
}: {
  onShowAgent?: () => void;
  /** Whether the Investors agent is answering in the panel; its contact changes load when it ends. */
  agentBusy?: boolean;
}) {
  const [overview, setOverview] = useState<FundraisingOverview | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Contact | Prefill | null>(null);
  const [roundDialog, setRoundDialog] = useState<"start" | "edit" | null>(null);
  // Send SAFE for this prospect; then the saved SAFE's cover summary.
  const [sending, setSending] = useState<Contact | null>(null);
  const [cover, setCover] = useState<Safe | null>(null);
  // Send SAFE with Mercury for a prospect that has no email yet, and Assign to contact.
  const [needsEmail, setNeedsEmail] = useState<Contact | null>(null);
  const [assigning, setAssigning] = useState<Safe | null>(null);
  const [marking, setMarking] = useState<{ safe: Safe; step: SafeStep } | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: "close"; unpaid: Safe[] } | { kind: "delete"; safe: Safe } | null
  >(null);

  const latestLoad = useRef(0);
  const load = useCallback(() => {
    const request = ++latestLoad.current;
    setError("");
    Promise.all([rpc.fundraising.overview(), rpc.contacts.list({})])
      .then(([next, list]) => {
        if (request !== latestLoad.current) return;
        setOverview(next);
        setContacts(list);
      })
      .catch((cause) => {
        if (request === latestLoad.current)
          setError(errorText(cause, t`Could not load fundraising`));
      });
  }, []);
  useEffect(load, [load]);
  const container = useRef<HTMLDivElement>(null);
  const { notify, savedId, setSavedId, deleted } = useContactNotices(load, container, contacts);

  // A chat turn can add or change contacts, so reload when the agent finishes answering.
  const wasBusy = useRef(agentBusy);
  useEffect(() => {
    if (wasBusy.current && !agentBusy) load();
    wasBusy.current = agentBusy;
  }, [agentBusy, load]);

  const round = overview?.round ?? null;
  const open = round && !round.closedAt ? round : null;

  const run = (call: () => Promise<unknown>, failure: string) =>
    call()
      .then(load)
      .catch((cause) => notify(errorText(cause, failure)));
  const move = (prospect: Contact, stage: ContactStage) =>
    run(
      () => rpc.fundraising.prospects.save({ id: prospect.id, stage }),
      t`Could not move ${prospect.name}`,
    );

  const mercuryConnected = overview ? overview.mercury.status !== "not_connected" : false;
  // With Mercury the SAFE is made there: open it, then mark the prospect Waiting for Mercury.
  function sendSafe(prospect: Contact) {
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
  // Records a step with its date, then offers Undo, which clears the date again.
  async function mark(safe: Safe, action: SafeMarkInput["action"], at: string) {
    await rpc.fundraising.safes.mark({ id: safe.id, action, at });
    load();
    // Undo clears the date again. It fades after the usual few seconds so it cannot cover the header.
    enqueueNotificationToast({
      id: `safe-${safe.id}-${action}-${Date.now()}`,
      title: markDone()[action],
      action: {
        label: t`Undo`,
        onClick: () =>
          void run(
            () => rpc.fundraising.safes.mark({ id: safe.id, action, at: null }),
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
      <div className={`${PAGE_GUTTER_X} pt-2 md:pt-5`}>
        <PageHeader
          title={<Trans>Fundraising</Trans>}
          actions={
            <>
              {overview ? (
                <MercuryLine
                  state={overview.mercury}
                  onConnect={() => void connectMercury(false)}
                  onRefresh={() => void run(() => rpc.fundraising.refresh(), t`Could not refresh`)}
                  onReconnect={() => void connectMercury(true)}
                />
              ) : null}
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
        {error ? (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={load}>
              <Trans>Try again</Trans>
            </Button>
          </div>
        ) : null}

        {overview === null ? (
          error ? null : (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} className="h-9 w-full" />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-5">
            <AttentionStrip
              safes={overview.safes}
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

            <section className="max-w-5xl" aria-label={t`Pipeline`}>
              <h2 className="mb-2 text-sm font-semibold">
                <Trans>Pipeline</Trans>
              </h2>
              {overview.prospects.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    <Trans>No prospects yet</Trans>
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setEditing(NEW_PROSPECT)}>
                    <Plus aria-hidden="true" />
                    <Trans>Add prospect</Trans>
                  </Button>
                </div>
              ) : (
                <Pipeline
                  prospects={overview.prospects}
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
                  onEdit={setEditing}
                  onMove={(prospect, stage) => void move(prospect, stage)}
                />
              )}
            </section>

            <Card className="max-w-5xl gap-2 px-3.5 py-3">
              <h2 className="text-sm font-semibold">
                <Trans>SAFEs</Trans>
              </h2>
              {overview.safes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Trans>No SAFEs yet</Trans>
                </p>
              ) : (
                <SafeList
                  safes={overview.safes}
                  round={round}
                  onOpen={openSafe}
                  onAssign={setAssigning}
                  onUnassign={(safe) =>
                    void run(
                      () => rpc.fundraising.safes.unassign({ id: safe.id }),
                      t`Could not unassign`,
                    )
                  }
                  onMark={(safe, step) => setMarking({ safe, step })}
                  onCancel={(safe) =>
                    void run(
                      () => mark(safe, "cancel", isoFromDay(todayDay())),
                      t`Could not cancel`,
                    )
                  }
                  onDelete={(safe) => setConfirm({ kind: "delete", safe })}
                />
              )}
            </Card>
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
            onClose={() => setMarking(null)}
            onSave={async (day) => {
              await mark(marking.safe, marking.step, isoFromDay(day));
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
