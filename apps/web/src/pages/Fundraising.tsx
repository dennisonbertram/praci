import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, ContactStage, FundraisingOverview } from "@rakazo/contracts";
import { Button, Card, Skeleton } from "@rakazo/ui-web";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AskBotButton } from "../components/AskBotButton";
import type { ContactPrefill as Prefill } from "../components/ContactDialog";
import { ContactDialog } from "../components/ContactDialog";
import { Pipeline } from "../components/fundraising/Pipeline";
import { RoundCard, RoundDialog } from "../components/fundraising/RoundCard";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { rpc } from "../lib/rpc";
import { useContactNotices } from "../lib/use-contact-notices";
import { errorText } from "../lib/user-error";

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

  return (
    <div className="@container/bd flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2 md:pt-5`}>
        <PageHeader
          title={<Trans>Fundraising</Trans>}
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
            <RoundCard
              round={round}
              pendingCents={overview.pendingCents}
              onStart={() => setRoundDialog("start")}
              onEdit={() => setRoundDialog("edit")}
              onClose={() =>
                round &&
                void run(
                  () => rpc.fundraising.round.close({ id: round.id }),
                  t`Could not close the round`,
                )
              }
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
                  onEdit={setEditing}
                  onMove={(prospect, stage) => void move(prospect, stage)}
                />
              )}
            </section>

            <Card className="max-w-5xl gap-2 px-3.5 py-3">
              <h2 className="text-sm font-semibold">
                <Trans>SAFEs</Trans>
              </h2>
              <p className="text-sm text-muted-foreground">
                <Trans>No SAFEs yet</Trans>
              </p>
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
