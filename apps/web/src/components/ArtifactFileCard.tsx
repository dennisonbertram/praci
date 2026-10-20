import { Trans, useLingui } from "@lingui/react/macro";
import { UI_ARTIFACT_MIME_TYPE } from "@rakazo/contracts";
import { Button, Dialog, DialogClose, DialogContent, DialogTitle } from "@rakazo/ui-web";
import { Code2, Download, FileText, X } from "lucide-react";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type { ArtifactTarget } from "../lib/artifact-open";
import { downloadArtifact, downloadArtifactBytes, fetchArtifactBytes } from "../lib/artifact-open";
import { formatBytes } from "../lib/format-bytes";
import { errorText } from "../lib/user-error";
import { ArtifactPreview, canPreviewArtifact } from "./ArtifactPreview";

type ArtifactFileCardProps = {
  target: ArtifactTarget;
  artifactId: string;
  name: string;
  mimeType: string;
  size: number;
};

const TEXT_MIME_TYPES = new Set(["text/markdown", "text/html", UI_ARTIFACT_MIME_TYPE]);

export function ArtifactFileCard(props: ArtifactFileCardProps) {
  const { t } = useLingui();
  const previewable = canPreviewArtifact(props);
  const previewButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function startDownload() {
    setDownloadError(null);
    try {
      await downloadArtifact(props.target, props.artifactId, props.name, props.mimeType);
    } catch {
      setDownloadError(t`Could not download ${props.name}. Try again.`);
    }
  }

  return (
    <>
      <div>
        <div className="flex min-w-[280px] overflow-hidden rounded-2xl border border-border bg-card text-left text-foreground">
          <button
            ref={previewButton}
            type="button"
            aria-label={previewable ? t`Preview ${props.name}` : t`Download ${props.name}`}
            onClick={() => (previewable ? setPreviewOpen(true) : void startDownload())}
            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-accent"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-muted text-foreground">
              {props.mimeType === "text/html" ? (
                <Code2 size={21} strokeWidth={1.8} />
              ) : (
                <FileText size={21} strokeWidth={1.8} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium">{props.name}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">
                {formatBytes(props.size)}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label={t`Download ${props.name}`}
            title={t`Download ${props.name}`}
            onClick={() => void startDownload()}
            className="grid w-14 shrink-0 place-items-center border-l border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Download size={19} strokeWidth={1.8} />
          </button>
        </div>
        {downloadError ? <DownloadError message={downloadError} /> : null}
      </div>
      {previewable ? (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent
            showCloseButton={false}
            initialFocus={closeButton}
            finalFocus={previewButton}
            className="flex h-[min(88vh,900px)] w-[min(960px,94vw)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <FilePreview {...props} closeButtonRef={closeButton} />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function FilePreview({
  target,
  artifactId,
  name,
  mimeType,
  closeButtonRef,
}: ArtifactFileCardProps & { closeButtonRef: RefObject<HTMLButtonElement | null> }) {
  const { t } = useLingui();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; bytes: Uint8Array; text?: string }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const targetBotId = "botId" in target ? target.botId : undefined;
  const targetGroupId = "groupId" in target ? target.groupId : undefined;

  useEffect(() => {
    let cancelled = false;
    const artifactTarget: ArtifactTarget =
      targetBotId !== undefined ? { botId: targetBotId } : { groupId: targetGroupId! };
    void fetchArtifactBytes(artifactTarget, artifactId)
      .then((bytes) => {
        if (cancelled) return;
        if (!TEXT_MIME_TYPES.has(mimeType)) {
          setState({ status: "ready", bytes });
          return;
        }
        try {
          const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          setState({ status: "ready", bytes, text });
        } catch {
          setState({ status: "error", message: t`This file is not valid UTF-8 text.` });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: errorText(error, t`Could not load this file.`),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId, targetBotId, targetGroupId, mimeType, t]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-5">
        <DialogTitle className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-foreground">
          {name}
        </DialogTitle>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full text-muted-foreground"
          aria-label={t`Download ${name}`}
          title={t`Download ${name}`}
          onClick={() =>
            void (async () => {
              setDownloadError(null);
              try {
                if (state.status === "ready") downloadArtifactBytes(name, mimeType, state.bytes);
                else await downloadArtifact(target, artifactId, name, mimeType);
              } catch {
                setDownloadError(t`Could not download ${name}. Try again.`);
              }
            })()
          }
        >
          <Download />
        </Button>
        <DialogClose
          ref={closeButtonRef}
          aria-label={t`Close preview`}
          render={
            <Button variant="ghost" size="icon-lg" className="rounded-full text-muted-foreground" />
          }
        >
          <X />
        </DialogClose>
      </header>
      {downloadError ? (
        <div className="shrink-0 px-5 pt-4">
          <DownloadError message={downloadError} />
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {state.status === "loading" ? (
          <div className="p-8 text-muted-foreground">
            <Trans>Loading preview…</Trans>
          </div>
        ) : state.status === "error" ? (
          <div className="m-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
            {state.message}
          </div>
        ) : (
          <ArtifactPreview artifact={{ id: artifactId, name, mimeType }} bytes={state.bytes} />
        )}
      </div>
    </>
  );
}

function DownloadError({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-2 text-left text-[13px] text-destructive">
      {message}
    </div>
  );
}
