import {
  type Announcements,
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLingui } from "@lingui/react/macro";
import type { CSSProperties, ReactNode } from "react";
import {
  type DropResult,
  folderDragId,
  ROOT_END_ID,
  resolveDrop,
  type SidebarLayout,
} from "./drop-target";

/**
 * Drag and drop for the Personnel list. Rows and folder headers are the handles: a drag starts after
 * a few pixels (or a long press on touch), so a click still opens the chat; with the keyboard, Space
 * picks up, the arrow keys move, Space drops and Escape cancels.
 */
export function SidebarDnd({
  layout,
  labelFor,
  onDrop,
  overlay,
  children,
}: {
  layout: SidebarLayout;
  /** The name a screen reader announces for a drag id. */
  labelFor: (dragId: string) => string;
  onDrop: (result: DropResult) => void;
  /** What follows the pointer while dragging. */
  overlay: (dragId: string) => ReactNode;
  children: ReactNode;
}) {
  const { t } = useLingui();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter keeps opening the chat or toggling the folder.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  // A folder only moves among folders, so its drag ignores rows.
  const collisionDetection: CollisionDetection = (args) =>
    closestCenter(
      String(args.active.id).startsWith("folder:")
        ? {
            ...args,
            droppableContainers: args.droppableContainers.filter((container) =>
              String(container.id).startsWith("folder:"),
            ),
          }
        : args,
    );
  const name = (id: unknown) => labelFor(String(id));
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const item = name(active.id);
      return t`Picked up ${item}.`;
    },
    onDragOver: ({ active, over }) => {
      if (!over || over.id === active.id) return undefined;
      const item = name(active.id);
      const target = name(over.id);
      return t`${item} is over ${target}.`;
    },
    onDragEnd: ({ active, over }) => {
      const item = name(active.id);
      if (!over || over.id === active.id) return t`${item} dropped.`;
      const target = name(over.id);
      return t`${item} dropped on ${target}.`;
    },
    onDragCancel: ({ active }) => {
      const item = name(active.id);
      return t`Move of ${item} cancelled.`;
    },
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const result = resolveDrop(String(active.id), String(over.id), layout);
    if (result) onDrop(result);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: t`To pick up, press space. Use the arrow keys to move, space to drop, escape to cancel.`,
        },
      }}
    >
      {children}
      <Overlay render={overlay} />
    </DndContext>
  );
}

function Overlay({ render }: { render: (dragId: string) => ReactNode }) {
  const { active } = useDndContext();
  return (
    <DragOverlay dropAnimation={null}>{active ? render(String(active.id)) : null}</DragOverlay>
  );
}

export type SortableRowState = {
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  /** Spread on the element that is the handle (the row button). */
  handleProps: Record<string, unknown>;
  isDragging: boolean;
  /** Another list's row is being dragged over this one: it will land before it. */
  dropsBefore: boolean;
};

/** One row of a list; `ids` of its siblings go in the surrounding SortableList. */
export function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (state: SortableRowState) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, active } =
    useSortable({ id, disabled });
  const draggingFolder = String(active?.id ?? "").startsWith("folder:");
  return children({
    setNodeRef,
    style: { transform: CSS.Translate.toString(transform), transition },
    handleProps: disabled ? {} : { ...attributes, ...listeners },
    isDragging,
    dropsBefore: isOver && !isDragging && !draggingFolder,
  });
}

export function SortableList({ ids, children }: { ids: string[]; children: ReactNode }) {
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

export type FolderDndState = {
  setNodeRef: (node: HTMLElement | null) => void;
  handleProps: Record<string, unknown>;
  isDragging: boolean;
  /** A row is over the header: it will land in the folder. */
  dropsInto: boolean;
  /** Another folder is over the header: it will land before or after it. */
  dropsFolder: boolean;
};

/** A folder header is both a handle (to move the folder) and a target (to drop a row into it). */
export function useFolderDnd(folderId: string, disabled?: boolean): FolderDndState {
  const id = folderDragId(folderId);
  const drag = useDraggable({ id, disabled });
  const drop = useDroppable({ id, disabled });
  const { active } = useDndContext();
  const draggingFolder = String(active?.id ?? "").startsWith("folder:");
  const over = drop.isOver && active?.id !== id;
  return {
    setNodeRef: (node) => {
      drag.setNodeRef(node);
      drop.setNodeRef(node);
    },
    handleProps: disabled ? {} : { ...drag.attributes, ...drag.listeners },
    isDragging: drag.isDragging,
    dropsInto: over && !draggingFolder,
    dropsFolder: over && draggingFolder,
  };
}

/** The strip after the last row: drop here to move a row to the end of the root list. */
export function RootEnd() {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_END_ID });
  const { active } = useDndContext();
  return (
    <div
      ref={setNodeRef}
      data-testid="sidebar-root-end"
      className={`mx-2 rounded-lg ${active ? "h-6" : "h-0"} ${isOver ? "bg-sidebar-accent" : ""}`}
    />
  );
}
