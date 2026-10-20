import type { Artifact, ArtifactVersion, SpreadsheetPreview } from "@rakazo/contracts";
import { rpc } from "./api";
import type { MobileArtifactTarget } from "./artifact-open";

export type MobileArtifactSummary = Artifact & { versionCount: number };
export type MobileArtifactWithContent = Artifact & { contentBase64: string };

export type ArtifactListPage = { items: MobileArtifactSummary[]; nextCursor: string | null };

export function listSpaceArtifacts(input: {
  botId?: string;
  cursor?: string;
  limit?: number;
}): Promise<ArtifactListPage> {
  return rpc<ArtifactListPage>("artifacts/listSpace", input);
}

export function listArtifactVersions(familyId: string): Promise<ArtifactVersion[]> {
  return rpc<ArtifactVersion[]>("artifacts/listVersions", { familyId });
}

export function getArtifactById(artifactId: string): Promise<MobileArtifactWithContent> {
  return rpc<MobileArtifactWithContent>("artifacts/getById", { artifactId });
}

export function removeArtifact(artifactId: string): Promise<{ ok: true }> {
  return rpc<{ ok: true }>("artifacts/remove", { artifactId });
}

/** Group scope wins: a bot-scoped read drops rows that also have a group id. */
export function artifactThreadTarget(
  artifact: Pick<Artifact, "botId" | "groupId">,
): MobileArtifactTarget | null {
  if (artifact.groupId) return { groupId: artifact.groupId };
  if (artifact.botId) return { botId: artifact.botId };
  return null;
}

/** The first sheet of a spreadsheet artifact, read by the server. */
export function getSpreadsheetPreview(artifactId: string): Promise<SpreadsheetPreview> {
  return rpc<SpreadsheetPreview>("files/spreadsheetPreview", { source: { artifactId } });
}

/** .xlsx, .xlsm, .csv and .tsv; legacy .xls is not previewed. */
export function isSpreadsheetArtifact(name: string, mimeType: string): boolean {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext === "xls" || mimeType === "application/vnd.ms-excel") return false;
  return (
    ["xlsx", "xlsm", "csv", "tsv"].includes(ext ?? "") ||
    mimeType.includes("spreadsheetml.sheet") ||
    mimeType === "text/csv" ||
    mimeType === "text/tab-separated-values"
  );
}
