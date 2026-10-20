import { Trans } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { Artifact } from "@rakazo/contracts";
import { isAttachmentImageMimeType, UI_ARTIFACT_MIME_TYPE } from "@rakazo/contracts";
import { canPreviewSpreadsheet } from "../lib/spreadsheet";
import { useObjectUrl } from "../lib/use-object-url";
import { PdfViewer } from "./PdfViewer";
import { SandboxedHtmlViewer } from "./SandboxedHtmlViewer";
import { SheetPreview } from "./SheetPreview";
import { UiArtifactView } from "./UiArtifactView";

type PreviewTarget = Pick<Artifact, "id" | "name" | "mimeType">;

/** The one rule for which files open in a preview; everything else is download-only. */
export function canPreviewArtifact({ name, mimeType }: Pick<Artifact, "name" | "mimeType">) {
  return (
    mimeType === "text/html" ||
    mimeType === UI_ARTIFACT_MIME_TYPE ||
    mimeType === "text/markdown" ||
    mimeType === "application/pdf" ||
    isAttachmentImageMimeType(mimeType) ||
    canPreviewSpreadsheet(name, mimeType)
  );
}

export function ArtifactPreview({
  artifact,
  bytes,
}: {
  artifact: PreviewTarget;
  bytes: Uint8Array;
}) {
  if (artifact.mimeType === "text/html") {
    const html = new TextDecoder("utf-8").decode(bytes);
    return <SandboxedHtmlViewer html={html} title={artifact.name} />;
  }
  if (artifact.mimeType === UI_ARTIFACT_MIME_TYPE) {
    return <UiArtifactView source={new TextDecoder("utf-8").decode(bytes)} />;
  }
  if (artifact.mimeType === "text/markdown") {
    const text = new TextDecoder("utf-8").decode(bytes);
    return (
      <div className="h-full overflow-y-auto bg-background">
        <article className="mx-auto w-full max-w-[760px] px-8 py-10 text-[16px] leading-7 text-foreground">
          <ChatMarkdown>{text}</ChatMarkdown>
        </article>
      </div>
    );
  }
  if (artifact.mimeType === "application/pdf") {
    return <PdfViewer bytes={bytes} title={artifact.name} />;
  }
  if (isAttachmentImageMimeType(artifact.mimeType)) {
    return <ImagePreview bytes={bytes} mimeType={artifact.mimeType} name={artifact.name} />;
  }
  if (canPreviewSpreadsheet(artifact.name, artifact.mimeType)) {
    return <SheetPreview key={artifact.id} source={{ artifactId: artifact.id }} />;
  }
  return (
    <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground/80">
      <Trans>Preview isn't available for this file type — download it to view it.</Trans>
    </div>
  );
}

function ImagePreview({
  bytes,
  mimeType,
  name,
}: {
  bytes: Uint8Array;
  mimeType: string;
  name: string;
}) {
  const url = useObjectUrl(bytes, mimeType);
  if (!url) return null;
  return (
    <div className="grid h-full place-items-center overflow-auto bg-muted/40 p-4">
      <img src={url} alt={name} className="max-h-full max-w-full rounded-lg shadow-sm" />
    </div>
  );
}
