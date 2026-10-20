import { planSidebarMove, sidebarSections } from "@rakazo/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useMemo, useState } from "react";
import { type DropResult, itemDragId, ROOT_CONTAINER, type SidebarLayout } from "./drop-target";
import { FolderHeader } from "./FolderHeader";
import { RootEnd, SidebarDnd, SortableList, SortableRow } from "./SidebarDnd";

type Entry = {
  kind: "bot" | "group";
  id: string;
  name: string;
  sectionId: string | null;
  position: number | null;
  pinned: boolean;
  unread?: boolean;
  status?: "urgent" | "needs_input";
};
type Folder = { id: string; name: string; collapsed: boolean };

const entry = (
  kind: Entry["kind"],
  id: string,
  name: string,
  over: Partial<Entry> = {},
): Entry => ({
  kind,
  id,
  name,
  sectionId: null,
  position: kind === "bot" ? 0 : null,
  pinned: false,
  ...over,
});

const bots = [
  entry("bot", "chief", "Chief"),
  entry("bot", "ledger", "Ledger agent", { sectionId: "workspace" }),
  entry("bot", "counsel", "Counsel agent", { sectionId: "workspace", unread: true }),
  entry("bot", "relay", "Relay agent", { sectionId: "apps", status: "needs_input" }),
  entry("bot", "atlas", "Atlas agent", { sectionId: "apps" }),
  entry("bot", "scout", "Scout"),
  entry("group", "operations", "Operations"),
];

/**
 * The Personal list built from the same parts the app uses: folder headers, sortable rows and the
 * drop handling. Drag with the mouse, or focus a row and press space, the arrow keys, then space.
 */
export function FolderListDemo({
  initialEntries = bots,
  initialFolders = [
    { id: "workspace", name: "Workspace", collapsed: false },
    { id: "apps", name: "Apps", collapsed: true },
  ],
  onMoved,
}: {
  initialEntries?: Entry[];
  initialFolders?: Folder[];
  onMoved?: (result: DropResult) => void;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [folders, setFolders] = useState(initialFolders);
  const [editing, setEditing] = useState<string | null>(null);
  const {
    pinned: _pinned,
    folders: filed,
    root,
  } = useMemo(() => sidebarSections(entries, folders), [entries, folders]);
  const layout = useMemo<SidebarLayout>(
    () => ({
      folders: folders.map((folder) => folder.id),
      containers: {
        ...Object.fromEntries(
          filed.map(({ section, items }) => [
            section.id,
            section.collapsed ? [] : items.map(({ kind, id }) => ({ kind, id })),
          ]),
        ),
        [ROOT_CONTAINER]: root.map(({ kind, id }) => ({ kind, id })),
      },
    }),
    [folders, filed, root],
  );
  const labelFor = useCallback(
    (dragId: string) =>
      folders.find((folder) => `folder:${folder.id}` === dragId)?.name ??
      entries.find((item) => itemDragId(item) === dragId)?.name ??
      "Personal",
    [entries, folders],
  );
  const onDrop = (result: DropResult) => {
    onMoved?.(result);
    if (result.type === "folder") {
      setFolders((current) => {
        const moving = current.find((folder) => folder.id === result.folderId);
        if (!moving) return current;
        const rest = current.filter((folder) => folder !== moving);
        const at = result.beforeFolderId
          ? rest.findIndex((folder) => folder.id === result.beforeFolderId)
          : rest.length;
        return [...rest.slice(0, at), moving, ...rest.slice(at)];
      });
      return;
    }
    const plan = planSidebarMove(entries, result);
    if (!plan) return;
    const next = new Map(plan.map(({ item, ...rest }) => [itemDragId(item), rest]));
    setEntries((current) =>
      current.map((item) => {
        const placed = next.get(itemDragId(item));
        return placed ? { ...item, ...placed } : item;
      }),
    );
  };
  const row = (item: Entry) => (
    <SortableRow key={itemDragId(item)} id={itemDragId(item)}>
      {(state) => (
        <div
          ref={state.setNodeRef}
          style={{ ...state.style, opacity: state.isDragging ? 0.4 : 1 }}
          data-drops-before={state.dropsBefore ? "" : undefined}
          className="mb-1 data-drops-before:border-t-2 data-drops-before:border-ring"
        >
          <button
            type="button"
            data-roster-bot-id={item.id}
            className="flex w-full cursor-grab items-center gap-3 rounded-xl px-2.5 py-2 text-start text-[14.5px] hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            {...state.handleProps}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm">
              {item.name.slice(0, 1)}
            </span>
            {item.name}
          </button>
        </div>
      )}
    </SortableRow>
  );
  return (
    <div className="w-[316px] bg-sidebar p-2">
      <div className="px-2.5 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
        Personal
      </div>
      <SidebarDnd
        layout={layout}
        labelFor={labelFor}
        onDrop={onDrop}
        overlay={(dragId) => (
          <div className="w-fit rounded-xl bg-sidebar-accent px-2.5 py-2 shadow-lg ring-1 ring-border">
            {labelFor(dragId)}
          </div>
        )}
      >
        {filed.map(({ section, items }) => {
          const folder = folders.find((candidate) => candidate.id === section.id)!;
          return (
            <div key={folder.id}>
              <FolderHeader
                id={folder.id}
                name={folder.name}
                count={items.length}
                collapsed={folder.collapsed}
                status={items.find((item) => item.status)?.status}
                unread={items.some((item) => item.unread)}
                editing={editing === folder.id}
                onToggle={() =>
                  setFolders((current) =>
                    current.map((candidate) =>
                      candidate.id === folder.id
                        ? { ...candidate, collapsed: !candidate.collapsed }
                        : candidate,
                    ),
                  )
                }
                onStartRename={() => setEditing(folder.id)}
                onRename={(name) => {
                  setEditing(null);
                  setFolders((current) =>
                    current.map((candidate) =>
                      candidate.id === folder.id ? { ...candidate, name } : candidate,
                    ),
                  );
                }}
                onCancelRename={() => setEditing(null)}
                onDelete={() => {
                  setFolders((current) =>
                    current.filter((candidate) => candidate.id !== folder.id),
                  );
                  setEntries((current) =>
                    current.map((item) =>
                      item.sectionId === folder.id ? { ...item, sectionId: null } : item,
                    ),
                  );
                }}
              />
              {folder.collapsed ? null : (
                <SortableList ids={items.map(itemDragId)}>{items.map(row)}</SortableList>
              )}
            </div>
          );
        })}
        {root.length > 0 && folders.length > 0 ? (
          <div className="mt-1 px-2.5 py-1.5 text-[13px] font-medium text-foreground/80">Chats</div>
        ) : null}
        <SortableList ids={root.map(itemDragId)}>{root.map(row)}</SortableList>
        <RootEnd />
      </SidebarDnd>
    </div>
  );
}

const meta = {
  title: "Shell/Sidebar folders/Personal list",
  component: FolderListDemo,
  parameters: { layout: "centered" },
} satisfies Meta<typeof FolderListDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Workspace is open, Apps is closed with its needs-input status still showing. */
export const Default: Story = {};

/** Nothing filed yet: the list looks exactly as it did before folders. */
export const NoFolders: Story = {
  args: { initialFolders: [], initialEntries: bots.map((item) => ({ ...item, sectionId: null })) },
};

/** A new folder, already in rename. */
export const Empty: Story = {
  args: {
    initialFolders: [{ id: "workspace", name: "Untitled folder", collapsed: false }],
    initialEntries: bots.map((item) => ({ ...item, sectionId: null })),
  },
};
