import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { PipelineImportCard as CardData, MessageBlock } from "@rakazo/contracts";
import { PIPELINE_IMPORT_NEW, PIPELINE_IMPORT_SKIP } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { rpc } from "../lib/rpc";
import { NOTIFICATIONS_CHANGED_EVENT } from "../lib/use-sidebar-glance";
import { errorText } from "../lib/user-error";
import { SeeAll, useCappedRows } from "./CappedList";

const CHROME =
  "@container w-160 max-w-full overflow-hidden rounded-3xl bg-muted ring-1 ring-inset ring-border";
const TITLE = "font-medium text-foreground";
/** Names shown per list before See all, on a phone too. */
const CAP = 8;
const POLL_MS = 3_000;

type Question = CardData["questions"][number];

function candidateDetail(candidate: Question["candidates"][number]): string {
  const parts = [
    candidate.email ?? t`No email`,
    candidate.organization,
    candidate.stays ? t`Stays on ${candidate.stays}` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

function Choice({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const sub =
    question.kind === "referrer"
      ? plural(question.referred, { one: "referred # prospect", other: "referred # prospects" })
      : question.firm;
  const options = [
    ...question.candidates.map((candidate) => ({
      id: candidate.id,
      label: candidate.name,
      detail: candidateDetail(candidate),
    })),
    ...(question.allowNew ? [{ id: PIPELINE_IMPORT_NEW, label: t`New contact`, detail: "" }] : []),
    {
      id: PIPELINE_IMPORT_SKIP,
      label: question.kind === "referrer" ? t`Leave Referred by empty` : t`Skip this row`,
      detail: "",
    },
  ];
  return (
    <fieldset className="border-t border-border px-5 py-3 text-sm">
      <legend className="sr-only">
        {question.name}, {sub}
      </legend>
      <p className="font-medium text-foreground">
        {question.name}
        <span className="font-normal text-muted-foreground"> · {sub}</span>
      </p>
      <div className="mt-1.5 grid gap-1">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex min-h-7 cursor-pointer items-center gap-2 pointer-coarse:min-h-11"
          >
            <input
              type="radio"
              name={question.id}
              className="accent-primary"
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <span className="min-w-0">
              {option.label}
              {option.detail ? (
                <span className="block text-xs break-words text-muted-foreground">
                  {option.detail}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ListGroup({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(true);
  const list = useCappedRows(items, { phone: CAP, desktop: CAP });
  if (items.length === 0) return null;
  return (
    <div className="border-t border-border px-5 py-2.5 text-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-6 w-full items-center gap-1 text-start pointer-coarse:min-h-11"
      >
        <ChevronDown
          aria-hidden="true"
          className={`size-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        {title}
      </button>
      {open ? (
        <>
          <ul className="mt-1 space-y-1 ps-5 text-[13px] text-muted-foreground">
            {list.rows.map((item) => (
              <li key={item} className="break-words">
                {item}
              </li>
            ))}
          </ul>
          <SeeAll list={list} className="mt-1 ps-5" />
        </>
      ) : null}
    </div>
  );
}

function Result({ result }: { result: NonNullable<CardData["result"]> }) {
  const counts = [
    plural(result.newContacts, { one: "# new contact", other: "# new contacts" }),
    plural(result.savedContacts, {
      one: "# contact already saved",
      other: "# contacts already saved",
    }),
    ...(result.failed.length > 0
      ? [plural(result.failed.length, { one: "# row failed", other: "# rows failed" })]
      : []),
  ];
  const onlyUpdates = result.added === 0 && result.updated > 0;
  return (
    <div data-testid="pipeline-import-result" className={CHROME}>
      <div className="px-5 py-3.5 text-[15px]">
        <p className={TITLE}>
          {onlyUpdates
            ? plural(result.updated, {
                one: "Updated # prospect in Fundraising",
                other: "Updated # prospects in Fundraising",
              })
            : plural(result.added, {
                one: "Added # prospect to Fundraising",
                other: "Added # prospects to Fundraising",
              })}
        </p>
        <p className="text-sm text-muted-foreground">{counts.join(" · ")}</p>
      </div>
      {result.failed.length > 0 ? (
        <p className="border-t border-border px-5 py-3 text-sm">
          <span className="text-destructive">
            <Trans>Could not save:</Trans>
          </span>{" "}
          {result.failed.map((row) => row.firm).join(", ")}. <Trans>Nothing else changed.</Trans>
        </p>
      ) : null}
      <div className="flex justify-end border-t border-border px-5 py-3">
        <Button className="pointer-coarse:h-11" render={<Link to="/app/fundraising" />}>
          <Trans>View in Pipeline</Trans>
        </Button>
      </div>
    </div>
  );
}

/**
 * One card for a whole list import, on web and desktop. Add is its own request with every answer;
 * Cancel answers the card as usual. The phone apps show the block's plain text and Deny instead.
 */
export function PipelineImportCard({
  block,
  botId,
  message,
  canAnswer,
  onAnswer,
  fallback,
}: {
  block: Extract<MessageBlock, { kind: "ask" }>;
  botId: string;
  message: { id: string; runId?: string | null };
  canAnswer: boolean;
  onAnswer: (answer: string) => Promise<void>;
  /** The plain card: a closed one, or for a reader whose request for the card fails. */
  fallback: ReactNode;
}) {
  const ids = useMemo(
    () => ({ botId, runId: message.runId ?? "", messageId: message.id }),
    [botId, message.runId, message.id],
  );
  const [data, setData] = useState<CardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await rpc.threads.pipelineImport(ids));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [ids]);

  // A realtime event on the message moves the card on; the poll covers one that was missed.
  const cardState = `${block.status}:${block.answer}:${block.text}`;
  useEffect(() => {
    void load();
  }, [load, cardState]);
  const applying = data?.status === "applying";
  useEffect(() => {
    if (!applying) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [applying, load]);
  // An applied import changes the pipeline; an open page reloads on this event.
  useEffect(() => {
    if (data?.status === "done") window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }, [data?.status]);

  const answered = block.status === "answered" && block.answer !== "allow";
  if (failed || answered || data?.status === "closed") return <>{fallback}</>;
  if (!data || data.status === "applying") {
    return (
      <div data-testid="pipeline-import-card" className={`${CHROME} px-5 py-3.5 text-[15px]`}>
        <p className={TITLE}>{data ? <Trans>Adding prospects</Trans> : block.text}</p>
      </div>
    );
  }
  if (data.status === "done" && data.result) return <Result result={data.result} />;

  const people = data.questions.filter((question) => question.kind === "person");
  const referrers = data.questions.filter((question) => question.kind === "referrer");
  const left = data.questions.filter((question) => !choices[question.id]).length;
  // Skipping any person question drops that firm's row whole, once however many of its people are
  // skipped: one fewer add for a new row, one fewer update for an existing one.
  const skippedRows = (newRecord: boolean) =>
    new Set(
      people
        .filter(
          (question) =>
            question.newRecord === newRecord && choices[question.id] === PIPELINE_IMPORT_SKIP,
        )
        .map((question) => question.row),
    ).size;
  const adding = data.add - skippedRows(true);
  const updating = data.update - skippedRows(false);
  const onlyUpdates = data.add === 0;
  const choose = (id: string) => (value: string) =>
    setChoices((current) => ({ ...current, [id]: value }));
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (problem) {
      setError(errorText(problem, t`Could not submit this answer`));
      await load();
    } finally {
      setBusy(false);
    }
  };
  // The button names what pressing it will do; a skipped new row can leave nothing but updates.
  const addLabel =
    adding > 0 || (updating === 0 && !onlyUpdates)
      ? plural(adding, { one: "Add # prospect", other: "Add # prospects" })
      : plural(updating, { one: "Update # prospect", other: "Update # prospects" });

  return (
    <div data-testid="pipeline-import-card" className={CHROME}>
      <div className="px-5 py-3.5 text-[15px]">
        <p className={TITLE}>
          {onlyUpdates
            ? plural(data.update, {
                one: "Update # prospect in Fundraising",
                other: "Update # prospects in Fundraising",
              })
            : plural(data.add, {
                one: "Add # prospect to Fundraising",
                other: "Add # prospects to Fundraising",
              })}
        </p>
        <p className="text-sm text-muted-foreground">
          <Trans>Saved contacts are not overwritten.</Trans>
        </p>
      </div>
      {people.length > 0 ? (
        <p className="border-t border-border px-5 pt-3 text-sm font-medium">
          <Trans>Which contact is this?</Trans>
        </p>
      ) : null}
      {people.map((question) => (
        <Choice
          key={question.id}
          question={question}
          value={choices[question.id]}
          onChange={choose(question.id)}
        />
      ))}
      {referrers.length > 0 ? (
        <p className="border-t border-border px-5 pt-3 text-sm font-medium">
          <Trans>Who made these introductions?</Trans>
        </p>
      ) : null}
      {referrers.map((question) => (
        <Choice
          key={question.id}
          question={question}
          value={choices[question.id]}
          onChange={choose(question.id)}
        />
      ))}
      <ListGroup
        title={plural(data.newContacts.length, {
          one: "# new contact",
          other: "# new contacts",
        })}
        items={data.newContacts}
      />
      <ListGroup
        title={plural(data.savedContacts.length, {
          one: "# contact already saved",
          other: "# contacts already saved",
        })}
        items={data.savedContacts}
      />
      <ListGroup
        title={plural(data.noPerson.length, {
          one: "# prospect with no person yet",
          other: "# prospects with no person yet",
        })}
        items={data.noPerson}
      />
      <ListGroup
        title={plural(data.existing.length, {
          one: "# prospect already in Fundraising",
          other: "# prospects already in Fundraising",
        })}
        items={data.existing}
      />
      {error ? (
        <p role="alert" className="border-t border-border px-5 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        {left > 0 ? (
          <span className="me-auto text-sm text-muted-foreground">
            <Trans>{left} left to choose</Trans>
          </span>
        ) : null}
        <Button
          variant="outline"
          className="pointer-coarse:h-11"
          disabled={busy || !canAnswer}
          onClick={() => void run(() => onAnswer("deny"))}
        >
          <Trans>Cancel</Trans>
        </Button>
        <Button
          className="pointer-coarse:h-11"
          disabled={busy || !canAnswer || left > 0 || (adding === 0 && updating === 0)}
          onClick={() =>
            void run(() =>
              rpc.threads.applyPipelineImport({ ...ids, hash: data.hash, answers: choices }),
            )
          }
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
