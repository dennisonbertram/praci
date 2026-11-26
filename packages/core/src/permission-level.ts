import type { PermissionLevel } from "@rakazo/contracts";
import { PermissionLevelSchema } from "@rakazo/contracts";

/**
 * Deployment default for a space with no stored level. Unset or empty means open; a value that is
 * not a level fails closed: a typo in a deployment's safety dial must never silently open it.
 */
export function deploymentPermissionDefault(
  env: Partial<Record<string, string | undefined>> = process.env,
): PermissionLevel {
  const raw = env.RAKAZO_PERMISSIONS_DEFAULT?.trim().toLowerCase();
  if (!raw) return "open";
  const parsed = PermissionLevelSchema.safeParse(raw);
  return parsed.success ? parsed.data : "ask_changes";
}

/** A Firewalled or external agent never goes above Ask for changes. Pure, so the browser can use it. */
export const clampPermissionLevel = (level: PermissionLevel): PermissionLevel =>
  level === "open" ? "ask_changes" : level;

/**
 * The level that applies to one agent: its own override, else the owner's space level, else the
 * deployment default. A Firewalled or external agent is held to ask_changes at most, whichever
 * source said open. The executor's gate and the approvals table both read it.
 */
export function effectivePermissionLevel(input: {
  botLevel?: string | null;
  spaceLevel?: string | null;
  firewall?: boolean;
  external?: boolean;
  env?: Partial<Record<string, string | undefined>>;
}): PermissionLevel {
  const stored = (value: string | null | undefined) => PermissionLevelSchema.safeParse(value).data;
  const level =
    stored(input.botLevel) ?? stored(input.spaceLevel) ?? deploymentPermissionDefault(input.env);
  return input.firewall || input.external ? clampPermissionLevel(level) : level;
}

/**
 * `effectivePermissionLevel` for inputs that are loaded (a database read). A failed load uses Ask
 * for everything, so callers cannot run ordinary actions from a standing Allow. The one resolution
 * the executor and the approvals table share.
 */
export async function resolvePermissionLevel(
  load: () => Promise<Parameters<typeof effectivePermissionLevel>[0]>,
): Promise<PermissionLevel> {
  try {
    return effectivePermissionLevel(await load());
  } catch {
    return "ask_everything";
  }
}
