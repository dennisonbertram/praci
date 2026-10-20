import type { SpaceBot, SpaceGroup } from "@rakazo/contracts";
import { nestRosterByParent, sidebarSections } from "@rakazo/core";
import type { MobileBot, MobileGroup, MobileSpace } from "./api";
import { adoptDeletedSpaceFallback, rpc, selectedSpaceId, selectSpace } from "./api";

export type InboxSpace = Pick<
  MobileSpace,
  "id" | "name" | "isDefault" | "hasContent" | "canDelete" | "canRename" | "botSections"
> & {
  bots: (MobileBot | SpaceBot)[];
  groups: (MobileGroup | SpaceGroup)[];
};

export type InboxSpaceItem =
  | {
      type: "bot";
      bot: MobileBot | SpaceBot;
      depth: number;
      hasChildren: boolean;
    }
  | { type: "group"; group: MobileGroup | SpaceGroup }
  | {
      type: "heading";
      key: string;
      title: string;
      space?: InboxSpace;
      /** Set on section headings: the fixed ones' title is an English fallback translated at render, folder names are user data. */
      kind?: "pinned" | "unassigned" | "folder";
      collapsed?: boolean;
    };

/** Same limit as the server's space name and the new-space screen. */
export const SPACE_NAME_MAX = 60;

export function canRenameInboxSpace(space: Pick<InboxSpace, "canRename">) {
  return space.canRename === true;
}

export async function renameInboxSpace(
  spaceId: string,
  name: string,
  refresh: () => Promise<void>,
) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await rpc("spaces/rename", { spaceId, name: trimmed });
  await refresh();
}

export function canDeleteInboxSpace(
  space: Pick<InboxSpace, "isDefault" | "hasContent" | "canDelete">,
) {
  return !space.isDefault && !space.hasContent && space.canDelete === true;
}

/** A brand-new space renders only its heading until it has a bot or group. */
export function inboxNeedsCreateHint(items: readonly { type: string }[]): boolean {
  return items.length > 0 && items.every((item) => item.type === "heading");
}

export function spaceInboxItems(
  spaces: InboxSpace[],
  // Bot ids that are collapsed, plus heading keys of folders toggled locally away from section.collapsed.
  collapsedParentIds: ReadonlySet<string> = new Set(),
): InboxSpaceItem[] {
  return spaces.flatMap((space): InboxSpaceItem[] => {
    const chats = [
      ...space.bots.map((chat) => ({
        type: "bot" as const,
        bot: chat,
        id: chat.id,
        parentBotId: chat.parentBotId,
        pinned: chat.pinned,
        position: chat.position,
        sectionId: chat.sectionId,
      })),
      ...space.groups.map((chat) => ({
        type: "group" as const,
        group: chat,
        id: chat.id,
        pinned: chat.pinned,
        position: chat.position,
        sectionId: chat.sectionId,
      })),
    ];
    const items: InboxSpaceItem[] = [];
    if (spaces.length > 1 || !space.isDefault || chats.length === 0) {
      items.push({ type: "heading", key: space.id, title: space.name, space });
    }
    // Folders are headings in the web sidebar's order; moving things around is web-only for now.
    const { pinned, folders, root } = sidebarSections(chats, space.botSections);
    const showRootHeading = pinned.length > 0 || folders.some(({ items }) => items.length > 0);
    const blocks = [
      {
        key: "pinned",
        kind: "pinned" as const,
        title: "Pinned",
        heading: true,
        collapsed: false,
        chats: pinned,
      },
      ...folders.map(({ section, items }) => ({
        key: `section:${section.id}`,
        kind: "folder" as const,
        title: section.name,
        heading: true,
        collapsed:
          section.collapsed !== collapsedParentIds.has(`${space.id}:section:${section.id}`),
        chats: items,
      })),
      {
        key: "unassigned",
        kind: "unassigned" as const,
        title: "Unassigned",
        heading: showRootHeading,
        collapsed: false,
        chats: root,
      },
    ];
    for (const block of blocks) {
      if (block.chats.length === 0) continue;
      if (block.heading) {
        items.push({
          type: "heading",
          key: `${space.id}:${block.key}`,
          kind: block.kind,
          title: block.title,
          collapsed: block.collapsed,
        });
      }
      if (block.collapsed) continue;
      for (const row of nestRosterByParent(block.chats, collapsedParentIds)) {
        if (row.item.type === "bot") {
          items.push({
            type: "bot",
            bot: row.item.bot,
            depth: row.depth,
            hasChildren: row.hasChildren,
          });
        } else {
          items.push({ type: "group", group: row.item.group });
        }
      }
    }
    return items;
  });
}

export async function selectInboxSpace(spaceId: string, refresh: () => Promise<void>) {
  if (!(await selectSpace(spaceId).catch(() => false))) return false;
  await refresh();
  return true;
}

export async function retryInboxSpaceFallback(spaceId: string, refresh: () => Promise<void>) {
  if (!(await adoptDeletedSpaceFallback(spaceId))) return false;
  await refresh();
  return true;
}

// Return the selection to retry if native storage fails after a successful deletion.
// The inbox must not refresh against the deleted selection in that case.
export async function removeInboxSpace(
  spaceId: string,
  refresh: () => Promise<void>,
): Promise<string | null> {
  const response = await rpc<{ ok: true; activeSpaceId: string }>("spaces/remove", { spaceId });
  if (selectedSpaceId() === spaceId) {
    if (await selectSpace(response.activeSpaceId).catch(() => false)) {
      await refresh();
      return null;
    }
    const durable = await adoptDeletedSpaceFallback(response.activeSpaceId);
    await refresh();
    return durable ? null : response.activeSpaceId;
  }
  await refresh();
  return null;
}
