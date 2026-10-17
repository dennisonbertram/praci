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
import { type ReactNode, useEffect, useMemo, useState } from "react";

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

/** An app page (Inbox, Finance, ...) or a group chat the palette can open. */
export type PaletteEntry = { id: string; label: string; icon?: ReactNode };

export function CommandPalette({
  open,
  onOpenChange,
  bots,
  onSelectBot,
  pages = [],
  groups = [],
  onSelectPage = () => undefined,
  onSelectGroup = () => undefined,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bots: Bot[];
  onSelectBot: (botId: string) => void;
  pages?: PaletteEntry[];
  groups?: PaletteEntry[];
  onSelectPage?: (id: string) => void;
  onSelectGroup?: (id: string) => void;
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
  const filteredBots = useMemo(() => {
    if (!needle) return bots;
    return bots.filter((bot) => botSearchText(bot).includes(needle));
  }, [bots, needle]);
  const matches = (entry: PaletteEntry) => !needle || entry.label.toLowerCase().includes(needle);
  const shownPages = pages.filter(matches);
  const shownGroups = groups.filter(matches);

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
          className="items-center gap-3 rounded-xl! px-2.5 py-2"
        >
          <span className="grid size-8 place-items-center text-muted-foreground">{page.icon}</span>
          <span className="truncate font-medium text-foreground">{page.label}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  ) : null;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t`Go to`}
      description={t`Search pages, bots and groups`}
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
        />
        <CommandList className="max-h-80" data-testid="command-palette-list">
          <CommandEmpty>
            <Trans>No results</Trans>
          </CommandEmpty>
          {needle ? pagesGroup : null}
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
                  className="items-center gap-3 rounded-xl! px-2.5 py-2.5"
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
                    <CommandShortcut className="tracking-normal">
                      <Kbd>{shortcut}</Kbd>
                    </CommandShortcut>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
          {shownGroups.length ? (
            <CommandGroup heading={t`Groups`}>
              {shownGroups.map((group) => (
                <CommandItem
                  key={group.id}
                  value={`group:${group.id}`}
                  onSelect={() => {
                    onSelectGroup(group.id);
                    onOpenChange(false);
                  }}
                  className="items-center gap-3 rounded-xl! px-2.5 py-2"
                >
                  <span className="grid size-8 place-items-center">{group.icon}</span>
                  <span className="truncate font-medium text-foreground" dir="auto">
                    {group.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {/* Bots first while browsing (the usual switch); pages first once a search names one. */}
          {needle ? null : pagesGroup}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export { isCommandPaletteHotkey } from "./command-palette-hotkey";
