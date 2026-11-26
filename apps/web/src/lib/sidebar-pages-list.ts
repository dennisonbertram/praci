import type { SidebarPagesState } from "@rakazo/contracts";
import { rpc } from "./rpc";

/**
 * One sidebar list request shared by everything that asks in the same task: every page card in a
 * transcript mounts in one commit and every card reacts to one sidebar change event, so without
 * this each card would fetch the same list. The promise is dropped right after the task, so the
 * next event still reads fresh state.
 */
let pending: Promise<SidebarPagesState> | null = null;

export function listSidebarPages(): Promise<SidebarPagesState> {
  if (pending) return pending;
  const request = rpc.sidebarPages.list();
  pending = request;
  queueMicrotask(() => {
    if (pending === request) pending = null;
  });
  return request;
}
