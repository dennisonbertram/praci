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
  const next = text.trim().slice(0, 300);
  return next ? mapItem(list, id, (item) => ({ ...item, text: next })) : list;
}

export const deleteItem = (list: PinList, id: string): PinList => ({
  ...list,
  items: list.items.filter((item) => item.id !== id),
});

export function addItem(list: PinList, id: string, text: string): PinList {
  const next = text.trim().slice(0, 300);
  if (!next || list.items.length >= BOT_PINS_MAX_ITEMS) return list;
  return { ...list, items: [...list.items, { id, text: next, done: false }] };
}
