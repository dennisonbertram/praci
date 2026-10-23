// biome-ignore-all lint/a11y/noNoninteractiveTabindex: The named review card is the c/e/r shortcut target.

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CompanyFact, CompanyReviewCandidate, CompanyReviewItem } from "@rakazo/contracts";
import { Button, Input, NativeSelect, NativeSelectOption } from "@rakazo/ui-web";
import { useId, useState } from "react";
import { companyFactTitle } from "../lib/company-format";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

function candidateReason(reason: string) {
  if (
    [
      "name_only_person_candidate",
      "email_local_part_candidate",
      "conflicting_person_identifiers",
    ].includes(reason)
  )
    return t`Same person?`;
  if (reason === "rejected_name_only_claim") return t`Previously rejected name`;
  if (reason === "ambiguous_event_subjects") return t`Which event?`;
  if (reason === "unresolved_import_subjects") return t`Choose subjects`;
  return t`Resolve identity`;
}

export function CompanyReview({
  items,
  onOpen,
  onChanged,
}: {
  items: CompanyReviewItem[];
  onOpen: (fact: CompanyFact, editing?: boolean) => void;
  onChanged: () => void;
}) {
  if (items.length === 0)
    return (
      <p className="py-12 text-center text-muted-foreground">
        <Trans>Nothing to review</Trans>
      </p>
    );
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ReviewItem
          key={item.kind === "candidate" ? `${item.id}:${item.candidate.version}` : item.id}
          item={item}
          onOpen={onOpen}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function ReviewItem({
  item,
  onOpen,
  onChanged,
}: {
  item: CompanyReviewItem;
  onOpen: (fact: CompanyFact, editing?: boolean) => void;
  onChanged: () => void;
}) {
  const id = useId();
  useHideAmounts();
  const candidate = item.kind === "candidate" ? item.candidate : null;
  const [title, setTitle] = useState(candidate?.title ?? "");
  const [target, setTarget] = useState("");
  const [subjects, setSubjects] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      candidate?.subjects.map((subject) => [subject.ref, subject.entityId ?? ""]) ?? [],
    ),
  );
  const titleInputId = `${id}-title`;
  const matchSelectId = `${id}-match`;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canConfirm =
    !candidate ||
    ((!(candidate.choices.length || candidate.allowSeparate) || !!target) &&
      candidate.subjects.every((subject) => !!subjects[subject.ref]) &&
      (!candidate.editableTitle || !!title.trim()));
  const edit = () => {
    if (busy) return;
    if (item.kind === "fact") onOpen(item.fact, true);
    else setEditing(true);
  };
  async function act(action: "confirm" | "reject") {
    if (busy || (action === "confirm" && !canConfirm)) return;
    setBusy(true);
    setError("");
    try {
      if (item.kind === "fact") {
        const ref = { kind: item.fact.kind, id: item.fact.record.id };
        if (action === "confirm") await rpc.company.confirm(ref);
        else await rpc.company.reject(ref);
      } else {
        await rpc.company.resolveCandidate(
          action === "reject"
            ? { candidateId: item.candidate.id, version: item.candidate.version, action }
            : {
                candidateId: item.candidate.id,
                version: item.candidate.version,
                action,
                separate: target === "separate",
                targetId: target && target !== "separate" ? target : undefined,
                title: editing && item.candidate.editableTitle ? title : undefined,
                subjects,
              },
        );
      }
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      tabIndex={0}
      aria-labelledby={`${id}-title`}
      aria-busy={busy}
      className="rounded-lg border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.repeat
        )
          return;
        const key = event.key.toLowerCase();
        if (!["c", "e", "r"].includes(key)) return;
        event.preventDefault();
        if (key === "e") edit();
        else void act(key === "c" ? "confirm" : "reject");
      }}
    >
      <p className="text-xs text-muted-foreground">
        {candidate
          ? candidateReason(candidate.reason)
          : item.kind === "fact" && item.reason === "contradiction"
            ? t`Conflicting evidence`
            : t`Not confirmed`}
      </p>
      <h3 id={`${id}-title`} className="mt-1 font-medium">
        {maskCurrencyWhenHidden(
          candidate?.title ?? (item.kind === "fact" ? companyFactTitle(item.fact) : ""),
        )}
      </h3>
      {item.kind === "fact" && (
        <Button variant="link" className="h-auto px-0" onClick={() => onOpen(item.fact)}>
          <Trans>View evidence</Trans>
        </Button>
      )}
      {candidate && (
        <>
          {candidate.quote && (
            <blockquote className="my-3 text-sm text-muted-foreground">
              {maskCurrencyWhenHidden(candidate.quote)}
            </blockquote>
          )}
          {!!candidate.details.length && (
            <details className="my-3 text-sm">
              <summary className="cursor-pointer">
                <Trans>Details</Trans>
              </summary>
              <dl className="mt-2 space-y-1">
                {candidate.details.map((detail, index) => (
                  <div key={`${detail.label}-${index}`}>
                    <dt className="text-muted-foreground">{detail.label}</dt>
                    <dd>{maskCurrencyWhenHidden(detail.value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {editing && candidate.editableTitle && (
            <div className="my-3 text-sm">
              <label htmlFor={titleInputId}>
                <Trans>Name or title</Trans>
              </label>
              <Input
                id={titleInputId}
                autoFocus
                value={title}
                disabled={busy}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          )}
          {(candidate.choices.length > 0 || candidate.allowSeparate) && (
            <div className="my-3 text-sm">
              <label htmlFor={matchSelectId}>
                <Trans>Match</Trans>
              </label>
              <NativeSelect
                id={matchSelectId}
                value={target}
                disabled={busy}
                onChange={(event) => setTarget(event.target.value)}
              >
                <NativeSelectOption value="">
                  <Trans>Choose…</Trans>
                </NativeSelectOption>
                {candidate.choices.map((choice) => (
                  <NativeSelectOption key={choice.id} value={choice.id}>
                    {choice.title}
                  </NativeSelectOption>
                ))}
                {candidate.allowSeparate && (
                  <NativeSelectOption value="separate">
                    <Trans>Keep separate</Trans>
                  </NativeSelectOption>
                )}
              </NativeSelect>
            </div>
          )}
          <CandidateSubjects
            idPrefix={id}
            candidate={candidate}
            subjects={subjects}
            busy={busy}
            onChange={(ref, value) => setSubjects((current) => ({ ...current, [ref]: value }))}
          />
        </>
      )}
      {error && (
        <p role="alert" className="my-2 text-sm text-destructive">
          {error}{" "}
          <Button variant="link" onClick={onChanged}>
            <Trans>Reload</Trans>
          </Button>
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || !canConfirm}
          aria-keyshortcuts="c"
          onClick={() => void act("confirm")}
        >
          <Trans>Confirm</Trans>
        </Button>
        {(item.kind === "fact" || candidate?.editableTitle) && (
          <Button size="sm" variant="outline" disabled={busy} aria-keyshortcuts="e" onClick={edit}>
            <Trans>Edit</Trans>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          aria-keyshortcuts="r"
          onClick={() => void act("reject")}
        >
          <Trans>Reject</Trans>
        </Button>
      </div>
    </section>
  );
}

function CandidateSubjects({
  idPrefix,
  candidate,
  subjects,
  busy,
  onChange,
}: {
  idPrefix: string;
  candidate: CompanyReviewCandidate;
  subjects: Record<string, string>;
  busy: boolean;
  onChange: (ref: string, value: string) => void;
}) {
  return candidate.subjects.map((subject, index) => {
    const id = `${idPrefix}-subject-${index}`;
    return (
      <div key={subject.ref} className="my-3 text-sm">
        <label htmlFor={id}>{subject.title}</label>
        <NativeSelect
          id={id}
          value={subjects[subject.ref] ?? ""}
          disabled={busy}
          onChange={(event) => onChange(subject.ref, event.target.value)}
        >
          <NativeSelectOption value="">
            <Trans>Choose…</Trans>
          </NativeSelectOption>
          {candidate.subjectChoices.map((choice) => (
            <NativeSelectOption key={choice.id} value={choice.id}>
              {choice.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    );
  });
}
