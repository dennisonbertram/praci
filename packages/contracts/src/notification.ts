import * as z from "zod";

export const NotificationImportanceSchema = z.enum(["info", "attention"]);

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
