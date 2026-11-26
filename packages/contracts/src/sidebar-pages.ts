import * as z from "zod";
import { Id } from "./ids.js";
import { BotPageTitleSchema } from "./pages.js";

/** Optional sidebar pages a user can add. `available: false` templates cannot be added yet. */
export const SIDEBAR_PAGE_TEMPLATES = [
  {
    key: "company",
    route: "/app/company",
    platforms: ["web", "desktop", "mobile"],
    available: false,
    ownerOnly: true,
  },
  {
    key: "team-health",
    route: "/app/team-health",
    platforms: ["web", "desktop"],
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

/** An added row is a template page or one of the user's bot pages (with what the row shows). */
export const SidebarPageSchema = z.union([
  z.object({ templateKey: SidebarPageKeySchema }),
  z.object({ pageId: Id, botId: Id, title: BotPageTitleSchema }),
]);
export type SidebarPage = z.infer<typeof SidebarPageSchema>;

/** Adds or removes a template page (`templateKey`) or a bot page (`pageId`). */
export const SidebarPageInputSchema = z.union([
  z.object({ templateKey: SidebarPageKeySchema }),
  z.object({ pageId: Id }),
]);
export type SidebarPageInput = z.infer<typeof SidebarPageInputSchema>;

/** The user's added pages, the template keys they may still add, and their bot pages not yet added, by bot. */
export const SidebarPagesStateSchema = z.object({
  pages: z.array(SidebarPageSchema),
  addable: z.array(SidebarPageKeySchema),
  botPages: z.array(
    z.object({
      botId: Id,
      pages: z.array(z.object({ id: Id, title: BotPageTitleSchema })),
    }),
  ),
});
export type SidebarPagesState = z.infer<typeof SidebarPagesStateSchema>;
