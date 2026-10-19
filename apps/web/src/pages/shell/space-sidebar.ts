import { groupBotsForSidebar } from "@rakazo/core";

type SidebarChat = {
  id: string;
  name: string;
  title?: string | null;
  preview?: string | null;
  pinned: boolean;
  sectionId: string | null;
  parentBotId?: string | null;
};

type SidebarSpace<TBot extends SidebarChat, TGroup extends SidebarChat> = {
  id: string;
  name: string;
  canRename?: boolean;
  canDelete?: boolean;
  bots: readonly TBot[];
  groups: readonly TGroup[];
  botSections: readonly { id: string; name: string }[];
};

function spaceHeaderMenu(space: { canRename?: boolean; canDelete?: boolean }, hostsMenu: boolean) {
  return {
    canRenameSpace: hostsMenu && space.canRename === true,
    canDeleteSpace: hostsMenu && space.canDelete === true,
  };
}

export async function commitSpaceRename(input: {
  rename: () => Promise<void>;
  apply: () => void;
  refresh: () => Promise<void>;
}): Promise<void> {
  await input.rename();
  input.apply();
  await input.refresh().catch(() => undefined);
}

/**
 * The space the app is showing comes first, so the chats at the top of the sidebar belong to the
 * company on screen (Finance switches spaces too); the others keep their order below it.
 */
export function activeSpaceFirst<T extends { id: string }>(
  spaces: readonly T[],
  activeId: string | null | undefined,
): T[] {
  const active = spaces.filter((space) => space.id === activeId);
  return [...active, ...spaces.filter((space) => space.id !== activeId)];
}

export function sidebarGroupsForSpaces<TBot extends SidebarChat, TGroup extends SidebarChat>(
  spaces: readonly SidebarSpace<TBot, TGroup>[],
  query: string,
  /** The space the app is showing; its headers are marked when several spaces are listed. */
  currentSpaceId?: string,
  /** Header label for the only space, which needs no name to tell it from others. */
  soleSpaceTitle?: string,
) {
  const needle = query.toLowerCase();
  const showSpaceNames = spaces.length > 1;
  return spaces.flatMap((space) => {
    const visibleBots = space.bots.filter((bot) =>
      `${bot.name} ${bot.title ?? ""} ${bot.preview ?? ""}`.toLowerCase().includes(needle),
    );
    const visibleGroups = space.groups.filter((group) =>
      `${group.name} ${group.preview ?? ""}`.toLowerCase().includes(needle),
    );
    const sections = groupBotsForSidebar(
      [
        ...visibleBots.map((chat) => ({ kind: "bot" as const, chat })),
        ...visibleGroups.map((chat) => ({ kind: "group" as const, chat })),
      ].map((item) => ({
        ...item,
        id: item.chat.id,
        parentBotId: item.kind === "bot" ? (item.chat.parentBotId ?? null) : null,
        pinned: item.chat.pinned,
        sectionId: item.chat.sectionId,
      })),
      space.botSections,
    ).map((group, index) => ({
      ...group,
      sectionId: group.key.startsWith("section:") ? group.key.slice("section:".length) : null,
      key: showSpaceNames ? `space:${space.id}:${group.key}` : group.key,
      // The only space is labelled on its first, untitled header too, so its actions button is
      // not left floating beside an empty label.
      title: showSpaceNames
        ? group.title
          ? `${space.name} · ${group.title}`
          : space.name
        : group.title || (index === 0 ? (soleSpaceTitle ?? space.name) : group.title),
      relabeled: !showSpaceNames && !group.title && index === 0 && soleSpaceTitle !== undefined,
      showLock: showSpaceNames,
      emptySpaceId: undefined as string | undefined,
      current: showSpaceNames && space.id === currentSpaceId,
      spaceId: space.id,
      spaceName: space.name,
      ...spaceHeaderMenu(space, index === 0),
    }));
    if (sections.length > 0) return sections;
    // Keep empty spaces selectable; chat clicks are the only switch control.
    if (needle && (space.bots.length > 0 || space.groups.length > 0)) return [];
    if (!showSpaceNames && space.canRename !== true && space.canDelete !== true) return [];
    return [
      {
        key: showSpaceNames ? `space:${space.id}:empty` : `space:${space.id}:actions`,
        title: showSpaceNames ? space.name : null,
        relabeled: false,
        bots: [],
        sectionId: null,
        showLock: showSpaceNames,
        emptySpaceId: showSpaceNames ? space.id : undefined,
        current: showSpaceNames && space.id === currentSpaceId,
        spaceId: space.id,
        spaceName: space.name,
        ...spaceHeaderMenu(space, true),
      },
    ];
  });
}
