import { Trans, useLingui } from "@lingui/react/macro";
import type { MemoryDocument } from "@rakazo/contracts";
import { Button, Input, Skeleton, Textarea } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { downloadArtifactBytes } from "../lib/artifact-open";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { rpc } from "../lib/rpc";

const fieldClass = "mt-2 w-full font-mono text-[13px] leading-relaxed";

function rowClass(open: boolean): string {
  return `h-auto w-full justify-start whitespace-normal px-2.5 py-2.5 text-start ${open ? "bg-muted" : ""}`;
}

/**
 * Bot memory.
 * User-scoped memory shared across bots lives in the Memory settings overlay.
 */
export function KnowledgeSection({ botId }: { botId: string }) {
  return (
    <section className="mt-6" data-testid="bot-knowledge">
      <h3 className="pb-1 text-[13.5px] font-medium text-foreground">
        <Trans>Memory</Trans>
      </h3>
      <MemoryDocumentList
        key={botId}
        load={() => rpc.memory.list({ botId, scope: "bot" })}
        exportFilename="memory.md"
        testId="bot-knowledge-memory"
      />
    </section>
  );
}

/** All of the user's memory documents (shared and per bot), mounted in Settings → Memory. */
/** The first line of a memory document that says something: headings are skipped, list marks dropped. */
export function memoryDocPreview(content: string): string | null {
  for (const raw of content.split("\n")) {
    if (/^\s*#/.test(raw)) continue;
    const line = raw
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\s*\(\/[^)\s]*\)/g, "")
      .replace(/^\s*([-*+]|\d+\.)\s+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (line) return line;
  }
  return null;
}

export function SpaceMemorySection() {
  const { t } = useLingui();
  const [filter, setFilter] = useState("");
  const [hasDocs, setHasDocs] = useState(false);
  const [botNames, setBotNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Documents still show, with whatever names loaded, if a bot list fails.
    void Promise.allSettled([rpc.bots.list(), rpc.bots.listArchived()])
      .then((lists) =>
        setBotNames(
          new Map(
            lists.flatMap((list) =>
              list.status === "fulfilled"
                ? list.value.map((bot) => [bot.id, bot.name] as const)
                : [],
            ),
          ),
        ),
      )
      .catch(() => undefined);
  }, []);

  return (
    <div className="mt-6" data-testid="space-memory-documents">
      {hasDocs ? (
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t`Filter memory`}
          aria-label={t`Filter memory`}
          className="mb-3"
        />
      ) : null}
      <MemoryDocumentList
        load={() => rpc.memory.list({})}
        exportFilename="space-memory.md"
        exportScope="user"
        testId="space-memory-list"
        filter={filter}
        onHasDocs={setHasDocs}
        groupLabel={(doc) =>
          doc.scope === "user"
            ? t`Shared by all bots`
            : (botNames.get(doc.botId ?? "") ?? t`Unknown bot`)
        }
      />
    </div>
  );
}

function MemoryDocumentList({
  load,
  exportFilename,
  exportScope,
  testId,
  filter = "",
  groupLabel,
  onHasDocs,
}: {
  load: () => Promise<MemoryDocument[]>;
  exportFilename: string;
  /** Limit the exported file to one scope. */
  exportScope?: MemoryDocument["scope"];
  testId: string;
  filter?: string;
  /** When set, documents render in groups headed by this label; shared first, then by label. */
  groupLabel?: (doc: MemoryDocument) => string;
  onHasDocs?: (hasDocs: boolean) => void;
}) {
  const { t } = useLingui();
  useHideAmounts();
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<MemoryDocument[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const current = ++generation.current;
    void loadRef
      .current()
      .then((list) => {
        if (current !== generation.current) return;
        setDocs(list);
        setLoading(false);
      })
      .catch(() => {
        if (current !== generation.current) return;
        setDocs([]);
        setLoading(false);
        setError(t`Could not load`);
      });
    return () => {
      generation.current += 1;
    };
  }, [t]);

  const hasDocs = docs.length > 0;
  useEffect(() => {
    onHasDocs?.(hasDocs);
  }, [hasDocs, onHasDocs]);

  // A document with nothing in it is not a memory; it only shows when nothing else does.
  const remembered = docs.filter((doc) => memoryDocPreview(doc.content) !== null);
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? remembered.filter(
        (doc) =>
          doc.path.toLowerCase().includes(needle) || doc.content.toLowerCase().includes(needle),
      )
    : remembered;
  const groups = new Map<string, { label: string; docs: MemoryDocument[] }>();
  for (const doc of visible) {
    const key = groupLabel ? (doc.scope === "user" ? "" : (doc.botId ?? "?")) : "";
    const group = groups.get(key) ?? { label: groupLabel?.(doc) ?? "", docs: [] };
    group.docs.push(doc);
    groups.set(key, group);
  }
  // Shared group (key "") first, then bots by name.
  const ordered = [...groups.entries()].sort(([ka, a], [kb, b]) =>
    ka === "" ? -1 : kb === "" ? 1 : a.label.localeCompare(b.label),
  );

  function openDoc(doc: MemoryDocument) {
    setOpenId(doc.id);
    setDraft(doc.content);
    setError(null);
  }

  async function save(doc: MemoryDocument) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await rpc.memory.update({ documentId: doc.id, content: draft });
      setDocs((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setOpenId(null);
    } catch {
      setError(t`Could not save`);
    } finally {
      setBusy(false);
    }
  }

  async function exportMarkdown() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Re-fetch through the section's own loader so the file is current,
      // then sync the list so the export matches what is displayed.
      const fresh = await loadRef.current();
      generation.current += 1;
      setDocs(fresh);
      const exported = exportScope ? fresh.filter((doc) => doc.scope === exportScope) : fresh;
      const markdown = exported.map((doc) => `# ${doc.path}\n\n${doc.content}`).join("\n\n");
      downloadArtifactBytes(exportFilename, "text/markdown", new TextEncoder().encode(markdown));
    } catch {
      setError(t`Could not load`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid={testId}>
      {error ? <div className="px-2.5 pb-2 text-[13px] text-destructive">{error}</div> : null}
      {loading ? <Skeleton className="h-10 w-full" /> : null}
      {!loading && remembered.length === 0 && !error ? (
        <div className="px-2.5 py-1 text-[13.5px] text-muted-foreground">
          <Trans>Nothing remembered yet</Trans>
        </div>
      ) : null}
      {!loading && remembered.length > 0 && visible.length === 0 ? (
        <div className="px-2.5 py-1 text-[13.5px] text-muted-foreground">
          <Trans>No matches</Trans>
        </div>
      ) : null}
      {ordered.map(([key, group], index) => (
        <div
          key={key}
          className={groupLabel && index > 0 ? "mt-4" : undefined}
          data-testid={groupLabel ? `memory-group-${key || "shared"}` : undefined}
        >
          {groupLabel ? (
            <div
              className="mb-2 text-[12.5px] uppercase tracking-[0.08em] text-muted-foreground"
              dir="auto"
            >
              {group.label}
            </div>
          ) : null}
          {group.docs.map((doc) => (
            <div key={doc.id}>
              <Button
                variant="ghost"
                type="button"
                disabled={busy}
                onClick={() => (openId === doc.id ? setOpenId(null) : openDoc(doc))}
                className={rowClass(openId === doc.id)}
              >
                {/* What the bot remembers, not its file name and revision number. */}
                <span
                  className="min-w-0 truncate text-[14px] text-foreground"
                  dir="auto"
                  title={doc.path}
                >
                  {maskCurrencyWhenHidden(memoryDocPreview(doc.content) ?? "")}
                </span>
              </Button>
              {openId === doc.id ? (
                <div className="px-2.5 pb-2">
                  <Textarea
                    aria-label={doc.path}
                    disabled={busy}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={Math.min(16, Math.max(4, draft.split("\n").length + 1))}
                    className={fieldClass}
                    dir="auto"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={busy || draft === doc.content}
                      onClick={() => void save(doc)}
                      className="rounded-lg bg-muted px-3 py-1.5 text-[13px] text-foreground disabled:opacity-50"
                    >
                      <Trans>Save</Trans>
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => setOpenId(null)}
                      className="rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground"
                    >
                      <Trans>Cancel</Trans>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ))}
      {docs.length ? (
        <Button
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={() => void exportMarkdown()}
          className="mt-2 px-2.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <Trans>Download as markdown</Trans>
        </Button>
      ) : null}
    </div>
  );
}
