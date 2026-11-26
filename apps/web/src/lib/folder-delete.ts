import { t } from "@lingui/core/macro";
import type { BotSection } from "@rakazo/contracts";

type Item = { kind: "bot" | "group"; id: string };

/**
 * Deletes a folder at once and offers Undo. The server keeps no deleted folder, so Undo makes a new
 * one with the same name and files the chats back in their old order.
 */
export async function deleteFolderWithUndo({
  folder,
  items,
  api,
  hide,
  refresh,
  notify,
  fail,
}: {
  folder: BotSection;
  /** The chats in the folder, in order. */
  items: Item[];
  api: {
    remove: (input: { sectionId: string }) => Promise<unknown>;
    add: (input: { name: string }) => Promise<BotSection>;
    setCollapsed: (input: { sectionId: string; collapsed: boolean }) => Promise<unknown>;
    move: (input: { item: Item; folderId: string; beforeItem: null }) => Promise<unknown>;
  };
  /** Takes the folder off the list before the server answers. */
  hide: () => void;
  refresh: () => Promise<unknown>;
  notify: (title: string, action?: { label: string; onClick: () => void | Promise<void> }) => void;
  fail: (cause: unknown) => void;
}) {
  const { id, name } = folder;
  hide();
  try {
    await api.remove({ sectionId: id });
  } catch (cause) {
    fail(cause);
    await refresh().catch(() => undefined);
    return;
  }
  notify(t`Deleted ${name}`, {
    label: t`Undo`,
    onClick: async () => {
      try {
        const created = await api.add({ name });
        if (folder.collapsed) await api.setCollapsed({ sectionId: created.id, collapsed: true });
        for (const item of items) {
          await api.move({ item, folderId: created.id, beforeItem: null });
        }
      } catch (cause) {
        fail(cause);
      } finally {
        await refresh().catch(() => undefined);
      }
    },
  });
  await refresh().catch(() => undefined);
}
