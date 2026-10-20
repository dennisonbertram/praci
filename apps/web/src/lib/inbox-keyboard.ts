import { useEffect, useRef } from "react";

interface InboxKeyboard {
  /** Row ids in display order. */
  ids: string[];
  selectedId: string | undefined;
  enabled: boolean;
  select: (id: string) => void;
  open: (id: string) => void;
  focusSearch: () => void;
  compose: (() => void) | undefined;
  /** Toggles the checkbox of the selected row, or of a whole group when the id is a group's. */
  toggle: (id: string) => void;
  /** Some rows are checked. */
  hasPicked: boolean;
  /** Archives the checked rows when there are any, else the selected one. */
  archive: ((id: string | undefined) => void) | undefined;
  help: () => void;
}

const rowButton = (id: string) =>
  [...document.querySelectorAll<HTMLElement>("[data-row-id]")].find(
    (el) => el.dataset.rowId === id,
  );

let lastStep = Number.NEGATIVE_INFINITY;
/**
 * Whether a j/k press may move now. Held keys (`repeat`) and presses within 150ms of the last
 * accepted one are dropped, so a key burst cannot walk through, and mark read, a whole list.
 */
export function allowStep(event: KeyboardEvent): boolean {
  const now = Date.now();
  if (event.repeat || now - lastStep < 150) return false;
  lastStep = now;
  return true;
}

/** List shortcuts for the Inbox: j/k and arrows move, Enter or o opens, / searches, c composes, x checks a row, e archives, ? lists them. */
export function useInboxKeyboard(options: InboxKeyboard) {
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const {
        ids,
        selectedId: selection,
        enabled,
        select,
        open,
        focusSearch,
        compose,
        toggle,
        hasPicked,
        archive,
        help,
      } = latest.current;
      if (!enabled || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input,textarea,select,[contenteditable],[role=menu],[role=tablist]"))
        return;
      // Keys pressed elsewhere on the screen, such as by the Inbox agent's message box, are not for the list.
      if (target && target !== document.body && !target.closest("[data-inbox-page]")) return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      const key = event.key;
      // A selection a filter or search has hidden is no selection.
      const selectedId = selection && ids.includes(selection) ? selection : undefined;
      const index = selectedId ? ids.indexOf(selectedId) : -1;
      const move = (to: number) => {
        const id = ids[Math.max(0, Math.min(ids.length - 1, to))];
        if (!id) return;
        event.preventDefault();
        select(id);
        const el = rowButton(id);
        el?.scrollIntoView?.({ block: "nearest" });
        el?.focus();
      };
      if (key === "j" || key === "k") {
        if (allowStep(event)) move(key === "j" ? index + 1 : index < 0 ? 0 : index - 1);
        else event.preventDefault();
      } else if (key === "ArrowDown") move(index + 1);
      else if (key === "ArrowUp") move(index < 0 ? 0 : index - 1);
      else if (key === "o" || (key === "Enter" && !target?.closest("button,a"))) {
        if (index < 0) return;
        event.preventDefault();
        open(ids[index] as string);
      } else if (key === "/") {
        event.preventDefault();
        focusSearch();
      } else if (key === "c" && compose) {
        event.preventDefault();
        compose();
      } else if (key === "x" && selectedId) {
        event.preventDefault();
        toggle(selectedId);
      } else if (key === "e" && archive && (selectedId || hasPicked)) {
        event.preventDefault();
        archive(selectedId);
      } else if (key === "?") {
        event.preventDefault();
        help();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
