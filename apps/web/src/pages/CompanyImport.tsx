import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CompanyImportCatalogSource, CompanyImportSession } from "@rakazo/contracts";
import { CompanyGenericScopeSchema } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  Input,
  Skeleton,
} from "@rakazo/ui-web";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AskBotButton } from "../components/AskBotButton";
import { useFinanceQuery } from "../components/finance/ui";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { CompanyImportScope } from "./CompanyImportScope";

const liveStatuses = new Set(["running", "paused", "awaiting_consent", "budget_reached"]);
function statusName(status: string) {
  const names: Record<string, string> = {
    draft: t`Review`,
    running: t`Importing`,
    paused: t`Paused`,
    awaiting_consent: t`Consent required`,
    budget_reached: t`Token cap reached`,
    preview_ready: t`Sample ready`,
    completed: t`Done`,
    partial: t`Partial import`,
    failed: t`Failed`,
    cancelled: t`Cancelled`,
    discarded: t`Discarded`,
    waiting: t`Waiting`,
    reading: t`Reading`,
  };
  return names[status] ?? status.replaceAll("_", " ");
}
function trackerSource(source: { sourceKind: string; scope: Record<string, unknown> }) {
  return (
    source.sourceKind === "github" ||
    source.sourceKind === "linear" ||
    source.sourceKind === "notion" ||
    source.scope.reader === "github" ||
    source.scope.reader === "linear"
  );
}
function scopeName(source: { sourceKind: string; scope: Record<string, unknown> }) {
  if (source.sourceKind === "notion") return t`Shared pages`;
  if (source.sourceKind === "composio") {
    const count = Array.isArray(source.scope.tools) ? source.scope.tools.length : 0;
    return count === 1 ? t`1 read tool` : count ? t`${count} read tools` : t`Choose read tools`;
  }
  if (trackerSource(source)) return t`All accessible items`;
  if (source.sourceKind === "slack" || source.scope.reader === "slack") {
    const count =
      (Array.isArray(source.scope.channelIds) ? source.scope.channelIds.length : 0) +
      (Array.isArray(source.scope.privateChannelIds) ? source.scope.privateChannelIds.length : 0);
    if (!Array.isArray(source.scope.channelIds))
      return count ? t`Public and selected private channels` : t`All public channels`;
    return count === 1 ? t`1 channel` : t`${count} channels`;
  }
  if (source.sourceKind === "data_room") {
    if (!Array.isArray(source.scope.folderIds)) return t`All folders`;
    const count = source.scope.folderIds.length;
    return count === 1 ? t`1 folder` : t`${count} folders`;
  }
  if (source.scope.allTime) return t`All time`;
  const dates = [source.scope.after, source.scope.before].filter(Boolean).join(" — ");
  const labels = Array.isArray(source.scope.labelIds) ? source.scope.labelIds.join(", ") : "";
  return [dates, labels].filter(Boolean).join(" · ") || t`Last three years`;
}
export function CompanyImportPage({
  onOpenSettings,
  onAskAgent,
  settingsOpen = false,
}: {
  onOpenSettings: () => void;
  onAskAgent?: () => void;
  settingsOpen?: boolean;
}) {
  useHideAmounts();
  const [params, setParams] = useSearchParams();
  const requestedId = params.get("runId") ?? undefined;
  const catalog = useFinanceQuery(() => rpc.companyImport.catalog(), []);
  const boot = useFinanceQuery(
    async () => ({ session: await rpc.companyImport.session({ runId: requestedId }) }),
    [requestedId],
  );
  const [run, setRun] = useState<CompanyImportSession | null>(null);
  const [newImport, setNewImport] = useState(params.get("new") === "1");
  const [selected, setSelected] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [scopeSource, setScopeSource] = useState<CompanyImportCatalogSource | null>(null);
  const [cap, setCap] = useState("1000000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const [consentRevision, setConsentRevision] = useState(0);
  useEffect(() => {
    if (boot.data) {
      setRun(boot.data.session);
      if (boot.data.session) setCap(String(boot.data.session.progress.tokenCap));
    }
  }, [boot.data]);
  useEffect(() => {
    const data = catalog.data;
    if (data)
      setSelected(
        (current) =>
          current ??
          Object.fromEntries(
            data.sources
              .filter((source) => source.available && source.sourceKind !== "composio")
              .map((source) => [source.key, source.defaultScope]),
          ),
      );
  }, [catalog.data]);
  const runId = run?.progress.runId;
  const status = run?.progress.status;
  const refresh = useCallback(async (id: string) => {
    const next = await rpc.companyImport.session({ runId: id });
    setRun((current) => (!current || current.progress.runId === id ? next : current));
    return next;
  }, []);
  useEffect(() => {
    if (!runId || !status || !liveStatuses.has(status) || newImport) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | undefined;
    void (async () => {
      try {
        const stream = await rpc.companyImport.subscribe({ runId }, { signal: controller.signal });
        for await (const progress of stream) {
          if (controller.signal.aborted) return;
          setRun((current) =>
            current?.progress.runId === runId ? { ...current, progress } : current,
          );
          if (progress.status !== status) await refresh(runId);
        }
      } catch {
        /* A reconnect reads durable progress; it never restarts work. */
      }
      if (!controller.signal.aborted)
        timer = setInterval(() => {
          void refresh(runId).catch(() => {});
        }, 4000);
    })();
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [runId, status, newImport, refresh]);
  const consent = useFinanceQuery(
    async () =>
      Object.fromEntries(
        await Promise.all(
          (run?.sources ?? []).map(
            async (source) =>
              [
                source.id,
                await rpc.companyImport.consentStatus({
                  runId: run!.progress.runId,
                  sourceId: source.id,
                }),
              ] as const,
          ),
        ),
      ),
    [runId, status, consentRevision, settingsOpen],
  );
  const sample = useFinanceQuery(
    () =>
      runId && run?.mode === "sample" && status !== "draft"
        ? rpc.companyImport.sample({ runId })
        : Promise.resolve([]),
    [runId, status, run?.mode],
  );
  const allAllowed = Boolean(
    run?.sources.length && run.sources.every((source) => consent.data?.[source.id]?.allowed),
  );
  const showSources = newImport || !run;
  const validCap = Number.isSafeInteger(Number(cap)) && Number(cap) > 0;
  async function act(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    const sources = catalog
      .data!.sources.filter((source) => source.available && selected?.[source.key])
      .map((source) => ({
        sourceKind: source.sourceKind,
        connectionId: source.connectionId,
        mcpServerId: source.mcpServerId,
        scope: selected![source.key]!,
      }));
    const progress = await rpc.companyImport.create({
      mode: "sample",
      tokenCap: Number(cap),
      sources,
    });
    const next = await rpc.companyImport.session({ runId: progress.runId });
    setRun(next);
    setNewImport(false);
    setParams({ runId: progress.runId });
  }
  async function action(
    action: "pause" | "resume" | "continue" | "retry_failed" | "cancel" | "discard",
  ) {
    if (!runId) return;
    await rpc.companyImport.action({
      runId,
      action,
      ...(action === "resume" && status === "budget_reached" ? { tokenCap: Number(cap) } : {}),
    });
    await refresh(runId);
    setConsentRevision((n) => n + 1);
  }
  const loadError = catalog.error || boot.error;
  if (loadError)
    return (
      <main className="p-6">
        <p role="alert" className="text-destructive">
          {loadError}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            catalog.retry();
            boot.retry();
          }}
        >
          <Trans>Retry</Trans>
        </Button>
      </main>
    );
  if (!catalog.data || !boot.data || selected === null)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  return (
    <main className="rk-scroll mx-auto min-h-0 w-full max-w-4xl flex-1 space-y-8 overflow-y-auto p-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/app/company" className="text-sm text-muted-foreground hover:text-foreground">
            <Trans>Company</Trans>
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            <Trans>Import company</Trans>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {!showSources && status && <Badge variant="secondary">{statusName(status)}</Badge>}
          {onAskAgent && <AskBotButton botName={t`Company importer`} onClick={onAskAgent} />}
        </div>
      </header>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {showSources ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void act(create);
          }}
        >
          <section className="space-y-3">
            <h2 className="font-semibold">
              <Trans>Sources</Trans>
            </h2>
            <div className="divide-y divide-border rounded-xl border border-border">
              {catalog.data.sources.map((source) => (
                <div key={source.key} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="flex min-w-40 flex-1 items-center gap-3">
                    <Checkbox
                      aria-label={source.label}
                      disabled={!source.available || busy}
                      checked={Boolean(selected[source.key])}
                      onCheckedChange={(checked) =>
                        setSelected((current) => {
                          const next = { ...current };
                          if (checked) next[source.key] = source.defaultScope;
                          else delete next[source.key];
                          return next;
                        })
                      }
                    />
                    <span className="font-medium">{source.label}</span>
                  </div>
                  {source.available ? (
                    <div className="flex items-center gap-3 text-sm">
                      {source.itemCount !== null &&
                        Object.keys(selected[source.key] ?? {}).length === 0 && (
                          <span className="text-muted-foreground">
                            <Trans>{source.itemCount} items</Trans>
                          </span>
                        )}
                      {trackerSource({
                        sourceKind: source.sourceKind,
                        scope: source.defaultScope,
                      }) ? (
                        <span>
                          {scopeName({ sourceKind: source.sourceKind, scope: source.defaultScope })}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="link"
                          disabled={busy || !selected[source.key]}
                          onClick={() => setScopeSource(source)}
                        >
                          {scopeName({
                            sourceKind: source.sourceKind,
                            scope: selected[source.key] ?? source.defaultScope,
                          })}
                          <span className="sr-only">
                            {" "}
                            · <Trans>Choose scope</Trans>
                          </span>
                        </Button>
                      )}
                    </div>
                  ) : source.reason === "not_connected" && source.connectPath ? (
                    <Link className="text-sm underline underline-offset-4" to={source.connectPath}>
                      <Trans>Connect</Trans>
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {source.reason === "access_denied"
                        ? t`Access denied`
                        : t`No read-only importer`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
          <label htmlFor="company-import-token-cap" className="grid max-w-xs gap-2 text-sm">
            <Trans>Token cap</Trans>
            <Input
              id="company-import-token-cap"
              type="number"
              min={1}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              required
              value={cap}
              onChange={(event) => setCap(event.target.value)}
            />
          </label>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                busy ||
                !validCap ||
                !Object.keys(selected).length ||
                catalog.data.sources.some(
                  (source) =>
                    source.sourceKind === "composio" &&
                    selected[source.key] &&
                    !CompanyGenericScopeSchema.safeParse(selected[source.key]).success,
                )
              }
            >
              <Trans>Review</Trans>
            </Button>
          </div>
        </form>
      ) : (
        run && (
          <>
            {(status === "draft" ||
              status === "awaiting_consent" ||
              status === "preview_ready" ||
              (!allAllowed &&
                status &&
                ["paused", "budget_reached", "partial", "failed"].includes(status))) && (
              <section className="space-y-4">
                <h2 className="font-semibold">
                  <Trans>Sources and model recipients</Trans>
                </h2>
                {consent.error && (
                  <p role="alert" className="text-destructive">
                    {consent.error}
                  </p>
                )}
                {run.sources.map((source) => {
                  const current = consent.data?.[source.id];
                  return (
                    <div key={source.id} className="space-y-3 rounded-xl border border-border p-4">
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong>{source.label}</strong>
                        <span className="text-sm text-muted-foreground">{scopeName(source)}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          aria-label={t`Allow ${source.label} to ${current?.recipient?.name ?? "model"}`}
                          checked={current?.allowed ?? false}
                          disabled={busy || !current?.recipient || current.allowed}
                          onCheckedChange={(checked) => {
                            if (!checked || !current?.recipient || !current.consentKey) return;
                            void act(async () => {
                              await rpc.companyImport.grantConsent({
                                runId: run.progress.runId,
                                sourceId: source.id,
                                consentKey: current.consentKey!,
                                version: current.version,
                                sourceKind: current.sourceKind,
                                recipient: current.recipient!,
                              });
                              setConsentRevision((n) => n + 1);
                              await refresh(run.progress.runId);
                            });
                          }}
                        />
                        <span className="grid gap-1 text-sm">
                          {current?.recipient ? (
                            <>
                              <span>{current.recipient.name}</span>
                              <span className="text-muted-foreground">
                                {current.recipient.detail}
                              </span>
                              {current.recipient.privacyUrl && (
                                <a
                                  href={current.recipient.privacyUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline underline-offset-4"
                                >
                                  <Trans>Privacy</Trans>
                                </a>
                              )}
                            </>
                          ) : (
                            <span>{current ? t`No extraction model` : t`Loading recipients`}</span>
                          )}
                        </span>
                      </div>
                      {current && !current.recipient && (
                        <Button variant="link" onClick={onOpenSettings}>
                          <Trans>Connect a model</Trans>
                        </Button>
                      )}
                      <p className="text-sm text-muted-foreground">
                        <Trans>Items</Trans>: {source.plan.itemCount ?? t`Unknown`}
                      </p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        <Trans>Token estimate</Trans>: {source.plan.tokensLower.toLocaleString()}–
                        {source.plan.tokensUpper.toLocaleString()} ·{" "}
                        {source.plan.estimateBasis === "sample"
                          ? t`From sample`
                          : t`Cap-limited; sample pending`}
                      </p>
                      {source.plan.perCallCosts?.length ? (
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            <Trans>Published call rates · total unknown</Trans>
                          </p>
                          {source.plan.perCallCosts.map((cost) => (
                            <p key={cost.toolName} className="break-words">
                              {cost.toolName}: {maskCurrencyWhenHidden(cost.description)}
                              {cost.discount ? ` · ${maskCurrencyWhenHidden(cost.discount)}` : ""}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <p className="text-sm tabular-nums">
                  <Trans>Token cap</Trans>: {run.progress.tokenCap.toLocaleString()}
                </p>
                {status === "draft" && (
                  <div className="flex justify-end">
                    <Button
                      disabled={busy || !allAllowed}
                      onClick={() =>
                        void act(async () => {
                          await rpc.companyImport.start({ runId: run.progress.runId });
                          await refresh(run.progress.runId);
                        })
                      }
                    >
                      <Trans>Preview sample</Trans>
                    </Button>
                  </div>
                )}
              </section>
            )}
            {status !== "draft" && (
              <section className="space-y-4">
                <h2 className="font-semibold">
                  {run.mode === "sample" ? t`Sample · up to 25 items per source` : t`Progress`}
                </h2>
                {run.progress.sources.map((source) => (
                  <div key={source.id} className="space-y-3 rounded-xl border border-border p-4">
                    <div className="flex justify-between gap-4">
                      <strong>
                        {run.sources.find((item) => item.id === source.id)?.label ??
                          source.sourceKind}
                      </strong>
                      <span className="text-sm text-muted-foreground">
                        {statusName(source.status)}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={t`${run.sources.find((item) => item.id === source.id)?.label ?? source.sourceKind} progress`}
                      aria-valuemin={0}
                      aria-valuemax={Math.max(1, source.itemsDiscovered)}
                      aria-valuenow={source.itemsRead}
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${Math.min(100, (source.itemsRead / Math.max(1, source.itemsDiscovered)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-5 text-sm tabular-nums text-muted-foreground">
                      <span>
                        <Trans>Read</Trans> {source.itemsRead}/{source.itemsDiscovered}
                      </span>
                      <span>
                        <Trans>Facts</Trans> {source.factsFound}
                      </span>
                      <span>
                        <Trans>Tokens</Trans> {source.inputTokensUsed + source.outputTokensUsed}
                      </span>
                    </div>
                    {source.lastError && (
                      <p className="text-sm text-destructive">
                        {source.lastError.replaceAll("_", " ")}
                      </p>
                    )}
                  </div>
                ))}
                <p className="text-sm tabular-nums text-muted-foreground">
                  <Trans>Tokens</Trans>{" "}
                  {run.progress.inputTokensUsed + run.progress.outputTokensUsed}/
                  {run.progress.tokenCap} · <Trans>Reserved</Trans> {run.progress.reservedTokens}
                </p>
                {run.progress.budgetWarning && (
                  <p className="text-sm text-warning">
                    <Trans>Token cap nearly reached</Trans>
                  </p>
                )}
                {status === "budget_reached" && (
                  <label
                    htmlFor="company-import-increase-token-cap"
                    className="grid max-w-xs gap-2 text-sm"
                  >
                    <Trans>Increase token cap</Trans>
                    <Input
                      id="company-import-increase-token-cap"
                      type="number"
                      min={run.progress.tokenCap}
                      step={1}
                      value={cap}
                      onChange={(event) => setCap(event.target.value)}
                    />
                  </label>
                )}
              </section>
            )}
            {sample.data?.some((source) => source.items.length > 0) && (
              <section className="space-y-4">
                <h2 className="font-semibold">
                  <Trans>Sample facts</Trans>
                </h2>
                {sample.data.map((source) => (
                  <div key={source.sourceId} className="space-y-3">
                    <h3 className="text-sm text-muted-foreground">
                      {run.sources.find((row) => row.id === source.sourceId)?.label}
                    </h3>
                    {source.items.map((item) => (
                      <div
                        key={item.sourceItemId}
                        className="space-y-3 border-l border-border pl-4"
                      >
                        {item.facts.map((fact, index) => (
                          <div key={`${fact.kind}:${index}`}>
                            <p className="text-sm font-medium">
                              {maskCurrencyWhenHidden(fact.title)}{" "}
                              <span className="font-normal text-muted-foreground">
                                {Math.round(fact.confidence * 100)}%
                              </span>
                            </p>
                            <blockquote className="mt-1 text-sm text-muted-foreground">
                              {maskCurrencyWhenHidden(fact.quote)}
                            </blockquote>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            )}
            {sample.error && (
              <p role="alert" className="text-destructive">
                {sample.error}
              </p>
            )}
            {status === "preview_ready" &&
              sample.data &&
              sample.data.every((source) => source.items.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  <Trans>No facts in this sample</Trans>
                </p>
              )}
            <footer className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              {status === "running" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act(() => action("pause"))}
                >
                  <Trans>Pause</Trans>
                </Button>
              )}
              {(status === "paused" || status === "budget_reached") && (
                <Button
                  disabled={
                    busy ||
                    !allAllowed ||
                    (status === "budget_reached" &&
                      (!validCap || Number(cap) < run.progress.tokenCap))
                  }
                  onClick={() => void act(() => action("resume"))}
                >
                  <Trans>Resume</Trans>
                </Button>
              )}
              {(status === "partial" || status === "failed") && (
                <Button
                  disabled={busy || !allAllowed}
                  onClick={() => void act(() => action("retry_failed"))}
                >
                  <Trans>Retry failed</Trans>
                </Button>
              )}
              {status === "preview_ready" && (
                <Button
                  disabled={busy || !allAllowed}
                  onClick={() => void act(() => action("continue"))}
                >
                  <Trans>Start import</Trans>
                </Button>
              )}
              {status &&
                [
                  "draft",
                  "running",
                  "paused",
                  "awaiting_consent",
                  "budget_reached",
                  "preview_ready",
                ].includes(status) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void act(() => action("cancel"))}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                )}
              {status !== "discarded" && (
                <Button variant="ghost" disabled={busy} onClick={() => setDiscard(true)}>
                  <Trans>Discard</Trans>
                </Button>
              )}
              {status &&
                ["completed", "partial", "failed", "cancelled", "discarded"].includes(status) && (
                  <Button variant="outline" disabled={busy} onClick={() => setNewImport(true)}>
                    <Trans>New import</Trans>
                  </Button>
                )}
              <Link to="/app/company" className="ms-auto text-sm underline underline-offset-4">
                <Trans>Open Company</Trans>
              </Link>
            </footer>
          </>
        )
      )}
      {scopeSource && (
        <CompanyImportScope
          key={scopeSource.key}
          source={scopeSource}
          scope={selected[scopeSource.key] ?? scopeSource.defaultScope}
          folders={catalog.data.folders}
          onClose={() => setScopeSource(null)}
          onSave={(scope) => {
            setSelected((current) => ({ ...current, [scopeSource.key]: scope }));
            setScopeSource(null);
          }}
        />
      )}
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Discard this import?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>Remove this import’s evidence and facts that have no other evidence.</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Keep</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscard(false);
                void act(() => action("discard"));
              }}
            >
              <Trans>Discard</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
