import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { PageSource, PageSourceSchedule } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { RowsSkeleton } from "../RowsSkeleton";

const SCHEDULES: PageSourceSchedule[] = ["15m", "1h", "6h", "1d", "1w"];

function scheduleLabel(schedule: PageSourceSchedule): string {
  switch (schedule) {
    case "15m":
      return t`Every 15 min`;
    case "1h":
      return t`Hourly`;
    case "6h":
      return t`Every 6 hours`;
    case "1d":
      return t`Daily`;
    case "1w":
      return t`Weekly`;
  }
}

function statusBadge(source: PageSource): {
  label: string;
  variant: "secondary" | "destructive" | "outline";
} {
  if (source.status === "active" && source.lastError) {
    return { label: t`failed`, variant: "destructive" };
  }
  switch (source.status) {
    case "active":
      return { label: t`ok`, variant: "secondary" };
    case "pending":
      return { label: t`pending`, variant: "outline" };
    case "paused":
      return { label: t`paused`, variant: "outline" };
    case "denied":
      return { label: t`denied`, variant: "outline" };
  }
}

function refreshedText(at: string | null): string {
  const date = at ? new Date(at) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}

/** The page's saved data sources. Removing one leaves blocks that read it showing "Source not found". */
export function PageSourcesDialog({
  botId,
  pageId,
  open,
  onOpenChange,
  onChanged,
}: {
  botId: string;
  pageId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a source was removed, so the page can reload its data. */
  onChanged: () => void;
}) {
  const [sources, setSources] = useState<PageSource[]>();
  const [removing, setRemoving] = useState<PageSource>();
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = () => {
    setSources(undefined);
    setLoadError("");
    void rpc.pages
      .sources({ botId, pageId })
      .then((list: PageSource[]) => setSources(list))
      .catch((cause: unknown) => setLoadError(errorText(cause)));
  };

  useEffect(() => {
    if (!open) return;
    let live = true;
    setSources(undefined);
    setLoadError("");
    setActionError("");
    void rpc.pages
      .sources({ botId, pageId })
      .then((list: PageSource[]) => live && setSources(list))
      .catch((cause: unknown) => live && setLoadError(errorText(cause)));
    return () => {
      live = false;
    };
  }, [open, botId, pageId]);

  /** Run an owner change and show the source the server returns. */
  const change = async (work: Promise<PageSource>) => {
    try {
      const saved = await work;
      setSources((list) => list?.map((source) => (source.id === saved.id ? saved : source)));
      setActionError("");
      onChanged();
    } catch (cause) {
      setActionError(errorText(cause));
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await rpc.pages.removeSource({ botId, sourceId: removing.id });
      setSources((list) => list?.filter((source) => source.id !== removing.id));
      setActionError("");
      onChanged();
    } catch (cause) {
      setActionError(errorText(cause));
    }
    setRemoving(undefined);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              <Trans>Sources</Trans>
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {loadError ? (
              <p role="alert" className="mb-2 text-sm text-destructive">
                {loadError}
              </p>
            ) : null}
            {loadError ? (
              <Button variant="outline" size="sm" onClick={load}>
                <Trans>Retry</Trans>
              </Button>
            ) : null}
            {actionError ? (
              <p role="alert" className="mb-2 text-sm text-destructive">
                {actionError}
              </p>
            ) : null}
            {sources === undefined && !loadError ? (
              <RowsSkeleton rows={3} />
            ) : loadError ? null : sources?.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <Trans>No sources</Trans>
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(sources ?? []).map((source) => {
                  const badge = statusBadge(source);
                  return (
                    <li key={source.id} className="py-2">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{source.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {source.serverName ? `${source.serverName} · ` : ""}
                            {"tool" in source.call ? `${source.call.tool} · ` : ""}
                            {scheduleLabel(source.schedule)}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {refreshedText(source.lastRefreshAt)}
                        </span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t`${source.name} options`}
                              >
                                <MoreHorizontal size={16} />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Trans>Change schedule</Trans>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup
                                  value={source.schedule}
                                  onValueChange={(schedule) =>
                                    void change(
                                      rpc.pages.setSourceSchedule({
                                        botId,
                                        sourceId: source.id,
                                        schedule: schedule as PageSourceSchedule,
                                      }),
                                    )
                                  }
                                >
                                  {SCHEDULES.map((schedule) => (
                                    <DropdownMenuRadioItem
                                      key={schedule}
                                      value={schedule}
                                      closeOnClick
                                    >
                                      {scheduleLabel(schedule)}
                                    </DropdownMenuRadioItem>
                                  ))}
                                </DropdownMenuRadioGroup>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            {source.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  void change(rpc.pages.pauseSource({ botId, sourceId: source.id }))
                                }
                              >
                                <Trans>Pause</Trans>
                              </DropdownMenuItem>
                            ) : null}
                            {source.status === "paused" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  void change(
                                    rpc.pages.resumeSource({ botId, sourceId: source.id }),
                                  )
                                }
                              >
                                <Trans>Resume</Trans>
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setRemoving(source)}
                            >
                              <Trans>Remove</Trans>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {source.lastError ? (
                        <p
                          title={source.lastError}
                          className="mt-0.5 truncate text-xs text-muted-foreground"
                        >
                          {source.lastError}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={removing !== undefined}
        onOpenChange={(next) => !next && setRemoving(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              <Trans>Remove {removing?.name}?</Trans>
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              <Trans>Remove</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
