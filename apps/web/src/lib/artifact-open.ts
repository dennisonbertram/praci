import { rpc } from "./rpc";

export type ArtifactTarget = { botId: string } | { groupId: string };

export function decodeArtifactBase64(contentBase64: string): Uint8Array {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function fetchArtifactBytes(
  target: ArtifactTarget,
  artifactId: string,
): Promise<Uint8Array> {
  const artifact = await rpc.artifacts.get({ ...target, artifactId });
  return decodeArtifactBase64(artifact.contentBase64);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function downloadArtifactBytes(name: string, mimeType: string, bytes: Uint8Array): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * What a new tab may show. The stored type is agent-written, so it only picks a row here; the blob
 * is typed by this table, never by the stored value. Text is written with textContent and images
 * go in an <img>, so nothing the agent wrote can run on the app's origin. Everything else (HTML,
 * SVG, XML, unknown) is saved as a plain download instead of opening.
 */
type TabKind = "text" | "image" | "pdf";
const TAB_TYPES: Record<string, { kind: TabKind; type: string }> = {
  "text/markdown": { kind: "text", type: "text/plain" },
  "text/plain": { kind: "text", type: "text/plain" },
  "text/csv": { kind: "text", type: "text/plain" },
  "application/json": { kind: "text", type: "text/plain" },
  "application/pdf": { kind: "pdf", type: "application/pdf" },
  "image/png": { kind: "image", type: "image/png" },
  "image/jpeg": { kind: "image", type: "image/jpeg" },
  "image/gif": { kind: "image", type: "image/gif" },
  "image/webp": { kind: "image", type: "image/webp" },
};
const TAB_EXTENSIONS: Record<string, string> = {
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function tabType(name: string, mimeType: string) {
  const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (TAB_TYPES[mime]) return TAB_TYPES[mime];
  if (mime && mime !== "application/octet-stream") return undefined;
  return TAB_TYPES[TAB_EXTENSIONS[name.split(".").pop()?.toLowerCase() ?? ""] ?? ""];
}

function showInTab(tab: Window, name: string, kind: TabKind, bytes: Uint8Array, type: string) {
  const doc = tab.document;
  doc.title = name;
  doc.body.style.cssText = "margin:0;font:14px system-ui,sans-serif";
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  // The file name is the save link: it saves under the real name.
  const save = doc.createElement("a");
  save.href = url;
  save.download = name;
  save.textContent = name;
  save.style.cssText = "display:block;padding:8px 12px;border-bottom:1px solid #ddd";
  let view: HTMLElement;
  if (kind === "text") {
    view = doc.createElement("pre");
    view.textContent = new TextDecoder().decode(bytes);
    view.style.cssText = "margin:0;padding:12px;white-space:pre-wrap;word-break:break-word";
  } else if (kind === "image") {
    view = doc.createElement("img");
    view.setAttribute("src", url);
    view.setAttribute("alt", name);
    view.style.cssText = "display:block;max-width:100%;margin:12px auto";
  } else {
    view = doc.createElement("iframe");
    view.setAttribute("src", url);
    view.setAttribute("title", name);
    view.style.cssText = "border:0;display:block;width:100vw;height:calc(100vh - 38px)";
  }
  doc.body.replaceChildren(save, view);
}

/**
 * The download control for an artifact: shows the file in a new tab where the browser can display
 * it safely, and saves it otherwise. The tab opens synchronously in the click (before the bytes
 * arrive) so a pop-up blocker lets it through; if it is refused (Electron denies it too) the file
 * downloads as before. A failed load closes the tab and rethrows.
 */
export async function openArtifactBytes(
  name: string,
  mimeType: string,
  load: () => Promise<Uint8Array> | Uint8Array,
): Promise<void> {
  const allowed = tabType(name, mimeType);
  const tab = allowed ? window.open("", "_blank") : null;
  if (!tab || !allowed) return downloadArtifactBytes(name, mimeType, await load());
  tab.opener = null;
  try {
    showInTab(tab, name, allowed.kind, await load(), allowed.type);
  } catch (error) {
    tab.close();
    throw error;
  }
}

export function downloadArtifact(
  target: ArtifactTarget,
  artifactId: string,
  name: string,
  mimeType: string,
): Promise<void> {
  return openArtifactBytes(name, mimeType, () => fetchArtifactBytes(target, artifactId));
}
