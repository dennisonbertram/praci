import { Trans, useLingui } from "@lingui/react/macro";
import type { SidebarPageTemplate } from "@rakazo/contracts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { Plus } from "lucide-react";
import { sidebarPageCopy } from "../lib/sidebar-page-copy";

/** The "+ Add page" row and its menu. Renders nothing when there is no page left to add. */
export function AddSidebarPage({
  templates,
  onAdd,
  onOpenMenu,
  defaultOpen,
}: {
  templates: readonly SidebarPageTemplate[];
  onAdd: (templateKey: string) => void;
  onOpenMenu?: () => void;
  defaultOpen?: boolean;
}) {
  const { t } = useLingui();
  if (templates.length === 0) return null;
  return (
    <DropdownMenu defaultOpen={defaultOpen} onOpenChange={(open) => open && onOpenMenu?.()}>
      <DropdownMenuTrigger
        data-testid="sidebar-add-page"
        className="mx-2.5 mb-1 flex items-center gap-3 rounded-xl px-2.5 py-2 text-start text-muted-foreground hover:bg-sidebar-accent"
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
