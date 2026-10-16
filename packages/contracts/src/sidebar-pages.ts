import * as z from "zod";

/** Optional sidebar pages a user can add. `available: false` templates cannot be added yet. */
export const SIDEBAR_PAGE_TEMPLATES = [
  {
    key: "team-health",
    label: "Team health",
    description: "Workload and key people, from your connected tools",
    route: "/app/team-health",
    platforms: ["web"],
    available: false,
    ownerOnly: true,
  },
] as const satisfies readonly SidebarPageTemplate[];

export type SidebarPageTemplate = {
  key: string;
  label: string;
  description: string;
  route: string;
  platforms: readonly ("web" | "desktop" | "mobile")[];
  available: boolean;
  /** Only the space owner may add it. */
  ownerOnly?: boolean;
};

export const SidebarPageKeySchema = z.string().trim().min(1).max(64);

export const SidebarPageSchema = z.object({
  templateKey: SidebarPageKeySchema,
});
export type SidebarPage = z.infer<typeof SidebarPageSchema>;

export const SidebarPageInputSchema = z.object({
  templateKey: SidebarPageKeySchema,
});
