import * as z from "zod";

/** iMessage providers the deployment owner can configure in the app (env values still win). */
export const IMessageProviderIdSchema = z.enum(["bluebubbles", "photon"]);
export type IMessageProviderId = z.infer<typeof IMessageProviderIdSchema>;

export const BLUEBUBBLES_MIN_WEBHOOK_TOKEN = 32;

const secret = z.string().trim().max(16384).optional();
/** A blank secret keeps the saved one; a value replaces it. */
export const MessagingSetupSaveSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("bluebubbles"),
    serverUrl: z.string().trim().min(1).max(2048),
    password: secret,
    /** Blank keeps the saved token, or generates one the first time. */
    webhookToken: z.string().trim().min(BLUEBUBBLES_MIN_WEBHOOK_TOKEN).max(512).optional(),
  }),
  z.object({
    provider: z.literal("photon"),
    projectId: z.string().trim().min(1).max(512),
    projectSecret: secret,
    webhookSecret: secret,
    address: z.string().trim().max(512).optional(),
  }),
]);
export type MessagingSetupSave = z.infer<typeof MessagingSetupSaveSchema>;

/** Where a field's value comes from; secret values are never sent, only that they exist. */
export const MessagingFieldSchema = z.object({
  source: z.enum(["server", "saved", "empty"]),
  /** Present for non-secret fields only. */
  value: z.string().optional(),
});
export type MessagingField = z.infer<typeof MessagingFieldSchema>;

export const MessagingSetupStateSchema = z.object({
  canConfigure: z.boolean(),
  providers: z.array(
    z.object({
      id: IMessageProviderIdSchema,
      fields: z.record(z.string(), MessagingFieldSchema),
      /** Every required field has a value. */
      configured: z.boolean(),
      /** The running server has this provider mounted. */
      active: z.boolean(),
      /** Where to register the webhook; null until a BlueBubbles token exists. */
      webhookUrl: z.string().nullable(),
    }),
  ),
});
export type MessagingSetupState = z.infer<typeof MessagingSetupStateSchema>;

export const MessagingSetupTestResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

/** True for loopback, LAN, tailnet and single-label or `.local`-style names (not reachable from the internet). */
export function isPrivateServerUrl(value: string): boolean {
  let host: string;
  try {
    host = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return true;
  }
  const v4 = host.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254)
    );
  }
  if (host.includes(":")) return host === "::1" || /^(f[cd]|fe[89ab])/.test(host);
  return (
    !host.includes(".") ||
    /\.(local|lan|internal|ts\.net|home\.arpa)$/.test(host) ||
    host === "localhost"
  );
}
