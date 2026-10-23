import type { DataRoomApiItem } from "@rakazo/contracts";
import { Directory, File, Paths } from "expo-file-system";
import { captureApiRequestContext, currentApiBase, selectedSpaceId } from "./api";
import { artifactShareFileName } from "./artifact-file";
import { t } from "./i18n";
import { currentSessionGeneration, registerSessionDiskCache } from "./session";

const cache = () => new Directory(Paths.cache, "data-room");
registerSessionDiskCache(() => {
  const root = cache();
  if (root.exists) root.delete();
});

export type DataRoomFile = {
  file: File;
  assertCurrent: () => void;
  dispose: () => void;
};

/** Every open is authorized again; neither partial downloads nor previous sessions are cache hits. */
export async function downloadDataRoomFile(
  item: Pick<DataRoomApiItem, "id" | "name" | "mimeType">,
  signal: AbortSignal,
): Promise<DataRoomFile> {
  const generation = currentSessionGeneration();
  const spaceId = selectedSpaceId();
  const context = await captureApiRequestContext();
  const assertCurrent = () => {
    if (
      signal.aborted ||
      generation !== currentSessionGeneration() ||
      spaceId !== selectedSpaceId() ||
      context.apiBase !== currentApiBase()
    )
      throw new Error(t("The session changed. Open the file again."));
  };
  assertCurrent();
  const directory = new Directory(
    cache(),
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  );
  directory.create({ intermediates: true });
  const file = new File(directory, artifactShareFileName(item.name, item.mimeType));
  const dispose = () => {
    if (directory.exists) directory.delete();
  };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 120_000);
  try {
    await File.downloadFileAsync(
      `${context.apiBase}/api/data-room/items/${encodeURIComponent(item.id)}/content`,
      file,
      { headers: context.headers, signal: controller.signal },
    );
    assertCurrent();
    return { file, assertCurrent, dispose };
  } catch (error) {
    dispose();
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}
