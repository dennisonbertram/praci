import * as z from "zod";
import { isCartaAgentSpawnKey } from "./carta.js";
import { isDataRoomAgentSpawnKey } from "./data-room.js";
import { isFinanceAgentSpawnKey } from "./finance.js";
import { Id } from "./ids.js";
import { isInboxAgentSpawnKey } from "./inbox.js";
import { isIntegrationAgentSpawnKey } from "./integration-agent.js";
import { isLegalAgentSpawnKey } from "./legal.js";

/**
 * Sidebar folders are bot sections: a named container per user and space that holds bots and
 * groups. These schemas cover the operations that move things between containers.
 */
export const SidebarItemRefSchema = z.object({ kind: z.enum(["bot", "group"]), id: Id });
export type SidebarItemRef = z.infer<typeof SidebarItemRefSchema>;

export const MoveSidebarItemInput = z.object({
  item: SidebarItemRefSchema,
  /** The destination folder, or null for the root of the list. */
  folderId: Id.nullable(),
  /** Insert before this item (which must already be in the destination); omitted or null appends. */
  beforeItem: SidebarItemRefSchema.nullable().optional(),
});
export type MoveSidebarItemInput = z.infer<typeof MoveSidebarItemInput>;

export const MoveSidebarFolderInput = z.object({
  folderId: Id,
  /** Insert before this folder; omitted or null moves it last. */
  beforeFolderId: Id.nullable().optional(),
});

/** Where items sat before an auto-group, enough to put them back. */
export const SidebarSnapshotSchema = z.object({
  placements: z.array(
    z.object({
      item: SidebarItemRefSchema,
      folderId: Id.nullable(),
      position: z.number().int().nullable(),
    }),
  ),
  /** Folders the auto-group created, removed on restore if they are empty again. */
  createdFolderIds: z.array(Id),
});
export type SidebarSnapshot = z.infer<typeof SidebarSnapshotSchema>;

export const SIDEBAR_AUTO_FOLDERS = {
  workspace: "Workspace",
  apps: "Apps",
  agents: "Agents",
  groups: "Groups",
} as const;
export type SidebarAutoFolderName =
  (typeof SIDEBAR_AUTO_FOLDERS)[keyof typeof SIDEBAR_AUTO_FOLDERS];

/** The bot first-run onboarding creates (Chief); see apps/web Onboarding. */
export const FIRST_BOT_SPAWN_KEY = "onboarding:first";

/**
 * The folder Auto-group files an item into: page agents, integration agents, other bots, groups.
 * Null for Chief, which stays at the top of the list.
 */
export function autoGroupFolderName(item: {
  kind: "bot" | "group";
  spawnKey?: string | null;
}): SidebarAutoFolderName | null {
  if (item.kind === "group") return SIDEBAR_AUTO_FOLDERS.groups;
  const key = item.spawnKey;
  if (key === FIRST_BOT_SPAWN_KEY) return null;
  if (
    isInboxAgentSpawnKey(key) ||
    isFinanceAgentSpawnKey(key) ||
    isLegalAgentSpawnKey(key) ||
    isDataRoomAgentSpawnKey(key) ||
    isCartaAgentSpawnKey(key)
  ) {
    return SIDEBAR_AUTO_FOLDERS.workspace;
  }
  if (isIntegrationAgentSpawnKey(key)) return SIDEBAR_AUTO_FOLDERS.apps;
  return SIDEBAR_AUTO_FOLDERS.agents;
}
