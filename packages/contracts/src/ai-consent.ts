import * as z from "zod";

export const AI_DISCLOSURE_VERSION = "2026-09-14";
export const AI_PRIVACY_URL =
  "https://github.com/dennisonbertram/rakazo/blob/main/docs/ai-data-sharing-review.md";
export const AiDataUseSchema = z.enum(["model", "voice", "memory"]);
export type AiDataUse = z.infer<typeof AiDataUseSchema>;
export const AI_DATA_DISCLOSURES: Record<AiDataUse, string> = {
  model:
    "Messages, chat history, bot instructions, memories, attachments, screenshots and connected-app content are sent to run your bots, including routines.",
  voice:
    "Your recordings are sent for transcription, and text you play is sent to generate speech.",
  memory:
    "Conversation summaries, memories, searches and bot and Space IDs are sent to store and recall context.",
};
/** "vendor/gpt-6-luna, forwarded to its provider" -> "GPT-6 Luna". */
export const modelLabel = (detail: string) =>
  (detail.split(",")[0]?.split("/").pop() ?? "")
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => (/^gpt$/i.test(word) ? "GPT" : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ")
    .replace(/^GPT (?=\d)/, "GPT-");
export const AiConsentQuerySchema = z
  .object({
    botId: z.string().optional(),
    groupId: z.string().optional(),
    routineId: z.string().optional(),
    uses: z.array(AiDataUseSchema).optional(),
  })
  .default({});
export type AiConsentQuery = z.infer<typeof AiConsentQuerySchema>;
export const AiRecipientSchema = z.object({
  key: z.string(),
  name: z.string(),
  use: AiDataUseSchema,
  detail: z.string(),
  privacyUrl: z.string().url().optional(),
  allowed: z.boolean(),
});
export type AiRecipient = z.infer<typeof AiRecipientSchema>;
export const AiConsentStatusSchema = z.object({
  scope: z.string(),
  version: z.string(),
  recipients: z.array(AiRecipientSchema),
  privacyUrl: z.string().url().optional(),
});
export type AiConsentStatus = z.infer<typeof AiConsentStatusSchema>;
export const AI_CONSENT_REQUIRED = "Review AI data sharing in Account settings before continuing.";
/** The ExternalEffect kind of an inline AI data sharing request; its request holds the recipient key. */
export const AI_CONSENT_EFFECT_KIND = "ai_consent";
