import { Trans, useLingui } from "@lingui/react/macro";
import type { SidebarPageTemplate } from "@rakazo/contracts";
import {
  BotAvatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { Plus } from "lucide-react";
import { sidebarPageCopy } from "../lib/sidebar-page-copy";

export type AddableBotPages = {
  bot: { id: string; name: string; color: string };
  pages: readonly { id: string; title: string }[];
};

/** The "+ Add page" row and its menu: templates, then each bot's pages. Renders nothing when there is nothing to add. */
export function AddSidebarPage({
  templates,
  botPages = [],
  onAdd,
  onAddPage,
  onOpenMenu,
  defaultOpen,
}: {
  templates: readonly SidebarPageTemplate[];
  botPages?: readonly AddableBotPages[];
  onAdd: (templateKey: string) => void;
  onAddPage?: (pageId: string) => void;
  onOpenMenu?: () => void;
  defaultOpen?: boolean;
}) {
  const { t } = useLingui();
  if (templates.length === 0 && botPages.length === 0) return null;
  return (
    <DropdownMenu defaultOpen={defaultOpen} onOpenChange={(open) => open && onOpenMenu?.()}>
      <DropdownMenuTrigger
        data-testid="sidebar-add-page"
        className="mb-1 flex items-center gap-3 rounded-xl px-2.5 py-2 text-start text-muted-foreground hover:bg-sidebar-accent"
        aria-label={t`Add page`}
      >
        <span className="grid h-[30px] w-[30px] place-items-center rounded-lg">
          <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="text-[14px] font-medium">
          <Trans>Add page</Trans>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {templates.map((template) => {
          const copy = sidebarPageCopy(template.key);
          return (
            <DropdownMenuItem key={template.key} onClick={() => onAdd(template.key)}>
              <span className="flex flex-col">
                <span>{t(copy.label)}</span>
                <span className="text-xs text-muted-foreground">{t(copy.description)}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
        {botPages.map(({ bot, pages }, index) => (
          <DropdownMenuGroup key={bot.id}>
            {index > 0 || templates.length > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="flex items-center gap-2">
              <BotAvatar color={bot.color} identity={bot.id} size={16} />
              <span className="truncate" dir="auto">
                {bot.name}
              </span>
            </DropdownMenuLabel>
            {pages.map((page) => (
              <DropdownMenuItem key={page.id} onClick={() => onAddPage?.(page.id)}>
                <span className="truncate" dir="auto">
                  {page.title}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
