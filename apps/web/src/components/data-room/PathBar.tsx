import { t } from "@lingui/core/macro";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { Fragment } from "react";
import type { FolderNode } from "./folders";

type Crumb = { id: string | undefined; name: string };

/** More segments than this and the middle ones move into a menu. */
const MAX_SHOWN = 4;

/** All items, then each folder from the top down to the open one. */
export function folderCrumbs(nodes: FolderNode[], folderId: string): Crumb[] {
  const byId = new Map(nodes.map(({ folder }) => [folder.id, folder]));
  const chain: Crumb[] = [];
  const seen = new Set<string>();
  for (let id: string | null = folderId; id && !seen.has(id); ) {
    seen.add(id);
    const folder = byId.get(id);
    if (!folder) break;
    chain.unshift({ id: folder.id, name: folder.name });
    id = folder.parentId;
  }
  return [{ id: undefined, name: t`All items` }, ...chain];
}

/** The open folder's path, each folder above it a link; "All items" alone at the top level. */
export function PathBar({
  nodes,
  folderId,
  onSelect,
}: {
  nodes: FolderNode[];
  folderId: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  // Also at the top level, so entering a folder does not push the list down by a row.
  const crumbs = folderId ? folderCrumbs(nodes, folderId) : [{ id: undefined, name: t`All items` }];
  const collapse = crumbs.length > MAX_SHOWN;
  const hidden = collapse ? crumbs.slice(1, -2) : [];
  const shown = collapse ? [...crumbs.slice(0, 1), ...crumbs.slice(-2)] : crumbs;
  const current = crumbs[crumbs.length - 1];
  const link = ({ id, name }: Crumb) => (
    <BreadcrumbLink
      render={<button type="button" title={name} onClick={() => onSelect(id)} />}
      className="block max-w-48 cursor-pointer truncate py-1"
    >
      {name}
    </BreadcrumbLink>
  );
  return (
    <Breadcrumb
      aria-label={t`Path`}
      className="sticky top-0 z-10 border-b border-border bg-background px-3 py-1.5"
    >
      <BreadcrumbList className="flex-nowrap gap-1 text-xs">
        {shown.map((crumb, index) => (
          <Fragment key={crumb.id ?? "all"}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            {collapse && index === 1 ? (
              <>
                <BreadcrumbItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={t`Hidden folders`}
                      className="grid size-5 place-items-center rounded-sm hover:text-foreground"
                    >
                      <MoreHorizontal aria-hidden="true" className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {hidden.map(({ id, name }) => (
                        <DropdownMenuItem key={id} onClick={() => onSelect(id)}>
                          {name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            ) : null}
            <BreadcrumbItem className={crumb.id ? "min-w-0" : "shrink-0"}>
              {crumb === current ? (
                <BreadcrumbPage className="block max-w-64 truncate" title={crumb.name}>
                  {crumb.name}
                </BreadcrumbPage>
              ) : (
                link(crumb)
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
