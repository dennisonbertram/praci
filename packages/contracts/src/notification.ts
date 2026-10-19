import * as z from "zod";

export const NotificationImportanceSchema = z.enum(["info", "attention"]);

/** Sidebar status kinds, highest priority first. */
export const NOTIFICATION_KINDS = ["urgent", "needs_input", "failed", "done", "new"] as const;
export const NotificationKindSchema = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

/** The kind of a stored notification; rows from before kinds existed fall back to importance. */
export const notificationKindOf = (n: {
  kind?: string | null;
  importance: "info" | "attention";
}): NotificationKind => {
  const parsed = NotificationKindSchema.safeParse(n.kind);
  return parsed.success ? parsed.data : n.importance === "attention" ? "urgent" : "new";
};

/** What a realtime frame carries; clients fetch the notification by listing since. */
export const NotificationSignalSchema = z.object({
  id: z.string(),
  surface: z.string(),
  importance: NotificationImportanceSchema,
});
export type NotificationSignal = z.infer<typeof NotificationSignalSchema>;

/** Frame ids that are not notifications: the client should call notifications.list to catch up. */
export const NOTIFICATION_CATCH_UP_ID = "catch-up";
export const NOTIFICATION_HEARTBEAT_ID = "heartbeat";

export const NotificationSchema = z.object({
  id: z.string(),
  botId: z.string().nullable(),
  surface: z.string(),
  threadId: z.string().nullable(),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  importance: NotificationImportanceSchema,
  createdAt: z.string(),
  seenAt: z.string().nullable(),
  shownAt: z.string().nullable(),
});
export type NotificationDto = z.infer<typeof NotificationSchema>;
