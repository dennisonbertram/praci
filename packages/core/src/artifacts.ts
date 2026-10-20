import { UI_ARTIFACT_MIME_TYPE } from "@rakazo/contracts";

/** Short badge text for a mime type ("HTML", "MD", "PDF", or its subtype). */
export function mimeBadgeLabel(mimeType: string): string {
  if (mimeType === "text/html") return "HTML";
  if (mimeType === "text/markdown") return "MD";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === UI_ARTIFACT_MIME_TYPE) return "UI";
  const slash = mimeType.indexOf("/");
  return (slash === -1 ? mimeType : mimeType.slice(slash + 1)).toUpperCase().slice(0, 6);
}

/** Client-side search over an already-loaded page, matching the web Artifacts page. */
export function matchesArtifactQuery(
  item: { name: string; description?: string | null },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    item.name.toLowerCase().includes(needle) ||
    (item.description?.toLowerCase().includes(needle) ?? false)
  );
}
