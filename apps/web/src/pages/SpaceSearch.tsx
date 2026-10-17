import { Trans, useLingui } from "@lingui/react/macro";
import type { SearchHit, SearchHitKind } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { Files, FileText, Mail } from "lucide-react";
import type { ReactNode } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";

/** A non-chat result: an app page or a Data room document. */
export type SearchLink = { id: string; label: string; detail?: string; icon?: ReactNode };

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="px-2.5 pb-0.5 pt-2 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {title}
      </h3>
      {children}
    </section>
  );
}

function LinkRow({ link, onSelect }: { link: SearchLink; onSelect: () => void }) {
  useHideAmounts();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onSelect}
      className="h-auto w-full justify-start gap-2.5 rounded-xl px-2.5 py-2 text-start font-normal hover:bg-background"
    >
      {link.icon ? <span className="shrink-0 text-muted-foreground">{link.icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-foreground" dir="auto">
          {maskCurrencyWhenHidden(link.label)}
        </span>
        {link.detail ? (
          <span className="block truncate text-[13px] text-muted-foreground" dir="auto">
            {link.detail}
          </span>
        ) : null}
      </span>
    </Button>
  );
}

/**
 * Sidebar search results grouped by type: app pages, Data room documents, artifacts, a mail
 * search, and chat hits. When only the mail search is left, a line says nothing else matched.
 */
export function SpaceSearchResults({
  query = "",
  hits,
  loading,
  pages = [],
  documents = [],
  artifacts = [],
  onSelect,
  onSelectPage = () => undefined,
  onSelectDocument = () => undefined,
  onSelectArtifact = () => undefined,
  onSearchMail,
}: {
  query?: string;
  hits: SearchHit[];
  loading: boolean;
  pages?: SearchLink[];
  documents?: SearchLink[];
  /** Files bots made, matched by name and description. */
  artifacts?: SearchLink[];
  onSelect: (hit: SearchHit) => void;
  onSelectPage?: (id: string) => void;
  onSelectDocument?: (id: string) => void;
  onSelectArtifact?: (id: string) => void;
  /** Present when the Inbox can run the query; shows a "Search mail" row. */
  onSearchMail?: () => void;
}) {
  const { t } = useLingui();
  const kindLabel: Record<SearchHitKind, string> = {
    conversation: t`Chat`,
    message: t`Message`,
    file: t`File`,
    link: t`Link`,
    routine: t`Routine`,
  };
  const nothingMatched = !hits.length && !pages.length && !documents.length && !artifacts.length;
  const empty = nothingMatched && !onSearchMail;
  if (empty && loading) {
    return (
      <div className="px-3 py-4 text-[14px] text-muted-foreground">
        <Trans>Searching…</Trans>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="px-3 py-4 text-[14px] text-muted-foreground">
        <Trans>No results</Trans>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {pages.length ? (
        <Section title={<Trans>Pages</Trans>}>
          {pages.map((page) => (
            <LinkRow key={page.id} link={page} onSelect={() => onSelectPage(page.id)} />
          ))}
        </Section>
      ) : null}
      {documents.length ? (
        <Section title={<Trans>Documents</Trans>}>
          {documents.map((document) => (
            <LinkRow
              key={document.id}
              link={{
                ...document,
                icon: document.icon ?? <FileText size={15} strokeWidth={1.8} aria-hidden="true" />,
              }}
              onSelect={() => onSelectDocument(document.id)}
            />
          ))}
        </Section>
      ) : null}
      {artifacts.length ? (
        <Section title={<Trans>Artifacts</Trans>}>
          {artifacts.map((artifact) => (
            <LinkRow
              key={artifact.id}
              link={{
                ...artifact,
                icon: artifact.icon ?? <Files size={15} strokeWidth={1.8} aria-hidden="true" />,
              }}
              onSelect={() => onSelectArtifact(artifact.id)}
            />
          ))}
        </Section>
      ) : null}
      {nothingMatched && !loading && onSearchMail ? (
        <div className="px-3 pt-3 pb-1 text-[14px] text-muted-foreground">
          <Trans>No matches in chats, pages or documents.</Trans>
        </div>
      ) : null}
      {onSearchMail ? (
        <Section title={<Trans>Mail</Trans>}>
          <LinkRow
            link={{
              id: "mail",
              label: t`Search mail for “${query}”`,
              icon: <Mail size={15} strokeWidth={1.8} aria-hidden="true" />,
            }}
            onSelect={onSearchMail}
          />
        </Section>
      ) : null}
      {hits.length || loading ? (
        <Section title={<Trans>Chats</Trans>}>
          {loading && !hits.length ? (
            <div className="px-2.5 py-2 text-[14px] text-muted-foreground">
              <Trans>Searching…</Trans>
            </div>
          ) : null}
          {hits.map((hit) => {
            const where = hit.groupName ?? hit.botName;
            return (
              <button
                key={`${hit.kind}-${hit.botId ?? hit.groupId}-${hit.messageId ?? hit.artifactId ?? hit.routineId ?? hit.url}`}
                type="button"
                onClick={() => onSelect(hit)}
                className="rounded-xl px-2.5 py-2 text-start hover:bg-background"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-medium text-foreground" dir="auto">
                    {hit.title}
                  </span>
                  <span className="shrink-0 text-[12px] text-muted-foreground/80">
                    {kindLabel[hit.kind]}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[13px] text-muted-foreground" dir="auto">
                  {/* The chat name is already the title of a conversation hit. */}
                  {where && where !== hit.title ? `${where} · ${hit.snippet}` : hit.snippet}
                </div>
              </button>
            );
          })}
        </Section>
      ) : null}
    </div>
  );
}
