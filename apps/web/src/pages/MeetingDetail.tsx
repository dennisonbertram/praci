import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { StoredMeetingDetail } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SeeAll, useCappedRows } from "../components/CappedList";
import { ErrorNotice } from "../components/ErrorNotice";
import { dueLabel } from "../components/inbox/TodoCard";
import { ConfirmDialog } from "../components/integrations/AppDetail";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { RowsSkeleton } from "../components/RowsSkeleton";
import { meetingMinutes, meetingSourceName } from "../lib/meeting-source";
import { usePollWhile } from "../lib/page-data";
import { rpc } from "../lib/rpc";
import { useRefetchWhileOpen } from "../lib/use-refetch-while-open";
import { errorText } from "../lib/user-error";
import { formatMeetingDate } from "./Meetings";

/** A card of rows; a phone shows the first 3 and opens the rest with See all. */
function Section({ title, rows }: { title: ReactNode; rows: ReactNode[] }) {
  const list = useCappedRows(rows);
  return (
    <section className="mt-6 max-w-3xl">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
        {list.rows}
      </ul>
      <div className="mt-1 flex justify-end">
        <SeeAll list={list} />
      </div>
    </section>
  );
}

const Row = ({ children }: { children: ReactNode }) => (
  <li className="px-3.5 py-2.5">{children}</li>
);

/** One stored meeting: what was decided, who owes what, and the transcript when asked for. */
export function MeetingDetailPage({
  meetingId,
  spaceName,
}: {
  meetingId: string;
  spaceName?: string;
}) {
  const [meeting, setMeeting] = useState<StoredMeetingDetail | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  // The list's search and filter ride in this URL's query, so Back restores them.
  const { search } = useLocation();
  const back = () => navigate(`/app/meetings${search}`);

  // Only the latest load or to-do save may supersede work already in flight.
  const latest = useRef(0);
  const currentMeetingId = useRef(meetingId);
  currentMeetingId.current = meetingId;
  const loadedRef = useRef(false);
  // Whether the error on screen came from loading: a refresh clears only that, never a failed
  // to-do toggle or delete.
  const loadFailed = useRef(false);
  const savingTodos = useRef(new Set<string>());
  const load = useCallback(() => {
    const request = ++latest.current;
    rpc.meetings
      .get({ meetingId })
      .then((loaded) => {
        if (request !== latest.current) return;
        // A failed refresh should not hide content already shown for this meeting.
        loadedRef.current = true;
        setMeeting(loaded);
        if (loadFailed.current) {
          loadFailed.current = false;
          setLoadError(false);
          setError("");
        }
      })
      .catch((cause) => {
        if (request !== latest.current) return;
        if ((cause as { code?: string } | null)?.code === "NOT_FOUND") {
          loadedRef.current = false;
          setMeeting(null);
          loadFailed.current = true;
          setLoadError(true);
          setError(errorText(cause, t`Could not load meeting`));
        } else if (!loadedRef.current) {
          loadFailed.current = true;
          setLoadError(true);
          setError(errorText(cause, t`Could not load meeting`));
        }
      });
  }, [meetingId]);
  useEffect(() => {
    loadedRef.current = false;
    loadFailed.current = false;
    setLoadError(false);
    setMeeting(null);
    setError("");
    load();
  }, [load]);

  const setDone = async (todoId: string, done: boolean) => {
    const savingMeetingId = currentMeetingId.current;
    if (savingTodos.current.has(todoId)) return;
    savingTodos.current.add(todoId);
    ++latest.current;
    if (!loadFailed.current) setError("");
    try {
      const todo = await rpc.inbox.todos.setDone({ id: todoId, done });
      if (currentMeetingId.current !== savingMeetingId) return;
      setMeeting(
        (m) =>
          m && {
            ...m,
            todos: m.todos.map((x) => (x.id === todoId ? { ...x, doneAt: todo.doneAt } : x)),
          },
      );
    } catch (cause) {
      if (currentMeetingId.current !== savingMeetingId) return;
      setError(errorText(cause));
    } finally {
      savingTodos.current.delete(todoId);
    }
  };

  async function remove() {
    const deletingMeetingId = currentMeetingId.current;
    if (!loadFailed.current) setError("");
    setBusy(true);
    try {
      await rpc.meetings.delete({ meetingId });
      if (currentMeetingId.current !== deletingMeetingId) return;
      back();
    } catch (cause) {
      if (currentMeetingId.current !== deletingMeetingId) return;
      setDeleting(false);
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function merge() {
    const mergingMeetingId = currentMeetingId.current;
    if (!loadFailed.current) setError("");
    setBusy(true);
    try {
      const merged = await rpc.meetings.mergeWithPrevious({ meetingId });
      if (currentMeetingId.current !== mergingMeetingId) return;
      navigate(`/app/meetings/${merged.meetingId}${search}`);
    } catch (cause) {
      if (currentMeetingId.current !== mergingMeetingId) return;
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  const minutes = meeting ? meetingMinutes(meeting) : null;
  const now = new Date();
  const summarizing = meeting?.summarizing === true;
  useRefetchWhileOpen(meeting !== null && !summarizing, load);
  usePollWhile(summarizing, 5000, load);
  return (
    <div className="@container/bd flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2`}>
        <PageHeader
          title={<span className="truncate">{meeting?.title ?? ""}</span>}
          spaceName={spaceName}
          onBack={back}
          meta={
            meeting ? (
              <span className="text-xs text-muted-foreground">
                {[
                  formatMeetingDate(meeting.startedAt),
                  minutes ? t`${minutes} min` : null,
                  meetingSourceName(meeting.provider),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null
          }
          actions={
            meeting ? (
              <>
                {meeting.canMergeWithPrevious ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" size="icon" aria-label={t`More`} disabled={busy} />
                      }
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void merge()}>
                        <Trans>Merge with previous</Trans>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                <Button variant="outline" onClick={() => setDeleting(true)}>
                  <Trans>Delete</Trans>
                </Button>
              </>
            ) : null
          }
        />
      </div>
      <div className={`rk-scroll flex-1 overflow-y-auto ${PAGE_GUTTER_X} pb-6`}>
        {error ? (
          <ErrorNotice
            message={error}
            onRetry={loadError ? load : undefined}
            className="justify-center py-8"
          />
        ) : null}
        {meeting === null ? (
          error ? null : (
            <RowsSkeleton className="pt-2" />
          )
        ) : (
          <>
            {meeting.partial ? (
              <p role="status" className="mt-2 text-sm text-destructive">
                <Trans>Part of this meeting could not be transcribed.</Trans>
              </p>
            ) : null}
            {summarizing ? (
              <p className="mt-2 text-sm text-muted-foreground">
                <Trans>Summarizing…</Trans>
              </p>
            ) : null}
            {meeting.summary ? (
              <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm">{meeting.summary}</p>
            ) : null}
            {meeting.decisions.length > 0 ? (
              <Section
                title={<Trans>Decisions</Trans>}
                rows={meeting.decisions.map((text) => <Row key={text}>{text}</Row>)}
              />
            ) : null}
            {meeting.followUps.length > 0 ? (
              <Section
                title={<Trans>Follow-ups</Trans>}
                rows={meeting.followUps.map((text) => <Row key={text}>{text}</Row>)}
              />
            ) : null}
            {meeting.todos.length > 0 ? (
              <Section
                title={<Trans>Your to-dos</Trans>}
                rows={meeting.todos.map((todo) => (
                  <li key={todo.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <Checkbox
                      checked={todo.doneAt !== null}
                      aria-label={todo.text}
                      onCheckedChange={(done) => void setDone(todo.id, done === true)}
                    />
                    <span
                      className={`min-w-0 flex-1 ${todo.doneAt ? "text-muted-foreground line-through" : ""}`}
                    >
                      {todo.text}
                    </span>
                    {todo.dueOn ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {dueLabel(todo.dueOn, now)}
                      </span>
                    ) : null}
                  </li>
                ))}
              />
            ) : null}
            {meeting.actionItems.length > 0 ? (
              <Section
                title={<Trans>Action items</Trans>}
                rows={meeting.actionItems.map((item) => (
                  <li
                    key={`${item.owner}:${item.text}`}
                    className="flex items-center gap-3 px-3.5 py-2.5"
                  >
                    <span className="min-w-0 flex-1">{`${item.owner}: ${item.text}`}</span>
                    {item.due ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {dueLabel(item.due, now)}
                      </span>
                    ) : null}
                  </li>
                ))}
              />
            ) : null}
            {meeting.transcript ? (
              <details className="group mt-6 max-w-3xl">
                <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ChevronRight
                    className="size-4 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                  <Trans>Transcript</Trans>
                </summary>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{meeting.transcript}</p>
              </details>
            ) : null}
          </>
        )}
      </div>
      <ConfirmDialog
        open={deleting}
        busy={busy}
        title={t`Delete "${meeting?.title ?? ""}"?`}
        confirm={t`Delete`}
        onCancel={() => setDeleting(false)}
        onConfirm={() => void remove()}
      >
        <li>
          {meeting?.provider === "granola" ? (
            <Trans>
              Removes this meeting and its to-dos from Praci. Your note in Granola is not changed.
            </Trans>
          ) : (
            <Trans>Removes this meeting and its to-dos from Praci.</Trans>
          )}
        </li>
      </ConfirmDialog>
    </div>
  );
}
