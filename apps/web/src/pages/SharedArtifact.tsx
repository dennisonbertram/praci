import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArtifactPreview } from "../components/ArtifactPreview";
import { artifactDisplayName } from "../lib/artifact-name";
import { decodeArtifactBase64, downloadArtifactBytes } from "../lib/artifact-open";
import { openSharedArtifact, SharedArtifactGoneError } from "../lib/shared-artifact";

/**
 * Types a recipient may save. The stored name is agent-written and can disagree with the type, so the
 * saved file always takes its extension from this table: a mislabeled HTML file is never saved as .html.
 */
const SAVE_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

type State =
  | { status: "loading" }
  | { status: "gone" }
  | { status: "error" }
  | { status: "ready"; name: string; mimeType: string; bytes: Uint8Array };

/**
 * A shared artifact. The link token is in the URL fragment, which browsers never send,
 * so it reaches the server only in the body of the one request below. No Shell, no app session.
 */
export function SharedArtifactPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [token, setToken] = useState(() => window.location.hash.slice(1));
  const requestNumber = useRef(0);
  const load = useCallback(async () => {
    const currentRequest = ++requestNumber.current;
    if (!token) {
      if (currentRequest === requestNumber.current) setState({ status: "gone" });
      return;
    }
    setState({ status: "loading" });
    try {
      const shared = await openSharedArtifact(token);
      if (currentRequest === requestNumber.current) {
        setState({
          status: "ready",
          name: shared.name,
          mimeType: shared.mimeType,
          bytes: decodeArtifactBase64(shared.contentBase64),
        });
      }
    } catch (error) {
      if (currentRequest === requestNumber.current) {
        setState(
          error instanceof SharedArtifactGoneError ? { status: "gone" } : { status: "error" },
        );
      }
    }
  }, [token]);

  useEffect(() => {
    const onHashChange = () => setToken(window.location.hash.slice(1));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const initialTitle = useRef(document.title);
  useEffect(() => {
    document.title =
      state.status === "ready" ? artifactDisplayName(state.name) : initialTitle.current;
  }, [state]);

  if (state.status === "gone") {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-4 text-sm text-muted-foreground">
        <p>{t`This link is not available.`}</p>
      </main>
    );
  }
  if (state.status === "loading") {
    return (
      <main className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">
        <Trans>Loading…</Trans>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-4 text-sm text-muted-foreground">
        <div role="alert" className="flex flex-col items-center gap-3 text-center">
          <p>{t`Could not load`}</p>
          <button
            type="button"
            className="text-foreground underline underline-offset-4"
            onClick={() => void load()}
          >
            <Trans>Try again</Trans>
          </button>
        </div>
      </main>
    );
  }
  const saveExtension = SAVE_EXTENSIONS[state.mimeType];
  return (
    <main className="flex h-svh flex-col bg-background text-foreground">
      <header className="flex items-baseline gap-3 border-b border-border px-4 py-3">
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold" title={state.name}>
          {artifactDisplayName(state.name)}
        </h1>
        <span
          className={`shrink-0 text-[12.5px] text-muted-foreground ${saveExtension ? "hidden sm:inline" : ""}`}
        >
          <Trans>Shared from Praci</Trans>
        </span>
        {saveExtension && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadArtifactBytes(
                `${artifactDisplayName(state.name)}.${saveExtension}`,
                state.mimeType,
                state.bytes,
              )
            }
          >
            <Trans>Download</Trans>
          </Button>
        )}
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ArtifactPreview
          artifact={{ id: "shared", name: state.name, mimeType: state.mimeType }}
          bytes={state.bytes}
        />
      </div>
    </main>
  );
}
