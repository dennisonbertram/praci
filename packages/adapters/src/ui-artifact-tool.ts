import { UI_ARTIFACT_EXTENSION } from "@rakazo/ui-artifact";

export const UI_ARTIFACT_GUIDANCE =
  "For a dashboard, summary, report or table, call create_ui_artifact (read-only cards, metrics, tables, lists and charts that follow the app's look). Use an HTML page with attach_file only when you need a free-form page it cannot express.";

/** A file name for the stored artifact: the title, without path characters. */
export function uiArtifactFileName(title: string): string {
  const base = title
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "artifact"}${UI_ARTIFACT_EXTENSION}`;
}
