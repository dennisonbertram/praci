import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Bot } from "@rakazo/contracts";
import {
  Badge,
  BotAvatar,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Kbd,
  Spinner,
} from "@rakazo/ui-web";
import type { ReactNode } from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MAIN_CONTENT_ID } from "../../components/SkipToContent";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";

/** Chat snippets come from markdown replies; show them as plain text. */
export function plainSnippet(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*\*|__|`/g, "");
}

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  // platform is deprecated but still the most reliable Apple check in browsers.
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function botSubtitle(bot: Bot) {
  return bot.description.trim() || bot.preview.trim() || bot.title.trim();
}

function botTitleTag(bot: Bot) {
  const title = bot.title.trim();
  if (!title) return null;
  // Title is already the subtitle when there is no description/preview.
  if (!(bot.description.trim() || bot.preview.trim())) return null;
  return title;
}

/**
 * How well `name` matches a typed query, lower is better: name prefix, then a word in the name,
 * then anywhere in the name, then only in `extra` (a bot's description). Shorter names win ties,
 * so "fin" puts Finance ahead of Finance agent. Null when nothing matches.
 */
export function paletteMatchScore(name: string, needle: string, extra = ""): number | null {
  const label = name.toLowerCase();
  const rank = label.startsWith(needle)
    ? 0
    : label.split(/\s+/).some((word) => word.startsWith(needle))
      ? 1
      : label.includes(needle)
        ? 2
        : extra.toLowerCase().includes(needle)
          ? 3
          : null;
  return rank === null ? null : rank * 1000 + Math.min(label.length, 999);
}

function ranked<T>(items: readonly T[], score: (item: T) => number | null): T[] {
  return items
    .map((item) => ({ item, score: score(item) }))
    .filter((entry): entry is { item: T; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);
}

const CLIP_BEFORE = 24;

/** The typed text inside a result, marked (as in Data room search) so a result shows why it matched. */
function Highlight({ text, needle, clip }: { text: string; needle: string; clip?: boolean }) {
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  // A long title is cut at the end by the row, so drop text before the match to keep it in view.
  const from = clip && at > CLIP_BEFORE ? at - CLIP_BEFORE / 2 : 0;
  return (
    <>
      {from ? "…" : ""}
      {text.slice(from, at)}
      <mark className="rounded-sm bg-warning/25 px-0.5 text-inherit">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/** The row Enter opens: data-selected's bg-muted barely shows on the popover, so mark it. */
const SELECTED_ROW = "data-selected:bg-accent";

/** Footer key hints: a visible cap on the popover, where Kbd's own bg-muted barely shows. */
const KEY_CAP = "border border-border bg-background";

/** An app page (Inbox, Finance, ...) or a group chat the palette can open. */
export type PaletteEntry = {
  id: string;
  label: string;
  keywords?: string;
  icon?: ReactNode;
  /** Second line: the field or snippet that matched, highlighted. */
  detail?: string;
  /** Short date shown at the end of the row. */
  date?: string;
};

/** A group of search results. `icon` marks every row of the group; `fallback` lists it after every direct match. */
export type PaletteLinkGroup = {
  heading: string;
  entries: PaletteEntry[];
  icon?: ReactNode;
  fallback?: boolean;
  /** Last row of the group, for results beyond the ones listed. */
  more?: PaletteEntry;
};

export function CommandPalette({
  open,
  onOpenChange,
  bots,
  searchOnlyBots = [],
  onSelectBot,
  pages = [],
  groups = [],
  onSelectPage = () => undefined,
  onSelectGroup = () => undefined,
  searchLinks,
  onOpenPath = () => undefined,
  actions = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bots: Bot[];
  /** Bots found only by typing: they have no row and no number shortcut in the empty palette. */
  searchOnlyBots?: Bot[];
  onSelectBot: (botId: string) => void;
  pages?: PaletteEntry[];
  groups?: PaletteEntry[];
  onSelectPage?: (id: string) => void;
  onSelectGroup?: (id: string) => void;
  /** Documents and artifacts matching the text; entry ids are the routes they open. */
  searchLinks?: (query: string) => Promise<PaletteLinkGroup[]>;
  onOpenPath?: (path: string) => void;
  /** Commands found only by typing; they have no row in the empty palette. */
  actions?: { label: string; run: () => void }[];
}) {
  useHideAmounts();
  const [search, setSearch] = useState("");
  const [modKey, setModKey] = useState("⌘");

  useEffect(() => {
    setModKey(isApplePlatform() ? "⌘" : "Ctrl");
  }, []);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);
  // After opening something, focus goes to the page, not back to where the palette was opened.
  const chose = useRef(false);
  const choose = () => {
    chose.current = true;
    onOpenChange(false);
  };

  // Whatever had focus when it opened gets it back, so Escape does not drop focus to the page body.
  const openedFrom = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      openedFrom.current = document.activeElement;
      chose.current = false;
    }
  }, [open]);

  const query = search.trim();
  const needle = query.toLowerCase();
  const [linkGroups, setLinkGroups] = useState<PaletteLinkGroup[]>([]);
  // The query the shown results belong to: while it differs from the typed one, a search is pending.
  const [answered, setAnswered] = useState("");
  useEffect(() => {
    if (!needle || !searchLinks) {
      setLinkGroups([]);
      return;
    }
    let stale = false;
    const timer = window.setTimeout(() => {
      searchLinks(query)
        .then((groups) => {
          if (stale) return;
          setLinkGroups(groups);
          setAnswered(needle);
        })
        .catch(() => {
          if (stale) return;
          setLinkGroups([]);
          setAnswered(needle);
        });
    }, 200);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [needle, query, searchLinks]);
  // A bot is found by its name or role, never by words in its description.
  const botScore = (bot: Bot) => paletteMatchScore(bot.name, needle, bot.title);
  const entryScore = (entry: PaletteEntry) =>
    paletteMatchScore(entry.label, needle, entry.keywords);
  const shownPages = needle ? ranked(pages, entryScore) : pages;
  const shownGroups = needle ? ranked(groups, entryScore) : groups;
  const shownActions = needle
    ? ranked(actions, (action) => paletteMatchScore(action.label, needle))
    : [];
  const filteredBots = useMemo(
    () =>
      needle
        ? ranked([...bots, ...searchOnlyBots], (bot) =>
            paletteMatchScore(bot.name, needle, bot.title),
          )
        : bots,
    [bots, searchOnlyBots, needle],
  );
  // A fade over the last row while more results wait below the visible ones.
  // Kept in state: the dialog mounts the list after the first render that opens it.
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const measureList = useCallback(() => {
    setMoreBelow(!!listEl && listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight > 4);
  }, [listEl]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the results change
  useEffect(measureList, [measureList, needle, filteredBots, shownPages, shownGroups, linkGroups]);
  // While searching, the section with the best match comes first, so Enter opens it.
  const best = (score: number | null | undefined) => score ?? Number.POSITIVE_INFINITY;
  const sectionOrder = needle
    ? (["bots", "groups", "pages"] as const)
        .map((section) => ({
          section,
          score: best(
            section === "bots"
              ? filteredBots[0] && botScore(filteredBots[0])
              : section === "groups"
                ? shownGroups[0] && entryScore(shownGroups[0])
                : shownPages[0] && entryScore(shownPages[0]),
          ),
        }))
        .sort((a, b) => a.score - b.score)
        .map((entry) => entry.section)
    : (["pages", "bots", "groups"] as const);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.repeat) {
        return;
      }
      if (!/^[1-9]$/.test(event.key)) return;
      // Numbers follow the full bot list, so they do not change while typing.
      const bot = bots[Number(event.key) - 1];
      if (!bot) return;
      event.preventDefault();
      onSelectBot(bot.id);
      chose.current = true;
      onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bots, onOpenChange, onSelectBot, open]);

  const botsGroup = filteredBots.length ? (
    <CommandGroup heading={shownPages.length || shownGroups.length ? t`Bots` : undefined}>
      {filteredBots.map((bot) => {
        const subtitle = botSubtitle(bot);
        const titleTag = botTitleTag(bot);
        const index = bots.indexOf(bot);
        const shortcut = index >= 0 && index < 9 ? `${modKey}${index + 1}` : null;
        return (
          <CommandItem
            key={bot.id}
            value={bot.id}
            data-testid={`command-palette-bot-${bot.id}`}
            onSelect={() => {
              onSelectBot(bot.id);
              choose();
            }}
            className={`items-center gap-3 rounded-xl! px-2.5 py-2.5 ${SELECTED_ROW}`}
          >
            <BotAvatar color={bot.color} identity={bot.id} size={32} status={bot.status} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-foreground" dir="auto">
                  <Highlight text={bot.name} needle={needle} />
                </span>
                {titleTag ? (
                  <Badge
                    variant="secondary"
                    className="max-w-[40%] truncate rounded-full px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
                  >
                    {titleTag}
                  </Badge>
                ) : null}
              </div>
              {subtitle ? (
                <div className="mt-0.5 truncate text-[13px] text-muted-foreground" dir="auto">
                  <Highlight text={subtitle} needle={needle} clip />
                </div>
              ) : null}
            </div>
            {shortcut ? (
              // Number shortcuts need a keyboard, so phones do not show them.
              <CommandShortcut className="tracking-normal max-sm:hidden">
                <Kbd>{shortcut}</Kbd>
              </CommandShortcut>
            ) : null}
          </CommandItem>
        );
      })}
    </CommandGroup>
  ) : null;
  const groupsGroup = shownGroups.length ? (
    <CommandGroup heading={t`Groups`}>
      {shownGroups.map((group) => (
        <CommandItem
          key={group.id}
          value={`group:${group.id}`}
          onSelect={() => {
            onSelectGroup(group.id);
            choose();
          }}
          className={`items-center gap-3 rounded-xl! px-2.5 py-2 ${SELECTED_ROW}`}
        >
          <span className="grid size-8 place-items-center">{group.icon}</span>
          <span className="truncate font-medium text-foreground" dir="auto">
            <Highlight text={group.label} needle={needle} />
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  ) : null;
  const pagesGroup = shownPages.length ? (
    <CommandGroup heading={t`Pages`}>
      {shownPages.map((page) => (
        <CommandItem
          key={page.id}
          value={`page:${page.id}`}
          onSelect={() => {
            onSelectPage(page.id);
            choose();
          }}
          className={`items-center gap-3 rounded-xl! px-2.5 py-2 ${SELECTED_ROW}`}
        >
          <span className="grid size-5 place-items-center text-muted-foreground">{page.icon}</span>
          <span className="truncate font-medium text-foreground">
            <Highlight text={page.label} needle={needle} />
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  ) : null;

  const linkGroup = (group: PaletteLinkGroup) => (
    <CommandGroup key={group.heading} heading={group.heading}>
      {group.entries.map((entry) => {
        const icon = entry.icon ?? group.icon;
        // A snippet that only repeats the query adds nothing.
        const detail =
          entry.detail && entry.detail.toLowerCase() !== needle
            ? maskCurrencyWhenHidden(entry.detail)
            : null;
        return (
          <CommandItem
            key={entry.id}
            value={`link:${entry.id}`}
            onSelect={() => {
              onOpenPath(entry.id);
              choose();
            }}
            className={`items-center gap-3 rounded-xl! px-2.5 py-2 ${SELECTED_ROW}`}
          >
            {icon ? (
              <span className="grid size-8 shrink-0 place-items-center text-muted-foreground">
                {icon}
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground" dir="auto">
                <Highlight text={maskCurrencyWhenHidden(entry.label)} needle={needle} />
              </span>
              {detail ? (
                <span className="block truncate text-[13px] text-muted-foreground" dir="auto">
                  <Highlight text={detail} needle={needle} clip />
                </span>
              ) : null}
            </span>
            {entry.date ? (
              <span className="shrink-0 text-xs text-muted-foreground">{entry.date}</span>
            ) : null}
          </CommandItem>
        );
      })}
      {group.more ? (
        <CommandItem
          value={`link:${group.more.id}`}
          onSelect={() => {
            onOpenPath(group.more?.id ?? "");
            choose();
          }}
          className={`items-center gap-3 rounded-xl! py-2 pe-2.5 ps-13.5 text-muted-foreground ${SELECTED_ROW}`}
        >
          {group.more.label}
        </CommandItem>
      ) : null}
    </CommandGroup>
  );
  // A chat of a bot already listed under Bots is not listed twice.
  const shownBotPaths = new Set(filteredBots.map((bot) => `/app/${bot.id}`));
  const shownLinks = linkGroups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => !shownBotPaths.has(entry.id)),
    }))
    .filter((group) => group.entries.length > 0);
  const fallbackLinks = shownLinks.filter((group) => group.fallback);
  // A title match outranks text found only in a body: a group with an exact title comes first, then
  // one with a partial title match, and a group keeps at most 3 body-only rows after its title matches.
  const titleHit = (entry: PaletteEntry) => entry.label.toLowerCase().includes(needle);
  const groupRank = (group: PaletteLinkGroup) =>
    group.entries.some((entry) => entry.label.toLowerCase() === needle)
      ? 2
      : Number(group.entries.some(titleHit));
  const directLinks = shownLinks
    .filter((group) => !group.fallback)
    .map((group) => {
      const titles = group.entries.filter(titleHit);
      const bodies = group.entries.filter((entry) => !titleHit(entry)).slice(0, 3);
      return { ...group, entries: [...titles, ...bodies] };
    })
    .sort((a, b) => groupRank(b) - groupRank(a));
  const searching = Boolean(needle && searchLinks && answered !== needle);

  // Direct matches come first, so Enter opens the first row; with none, the catch-all search does.
  const bestValue = (() => {
    if (!needle) return "";
    // A contact or document named exactly as typed wins; with no page or bot match, the first one does.
    const linkEntries = directLinks.flatMap((g) => g.entries);
    const exact = linkEntries.find((entry) => entry.label.toLowerCase() === needle);
    if (exact) return `link:${exact.id}`;
    const first = sectionOrder[0];
    const local =
      first === "bots"
        ? (filteredBots[0]?.id ?? "")
        : first === "groups"
          ? shownGroups[0]
            ? `group:${shownGroups[0].id}`
            : ""
          : shownPages[0]
            ? `page:${shownPages[0].id}`
            : "";
    const last = linkEntries[0] ?? fallbackLinks[0]?.entries[0];
    return local || (last ? `link:${last.id}` : "");
  })();
  const [picked, setPicked] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart from the best match when the query changes
  useEffect(() => setPicked(bestValue), [needle, bestValue]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={() => {
        const main = document.getElementById(MAIN_CONTENT_ID);
        // After opening something, the page itself gets focus. Base UI skips a tabindex=-1 element,
        // so move it by hand once the dialog has let go.
        if (chose.current) {
          window.setTimeout(() => main?.focus(), 0);
          return false;
        }
        // A trigger that is gone (a closed phone drawer) or the page body falls back to the page itself.
        const from = openedFrom.current;
        return from?.isConnected && from !== document.body ? from : main;
      }}
      title={t`Go to`}
      description={t`Search pages, bots, groups, documents and artifacts`}
      // On a phone the keyboard covers the lower half, so the palette sits at the top.
      className="max-sm:top-3 sm:max-w-xl"
    >
      <Command
        shouldFilter={false}
        value={picked || bestValue || undefined}
        onValueChange={setPicked}
        className="rounded-xl! bg-popover"
        data-testid="command-palette"
      >
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder={t`Search`}
          data-testid="command-palette-search"
          autoFocus
        />
        <CommandList
          ref={setListEl}
          onScroll={measureList}
          // The last results stay, dimmed, until the new ones arrive.
          className={`max-h-[min(27rem,60vh)] max-sm:max-h-[45vh] transition-opacity ${searching ? "opacity-60" : ""}`}
          aria-busy={searching}
          data-testid="command-palette-list"
        >
          {searching &&
          !shownLinks.length &&
          !shownPages.length &&
          !shownGroups.length &&
          !shownActions.length &&
          !filteredBots.length ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
            >
              <Spinner aria-hidden="true" />
              <Trans>Searching…</Trans>
            </div>
          ) : null}
          {searching ? null : (
            <CommandEmpty>
              <Trans>No results</Trans>
            </CommandEmpty>
          )}
          {sectionOrder.map((section) => (
            <Fragment key={section}>
              {section === "bots" ? botsGroup : section === "groups" ? groupsGroup : pagesGroup}
            </Fragment>
          ))}
          {directLinks.map(linkGroup)}
          {shownActions.length ? (
            <CommandGroup>
              {shownActions.map((action) => (
                <CommandItem
                  key={action.label}
                  value={`action:${action.label}`}
                  onSelect={() => {
                    action.run();
                    choose();
                  }}
                  className={`items-center gap-3 rounded-xl! px-2.5 py-2 ${SELECTED_ROW}`}
                >
                  <span className="truncate font-medium text-foreground">
                    <Highlight text={action.label} needle={needle} />
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {fallbackLinks.map(linkGroup)}
        </CommandList>
        {moreBelow ? (
          <div
            aria-hidden="true"
            data-testid="command-palette-fade"
            className="pointer-events-none -mt-12 h-12 bg-gradient-to-t from-popover to-transparent"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="flex items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground max-sm:hidden"
        >
          <span className="flex items-center gap-1.5">
            <Kbd className={KEY_CAP}>↑</Kbd>
            <Kbd className={KEY_CAP}>↓</Kbd>
            <Trans>Move</Trans>
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd className={KEY_CAP}>Enter</Kbd>
            <Trans>Open</Trans>
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd className={KEY_CAP}>Esc</Kbd>
            <Trans>Close</Trans>
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}

export { isCommandPaletteHotkey } from "./command-palette-hotkey";
