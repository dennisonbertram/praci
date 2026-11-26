const hasRole = (role: string | null | undefined, wanted: readonly string[]) =>
  role?.split(",").some((r) => wanted.includes(r.trim())) ?? false;

/** Better Auth stores multiple roles comma-joined, so "owner,admin" is an owner. */
export function isSpaceOwnerRole(role: string | null | undefined): boolean {
  return hasRole(role, ["owner"]);
}

/** Owners and admins, with the same comma-joined parsing as {@link isSpaceOwnerRole}. */
export function isSpaceOwnerOrAdminRole(role: string | null | undefined): boolean {
  return hasRole(role, ["owner", "admin"]);
}
