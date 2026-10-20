import { sidebarSections } from "@rakazo/core";

type SidebarChat = {
  id: string;
  name: string;
  title?: string | null;
  preview?: string | null;
  pinned: boolean;
  sectionId: string | null;
  position?: number | null;
  parentBotId?: string | null;
};

type SidebarSpace<TBot extends SidebarChat, TGroup extends SidebarChat> = {
  id: string;
  name: string;
  canRename?: boolean;
  canDelete?: boolean;
  bots: readonly TBot[];
  groups: readonly TGroup[];
  botSections: readonly { id: string; name: string; collapsed?: boolean }[];
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

/** What a block of the list is: the whole space, its heading alone, pinned, a folder or the rest. */
export type SidebarBlockKind = "space" | "head" | "pinned" | "folder" | "root";

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
    const spaceLabel = showSpaceNames ? space.name : (soleSpaceTitle ?? space.name);
    const visibleBots = space.bots.filter((bot) =>
      `${bot.name} ${bot.title ?? ""} ${bot.preview ?? ""}`.toLowerCase().includes(needle),
    );
    const visibleGroups = space.groups.filter((group) =>
      `${group.name} ${group.preview ?? ""}`.toLowerCase().includes(needle),
    );
    // Bots then groups, as the lists load.
    const placed = [
      ...visibleBots.map((chat) => ({ kind: "bot" as const, chat })),
      ...visibleGroups.map((chat) => ({ kind: "group" as const, chat })),
    ].map((item) => ({
      ...item,
      id: item.chat.id,
      parentBotId: item.kind === "bot" ? (item.chat.parentBotId ?? null) : null,
      pinned: item.chat.pinned,
      position: item.chat.position,
      sectionId: item.chat.sectionId,
    }));
    const { pinned, root, ...rest } = sidebarSections(placed, space.botSections);
    const folders = rest.folders
      .map(({ section, items }) => ({ section, bots: items }))
      // A search shows only the folders it found something in.
      .filter(({ bots }) => !needle || bots.length > 0);
    const key = (base: string) => (showSpaceNames ? `space:${space.id}:${base}` : base);
    const shared = {
      relabeled: false,
      showLock: false,
      emptySpaceId: undefined as string | undefined,
      current: false,
      spaceId: space.id,
      spaceName: space.name,
      canRenameSpace: false,
      canDeleteSpace: false,
      sectionId: null as string | null,
      collapsed: false,
      parentKey: null as string | null,
    };
    // The heading carries the space's name, lock, current marker and actions menu.
    const heading = (index: number) => ({
      ...shared,
      title: spaceLabel as string | null,
      relabeled: !showSpaceNames && soleSpaceTitle !== undefined,
      showLock: showSpaceNames,
      current: showSpaceNames && space.id === currentSpaceId,
      ...spaceHeaderMenu(space, index === 0),
    });
    const sections = [];
    if (pinned.length === 0 && folders.length === 0) {
      if (root.length > 0) {
        sections.push({
          ...heading(0),
          kind: "space" as SidebarBlockKind,
          key: key("unassigned"),
          bots: root,
        });
      }
    } else {
      const headKey = key("unassigned");
      const child = { ...shared, parentKey: headKey };
      sections.push({
        ...heading(0),
        kind: "head" as SidebarBlockKind,
        key: headKey,
        bots: [] as typeof root,
      });
      if (pinned.length > 0) {
        sections.push({
          ...child,
          kind: "pinned" as SidebarBlockKind,
          key: key("pinned"),
          title: "Pinned" as string | null,
          bots: pinned,
        });
      }
      for (const { section, bots } of folders) {
        sections.push({
          ...child,
          kind: "folder" as SidebarBlockKind,
          key: key(`section:${section.id}`),
          title: section.name as string | null,
          sectionId: section.id,
          collapsed: section.collapsed === true,
          bots,
        });
      }
      sections.push({
        ...child,
        kind: "root" as SidebarBlockKind,
        key: key("root"),
        title: null as string | null,
        bots: root,
      });
    }
    if (sections.length > 0) return sections;
    // Keep empty spaces selectable; chat clicks are the only switch control.
    if (needle && (space.bots.length > 0 || space.groups.length > 0)) return [];
    if (!showSpaceNames && space.canRename !== true && space.canDelete !== true) return [];
    return [
      {
        ...shared,
        ...spaceHeaderMenu(space, true),
        kind: "space" as SidebarBlockKind,
        key: showSpaceNames ? `space:${space.id}:empty` : `space:${space.id}:actions`,
        title: (showSpaceNames ? space.name : null) as string | null,
        bots: [] as typeof root,
        showLock: showSpaceNames,
        emptySpaceId: showSpaceNames ? space.id : undefined,
        current: showSpaceNames && space.id === currentSpaceId,
      },
    ];
  });
}
