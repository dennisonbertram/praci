import { Trans, useLingui } from "@lingui/react/macro";
import type { MessageBlock } from "@rakazo/contracts";
import { abortableDelay } from "@rakazo/core";
import { Button, Dialog, DialogClose, DialogContent, DialogTitle } from "@rakazo/ui-web";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { BuiCard, SuccessPop } from "../../components/ai/primitives";
import { AppLogo } from "../../components/integrations/AppLogo";
import type { ArtifactTarget } from "../../lib/artifact-open";
import { chartViewport } from "../../lib/chart-viewport";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { connectMcpOauth } from "../../lib/mcp-connect";
import { PLUGIN_CONNECT_WINDOW } from "../../lib/plugin-connect";
import { rpc } from "../../lib/rpc";
import { useArtifactImageState } from "../../lib/use-artifact-image";
import { errorText } from "../../lib/user-error";

export function ChoiceCard({
  botId,
  block,
  onBotChanged,
}: {
  botId: string;
  block: Extract<MessageBlock, { kind: "choice" }>;
  onBotChanged: () => Promise<void>;
}) {
  const { t } = useLingui();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locallyDismissed, setLocallyDismissed] = useState(false);
  const dismissed = locallyDismissed || block.answerId === "_dismissed";

  async function choose(optionId: string) {
    setPending(true);
    setError(null);
    try {
      await rpc.onboarding.choose({ botId, optionId });
      await onBotChanged();
    } catch (err) {
      setError(errorText(err, t`Could not save this choice`));
      setPending(false);
    }
  }

  async function dismiss() {
    setPending(true);
    setError(null);
    try {
      await rpc.onboarding.dismissFocus({ botId });
      setLocallyDismissed(true);
      void onBotChanged().catch(() => undefined);
    } catch (err) {
      setError(errorText(err, t`Could not dismiss`));
      setPending(false);
    }
  }

  if (dismissed) return null;

  return (
    <div className="flex justify-start">
      <div className="relative w-160 max-w-full rounded-2xl border border-border bg-card px-5 py-4">
        {!block.answerId ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t`Dismiss`}
            disabled={pending}
            onClick={() => void dismiss()}
            className="absolute end-2 top-2 text-muted-foreground"
          >
            <X size={16} strokeWidth={1.8} />
          </Button>
        ) : null}
        <div className="pe-8 text-[15.5px] text-foreground/90">
          <OnboardingFocusQuestion question={block.question} />
        </div>
        {block.subtitle ? (
          <div className="mt-0.5 text-[13px] text-foreground/75">{block.subtitle}</div>
        ) : null}
        <div className="mt-3 space-y-2.5">
          {block.options
            .filter((option) => !block.answerId || option.id === block.answerId)
            .map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={Boolean(block.answerId) || pending}
                onClick={() => void choose(option.id)}
                className={`flex w-full items-start gap-3 rounded-xl px-3.5 py-3.5 text-start text-foreground disabled:opacity-60 ${block.answerId ? "bg-accent" : "bg-muted hover:bg-accent"}`}
              >
                <span className="mt-0.5 grid h-[24px] w-[24px] shrink-0 place-items-center rounded-[7px] bg-background text-[12.5px] font-medium text-foreground/75">
                  {option.letter}
                </span>
                <span
                  className={`flex-1 text-[15px] leading-[1.35] ${block.answerId ? "text-foreground/75" : "text-foreground"}`}
                >
                  <OnboardingFocusOptionLabel
                    id={option.id}
                    label={option.label}
                    question={block.question}
                  />
                  {block.answerId ? null : (
                    <OnboardingFocusOptionHint id={option.id} question={block.question} />
                  )}
                </span>
                {block.answerId === option.id ? (
                  <span className="mt-0.5 text-foreground/75">✓</span>
                ) : null}
              </button>
            ))}
        </div>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

/** First-run Chief focus card: API stores English; UI locale catalogs translate it. */
function OnboardingFocusQuestion({ question }: { question: string }) {
  if (question === "What do you want me on first?") {
    return <Trans>What do you want me on first?</Trans>;
  }
  return question;
}

/** One line on what each first-run focus covers, so the choice is clear before it is made. */
function OnboardingFocusOptionHint({ id, question }: { id: string; question: string }) {
  if (question !== "What do you want me on first?") return null;
  const hint =
    id === "company" ? (
      <Trans>Email, calendar and your company pages</Trans>
    ) : id === "day" ? (
      <Trans>Slack, calendar and email</Trans>
    ) : id === "inbox" ? (
      <Trans>Email and calendar</Trans>
    ) : id === "research" ? (
      <Trans>The web, notes and docs</Trans>
    ) : id === "everything" ? (
      <Trans>Email, Slack and docs</Trans>
    ) : null;
  return hint ? (
    <span className="mt-0.5 block text-[13px] text-muted-foreground">{hint}</span>
  ) : null;
}

function OnboardingFocusOptionLabel({
  id,
  label,
  question,
}: {
  id: string;
  label: string;
  question: string;
}) {
  if (question !== "What do you want me on first?") return label;
  switch (id) {
    case "company":
      return <Trans>Run my company</Trans>;
    case "day":
      return <Trans>Day-to-day work</Trans>;
    case "inbox":
      return <Trans>Inbox & email</Trans>;
    case "research":
      return <Trans>Research & writing</Trans>;
    case "everything":
      return <Trans>A bit of everything</Trans>;
    default:
      return label;
  }
}

export function AppConnectCard({
  botId,
  block,
}: {
  botId: string;
  block: Extract<MessageBlock, { kind: "app_connect" }>;
}) {
  const { t } = useLingui();
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState<"pending" | "connected">(block.status);
  const [error, setError] = useState<string | null>(null);
  const connectionAttempt = useRef<AbortController | null>(null);
  const status = block.status === "connected" ? "connected" : localStatus;
  useEffect(() => () => connectionAttempt.current?.abort(), []);

  async function authorize() {
    connectionAttempt.current?.abort();
    const controller = new AbortController();
    connectionAttempt.current = controller;
    setBusy(true);
    setError(null);
    try {
      const started = await rpc.connections.begin({
        connectorId: block.connectorId,
        provider: block.provider,
        displayName: block.name,
      });
      if (started.authorizationUrl) {
        const opened = window.open(
          started.authorizationUrl,
          PLUGIN_CONNECT_WINDOW,
          "popup,width=560,height=720",
        );
        try {
          // The provider's page must not reach back into Praci.
          if (opened) opened.opener = null;
        } catch {
          // Cross-origin handles may refuse; the named window still works.
        }
      }
      for (let i = 0; i < 60; i += 1) {
        if (controller.signal.aborted) return;
        const row = await rpc.connections
          .complete({ connectionId: started.connectionId })
          .catch(() => undefined);
        if (row?.status === "connected") {
          if (controller.signal.aborted) return;
          setLocalStatus("connected");
          await rpc.onboarding
            .appConnected({ botId, provider: block.provider, connectorId: block.connectorId })
            .catch(() => undefined);
          return;
        }
        await abortableDelay(2_000, controller.signal);
      }
      if (!controller.signal.aborted) setError(t`Authorization timed out. Please try again.`);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(errorText(error, t`Could not authorize this app`));
      }
    } finally {
      if (connectionAttempt.current === controller) {
        connectionAttempt.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <BuiCard
      role="group"
      aria-label={t`${block.name} connection`}
      className="w-[min(420px,100%)] px-4 py-3.5"
    >
      {/* On a narrow card the button wraps under the name instead of covering it. */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <AppLogo name={block.name} logo={block.logo} />
        <span className="min-w-28 flex-1">
          <span className="block truncate text-[15px] font-medium text-foreground">
            {block.name}
          </span>
          <span className="block text-[13px] text-muted-foreground">{block.description}</span>
        </span>
        {status === "connected" ? (
          <SuccessPop label={t`Connected`} />
        ) : (
          <Button
            variant="outline"
            className="ms-auto rounded-full"
            disabled={busy}
            onClick={() => void authorize()}
          >
            {busy ? t`Waiting…` : t`Connect`}
          </Button>
        )}
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </BuiCard>
  );
}

/** Chart data reaches the plot renderer raw, so while amounts are hidden the chart is not drawn at all. */
export function ChartCanvas(props: ComponentProps<typeof ChartCanvasPlot>) {
  const hidden = useHideAmounts();
  if (hidden)
    return (
      <div data-testid="chart-hidden" className="text-[13px] text-muted-foreground">
        <Trans>Chart hidden while amounts are hidden</Trans>
      </div>
    );
  return <ChartCanvasPlot {...props} />;
}

function ChartCanvasPlot({
  spec,
  data,
  width,
  height,
}: {
  spec: Record<string, unknown>;
  data: unknown[];
  width: number;
  height?: number;
}) {
  const { t } = useLingui();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    title?: string;
    swatches: { label: string; color: string }[];
  }>({ swatches: [] });
  useEffect(() => {
    let cancelled = false;
    // Plot loads lazily so threads without charts never pay for the library.
    void (async () => {
      try {
        const { buildPlotParts } = await import("@rakazo/core/plot");
        if (cancelled || !ref.current) return;
        // Hover inspection by default: give the first mark a tooltip unless
        // the spec already asks for one somewhere.
        const marks = Array.isArray((spec as { marks?: unknown[] }).marks)
          ? ((spec as { marks: { options?: Record<string, unknown> }[] }).marks ?? [])
          : [];
        const hasTip = marks.some((mark) => mark.options && "tip" in mark.options);
        const liveSpec = hasTip
          ? spec
          : {
              ...spec,
              marks: marks.map((mark, index) =>
                index === 0 ? { ...mark, options: { ...(mark.options ?? {}), tip: true } } : mark,
              ),
            };
        const parts = buildPlotParts(liveSpec as never, data, document, { width, height });
        setMeta({ title: parts.title, swatches: parts.swatches });
        setError(null);
        ref.current.replaceChildren(parts.plotted);
      } catch (err) {
        if (!cancelled) setError(errorText(err, t`Could not render chart`));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spec, data, width, height, t]);
  if (error)
    return (
      <div className="text-[13px] text-destructive">
        <Trans>Chart failed to render: {error}</Trans>
      </div>
    );
  return (
    <div className="text-foreground/75">
      {meta.title ? (
        <div className="mb-1 text-[14.5px] font-semibold text-foreground">{meta.title}</div>
      ) : null}
      {meta.swatches.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
          {meta.swatches.map((swatch) => (
            <span
              key={swatch.label}
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
            >
              {/* Series colours are data-driven and intentionally distinct. */}
              <span
                className="h-[10px] w-[10px] rounded-[3px]"
                style={{ background: swatch.color }}
              />
              {swatch.label}
            </span>
          ))}
        </div>
      ) : null}
      <div ref={ref} className="[&_svg]:max-w-full" />
    </div>
  );
}

type McpApprovalState = "pending" | "connecting" | "connected" | "dismissed";

/** Approval card for an agent-created MCP server: the user completes browser
 * OAuth (or confirms no authorization is needed) without leaving the chat.
 * The decision persists on the block, so the card keeps showing it after the
 * thread remounts. */
export function McpApprovalCard({
  botId,
  threadId,
  block,
}: {
  botId: string | undefined;
  threadId: string | undefined;
  block: Extract<MessageBlock, { kind: "mcp_approval" }>;
}) {
  const { t } = useLingui();
  const { name, serverId, transport, endpoint, needsOAuth, status: savedStatus } = block;
  const [localStatus, setLocalStatus] = useState<McpApprovalState>("pending");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A removal repaints the block to pending. Drop an in-session connected
  // override so the card does not keep the old decision.
  useEffect(() => {
    if (savedStatus === "connected" || savedStatus === "dismissed") return;
    setLocalStatus((current) =>
      current === "connected" || current === "dismissed" ? "pending" : current,
    );
  }, [savedStatus]);
  // Blocks saved before the status field existed have none and count as pending.
  const state =
    savedStatus === "connected" || savedStatus === "dismissed" ? savedStatus : localStatus;

  async function authorize() {
    if (!botId || busy) {
      if (!botId) setError(t`This server cannot be assigned without a bot.`);
      return;
    }
    setBusy(true);
    setLocalStatus("connecting");
    setError(null);
    try {
      if (needsOAuth) {
        const result = await connectMcpOauth(serverId);
        if (result === "cancelled") {
          setLocalStatus("pending");
          return;
        }
      }
      await rpc.mcp.assignments.approve({ botId, serverId, threadId });
      setLocalStatus("connected");
    } catch (err) {
      setError(errorText(err, t`Could not approve this server`));
      setLocalStatus("pending");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (botId) {
        await rpc.mcp.assignments.dismiss({ botId, serverId, threadId });
      }
      setLocalStatus("dismissed");
    } catch (err) {
      setLocalStatus("pending");
      setError(errorText(err, t`Could not dismiss this server`));
    } finally {
      setBusy(false);
    }
  }

  const summary = endpoint ?? `stdio · ${transport}`;
  return (
    <BuiCard data-testid="mcp-approval-card" className="max-w-full p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-xs text-foreground">
          M
        </span>
        <span className="text-[14.5px] font-medium text-foreground">
          <Trans>Connect MCP server “{name}”</Trans>
        </span>
      </div>
      <p className="mt-1.5 truncate text-[12px] text-muted-foreground">{summary}</p>
      {state === "pending" || state === "connecting" ? (
        <>
          <p className="mt-2 text-[13px] leading-[1.5] text-foreground/75">
            {needsOAuth
              ? t`Authorize this server so bots can use its tools. A popup opens.`
              : t`Approve this server to let your bot use its tools.`}
          </p>
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <Button
              className="rounded-full"
              disabled={state !== "pending" || busy}
              onClick={() => void authorize()}
            >
              {state === "connecting" ? t`Connecting…` : needsOAuth ? t`Authorize` : t`Approve`}
            </Button>
            <Button
              variant="secondary"
              className="rounded-full"
              disabled={state !== "pending" || busy}
              onClick={() => void dismiss()}
            >
              <Trans>Not now</Trans>
            </Button>
          </div>
        </>
      ) : null}
      {state === "connected" ? (
        <div className="mt-3">
          <SuccessPop label={t`Connected. Its tools are available from your next message.`} />
        </div>
      ) : null}
      {state === "dismissed" ? (
        <p className="mt-2 text-[13px] text-muted-foreground">
          <Trans>Dismissed. Reconnect anytime from MCP settings.</Trans>
        </p>
      ) : null}
    </BuiCard>
  );
}

export function ChartBlockView({
  name,
  spec,
  data,
}: {
  name: string;
  spec: Record<string, unknown>;
  data: unknown[];
}) {
  const { t } = useLingui();
  const [expanded, setExpanded] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    if (!expanded) return;
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [expanded]);
  const expandedViewport = chartViewport(viewport.width, viewport.height);
  return (
    <>
      <div className="group relative max-w-[74%] rounded-[20px] bg-muted p-4">
        <ChartCanvas spec={spec} data={data} width={520} />
        <Button
          variant="outline"
          size="xs"
          onClick={() => setExpanded(true)}
          className="absolute end-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trans>Expand</Trans>
        </Button>
      </div>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] w-[min(1320px,94vw)] max-w-none overflow-auto p-8 sm:max-w-none"
        >
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[13px] font-normal text-muted-foreground">
              {name}
            </DialogTitle>
            <DialogClose
              aria-label={t`Close chart`}
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <X />
            </DialogClose>
          </div>
          <ChartCanvas
            spec={spec}
            data={data}
            width={expandedViewport.width}
            height={expandedViewport.height}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

type ImageBlock = Extract<MessageBlock, { kind: "image" }>;

/** One image fetched through the authenticated artifact route; click opens it full size. */
export function ArtifactImage({
  target,
  artifactId,
  name,
  alt,
  caption,
  tile,
}: {
  target: ArtifactTarget;
  artifactId: string;
  name: string;
  alt?: string;
  caption?: string;
  /** A square cell in a grid instead of a standalone image. */
  tile?: boolean;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const { src, failed } = useArtifactImageState(target, artifactId, visible);
  const label = alt || name;

  useEffect(() => {
    const element = container.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <figure ref={container} className={tile ? "min-w-0" : "max-w-[min(480px,100%)]"}>
      {src ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full overflow-hidden rounded-xl border border-border"
        >
          <img
            src={src}
            alt={label}
            className={tile ? "h-40 w-full object-cover" : "max-h-[480px] w-full object-contain"}
          />
        </button>
      ) : failed ? (
        <div
          role="img"
          aria-label={label}
          className="rounded-xl border border-border bg-muted px-4 py-3 text-[14px] text-muted-foreground"
        >
          {name}
        </div>
      ) : (
        <div
          data-testid="image-skeleton"
          className={`animate-pulse rounded-xl border border-border bg-muted ${tile ? "h-40" : "h-48 w-72"}`}
        />
      )}
      {caption ? (
        <figcaption className="mt-1 text-[13px] text-muted-foreground" dir="auto">
          {caption}
        </figcaption>
      ) : null}
      {src ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            showCloseButton={false}
            className="w-auto max-w-none bg-transparent p-0 ring-0 sm:max-w-none"
          >
            <DialogTitle className="sr-only">{label}</DialogTitle>
            <DialogClose
              aria-label={t`Close image preview`}
              render={<Button variant="ghost" size="icon-sm" className="absolute end-2 top-2" />}
            >
              <X />
            </DialogClose>
            <img
              src={src}
              alt={label}
              className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </figure>
  );
}

/** Several images shown together (show_image with more than one) make a two-column grid. */
export function ArtifactImageGrid({
  target,
  images,
}: {
  target: ArtifactTarget;
  images: ImageBlock[];
}) {
  if (images.length === 1) {
    const [image] = images as [ImageBlock];
    return <ArtifactImage target={target} {...image} />;
  }
  return (
    <div className="grid w-[min(480px,100%)] grid-cols-2 gap-2">
      {images.map((image) => (
        <ArtifactImage key={image.artifactId} target={target} {...image} tile />
      ))}
    </div>
  );
}
