import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CompanyContextRevision, CompanyContextSection } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Skeleton,
  Textarea,
} from "@rakazo/ui-web";
import { BookOpenText, ChevronDown, ChevronRight, Ellipsis } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorNotice } from "../components/ErrorNotice";
import { useFinanceQuery } from "../components/finance/ui";
import { PageEmptyState } from "../components/PageEmptyState";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

type Draft = { id?: string; title: string; text: string; revision?: number };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** What the owner wants every agent to know, one section per product or topic. */
export function CompanyContext() {
  const list = useFinanceQuery(() => rpc.companyContext.list(), []);
  const [params, setParams] = useSearchParams();
  const open = params.get("section");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<{ id: string; rows: CompanyContextRevision[] } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<CompanyContextSection | null>(null);

  const toggle = (slug: string) => {
    const next = new URLSearchParams(params);
    if (open === slug) next.delete("section");
    else next.set("section", slug);
    setParams(next, { replace: true });
  };
  const fail = (cause: unknown) => setError(errorText(cause));

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const saved = await rpc.companyContext.save({
        id: draft.id,
        title: draft.title,
        text: draft.text,
        expectedRevision: draft.revision,
      });
      setDraft(null);
      setHistory(null);
      list.reload();
      if (!draft.id) {
        const next = new URLSearchParams(params);
        next.set("section", saved.slug);
        setParams(next, { replace: true });
      }
    } catch (cause) {
      fail(cause);
      // Keep the typed text but start from the latest revision, so the next save is not rejected
      // again for the same old one.
      if (draft.id) {
        try {
          const latest = (await rpc.companyContext.list()).find((s) => s.id === draft.id);
          if (latest) setDraft((current) => current && { ...current, revision: latest.revision });
          list.reload();
        } catch {
          // The error above stays; a later save fails the same way.
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function showHistory(section: CompanyContextSection) {
    setError("");
    try {
      setHistory({ id: section.id, rows: await rpc.companyContext.history({ id: section.id }) });
    } catch (cause) {
      fail(cause);
    }
  }

  async function restore(section: CompanyContextSection, revision: number) {
    setError("");
    try {
      await rpc.companyContext.restore({
        id: section.id,
        revision,
        expectedRevision: section.revision,
      });
      setHistory(null);
      list.reload();
    } catch (cause) {
      fail(cause);
    }
  }

  async function remove(section: CompanyContextSection) {
    setError("");
    try {
      await rpc.companyContext.remove({ id: section.id, revision: section.revision });
      list.reload();
    } catch (cause) {
      fail(cause);
    } finally {
      setPendingDelete(null);
    }
  }

  const sections = list.data ?? [];
  const failure = (
    <>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );

  if (list.error) return <ErrorNotice message={list.error} onRetry={list.reload} className="" />;
  if (!list.data) return <Skeleton className="h-64 w-full" />;

  if (draft)
    return (
      <form
        className="max-w-[68ch] space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {failure}
        <Input
          aria-label={t`Name`}
          placeholder={t`Name`}
          value={draft.title}
          maxLength={80}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <Textarea
          aria-label={t`What is it?`}
          placeholder={t`What is it?`}
          rows={8}
          value={draft.text}
          onChange={(event) => setDraft({ ...draft, text: event.target.value })}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !draft.title.trim() || !draft.text.trim()}>
            <Trans>Save</Trans>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(null);
              setError("");
            }}
          >
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </form>
    );

  if (sections.length === 0)
    return (
      <PageEmptyState
        icon={<BookOpenText className="size-8" strokeWidth={1.6} aria-hidden="true" />}
        title={<Trans>What should every agent know?</Trans>}
        description={<Trans>Start with one product or topic.</Trans>}
      >
        <Button onClick={() => setDraft({ title: "", text: "" })}>
          <Trans>Add the first section</Trans>
        </Button>
      </PageEmptyState>
    );

  return (
    <div>
      {failure}
      <div className="mb-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setDraft({ title: "", text: "" })}>
          <Trans>New section</Trans>
        </Button>
      </div>
      <ul className="divide-y divide-border border-y border-border">
        {sections.map((section) => {
          const expanded = section.slug === open;
          return (
            <li key={section.id} className="py-3">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-start gap-2 text-start"
                  onClick={() => toggle(section.slug)}
                >
                  {expanded ? (
                    <ChevronDown
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <ChevronRight
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-medium text-foreground">
                      {section.title}
                    </span>
                    {!expanded && (
                      <span className="mt-0.5 block text-[13.5px] text-muted-foreground">
                        {section.summary}
                      </span>
                    )}
                  </span>
                </button>
                <span className="mt-0.5 hidden shrink-0 text-[12.5px] text-muted-foreground sm:block">
                  {day(section.updatedAt)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label={t`More`} />}
                  >
                    <Ellipsis aria-hidden className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void showHistory(section)}>
                      <Trans>History</Trans>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setPendingDelete(section)}
                    >
                      <Trans>Delete</Trans>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {expanded && (
                <div className="ms-6 mt-3 max-w-[68ch] space-y-2 text-[14px] leading-[1.55] text-foreground">
                  <p className="whitespace-pre-wrap">{section.text}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() =>
                      setDraft({
                        id: section.id,
                        title: section.title,
                        text: section.text,
                        revision: section.revision,
                      })
                    }
                  >
                    <Trans>Edit</Trans>
                  </Button>
                </div>
              )}
              {history?.id === section.id && (
                <ul className="ms-6 mt-3 max-w-[68ch] divide-y divide-border text-[13.5px]">
                  {history.rows.map((row, index) => (
                    <li key={row.revision} className="flex items-start gap-3 py-2">
                      <span className="shrink-0 text-muted-foreground">{day(row.createdAt)}</span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap">{row.text}</span>
                      {index > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void restore(section, row.revision)}
                        >
                          <Trans>Restore</Trans>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {pendingDelete && (
        <AlertDialog open onOpenChange={(next) => !next && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Delete {pendingDelete.title}?</Trans>
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Cancel</Trans>
              </AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => void remove(pendingDelete)}>
                <Trans>Delete</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
