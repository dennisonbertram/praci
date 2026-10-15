import type { PinList } from "@rakazo/contracts";
import { BOT_PINS_MAX_ITEMS } from "@rakazo/contracts";

const mapItem = (
  list: PinList,
  id: string,
  change: (item: PinList["items"][number]) => PinList["items"][number],
): PinList => ({
  ...list,
  items: list.items.map((item) => (item.id === id ? change(item) : item)),
});

export const toggleItem = (list: PinList, id: string): PinList =>
  mapItem(list, id, (item) => ({ ...item, done: !item.done }));

/** Blank text keeps the old text: the contract requires at least one character. */
export function editItem(list: PinList, id: string, text: string): PinList {
  const next = text.trim().slice(0, 60);
  return next ? mapItem(list, id, (item) => ({ ...item, text: next })) : list;
}

export const deleteItem = (list: PinList, id: string): PinList => ({
  ...list,
  items: list.items.filter((item) => item.id !== id),
});

export function addItem(list: PinList, id: string, text: string): PinList {
  const next = text.trim().slice(0, 60);
  if (!next || list.items.length >= BOT_PINS_MAX_ITEMS) return list;
  return { ...list, items: [...list.items, { id, text: next, done: false }] };
}

/** A queued edit, applied to whatever list is current when it runs. */
export type PinOp = (list: PinList) => PinList;

/** Replays queued edits, in order, onto a list. Edits on items that no longer exist do nothing. */
export const rebasePins = (base: PinList, ops: readonly PinOp[]): PinList =>
  ops.reduce((list, op) => op(list), base);
