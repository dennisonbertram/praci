import { Trans, useLingui } from "@lingui/react/macro";
import type { StoredMeeting } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { ConfirmDialog } from "./AppDetail";

/** The user's stored meetings, read straight from the rows: no model call, so it works with consent off and after Disconnect. */
export function StoredMeetingsList() {
  const { t } = useLingui();
  const [rows, setRows] = useState<StoredMeeting[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StoredMeeting | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    try {
      const page = await rpc.meetings.list(cursor ? { cursor } : {});
      setRows((prev) => (cursor ? [...(prev ?? []), ...page.items] : page.items));
      setNext(page.nextCursor);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function remove(meeting: StoredMeeting) {
    setBusy(true);
    setError(null);
    try {
      await rpc.meetings.delete({ meetingId: meeting.id });
      setDeleting(null);
      setRows((prev) => (prev ?? []).filter((row) => row.id !== meeting.id));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rk-scroll h-full overflow-y-auto px-4 py-6 md:px-9 md:py-7">
      <div className="mx-auto max-w-[1040px]">
        <Link
          to="/app/integrations/granola"
          className="mb-3.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Granola
        </Link>
        {error ? (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {(rows ?? []).map((meeting) => (
            <li key={meeting.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm">{meeting.title}</span>
              <time dateTime={meeting.startedAt} className="shrink-0 text-xs text-muted-foreground">
                {new Date(meeting.startedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <Button size="sm" variant="outline" onClick={() => setDeleting(meeting)}>
                <Trans>Delete</Trans>
              </Button>
            </li>
          ))}
        </ul>
        {next ? (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void load(next)}>
              <Trans>Show more</Trans>
            </Button>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={deleting !== null}
        busy={busy}
        title={t`Delete "${deleting?.title ?? ""}"?`}
        confirm={t`Delete`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
      >
        <li>
          <Trans>
            Removes this meeting and its to-dos from Praci. Your note in Granola is not changed.
          </Trans>
        </li>
      </ConfirmDialog>
    </div>
  );
}
