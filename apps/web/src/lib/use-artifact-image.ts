import { useEffect, useState } from "react";
import type { ArtifactTarget } from "./artifact-open";
import { decodeArtifactBase64 } from "./artifact-open";
import { rpc } from "./rpc";

type ImageDownload = {
  promise: Promise<string>;
  consumers: number;
  objectUrl: string | null;
  settled: boolean;
};

const downloads = new Map<string, ImageDownload>();

function releaseUnusedDownload(key: string, download: ImageDownload) {
  // Keep pending work reusable even if its original consumers leave.
  if (download.consumers || !download.settled) return;
  if (download.objectUrl) URL.revokeObjectURL(download.objectUrl);
  if (downloads.get(key) === download) downloads.delete(key);
}

function acquireDownload(target: ArtifactTarget, artifactId: string) {
  const key = JSON.stringify([
    "botId" in target ? "bot" : "group",
    "botId" in target ? target.botId : target.groupId,
    artifactId,
  ]);
  let download = downloads.get(key);
  if (!download) {
    const entry: ImageDownload = {
      consumers: 0,
      objectUrl: null,
      settled: false,
      promise: rpc.artifacts
        .get({ ...target, artifactId })
        .then((artifact) => {
          const bytes = decodeArtifactBase64(artifact.contentBase64);
          entry.objectUrl = URL.createObjectURL(
            new Blob([new Uint8Array(bytes)], { type: artifact.mimeType }),
          );
          return entry.objectUrl;
        })
        .catch((error) => {
          if (downloads.get(key) === entry) downloads.delete(key);
          throw error;
        })
        .finally(() => {
          entry.settled = true;
          releaseUnusedDownload(key, entry);
        }),
    };
    download = entry;
    downloads.set(key, download);
  }
  download.consumers++;
  const entry = download;
  return {
    promise: entry.promise,
    release: () => {
      entry.consumers--;
      releaseUnusedDownload(key, entry);
    },
  };
}

export function useArtifactImageState(
  target: ArtifactTarget | undefined,
  artifactId: string,
  enabled = true,
) {
  const [state, setState] = useState<{ src: string | null; failed: boolean }>({
    src: null,
    failed: false,
  });
  const botId = target && "botId" in target ? target.botId : undefined;
  const groupId = target && "groupId" in target ? target.groupId : undefined;
  useEffect(() => {
    setState({ src: null, failed: false });
    if (!enabled || (!botId && !groupId)) return;
    let cancelled = false;
    const download = acquireDownload(botId ? { botId } : { groupId: groupId! }, artifactId);
    void download.promise
      .then((objectUrl) => {
        if (!cancelled) setState({ src: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, failed: true });
      });
    return () => {
      cancelled = true;
      download.release();
    };
  }, [artifactId, botId, groupId, enabled]);
  return state;
}

export function useArtifactImage(
  target: ArtifactTarget | undefined,
  artifactId: string,
  enabled = true,
) {
  return useArtifactImageState(target, artifactId, enabled).src;
}
