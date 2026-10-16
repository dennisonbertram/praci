import type { Artifact, ArtifactVersion } from "@rakazo/contracts";
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
