import * as z from "zod";

/** Optional sidebar pages a user can add. `available: false` templates cannot be added yet. */
export const SIDEBAR_PAGE_TEMPLATES = [
  {
    key: "team-health",
    route: "/app/team-health",
    platforms: ["web"],
    available: false,
    ownerOnly: true,
  },
] as const satisfies readonly SidebarPageTemplate[];

export type SidebarPageTemplate = {
  key: string;
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

/** The user's added pages and the template keys they may still add. */
export const SidebarPagesStateSchema = z.object({
  pages: z.array(SidebarPageSchema),
  addable: z.array(SidebarPageKeySchema),
});
export type SidebarPagesState = z.infer<typeof SidebarPagesStateSchema>;
