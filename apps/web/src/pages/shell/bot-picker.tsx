import { Trans, useLingui } from "@lingui/react/macro";
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@rakazo/ui-web";
import { Info, Lock, Plus, Users } from "lucide-react";
import type { KeyboardEvent } from "react";

// Enter and Space on an info button must not select the row; Escape and Tab must still reach the popover.
function stopActivationKeys(event: KeyboardEvent<HTMLElement>) {
  if (event.key === "Enter" || event.key === " ") event.stopPropagation();
}

// Initial focus for the popover: the list itself (arrow keys pick a row), not the first info button.
export const pickerInitialFocus = () =>
  document.querySelector<HTMLElement>('[data-testid="bot-create-picker"] [cmdk-root]');

export function BotCreatePicker({
  onCreateBot,
  onCreateGroup,
  onCreateSpace,
  onShowGroupInfo,
  onShowSpaceInfo,
}: {
  onCreateBot: () => void;
  onCreateGroup: () => void;
  onCreateSpace: () => void;
  onShowGroupInfo: () => void;
  onShowSpaceInfo: () => void;
}) {
  const { t } = useLingui();
  return (
    <div data-testid="bot-create-picker" className="w-[min(240px,calc(100vw-2rem))]">
      <Command
        shouldFilter={false}
        tabIndex={-1}
        className="rounded-none border-0 bg-transparent p-0"
      >
        <CommandList className="max-h-72 p-1">
          <CommandGroup>
            <CommandItem
              value="create-new-bot"
              data-testid="create-new-bot"
              onSelect={() => onCreateBot()}
              className="gap-2"
            >
              <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
              <Trans>New bot</Trans>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup>
            <CommandItem
              value="create-group"
              data-testid="create-new-group"
              onSelect={() => onCreateGroup()}
              className="gap-2"
            >
              <Users size={16} strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                <Trans>New group</Trans>
              </span>
              <button
                type="button"
                data-testid="picker-info-group"
                aria-label={t`About groups`}
                title={t`About groups`}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onShowGroupInfo();
                }}
                onKeyDown={stopActivationKeys}
                className="-mr-2 shrink-0 rounded p-1 text-muted-foreground/70 opacity-0 transition-opacity duration-150 group-focus-within/command-item:opacity-100 group-hover/command-item:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Info size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </CommandItem>
            <CommandItem
              value="create-space"
              data-testid="create-new-space"
              onSelect={() => onCreateSpace()}
              className="gap-2"
            >
              <Lock size={14} strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                <Trans>New space</Trans>
              </span>
              <button
                type="button"
                data-testid="picker-info-space"
                aria-label={t`About spaces`}
                title={t`About spaces`}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onShowSpaceInfo();
                }}
                onKeyDown={stopActivationKeys}
                className="-mr-2 shrink-0 rounded p-1 text-muted-foreground/70 opacity-0 transition-opacity duration-150 group-focus-within/command-item:opacity-100 group-hover/command-item:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Info size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
