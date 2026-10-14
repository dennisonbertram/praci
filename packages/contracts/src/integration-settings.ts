import * as z from "zod";

export const IntegrationProviderIdSchema = z.enum(["composio", "pipedream", "google"]);
export const IntegrationProviderConfigSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("composio"), apiKey: z.string().trim().min(1).max(16384) }),
  z.object({
    provider: z.literal("pipedream"),
    clientId: z.string().trim().min(1).max(512),
    clientSecret: z.string().trim().min(1).max(16384),
    projectId: z.string().trim().min(1).max(512),
    environment: z.enum(["production", "development"]).default("production"),
  }),
  z.object({
    provider: z.literal("google"),
    clientId: z.string().trim().min(1).max(512),
    clientSecret: z.string().trim().min(1).max(16384),
  }),
]);
export type IntegrationProviderConfig = z.infer<typeof IntegrationProviderConfigSchema>;
export type IntegrationProviderId = z.infer<typeof IntegrationProviderIdSchema>;
export const IntegrationSetupStateSchema = z.object({
  canConfigure: z.boolean(),
  needsSetup: z.boolean(),
  webUrl: z.string().url(),
  providers: z.array(z.object({ id: IntegrationProviderIdSchema, configured: z.boolean() })),
});
export type IntegrationSetupState = z.infer<typeof IntegrationSetupStateSchema>;

/**
 * Google rejects sign-in inside Electron's embedded browser, so desktop signs in with the system
 * browser and receives the code on this loopback address. The port is fixed because Google only
 * accepts redirect URIs registered in the owner's OAuth client (shown next to the web one in setup).
 */
export const GOOGLE_DESKTOP_REDIRECT_URI = "http://127.0.0.1:53925/integrations/google/callback";
