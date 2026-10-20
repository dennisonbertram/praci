import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { authHeaders, currentApiBase } from "./api";

/** Downloads the signed-in user's finished export into the cache and opens the share sheet for it. */
export async function shareDataExport(exportId: string): Promise<void> {
  const response = await fetch(
    `${currentApiBase()}/api/account/exports/${encodeURIComponent(exportId)}/download`,
    { headers: await authHeaders() },
  );
  if (!response.ok) throw new Error(`Export download failed (${response.status})`);
  const dir = new Directory(Paths.cache, "data-exports");
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, "praci-export.zip");
  file.create({ overwrite: true });
  file.write(new Uint8Array(await response.arrayBuffer()));
  await Sharing.shareAsync(file.uri, { mimeType: "application/zip" });
}
