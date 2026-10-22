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
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";

/** Chat snippets come from markdown replies; show them as plain text. */
export function plainSnippet(text: string): string {
  return text.replace(/\*\*|__|`/g, "");
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

/** The typed text inside a result, underlined so a result shows why it matched. */
function Highlight({ text, needle }: { text: string; needle: string }) {
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent text-inherit underline decoration-2 underline-offset-2">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/** The row Enter opens: data-selected's bg-muted barely shows on the popover, so mark it. */
const SELECTED_ROW = "data-selected:bg-accent data-selected:shadow-[inset_3px_0_0_currentColor]";

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

/** A group of search results. `icon` marks every row of the group; `first` lists it above the pages. */
export type PaletteLinkGroup = {
  heading: string;
  entries: PaletteEntry[];
  icon?: ReactNode;
  first?: boolean;
};

export function CommandPalette({
  open,
  onOpenChange,
  bots,
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

  const needle = search.trim().toLowerCase();
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
      searchLinks(needle)
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
  }, [needle, searchLinks]);
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
    () => (needle ? ranked(bots, (bot) => paletteMatchScore(bot.name, needle, bot.title)) : bots),
    [bots, needle],
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
        const shortcut = index < 9 ? `${modKey}${index + 1}` : null;
        return (
          <CommandItem
            key={bot.id}
            value={bot.id}
            data-testid={`command-palette-bot-${bot.id}`}
            onSelect={() => {
              onSelectBot(bot.id);
              onOpenChange(false);
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
                  {subtitle}
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
            onOpenChange(false);
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
            onOpenChange(false);
          }}
          className={`items-center gap-3 rounded-xl! px-2.5 py-2 ${SELECTED_ROW}`}
        >
          <span className="grid size-8 place-items-center text-muted-foreground">{page.icon}</span>
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
        const detail = entry.detail && entry.detail.toLowerCase() !== needle ? entry.detail : null;
        return (
          <CommandItem
            key={entry.id}
            value={`link:${entry.id}`}
            onSelect={() => {
              onOpenPath(entry.id);
              onOpenChange(false);
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
                  <Highlight text={detail} needle={needle} />
                </span>
              ) : null}
            </span>
            {entry.date ? (
              <span className="shrink-0 text-xs text-muted-foreground">{entry.date}</span>
            ) : null}
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
  const shownLinks = linkGroups.filter((group) => group.entries.length > 0);
  const leadingLinks = shownLinks.filter((group) => group.first).map(linkGroup);
  const linksGroups = shownLinks.filter((group) => !group.first).map(linkGroup);
  const searching = Boolean(needle && searchLinks && answered !== needle);

  // The mail action leads the list, but Enter still opens the best match: select it by value.
  const bestValue = (() => {
    if (!needle) return "";
    const first = sectionOrder[0];
    if (first === "bots") return filteredBots[0]?.id ?? "";
    if (first === "groups") return shownGroups[0] ? `group:${shownGroups[0].id}` : "";
    return shownPages[0] ? `page:${shownPages[0].id}` : "";
  })();
  const [picked, setPicked] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart from the best match when the query changes
  useEffect(() => setPicked(bestValue), [needle, bestValue, leadingLinks.length]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t`Go to`}
      description={t`Search pages, bots, groups, documents and artifacts`}
      className="sm:max-w-xl"
    >
      <Command
        shouldFilter={false}
        value={picked || undefined}
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
          className={`max-h-[min(27rem,60vh)] transition-opacity ${searching ? "opacity-60" : ""}`}
          aria-busy={searching}
          data-testid="command-palette-list"
        >
          {searching &&
          !shownLinks.length &&
          !shownPages.length &&
          !shownGroups.length &&
          !shownActions.length &&
          !filteredBots.length ? (
            <div className="flex justify-center py-4">
              <Spinner aria-hidden="true" />
            </div>
          ) : null}
          {searching ? null : (
            <CommandEmpty>
              <Trans>No results</Trans>
            </CommandEmpty>
          )}
          {leadingLinks}
          {sectionOrder.map((section) => (
            <Fragment key={section}>
              {section === "bots" ? botsGroup : section === "groups" ? groupsGroup : pagesGroup}
            </Fragment>
          ))}
          {linksGroups}
          {shownActions.length ? (
            <CommandGroup>
              {shownActions.map((action) => (
                <CommandItem
                  key={action.label}
                  value={`action:${action.label}`}
                  onSelect={() => {
                    action.run();
                    onOpenChange(false);
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
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <Trans>Move</Trans>
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            <Trans>Open</Trans>
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}

export { isCommandPaletteHotkey } from "./command-palette-hotkey";
