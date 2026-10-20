import { isAttachmentImageMimeType, UI_ARTIFACT_MIME_TYPE } from "@rakazo/contracts";
import type { MobileArtifactWithContent } from "./artifacts";
import { isSpreadsheetArtifact } from "./artifacts";

export type PreviewContent =
  | { kind: "html"; html: string }
  | { kind: "markdown"; text: string }
  | { kind: "image"; uri: string }
  | { kind: "pdf"; uri: string }
  | { kind: "sheet"; artifactId: string }
  | { kind: "ui"; source: string }
  | { kind: "unsupported" };

export async function computePreview(
  artifact: Pick<MobileArtifactWithContent, "id" | "name" | "mimeType">,
  file: { uri: string; text(): Promise<string> },
): Promise<PreviewContent> {
  const { mimeType } = artifact;
  if (isSpreadsheetArtifact(artifact.name, mimeType))
    return { kind: "sheet", artifactId: artifact.id };
  if (mimeType === UI_ARTIFACT_MIME_TYPE) return { kind: "ui", source: await file.text() };
  if (mimeType === "text/html") return { kind: "html", html: await file.text() };
  if (mimeType === "text/markdown") return { kind: "markdown", text: await file.text() };
  if (isAttachmentImageMimeType(mimeType)) return { kind: "image", uri: file.uri };
  if (mimeType.split(";")[0]?.trim().toLowerCase() === "application/pdf")
    return { kind: "pdf", uri: file.uri };
  return { kind: "unsupported" };
}
