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
} from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  // platform is deprecated but still the most reliable Apple check in browsers.
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function botSearchText(bot: Bot) {
  return `${bot.name} ${bot.title} ${bot.description} ${bot.preview}`.toLowerCase();
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

/** The row Enter opens: data-selected's bg-muted barely shows on the popover, so mark it. */
const SELECTED_ROW = "data-selected:bg-accent data-selected:shadow-[inset_3px_0_0_var(--ring)]";

/** An app page (Inbox, Finance, ...) or a group chat the palette can open. */
export type PaletteEntry = { id: string; label: string; keywords?: string; icon?: ReactNode };

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
  searchLinks?: (query: string) => Promise<{ heading: string; entries: PaletteEntry[] }[]>;
  onOpenPath?: (path: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [modKey, setModKey] = useState("⌘");

  useEffect(() => {
    setModKey(isApplePlatform() ? "⌘" : "Ctrl");
  }, []);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const needle = search.trim().toLowerCase();
  const [linkGroups, setLinkGroups] = useState<{ heading: string; entries: PaletteEntry[] }[]>([]);
  useEffect(() => {
    if (!needle || !searchLinks) {
      setLinkGroups([]);
      return;
    }
    let stale = false;
    const timer = window.setTimeout(() => {
      searchLinks(needle)
        .then((groups) => !stale && setLinkGroups(groups))
        .catch(() => !stale && setLinkGroups([]));
    }, 200);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [needle, searchLinks]);
  const botScore = (bot: Bot) => paletteMatchScore(bot.name, needle, botSearchText(bot));
  const entryScore = (entry: PaletteEntry) =>
    paletteMatchScore(entry.label, needle, entry.keywords);
  const shownPages = needle ? ranked(pages, entryScore) : pages;
  const shownGroups = needle ? ranked(groups, entryScore) : groups;
  const filteredBots = useMemo(() => {
    if (!needle) return bots;
    const matches = ranked(bots, (bot) => paletteMatchScore(bot.name, needle, botSearchText(bot)));
    // Description-only matches are noise once anything matches by name.
    const nameMatched =
      shownPages.length > 0 ||
      shownGroups.length > 0 ||
      matches.some((bot) => paletteMatchScore(bot.name, needle) !== null);
    return nameMatched
      ? matches.filter((bot) => paletteMatchScore(bot.name, needle) !== null)
      : matches;
  }, [bots, needle, shownPages.length, shownGroups.length]);
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
                  {bot.name}
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
            {group.label}
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
          <span className="truncate font-medium text-foreground">{page.label}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  ) : null;

  const linksGroups = linkGroups
    .filter((group) => group.entries.length > 0)
    .map((group) => (
      <CommandGroup key={group.heading} heading={group.heading}>
        {group.entries.map((entry) => (
          <CommandItem
            key={entry.id}
            value={`link:${entry.id}`}
            onSelect={() => {
              onOpenPath(entry.id);
              onOpenChange(false);
            }}
            className={`items-center gap-3 rounded-xl! px-2.5 py-2 ${SELECTED_ROW}`}
          >
            <span className="truncate font-medium text-foreground" dir="auto">
              {entry.label}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    ));

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
        <CommandList className="max-h-[min(24rem,60vh)]" data-testid="command-palette-list">
          <CommandEmpty>
            <Trans>No results</Trans>
          </CommandEmpty>
          {sectionOrder.map((section) => (
            <Fragment key={section}>
              {section === "bots" ? botsGroup : section === "groups" ? groupsGroup : pagesGroup}
            </Fragment>
          ))}
          {linksGroups}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export { isCommandPaletteHotkey } from "./command-palette-hotkey";
